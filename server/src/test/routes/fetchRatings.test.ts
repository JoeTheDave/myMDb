import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { createUser, makeToken, createMedia } from '../helpers'
import { RTNotFoundError } from '../../lib/rtScraper'

// Mock the RT scraper — it makes real external HTTP calls
vi.mock('../../lib/rtScraper', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/rtScraper')>()
  return {
    ...actual,
    fetchRTRatings: vi.fn(),
  }
})

// Import the mocked function so we can control it per test
import { fetchRTRatings } from '../../lib/rtScraper'
const mockFetchRTRatings = vi.mocked(fetchRTRatings)

describe('PATCH /api/media/:id/fetch-ratings', () => {
  beforeEach(() => {
    mockFetchRTRatings.mockReset()
  })

  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).patch('/api/media/some-id/fetch-ratings')
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()
    const res = await request(app)
      .patch(`/api/media/${media.id}/fetch-ratings`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 when media id does not exist', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .patch('/api/media/00000000-0000-0000-0000-000000000000/fetch-ratings')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('returns 422 when scraper throws RTNotFoundError', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Unknown Film', mediaType: 'MOVIE' })

    mockFetchRTRatings.mockRejectedValueOnce(new RTNotFoundError('No RT ratings found for "Unknown Film"'))

    const res = await request(app)
      .patch(`/api/media/${media.id}/fetch-ratings`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('Could not find this title on Rotten Tomatoes.')
  })

  it('returns 200 with scores, saves to DB, and works for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Inception', mediaType: 'MOVIE' })

    mockFetchRTRatings.mockResolvedValueOnce({ criticRating: 87, audienceRating: 91 })

    const res = await request(app)
      .patch(`/api/media/${media.id}/fetch-ratings`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.criticRating).toBe(87)
    expect(res.body.audienceRating).toBe(91)
  })

  it('returns 200 with scores and works for ADMIN', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia({ title: 'The Matrix', mediaType: 'MOVIE' })

    mockFetchRTRatings.mockResolvedValueOnce({ criticRating: 88, audienceRating: 85 })

    const res = await request(app)
      .patch(`/api/media/${media.id}/fetch-ratings`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.criticRating).toBe(88)
    expect(res.body.audienceRating).toBe(85)
  })

  it('persists the fetched ratings to the database record', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Parasite', mediaType: 'MOVIE' })

    mockFetchRTRatings.mockResolvedValueOnce({ criticRating: 99, audienceRating: 90 })

    await request(app)
      .patch(`/api/media/${media.id}/fetch-ratings`)
      .set('Cookie', `token=${token}`)

    // Verify scores appear in subsequent GET
    const getRes = await request(app)
      .get(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body.criticRating).toBe(99)
    expect(getRes.body.audienceRating).toBe(90)
  })

  it('calls fetchRTRatings with the media title, releaseYear, and mediaType', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Dune', mediaType: 'MOVIE' })

    mockFetchRTRatings.mockResolvedValueOnce({ criticRating: 83, audienceRating: 90 })

    await request(app)
      .patch(`/api/media/${media.id}/fetch-ratings`)
      .set('Cookie', `token=${token}`)

    expect(mockFetchRTRatings).toHaveBeenCalledOnce()
    expect(mockFetchRTRatings).toHaveBeenCalledWith('Dune', null, 'MOVIE')
  })

  it('handles null scores from the scraper (no scores found but no error)', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Obscure Film', mediaType: 'MOVIE' })

    mockFetchRTRatings.mockResolvedValueOnce({ criticRating: null, audienceRating: null })

    const res = await request(app)
      .patch(`/api/media/${media.id}/fetch-ratings`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.criticRating).toBeNull()
    expect(res.body.audienceRating).toBeNull()
  })
})
