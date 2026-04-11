import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app } from '../../index'
import { createUser, makeToken, createMedia } from '../helpers'

// Mock axios so tests don't hit real external APIs (IMDB, DuckDuckGo)
vi.mock('axios')
import axios from 'axios'
const mockAxiosGet = vi.mocked(axios.get)

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

// Minimal IMDB full-credits HTML with a cast table
function makeImdbHtml(actors: Array<{ name: string; character: string }>) {
  const rows = actors
    .map(
      ({ name, character }) => `
    <tr>
      <td class="primary_photo"><a href="/name/nm001/"><img /></a></td>
      <td><a href="/name/nm001/">${name}</a></td>
      <td class="character">${character}</td>
    </tr>`,
    )
    .join('\n')

  return `<html><body><table class="cast_list">${rows}</table></body></html>`
}

// Minimal DuckDuckGo HTML with an Amazon Prime link
function makeAmazonDDGHtml(amazonUrl: string) {
  return `<html><body><a href="${amazonUrl}">Watch on Amazon</a></body></html>`
}

// Minimal DuckDuckGo HTML with a YouTube link
function makeYoutubeDDGHtml(videoId: string) {
  return `<html><body><a href="https://www.youtube.com/watch?v=${videoId}">Trailer</a></body></html>`
}

// HTML with no useful links
const EMPTY_HTML = '<html><body><p>No results.</p></body></html>'

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

  it('returns 422 when axios fails to fetch IMDB page', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    mockAxiosGet.mockRejectedValueOnce(new Error('Network error'))
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt9999999' })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/IMDB/i)
  })

  it('returns 422 when the IMDB page has no cast table', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    mockAxiosGet.mockResolvedValueOnce({ data: EMPTY_HTML })
    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt9999999' })
    expect(res.status).toBe(422)
  })

  it('imports cast and returns summary on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Test Film' })
    const html = makeImdbHtml([
      { name: 'Jane Smith', character: 'Hero' },
      { name: 'Bob Jones', character: 'Villain' },
    ])
    mockAxiosGet.mockResolvedValueOnce({ data: html })

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

  it('imports cast and returns summary on happy path for ADMIN', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia({ title: 'Admin Film' })
    const html = makeImdbHtml([{ name: 'Alice Walker', character: 'Protagonist' }])
    mockAxiosGet.mockResolvedValueOnce({ data: html })

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt7654321' })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)
  })

  it('matches existing actors instead of creating duplicates', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    // Pre-create an actor with the same name
    const existingActor = await prisma.actor.create({ data: { name: 'Jane Smith' } })

    const html = makeImdbHtml([{ name: 'Jane Smith', character: 'Hero' }])
    mockAxiosGet.mockResolvedValueOnce({ data: html })

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

    const html = makeImdbHtml([{ name: 'Jane Smith', character: 'Hero' }])
    mockAxiosGet.mockResolvedValueOnce({ data: html })

    const res = await request(app)
      .post(`/api/media/${media.id}/cast/import`)
      .set('Cookie', `token=${token}`)
      .send({ imdbId: 'tt1234567' })

    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe(1)
    expect(res.body.imported).toBe(0)
  })

  it('persists new actors and cast roles to the database', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const html = makeImdbHtml([{ name: 'Unique Actor Name', character: 'The Lead' }])
    mockAxiosGet.mockResolvedValueOnce({ data: html })

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

  it('returns 500 when DuckDuckGo request fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    mockAxiosGet.mockRejectedValueOnce(new Error('Network error'))
    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(500)
  })

  it('returns amazonPrimeUrl: null and message when no Amazon link is found', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Obscure Film' })
    mockAxiosGet.mockResolvedValueOnce({ data: EMPTY_HTML })

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toBeNull()
    expect(res.body.message).toBeDefined()
  })

  it('returns the found URL and saves it to the database on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Inception' })
    const amazonUrl = 'https://www.amazon.com/gp/video/detail/B003EYVXV4'
    mockAxiosGet.mockResolvedValueOnce({ data: makeAmazonDDGHtml(amazonUrl) })

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).toContain('amazon.com')

    const updated = await prisma.media.findUnique({ where: { id: media.id }, select: { amazonPrimeUrl: true } })
    expect(updated?.amazonPrimeUrl).toContain('amazon.com')
  })

  it('works for ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia({ title: 'The Matrix' })
    const amazonUrl = 'https://www.amazon.com/dp/B001234567'
    mockAxiosGet.mockResolvedValueOnce({ data: makeAmazonDDGHtml(amazonUrl) })

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).not.toBeNull()
  })

  it('strips tracking query params from the found Amazon URL', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Dune' })
    const dirtyUrl = 'https://www.amazon.com/dp/B001234567?ref=some-tracking&tag=foo&pf_rd=bar'
    mockAxiosGet.mockResolvedValueOnce({ data: makeAmazonDDGHtml(dirtyUrl) })

    const res = await request(app)
      .post(`/api/media/${media.id}/amazon-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.amazonPrimeUrl).not.toContain('ref=')
    expect(res.body.amazonPrimeUrl).not.toContain('tag=')
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

  it('returns 500 when DuckDuckGo request fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    mockAxiosGet.mockRejectedValueOnce(new Error('Network error'))
    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(500)
  })

  it('returns trailerUrl: null and message when no YouTube link is found', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Obscure Film' })
    mockAxiosGet.mockResolvedValueOnce({ data: EMPTY_HTML })

    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trailerUrl).toBeNull()
    expect(res.body.message).toBeDefined()
  })

  it('returns the found trailer URL and saves it to the database on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Inception' })
    const videoId = 'YoHD9XEInc0'
    mockAxiosGet.mockResolvedValueOnce({ data: makeYoutubeDDGHtml(videoId) })

    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trailerUrl).toBe(`https://www.youtube.com/watch?v=${videoId}`)

    const updated = await prisma.media.findUnique({ where: { id: media.id }, select: { trailerUrl: true } })
    expect(updated?.trailerUrl).toBe(`https://www.youtube.com/watch?v=${videoId}`)
  })

  it('works for ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia({ title: 'The Dark Knight' })
    const videoId = 'EXeTwQWrcwY'
    mockAxiosGet.mockResolvedValueOnce({ data: makeYoutubeDDGHtml(videoId) })

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
    const videoId = 'ABC1234DEF5'
    mockAxiosGet.mockResolvedValueOnce({ data: makeYoutubeDDGHtml(videoId) })

    await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    const updated = await prisma.media.findUnique({
      where: { id: media.id },
      select: { trailerUrl: true },
    })
    expect(updated?.trailerUrl).toBe(`https://www.youtube.com/watch?v=${videoId}`)
  })

  it('normalises youtu.be short links into full youtube.com watch URLs', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Short Link Film' })
    const videoId = 'dQw4w9WgXcw'
    const shortLinkHtml = `<html><body><a href="https://youtu.be/${videoId}">Trailer</a></body></html>`
    mockAxiosGet.mockResolvedValueOnce({ data: shortLinkHtml })

    const res = await request(app)
      .post(`/api/media/${media.id}/trailer-lookup`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trailerUrl).toBe(`https://www.youtube.com/watch?v=${videoId}`)
  })
})
