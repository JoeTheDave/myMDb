import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app } from '../../index'
import { createUser, makeToken, createMedia } from '../helpers'

// Mock axios so tests don't hit real external APIs
vi.mock('axios')
import axios from 'axios'
const mockAxiosGet = vi.mocked(axios.get)

// Mock S3 uploadBufferToS3 to avoid hitting AWS in tests
vi.mock('../../lib/s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/s3')>()
  return {
    ...actual,
    uploadBufferToS3: vi.fn().mockResolvedValue('https://mock-bucket.s3.us-east-1.amazonaws.com/imports/mock-uuid-actor-profile.jpg'),
  }
})

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

// TMDb /find response for a MOVIE
function makeTmdbFindMovieResponse(tmdbId: number) {
  return { data: { movie_results: [{ id: tmdbId }], tv_results: [] } }
}

// TMDb /find response with no results
function makeTmdbFindEmptyResponse() {
  return { data: { movie_results: [], tv_results: [] } }
}

// TMDb /credits response with cast (includes TMDb person id and profile_path)
function makeTmdbCreditsResponse(
  cast: Array<{ id?: number; name: string; character: string; profile_path?: string | null }>,
) {
  return {
    data: {
      cast: cast.map((m, i) => ({
        id: m.id ?? 1000 + i,
        name: m.name,
        character: m.character,
        profile_path: m.profile_path ?? null,
      })),
    },
  }
}

// TMDb /credits response with empty cast
function makeTmdbCreditsEmptyResponse() {
  return { data: { cast: [] } }
}

// TMDb /person response
function makeTmdbPersonResponse(birthday: string | null, deathday: string | null) {
  return { data: { birthday, deathday } }
}

// Fake image arraybuffer response
function makeImageResponse() {
  return { data: Buffer.from('fake-image-data'), headers: { 'content-type': 'image/jpeg' } }
}

// TMDb /videos response
function makeTmdbVideosResponse(videos: Array<{ site: string; type: string; key: string }>) {
  return { data: { results: videos } }
}

// TMDb /watch/providers response
function makeTmdbProvidersResponse(usRegion: { link?: string; flatrate?: unknown[]; rent?: unknown[]; buy?: unknown[] } | null) {
  return { data: { results: usRegion ? { US: usRegion } : {} } }
}

// TMDb /search/movie response
function makeTmdbSearchMovieResponse(tmdbId: number) {
  return { data: { results: [{ id: tmdbId }] } }
}

describe('POST /api/media/:id/cast/import', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset()
  })

  it('returns 401 when no auth is provided', async () => {
    const res = await request(app)
      .post('/api/media/some-id/cast/import')
      .send({ imdbId: 'tt1234567' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt1234567' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when imdbId is missing', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/imdbId/i)
  })

  it('returns 400 when imdbId has invalid format (no tt prefix)', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: '1234567' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/imdbId/i)
  })

  it('returns 400 when imdbId has letters after tt prefix', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'ttABCDEF' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when media does not exist', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/media/00000000-0000-0000-0000-000000000000/cast/import')
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt1234567' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('returns 422 when TMDb /find returns no results for the IMDB ID', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindEmptyResponse())
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt9999999' })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/TMDb/i)
  })

  it('returns 422 when TMDb /find request fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    mockAxiosGet.mockRejectedValueOnce(new Error('Network error'))
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt9999999' })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/TMDb/i)
  })

  it('returns 422 when TMDb credits returns an empty cast array', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    // Call 1: /find → tmdbId
    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(12345))
    // Call 2: /credits → empty cast
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsEmptyResponse())
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt9999999' })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/cast data/i)
  })

  it('imports cast with character names and returns summary on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Test Film' })
    // Call 1: /find → tmdbId
    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(12345))
    // Call 2: /credits → cast with character names
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsResponse([
      { id: 1001, name: 'Jane Smith', character: 'Hero', profile_path: null },
      { id: 1002, name: 'Bob Jones', character: 'Villain', profile_path: null },
    ]))
    // Enrichment calls for each new actor (person endpoint — no profile_path so no image download)
    mockAxiosGet.mockResolvedValueOnce(makeTmdbPersonResponse('1980-01-01', null))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbPersonResponse('1975-06-15', null))

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt1234567' })

    expect(res.status).toBe(200)
    expect(typeof res.body.imported).toBe('number')
    expect(typeof res.body.skipped).toBe('number')
    expect(typeof res.body.created).toBe('number')
    expect(typeof res.body.matched).toBe('number')
    expect(res.body.imported).toBe(2)
    expect(res.body.created).toBe(2)
  })

  it('enriches newly created actors with birthday, deathday, and profile image', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'The Matrix' })

    // Call 1: /find → tmdbId
    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(603))
    // Call 2: /credits → cast with profile_path
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsResponse([
      { id: 6384, name: 'Keanu Reeves', character: 'Neo', profile_path: '/43hoCX4R9rZmoh5rnDF9OI6NVez.jpg' },
    ]))
    // Enrichment: person details
    mockAxiosGet.mockResolvedValueOnce(makeTmdbPersonResponse('1964-09-02', null))
    // Enrichment: image download
    mockAxiosGet.mockResolvedValueOnce(makeImageResponse())

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt0133093' })

    expect(res.status).toBe(200)
    expect(res.body.created).toBe(1)

    const actor = await prisma.actor.findFirst({ where: { name: 'Keanu Reeves' } })
    expect(actor).not.toBeNull()
    expect(actor?.birthday).not.toBeNull()
    expect(actor?.deathDay).toBeNull()
    expect(actor?.imageUrl).toContain('amazonaws.com')
  })

  it('enriches actor with deathday when TMDb person has a death date', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'The Matrix' })

    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(603))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsResponse([
      { id: 9999, name: 'Gloria Foster', character: 'Oracle', profile_path: null },
    ]))
    // Enrichment: person with death date
    mockAxiosGet.mockResolvedValueOnce(makeTmdbPersonResponse('1933-11-15', '2001-09-02'))

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt0133093' })

    expect(res.status).toBe(200)
    expect(res.body.created).toBe(1)

    const actor = await prisma.actor.findFirst({ where: { name: 'Gloria Foster' } })
    expect(actor?.deathDay).not.toBeNull()
  })

  it('creates actor successfully even when TMDb person endpoint fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Some Movie' })

    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(12345))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsResponse([
      { id: 5555, name: 'Unknown Actor', character: 'Sidekick', profile_path: null },
    ]))
    // Person endpoint fails
    mockAxiosGet.mockRejectedValueOnce(new Error('TMDb person API error'))

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt5555555' })

    expect(res.status).toBe(200)
    // Actor is still created — enrichment failure must not increment skipped
    expect(res.body.created).toBe(1)
    expect(res.body.skipped).toBe(0)

    const actor = await prisma.actor.findFirst({ where: { name: 'Unknown Actor' } })
    expect(actor).not.toBeNull()
    expect(actor?.birthday).toBeNull()
    expect(actor?.imageUrl).toBeNull()
  })

  it('creates actor with null imageUrl when profile image download fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Another Movie' })

    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(77777))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsResponse([
      { id: 4444, name: 'Image Fail Actor', character: 'Lead', profile_path: '/some-path.jpg' },
    ]))
    // Person succeeds
    mockAxiosGet.mockResolvedValueOnce(makeTmdbPersonResponse('1990-03-20', null))
    // Image download fails
    mockAxiosGet.mockRejectedValueOnce(new Error('Image download error'))

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt7777777' })

    expect(res.status).toBe(200)
    expect(res.body.created).toBe(1)
    expect(res.body.skipped).toBe(0)

    const actor = await prisma.actor.findFirst({ where: { name: 'Image Fail Actor' } })
    expect(actor).not.toBeNull()
    // birthday set from person data, imageUrl null
    expect(actor?.birthday).not.toBeNull()
    expect(actor?.imageUrl).toBeNull()
  })

  it('sets characterName to null when TMDb character is empty string', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'No Char Film' })
    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(99999))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsResponse([
      { id: 3333, name: 'No Char Actor', character: '', profile_path: null },
    ]))
    // Enrichment
    mockAxiosGet.mockResolvedValueOnce(makeTmdbPersonResponse(null, null))

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt5555555' })

    expect(res.status).toBe(200)
    expect(res.body.created).toBe(1)

    const actor = await prisma.actor.findFirst({ where: { name: 'No Char Actor' } })
    expect(actor).not.toBeNull()
    const castRole = await prisma.castRole.findFirst({ where: { mediaId: media.id, actorId: actor!.id } })
    expect(castRole?.characterName).toBeNull()
  })

  it('matches existing actors instead of creating duplicates', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    // Pre-create an actor with the same name
    const existingActor = await prisma.actor.create({ data: { name: 'Jane Smith' } })

    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(12345))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsResponse([
      { id: 2222, name: 'Jane Smith', character: 'Hero', profile_path: null },
    ]))
    // No enrichment calls for matched actors

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt1234567' })

    expect(res.status).toBe(200)
    expect(res.body.matched).toBe(1)
    expect(res.body.created).toBe(0)

    // Verify the cast role links to the existing actor, not a new one
    const castRole = await prisma.castRole.findFirst({ where: { mediaId: media.id } })
    expect(castRole?.actorId).toBe(existingActor.id)
  })

  it('skips duplicate cast roles for actors already linked to this media', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const existingActor = await prisma.actor.create({ data: { name: 'Jane Smith' } })
    await prisma.castRole.create({
      data: { mediaId: media.id, actorId: existingActor.id, characterName: 'Hero' },
    })

    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(12345))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsResponse([
      { id: 2222, name: 'Jane Smith', character: 'Hero', profile_path: null },
    ]))

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt1234567' })

    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe(1)
    expect(res.body.imported).toBe(0)
  })

  it('persists new actors and cast roles with character names to the database', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    mockAxiosGet.mockResolvedValueOnce(makeTmdbFindMovieResponse(12345))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbCreditsResponse([
      { id: 8888, name: 'Unique Actor Name', character: 'The Lead', profile_path: null },
    ]))
    // Enrichment
    mockAxiosGet.mockResolvedValueOnce(makeTmdbPersonResponse(null, null))

    await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt1234567' })

    const actor = await prisma.actor.findFirst({ where: { name: 'Unique Actor Name' } })
    expect(actor).not.toBeNull()

    const castRole = await prisma.castRole.findFirst({ where: { mediaId: media.id, actorId: actor!.id } })
    expect(castRole).not.toBeNull()
    expect(castRole?.characterName).toBe('The Lead')
  })
})

describe('POST /api/media/:id/amazon-lookup', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset()
  })

  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).post('/api/media/some-id/amazon-lookup')
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()
    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 when media does not exist', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/media/00000000-0000-0000-0000-000000000000/amazon-lookup')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('returns 422 when TMDb search fails to find the title', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Unknown Film' })
    // TMDb search returns no results
    mockAxiosGet.mockResolvedValueOnce({ data: { results: [] } })
    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(422)
  })

  it('returns 500 when TMDb watch/providers request fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    // TMDb search succeeds
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(12345))
    // providers request fails
    mockAxiosGet.mockRejectedValueOnce(new Error('Network error'))
    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(500)
  })

  it('returns amazonPrimeUrl: null and message when not available in the US', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Obscure Film' })
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(12345))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbProvidersResponse(null))

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBeNull()
    expect(res.body.message).toBeDefined()
  })

  it('returns amazonPrimeUrl: null when US region exists but has no streaming entries', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'No Stream Film' })
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(12345))
    // US exists but no flatrate/rent/buy
    mockAxiosGet.mockResolvedValueOnce(makeTmdbProvidersResponse({ link: 'https://www.justwatch.com/us/movie/test' }))

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBeNull()
  })

  it('extracts Amazon ASIN from JustWatch HTML and returns gp/video/detail URL on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Inception' })
    const justWatchUrl = 'https://www.justwatch.com/us/movie/inception'
    const fakeHtml = `<html><body><a href="https://www.amazon.com/dp/B003ZSPK7M?tag=justwatch09-20">Buy on Amazon</a></body></html>`
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(27205))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbProvidersResponse({
      link: justWatchUrl,
      flatrate: [{ provider_id: 9, provider_name: 'Amazon Prime Video' }],
    }))
    mockAxiosGet.mockResolvedValueOnce({ data: fakeHtml })

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBe('https://www.amazon.com/gp/video/detail/B003ZSPK7M')

    const updated = await prisma.media.findUnique({ where: { id: media.id }, select: { amazonPrimeUrl: true } })
    expect(updated?.amazonPrimeUrl).toBe('https://www.amazon.com/gp/video/detail/B003ZSPK7M')
  })

  it('falls back to JustWatch URL when JustWatch page fetch fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Inception' })
    const justWatchUrl = 'https://www.justwatch.com/us/movie/inception'
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(27205))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbProvidersResponse({
      link: justWatchUrl,
      flatrate: [{ provider_id: 9, provider_name: 'Amazon Prime Video' }],
    }))
    mockAxiosGet.mockRejectedValueOnce(new Error('JustWatch fetch failed'))

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBe(justWatchUrl)
  })

  it('falls back to JustWatch URL when no ASIN found in JustWatch HTML', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Inception' })
    const justWatchUrl = 'https://www.justwatch.com/us/movie/inception'
    const fakeHtml = `<html><body><p>No amazon links here</p></body></html>`
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(27205))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbProvidersResponse({
      link: justWatchUrl,
      flatrate: [{ provider_id: 9, provider_name: 'Amazon Prime Video' }],
    }))
    mockAxiosGet.mockResolvedValueOnce({ data: fakeHtml })

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBe(justWatchUrl)
  })

  it('works for ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia({ title: 'The Matrix' })
    const fakeHtml = `<html><body><a href="https://www.amazon.com/dp/B07CF6WRWM?tag=justwatch09-20">Buy</a></body></html>`
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(603))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbProvidersResponse({
      link: 'https://www.justwatch.com/us/movie/the-matrix',
      buy: [{ provider_id: 3, provider_name: 'Google Play Movies' }],
    }))
    mockAxiosGet.mockResolvedValueOnce({ data: fakeHtml })

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBe('https://www.amazon.com/gp/video/detail/B07CF6WRWM')
  })
})

describe('PATCH /api/media/:id/amazon-prime-url', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app)
      .patch('/api/media/some-id/amazon-prime-url')
      .send({ amazonPrimeUrl: 'https://www.amazon.com/dp/B001234567' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()
    const res = await request(app)
      .patch(`/api/media/${media.id}/amazon-prime-url`)
      .set('Cookie', `token=${token}`)
      .send({ amazonPrimeUrl: 'https://www.amazon.com/dp/B001234567' })
    expect(res.status).toBe(403)
  })

  it('returns 404 when media does not exist', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .patch('/api/media/00000000-0000-0000-0000-000000000000/amazon-prime-url')
      .set('Cookie', `token=${token}`)
      .send({ amazonPrimeUrl: 'https://www.amazon.com/dp/B001234567' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('saves the URL and returns the updated record on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'The Godfather' })
    const url = 'https://www.amazon.com/dp/B001ABCDEF'

    const res = await request(app)
      .patch(`/api/media/${media.id}/amazon-prime-url`)
      .set('Cookie', `token=${token}`)
      .send({ amazonPrimeUrl: url })

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(media.id)
    expect(res.body.amazonPrimeUrl).toBe(url)
  })

  it('saves the URL and returns the updated record on happy path for ADMIN', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia({ title: 'Pulp Fiction' })
    const url = 'https://www.amazon.com/dp/B009ZZZZZZ'

    const res = await request(app)
      .patch(`/api/media/${media.id}/amazon-prime-url`)
      .set('Cookie', `token=${token}`)
      .send({ amazonPrimeUrl: url })

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBe(url)
  })

  it('persists the URL to the database', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const url = 'https://www.amazon.com/dp/B00PERSIST1'

    await request(app)
      .patch(`/api/media/${media.id}/amazon-prime-url`)
      .set('Cookie', `token=${token}`)
      .send({ amazonPrimeUrl: url })

    const updated = await prisma.media.findUnique({
      where: { id: media.id },
      select: { amazonPrimeUrl: true },
    })
    expect(updated?.amazonPrimeUrl).toBe(url)
  })

  it('clears the URL when null is sent', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    // Pre-set a URL via Prisma directly
    const media = await prisma.media.create({
      data: {
        title: 'Already Has URL',
        mediaType: 'MOVIE',
        amazonPrimeUrl: 'https://www.amazon.com/dp/B00EXISTING',
      },
    })

    const res = await request(app)
      .patch(`/api/media/${media.id}/amazon-prime-url`)
      .set('Cookie', `token=${token}`)
      .send({ amazonPrimeUrl: null })

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBeNull()

    const updated = await prisma.media.findUnique({
      where: { id: media.id },
      select: { amazonPrimeUrl: true },
    })
    expect(updated?.amazonPrimeUrl).toBeNull()
  })

  it('replaces an existing URL when a new one is provided', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const oldUrl = 'https://www.amazon.com/dp/B00OLD12345'
    const newUrl = 'https://www.amazon.com/dp/B00NEW67890'

    const media = await prisma.media.create({
      data: { title: 'Replace URL Film', mediaType: 'MOVIE', amazonPrimeUrl: oldUrl },
    })

    const res = await request(app)
      .patch(`/api/media/${media.id}/amazon-prime-url`)
      .set('Cookie', `token=${token}`)
      .send({ amazonPrimeUrl: newUrl })

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBe(newUrl)
  })
})

describe('POST /api/media/:id/trailer-lookup', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset()
  })

  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).post('/api/media/some-id/trailer-lookup')
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()
    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 when media does not exist', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/media/00000000-0000-0000-0000-000000000000/trailer-lookup')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('returns 422 when TMDb search fails to find the title', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Unknown Film' })
    mockAxiosGet.mockResolvedValueOnce({ data: { results: [] } })
    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(422)
  })

  it('returns 500 when TMDb videos request fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(12345))
    mockAxiosGet.mockRejectedValueOnce(new Error('Network error'))
    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(500)
  })

  it('returns trailerUrl: null and message when no YouTube Trailer found', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Obscure Film' })
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(12345))
    // videos returns results but none are YouTube Trailers
    mockAxiosGet.mockResolvedValueOnce(makeTmdbVideosResponse([
      { site: 'YouTube', type: 'Teaser', key: 'abc123' },
      { site: 'Vimeo', type: 'Trailer', key: 'xyz789' },
    ]))

    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trailerUrl).toBeNull()
    expect(res.body.message).toBeDefined()
  })

  it('returns trailerUrl: null when TMDb returns empty results', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'No Trailer Film' })
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(12345))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbVideosResponse([]))

    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trailerUrl).toBeNull()
  })

  it('returns the found trailer URL and saves it to the database on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Inception' })
    const videoKey = 'YoHD9XEInc0'
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(27205))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbVideosResponse([
      { site: 'YouTube', type: 'Trailer', key: videoKey },
    ]))

    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trailerUrl).toBe(`https://www.youtube.com/watch?v=${videoKey}`)

    const updated = await prisma.media.findUnique({ where: { id: media.id }, select: { trailerUrl: true } })
    expect(updated?.trailerUrl).toBe(`https://www.youtube.com/watch?v=${videoKey}`)
  })

  it('works for ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia({ title: 'The Dark Knight' })
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(155))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbVideosResponse([
      { site: 'YouTube', type: 'Trailer', key: 'EXeTwQWrcwY' },
    ]))

    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trailerUrl).toContain('youtube.com')
  })

  it('persists the trailer URL to the database', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const videoKey = 'ABC1234DEF5'
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(12345))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbVideosResponse([
      { site: 'YouTube', type: 'Trailer', key: videoKey },
    ]))

    await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    const updated = await prisma.media.findUnique({
      where: { id: media.id },
      select: { trailerUrl: true },
    })
    expect(updated?.trailerUrl).toBe(`https://www.youtube.com/watch?v=${videoKey}`)
  })

  it('takes the first YouTube Trailer when multiple results exist', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Multi Result Film' })
    const firstKey = 'dQw4w9WgXcQ'
    const secondKey = 'oHg5SJYRHA0'
    mockAxiosGet.mockResolvedValueOnce(makeTmdbSearchMovieResponse(99999))
    mockAxiosGet.mockResolvedValueOnce(makeTmdbVideosResponse([
      { site: 'YouTube', type: 'Trailer', key: firstKey },
      { site: 'YouTube', type: 'Trailer', key: secondKey },
    ]))

    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trailerUrl).toBe(`https://www.youtube.com/watch?v=${firstKey}`)
  })
})
