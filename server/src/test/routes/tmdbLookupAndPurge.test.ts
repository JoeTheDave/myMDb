import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app } from '../../index'
import { createUser, makeToken, createMedia, createActor, createCastRole } from '../helpers'

// Mock axios so tests don't hit real TMDB APIs
vi.mock('axios')
import axios from 'axios'
const mockAxiosGet = vi.mocked(axios.get)

// Mock S3 uploadBufferToS3 to avoid hitting AWS in tests
vi.mock('../../lib/s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/s3')>()
  return {
    ...actual,
    uploadBufferToS3: vi
      .fn()
      .mockResolvedValue(
        'https://mock-bucket.s3.us-east-1.amazonaws.com/imports/mock-poster.jpg',
      ),
  }
})

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

// ─── TMDB search/movie response helpers ────────────────────────────────────

function makeTmdbSearchMovieResponse(
  results: Array<{ id: number; poster_path?: string | null; release_date?: string }>,
) {
  return { data: { results } }
}

function makeTmdbMovieDetailResponse(overrides: {
  imdb_id?: string | null
  release_date?: string
  release_dates?: { results?: Array<{ iso_3166_1: string; release_dates: Array<{ type: number; certification: string }> }> }
}) {
  return {
    data: {
      imdb_id: overrides.imdb_id ?? null,
      release_date: overrides.release_date ?? '2023-06-15',
      release_dates: overrides.release_dates ?? { results: [] },
    },
  }
}

function makeImageResponse() {
  return { data: Buffer.from('fake-image-data'), headers: { 'content-type': 'image/jpeg' } }
}

// ─── GET /api/media/tmdb-lookup ─────────────────────────────────────────────

describe('GET /api/media/tmdb-lookup', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset()
  })

  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).get('/api/media/tmdb-lookup').query({ title: 'Inception' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .get('/api/media/tmdb-lookup')
      .query({ title: 'Inception' })
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 400 when title query param is missing', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .get('/api/media/tmdb-lookup')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/title/i)
  })

  it('returns 404 when TMDB returns no results for the title', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    // Search call returns empty results
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse([]))
    const res = await request(app)
      .get('/api/media/tmdb-lookup')
      .query({ title: 'ZzZzZzNotARealMovieXxXx' })
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('returns releaseYear, contentRating, imageUrl, imdbId on happy path', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    // Call 1: search/movie
    mockAxiosGet.mockResolvedValueOnce(
      makeTmdbSearchMovieResponse([
        { id: 27205, poster_path: '/poster.jpg', release_date: '2010-07-16' },
      ]),
    )
    // Call 2: movie detail with US certification
    mockAxiosGet.mockResolvedValueOnce(
      makeTmdbMovieDetailResponse({
        imdb_id: 'tt1375666',
        release_date: '2010-07-16',
        release_dates: {
          results: [
            {
              iso_3166_1: 'US',
              release_dates: [{ type: 3, certification: 'PG-13' }],
            },
          ],
        },
      }),
    )
    // Call 3: image download
    mockAxiosGet.mockResolvedValueOnce(makeImageResponse())

    const res = await request(app)
      .get('/api/media/tmdb-lookup')
      .query({ title: 'Inception', year: '2010' })
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.releaseYear).toBe(2010)
    expect(res.body.contentRating).toBe('PG_13')
    expect(res.body.imdbId).toBe('tt1375666')
    expect(typeof res.body.imageUrl).toBe('string')
    expect(res.body.imageUrl).toContain('mock-bucket.s3')
  })

  it('returns null fields when TMDB detail fetch fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    // Call 1: search/movie — returns a result with a release_date
    mockAxiosGet.mockResolvedValueOnce(
      makeTmdbSearchMovieResponse([
        { id: 27205, poster_path: null, release_date: '2010-07-16' },
      ]),
    )
    // Call 2: movie detail throws
    mockAxiosGet.mockRejectedValueOnce(new Error('TMDB detail unavailable'))

    const res = await request(app)
      .get('/api/media/tmdb-lookup')
      .query({ title: 'Inception' })
      .set('Cookie', `token=${token}`)

    // Still returns 200 with partial data (detail failure is non-fatal)
    expect(res.status).toBe(200)
    expect(res.body.imageUrl).toBeNull()
    expect(res.body.imdbId).toBeNull()
    expect(res.body.contentRating).toBeNull()
    // releaseYear is extracted from search result release_date
    expect(res.body.releaseYear).toBe(2010)
  })

  it('returns all null fields when no poster and detail returns no imdb_id or certification', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    mockAxiosGet.mockResolvedValueOnce(
      makeTmdbSearchMovieResponse([{ id: 99999, poster_path: null }]),
    )
    mockAxiosGet.mockResolvedValueOnce(
      makeTmdbMovieDetailResponse({ imdb_id: null, release_dates: { results: [] } }),
    )

    const res = await request(app)
      .get('/api/media/tmdb-lookup')
      .query({ title: 'Some Movie' })
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      imageUrl: null,
      imdbId: null,
      contentRating: null,
    })
  })

  it('is accessible by ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)

    mockAxiosGet.mockResolvedValueOnce(
      makeTmdbSearchMovieResponse([{ id: 1, poster_path: null }]),
    )
    mockAxiosGet.mockResolvedValueOnce(makeTmdbMovieDetailResponse({}))

    const res = await request(app)
      .get('/api/media/tmdb-lookup')
      .query({ title: 'Any Movie' })
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
  })
})

// ─── POST /api/media/:id/cast/purge-no-image ────────────────────────────────

describe('POST /api/media/:id/cast/purge-no-image', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).post('/api/media/some-id/cast/purge-no-image')
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/purge-no-image`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 for a non-existent mediaId', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/media/00000000-0000-0000-0000-000000000000/cast/purge-no-image')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('deletes only cast roles with null roleImageUrl and returns correct count', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const actor1 = await createActor({ name: 'Actor With Image' })
    const actor2 = await createActor({ name: 'Actor Without Image 1' })
    const actor3 = await createActor({ name: 'Actor Without Image 2' })

    // One role WITH an image
    await createCastRole(media.id, actor1.id, {
      roleImageUrl: 'https://example.com/image.jpg',
      billingOrder: 1,
    })
    // Two roles WITHOUT an image
    await createCastRole(media.id, actor2.id, { roleImageUrl: null, billingOrder: 2 })
    await createCastRole(media.id, actor3.id, { roleImageUrl: null, billingOrder: 3 })

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/purge-no-image`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(2)

    // Verify database state: only the role with an image remains
    const remaining = await prisma.castRole.findMany({ where: { mediaId: media.id } })
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.actorId).toBe(actor1.id)
  })

  it('returns { deleted: 0 } when all cast roles have images', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const actor1 = await createActor({ name: 'Actor A' })
    const actor2 = await createActor({ name: 'Actor B' })

    await createCastRole(media.id, actor1.id, {
      roleImageUrl: 'https://example.com/a.jpg',
      billingOrder: 1,
    })
    await createCastRole(media.id, actor2.id, {
      roleImageUrl: 'https://example.com/b.jpg',
      billingOrder: 2,
    })

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/purge-no-image`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(0)

    // Verify nothing was deleted
    const remaining = await prisma.castRole.findMany({ where: { mediaId: media.id } })
    expect(remaining).toHaveLength(2)
  })

  it('returns { deleted: 0 } for a media with no cast roles at all', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/purge-no-image`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(0)
  })

  it('is accessible by ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia()

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/purge-no-image`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(0)
  })

  it('only purges cast roles for the target media, not other media', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    const media1 = await createMedia({ title: 'Media 1' })
    const media2 = await createMedia({ title: 'Media 2' })
    const actor1 = await createActor({ name: 'Actor 1' })
    const actor2 = await createActor({ name: 'Actor 2' })

    // media1: one role with no image
    await createCastRole(media1.id, actor1.id, { roleImageUrl: null })
    // media2: one role with no image (should NOT be touched)
    await createCastRole(media2.id, actor2.id, { roleImageUrl: null })

    const res = await request(app)
      .post(`/api/media/${media1.id}/cast/purge-no-image`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(1)

    // media2's cast role must still exist
    const media2Roles = await prisma.castRole.findMany({ where: { mediaId: media2.id } })
    expect(media2Roles).toHaveLength(1)
  })
})
