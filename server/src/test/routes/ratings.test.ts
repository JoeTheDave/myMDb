import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app } from '../../index'
import { createUser, makeToken, createMedia } from '../helpers'

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

describe('PUT /api/media/:id/ratings', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app)
      .put('/api/media/some-id/ratings')
      .send({ stars: 4 })
    expect(res.status).toBe(401)
  })

  it('returns 400 when stars is 0 (out of range)', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const media = await createMedia()
    const res = await request(app)
      .put(`/api/media/${media.id}/ratings`)
      .set('Cookie', `token=${token}`)
      .send({ stars: 0 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when stars is 6 (out of range)', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const media = await createMedia()
    const res = await request(app)
      .put(`/api/media/${media.id}/ratings`)
      .set('Cookie', `token=${token}`)
      .send({ stars: 6 })
    expect(res.status).toBe(400)
  })

  it('creates a rating and returns 200', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/ratings`)
      .set('Cookie', `token=${token}`)
      .send({ stars: 4 })

    expect(res.status).toBe(200)
    expect(res.body.stars).toBe(4)
    expect(res.body.userId).toBe(user.id)
    expect(res.body.mediaId).toBe(media.id)
  })

  it('updates an existing rating and returns 200', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const media = await createMedia()

    // Create initial rating
    await prisma.rating.create({
      data: { stars: 3, userId: user.id, mediaId: media.id },
    })

    // Update it
    const res = await request(app)
      .put(`/api/media/${media.id}/ratings`)
      .set('Cookie', `token=${token}`)
      .send({ stars: 5 })

    expect(res.status).toBe(200)
    expect(res.body.stars).toBe(5)
  })
})

describe('DELETE /api/media/:id/ratings', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).delete('/api/media/some-id/ratings')
    expect(res.status).toBe(401)
  })

  it('returns 404 when no rating exists for this user+media', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const media = await createMedia()

    const res = await request(app)
      .delete(`/api/media/${media.id}/ratings`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 204 on successful deletion', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const media = await createMedia()

    await prisma.rating.create({
      data: { stars: 4, userId: user.id, mediaId: media.id },
    })

    const res = await request(app)
      .delete(`/api/media/${media.id}/ratings`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(204)
  })
})
