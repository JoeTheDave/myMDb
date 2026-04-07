import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { app } from '../../index'
import { createUser, makeToken, createMedia, createActor } from '../helpers'

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

describe('POST /api/media/:id/roles', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app)
      .post('/api/media/some-id/roles')
      .send({ characterName: 'Hero', actorId: 'some-actor' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .post('/api/media/some-id/roles')
      .set('Cookie', `token=${token}`)
      .send({ characterName: 'Hero', actorId: 'some-actor' })
    expect(res.status).toBe(403)
  })

  it('returns 404 when media is not found', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const actor = await createActor()
    const res = await request(app)
      .post('/api/media/00000000-0000-0000-0000-000000000000/roles')
      .set('Cookie', `token=${token}`)
      .send({ characterName: 'Hero', actorId: actor.id })
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/media/i)
  })

  it('returns 404 when actor is not found', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const res = await request(app)
      .post(`/api/media/${media.id}/roles`)
      .set('Cookie', `token=${token}`)
      .send({ characterName: 'Hero', actorId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/actor/i)
  })

  it('returns 409 on duplicate actor+media combination', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()

    await request(app)
      .post(`/api/media/${media.id}/roles`)
      .set('Cookie', `token=${token}`)
      .send({ characterName: 'Hero', actorId: actor.id })

    const res = await request(app)
      .post(`/api/media/${media.id}/roles`)
      .set('Cookie', `token=${token}`)
      .send({ characterName: 'Villain', actorId: actor.id })
    expect(res.status).toBe(409)
  })

  it('returns 201 on success', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()

    const res = await request(app)
      .post(`/api/media/${media.id}/roles`)
      .set('Cookie', `token=${token}`)
      .send({ characterName: 'Tony Stark', actorId: actor.id })
    expect(res.status).toBe(201)
    expect(res.body.characterName).toBe('Tony Stark')
    expect(res.body.actorId).toBe(actor.id)
    expect(res.body.mediaId).toBe(media.id)
    expect(res.body.id).toBeDefined()
  })
})

describe('PUT /api/roles/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).put('/api/roles/some-id').send({ characterName: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .put('/api/roles/some-id')
      .set('Cookie', `token=${token}`)
      .send({ characterName: 'Updated' })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown id', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .put('/api/roles/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
      .send({ characterName: 'Updated' })
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()

    const role = await prisma.castRole.create({
      data: { characterName: 'Original Name', actorId: actor.id, mediaId: media.id },
    })

    const res = await request(app)
      .put(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)
      .send({ characterName: 'Updated Name' })

    expect(res.status).toBe(200)
    expect(res.body.characterName).toBe('Updated Name')
  })
})

describe('DELETE /api/roles/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).delete('/api/roles/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app).delete('/api/roles/some-id').set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown id', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .delete('/api/roles/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 204 on success', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actor = await createActor()

    const role = await prisma.castRole.create({
      data: { characterName: 'To Delete', actorId: actor.id, mediaId: media.id },
    })

    const res = await request(app)
      .delete(`/api/roles/${role.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(204)
  })
})
