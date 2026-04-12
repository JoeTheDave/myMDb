import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app } from '../../index'
import { createUser, makeToken, createActor, createMedia, createCastRole } from '../helpers'

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

describe('GET /api/actors', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).get('/api/actors')
    expect(res.status).toBe(401)
  })

  it('returns 200 with actor list', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    await createActor({ name: 'Tom Hanks' })
    await createActor({ name: 'Meryl Streep' })

    const res = await request(app).get('/api/actors').set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items.length).toBe(2)
    expect(res.body.total).toBe(2)
  })

  it('filters actors by name query', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    await createActor({ name: 'Tom Hanks' })
    await createActor({ name: 'Meryl Streep' })

    const res = await request(app).get('/api/actors?q=tom').set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(res.body.items[0].name).toBe('Tom Hanks')
  })
})

describe('GET /api/actors/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).get('/api/actors/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown id', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const res = await request(app)
      .get('/api/actors/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 200 with actor data including cast list', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const actor = await createActor({ name: 'Cate Blanchett' })

    const res = await request(app).get(`/api/actors/${actor.id}`).set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(actor.id)
    expect(res.body.name).toBe('Cate Blanchett')
    expect(Array.isArray(res.body.filmography)).toBe(true)
  })
})

describe('POST /api/actors', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).post('/api/actors').send({ name: 'New Actor' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .post('/api/actors')
      .set('Cookie', `token=${token}`)
      .send({ name: 'New Actor' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/actors')
      .set('Cookie', `token=${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/actors')
      .set('Cookie', `token=${token}`)
      .send({ name: 'Denzel Washington' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Denzel Washington')
    expect(res.body.id).toBeDefined()
  })
})

describe('PUT /api/actors/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).put('/api/actors/some-id').send({ name: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const actor = await createActor()
    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ name: 'Updated' })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown id', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .put('/api/actors/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
      .send({ name: 'Updated' })
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor({ name: 'Original Name' })

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
  })
})

describe('DELETE /api/actors/purge', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).delete('/api/actors/purge')
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .delete('/api/actors/purge')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('deletes actors with no cast roles and returns count for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    // Create actors with no cast roles
    await createActor({ name: 'Orphan Actor One' })
    await createActor({ name: 'Orphan Actor Two' })

    // Create an actor with a cast role (should NOT be deleted)
    const media = await createMedia()
    const linkedActor = await createActor({ name: 'Linked Actor' })
    await createCastRole(media.id, linkedActor.id)

    const res = await request(app)
      .delete('/api/actors/purge')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(2)

    // Linked actor should still exist
    const remaining = await prisma.actor.findUnique({ where: { id: linkedActor.id } })
    expect(remaining).not.toBeNull()
  })

  it('returns { deleted: 0 } when no actors qualify', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    // All actors have cast roles
    const media = await createMedia()
    const actor = await createActor({ name: 'Has Role Actor' })
    await createCastRole(media.id, actor.id)

    const res = await request(app)
      .delete('/api/actors/purge')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(0)
  })

  it('works for ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)

    await createActor({ name: 'Admin Purge Actor' })

    const res = await request(app)
      .delete('/api/actors/purge')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.deleted).toBeGreaterThanOrEqual(1)
  })
})

describe('DELETE /api/actors/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).delete('/api/actors/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 403 for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor()
    const res = await request(app)
      .delete(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown id', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const res = await request(app)
      .delete('/api/actors/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 204 on success for ADMIN', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const actor = await createActor({ name: 'To Be Deleted' })

    const res = await request(app)
      .delete(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(204)
  })
})
