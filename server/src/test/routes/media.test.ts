import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { createUser, makeToken, createMedia } from '../helpers'

describe('GET /api/media', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).get('/api/media')
    expect(res.status).toBe(401)
  })

  it('returns 200 with paginated list', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    await createMedia({ title: 'Alpha Movie' })
    await createMedia({ title: 'Beta Movie' })

    const res = await request(app).get('/api/media').set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(2)
    expect(res.body.total).toBe(2)
    expect(res.body.page).toBe(1)
  })

  it('filters by type', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    await createMedia({ title: 'A Movie', mediaType: 'MOVIE' })
    await createMedia({ title: 'A Show', mediaType: 'SHOW' })

    const res = await request(app).get('/api/media?type=SHOW').set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
    expect(res.body.data[0].mediaType).toBe('SHOW')
  })

  it('filters by title search query', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    await createMedia({ title: 'Inception' })
    await createMedia({ title: 'The Matrix' })

    const res = await request(app).get('/api/media?q=inception').set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
    expect(res.body.data[0].title).toBe('Inception')
  })
})

describe('GET /api/media/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).get('/api/media/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown id', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const res = await request(app)
      .get('/api/media/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 200 with full detail including cast and ratings summary', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const media = await createMedia({ title: 'Interstellar' })

    const res = await request(app).get(`/api/media/${media.id}`).set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(media.id)
    expect(res.body.title).toBe('Interstellar')
    expect(Array.isArray(res.body.castRoles)).toBe(true)
    expect(typeof res.body.communityCount).toBe('number')
    expect(res.body.communityAvg === null || typeof res.body.communityAvg === 'number').toBe(true)
  })
})

describe('POST /api/media', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).post('/api/media').send({ title: 'Test', mediaType: 'MOVIE' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .post('/api/media')
      .set('Cookie', `token=${token}`)
      .send({ title: 'Test', mediaType: 'MOVIE' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when title is missing', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/media')
      .set('Cookie', `token=${token}`)
      .send({ mediaType: 'MOVIE' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when content rating is wrong for media type (TV rating on MOVIE)', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/media')
      .set('Cookie', `token=${token}`)
      .send({ title: 'Bad Movie', mediaType: 'MOVIE', contentRating: 'TV_MA' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when content rating is wrong for media type (movie rating on SHOW)', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/media')
      .set('Cookie', `token=${token}`)
      .send({ title: 'Bad Show', mediaType: 'SHOW', contentRating: 'R' })
    expect(res.status).toBe(400)
  })

  it('returns 201 on success for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/media')
      .set('Cookie', `token=${token}`)
      .send({ title: 'New Movie', mediaType: 'MOVIE', contentRating: 'PG_13' })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe('New Movie')
    expect(res.body.mediaType).toBe('MOVIE')
    expect(res.body.contentRating).toBe('PG_13')
    expect(res.body.id).toBeDefined()
  })

  it('returns 201 on success for ADMIN', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const res = await request(app)
      .post('/api/media')
      .set('Cookie', `token=${token}`)
      .send({ title: 'Admin Show', mediaType: 'SHOW', contentRating: 'TV_MA' })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Admin Show')
  })
})

describe('PUT /api/media/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).put('/api/media/some-id').send({ title: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()
    const res = await request(app)
      .put(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'Updated' })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown id', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .put('/api/media/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
      .send({ title: 'Updated' })
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia({ title: 'Original Title' })

    const res = await request(app)
      .put(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)
      .send({ title: 'Updated Title' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated Title')
  })
})

describe('DELETE /api/media/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).delete('/api/media/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 403 for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const res = await request(app)
      .delete(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown id', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const res = await request(app)
      .delete('/api/media/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 204 on success for ADMIN', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia()

    const res = await request(app)
      .delete(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(204)
  })
})
