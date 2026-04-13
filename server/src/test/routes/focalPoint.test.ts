import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app } from '../../index'
import { createUser, makeToken, createActor, createMedia, createCastRole } from '../helpers'

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

// ─── Actor focal point — PUT /api/actors/:id ─────────────────────────────────

describe('PUT /api/actors/:id — imageFocalX / imageFocalY', () => {
  it('happy path: persists and returns focal point values', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor({ name: 'Focal Point Actor' })

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalX: 25, imageFocalY: 75 })

    expect(res.status).toBe(200)
    expect(res.body.imageFocalX).toBe(25)
    expect(res.body.imageFocalY).toBe(75)
  })

  it('persists focal point values in the database', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor({ name: 'Db Persist Actor' })

    await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalX: 30, imageFocalY: 60 })

    const row = await prisma.actor.findUnique({ where: { id: actor.id } })
    expect(row?.imageFocalX).toBe(30)
    expect(row?.imageFocalY).toBe(60)
  })

  it('accepts boundary values 0 and 100', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor()

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalX: 0, imageFocalY: 100 })

    expect(res.status).toBe(200)
    expect(res.body.imageFocalX).toBe(0)
    expect(res.body.imageFocalY).toBe(100)
  })

  it('returns 400 when imageFocalX is below 0', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor()

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalX: -1 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when imageFocalX is above 100', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor()

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalX: 101 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when imageFocalY is below 0', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor()

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalY: -1 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when imageFocalY is above 100', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor()

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalY: 101 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when imageFocalX is a non-numeric string', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor()

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalX: 'not-a-number' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when imageFocalY is a non-numeric string', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor()

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalY: 'not-a-number' })

    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const actor = await createActor()

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .send({ imageFocalX: 25, imageFocalY: 75 })

    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const actor = await createActor()

    const res = await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)
      .send({ imageFocalX: 25, imageFocalY: 75 })

    expect(res.status).toBe(403)
  })
})

// ─── Actor focal point — GET /api/actors (list) ──────────────────────────────

describe('GET /api/actors — imageFocalX / imageFocalY in list response', () => {
  it('includes imageFocalX and imageFocalY fields on each actor', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const editor = await createUser({ role: 'EDITOR' })
    const editorToken = makeToken(editor)
    const actor = await createActor({ name: 'List Focal Actor' })

    // Set focal values via the update endpoint
    await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${editorToken}`)
      .send({ imageFocalX: 40, imageFocalY: 60 })

    const res = await request(app).get('/api/actors').set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    const item = res.body.items.find((a: { id: string }) => a.id === actor.id)
    expect(item).toBeDefined()
    expect(item.imageFocalX).toBe(40)
    expect(item.imageFocalY).toBe(60)
  })

  it('returns null imageFocalX and imageFocalY for actors without focal point set', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    await createActor({ name: 'No Focal Actor' })

    const res = await request(app).get('/api/actors').set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    const item = res.body.items.find((a: { name: string }) => a.name === 'No Focal Actor')
    expect(item).toBeDefined()
    expect(item.imageFocalX).toBeNull()
    expect(item.imageFocalY).toBeNull()
  })
})

// ─── Actor focal point — GET /api/actors/:id (detail) ────────────────────────

describe('GET /api/actors/:id — imageFocalX / imageFocalY in detail response', () => {
  it('includes imageFocalX and imageFocalY fields', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const editor = await createUser({ role: 'EDITOR' })
    const editorToken = makeToken(editor)
    const actor = await createActor({ name: 'Detail Focal Actor' })

    await request(app)
      .put(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${editorToken}`)
      .send({ imageFocalX: 55, imageFocalY: 45 })

    const res = await request(app)
      .get(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.imageFocalX).toBe(55)
    expect(res.body.imageFocalY).toBe(45)
  })

  it('returns null imageFocalX and imageFocalY when not set', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const actor = await createActor({ name: 'No Focal Detail Actor' })

    const res = await request(app)
      .get(`/api/actors/${actor.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.imageFocalX).toBeNull()
    expect(res.body.imageFocalY).toBeNull()
  })
})

// ─── Cast role focal point — PUT /api/roles/:id ──────────────────────────────

describe('PUT /api/roles/:id — roleImageFocalX / roleImageFocalY', () => {
  it('happy path: persists and returns focal point values', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ roleImageFocalX: 30, roleImageFocalY: 60 })

    expect(res.status).toBe(200)
    expect(res.body.roleImageFocalX).toBe(30)
    expect(res.body.roleImageFocalY).toBe(60)
  })

  it('persists focal point values in the database', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ roleImageFocalX: 30, roleImageFocalY: 60 })

    const row = await prisma.castRole.findUnique({ where: { id: role.id } })
    expect(row?.roleImageFocalX).toBe(30)
    expect(row?.roleImageFocalY).toBe(60)
  })

  it('accepts boundary values 0 and 100', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ roleImageFocalX: 0, roleImageFocalY: 100 })

    expect(res.status).toBe(200)
    expect(res.body.roleImageFocalX).toBe(0)
    expect(res.body.roleImageFocalY).toBe(100)
  })

  it('returns 400 when roleImageFocalX is below 0', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ roleImageFocalX: -1 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when roleImageFocalX is above 100', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ roleImageFocalX: 101 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when roleImageFocalY is below 0', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ roleImageFocalY: -1 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when roleImageFocalY is above 100', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ roleImageFocalY: 101 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when roleImageFocalX is a non-numeric string', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ roleImageFocalX: 'not-a-number' })

    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .send({ roleImageFocalX: 30, roleImageFocalY: 60 })

    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id)

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ roleImageFocalX: 30, roleImageFocalY: 60 })

    expect(res.status).toBe(403)
  })
})

// ─── Cast role focal point — GET /api/media/:id (cast list) ──────────────────

describe('GET /api/media/:id — roleImageFocalX / roleImageFocalY in cast response', () => {
  it('includes roleImageFocalX and roleImageFocalY on each cast member', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const editor = await createUser({ role: 'EDITOR' })
    const editorToken = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor({ name: 'Cast Focal Actor' })
    const role = await createCastRole(media.id, actor.id)

    // Set focal values via the update endpoint
    await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${editorToken}`)
      .send({ roleImageFocalX: 30, roleImageFocalY: 60 })

    const res = await request(app)
      .get(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.cast)).toBe(true)
    const castMember = res.body.cast.find((c: { id: string }) => c.id === role.id)
    expect(castMember).toBeDefined()
    expect(castMember.roleImageFocalX).toBe(30)
    expect(castMember.roleImageFocalY).toBe(60)
  })

  it('returns null roleImageFocalX and roleImageFocalY for cast roles without focal point set', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()
    const actor = await createActor()
    await createCastRole(media.id, actor.id)

    const res = await request(app)
      .get(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.cast)).toBe(true)
    expect(res.body.cast.length).toBeGreaterThan(0)
    expect(res.body.cast[0].roleImageFocalX).toBeNull()
    expect(res.body.cast[0].roleImageFocalY).toBeNull()
  })
})
