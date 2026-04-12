import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { createUser, makeToken, createMedia, createActor, createCastRole } from '../helpers'

// ─── GET /api/media/:id — castSortOrder + billingOrder on cast members ──────

describe('GET /api/media/:id — castSortOrder and billingOrder fields', () => {
  it('returns castSortOrder on the media object', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia({ title: 'Sort Field Movie' })

    const res = await request(app)
      .get(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('castSortOrder')
    // Default value from schema is BY_ACTOR
    expect(res.body.castSortOrder).toBe('BY_ACTOR')
  })

  it('returns billingOrder on each cast member', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia({ title: 'Billing Order Movie' })
    const actor = await createActor({ name: 'Jane Doe' })
    await createCastRole(media.id, actor.id, { characterName: 'Hero', billingOrder: 3 })

    const res = await request(app)
      .get(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.cast)).toBe(true)
    expect(res.body.cast.length).toBe(1)
    expect(res.body.cast[0]).toHaveProperty('billingOrder', 3)
  })
})

// ─── PUT /api/media/:id/cast-sort ────────────────────────────────────────────

describe('PUT /api/media/:id/cast-sort', () => {
  it('returns 401 when unauthenticated', async () => {
    const media = await createMedia()
    const res = await request(app)
      .put(`/api/media/${media.id}/cast-sort`)
      .send({ castSortOrder: 'BY_ACTOR' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-sort`)
      .set('Cookie', `token=${token}`)
      .send({ castSortOrder: 'BY_ACTOR' })

    expect(res.status).toBe(403)
  })

  it('returns 400 when castSortOrder is missing', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-sort`)
      .set('Cookie', `token=${token}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/castSortOrder/i)
  })

  it('returns 400 when castSortOrder is an invalid value', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-sort`)
      .set('Cookie', `token=${token}`)
      .send({ castSortOrder: 'ALPHABETICAL' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/castSortOrder/i)
  })

  it('returns 404 when media does not exist', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    const res = await request(app)
      .put('/api/media/00000000-0000-0000-0000-000000000000/cast-sort')
      .set('Cookie', `token=${token}`)
      .send({ castSortOrder: 'CUSTOM' })

    expect(res.status).toBe(404)
  })

  it('happy path: EDITOR can set castSortOrder to BY_ROLE', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-sort`)
      .set('Cookie', `token=${token}`)
      .send({ castSortOrder: 'BY_ROLE' })

    expect(res.status).toBe(200)
    expect(res.body.castSortOrder).toBe('BY_ROLE')
  })

  it('happy path: EDITOR can set castSortOrder to CUSTOM', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-sort`)
      .set('Cookie', `token=${token}`)
      .send({ castSortOrder: 'CUSTOM' })

    expect(res.status).toBe(200)
    expect(res.body.castSortOrder).toBe('CUSTOM')
  })

  it('happy path: ADMIN can set castSortOrder', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-sort`)
      .set('Cookie', `token=${token}`)
      .send({ castSortOrder: 'BY_ACTOR' })

    expect(res.status).toBe(200)
    expect(res.body.castSortOrder).toBe('BY_ACTOR')
  })

  it('persists the updated castSortOrder when fetched via GET', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    await request(app)
      .put(`/api/media/${media.id}/cast-sort`)
      .set('Cookie', `token=${token}`)
      .send({ castSortOrder: 'CUSTOM' })

    const getRes = await request(app)
      .get(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body.castSortOrder).toBe('CUSTOM')
  })
})

// ─── PUT /api/media/:id/cast-reorder ─────────────────────────────────────────

describe('PUT /api/media/:id/cast-reorder', () => {
  it('returns 401 when unauthenticated', async () => {
    const media = await createMedia()
    const res = await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .send({ order: [{ id: 'some-id', billingOrder: 1 }] })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .set('Cookie', `token=${token}`)
      .send({ order: [{ id: 'some-id', billingOrder: 1 }] })

    expect(res.status).toBe(403)
  })

  it('returns 400 when order is missing', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .set('Cookie', `token=${token}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/order/i)
  })

  it('returns 400 when order is an empty array', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .set('Cookie', `token=${token}`)
      .send({ order: [] })

    expect(res.status).toBe(400)
  })

  it('returns 400 when an item is missing billingOrder', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .set('Cookie', `token=${token}`)
      .send({ order: [{ id: 'some-id' }] })

    expect(res.status).toBe(400)
  })

  it('returns 400 when an item is missing id', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .set('Cookie', `token=${token}`)
      .send({ order: [{ billingOrder: 1 }] })

    expect(res.status).toBe(400)
  })

  it('returns 404 when media does not exist', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    const res = await request(app)
      .put('/api/media/00000000-0000-0000-0000-000000000000/cast-reorder')
      .set('Cookie', `token=${token}`)
      .send({ order: [{ id: 'some-id', billingOrder: 1 }] })

    expect(res.status).toBe(404)
  })

  it('returns 400 when a cast role id does not belong to this media', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const otherMedia = await createMedia({ title: 'Other Movie' })
    const actor = await createActor()
    const otherRole = await createCastRole(otherMedia.id, actor.id)

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .set('Cookie', `token=${token}`)
      .send({ order: [{ id: otherRole.id, billingOrder: 1 }] })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(new RegExp(otherRole.id))
  })

  it('happy path: updates billingOrder for cast roles belonging to this media', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actorA = await createActor({ name: 'Actor A' })
    const actorB = await createActor({ name: 'Actor B' })
    const roleA = await createCastRole(media.id, actorA.id, { billingOrder: 1 })
    const roleB = await createCastRole(media.id, actorB.id, { billingOrder: 2 })

    // Swap billing order
    const res = await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .set('Cookie', `token=${token}`)
      .send({
        order: [
          { id: roleA.id, billingOrder: 2 },
          { id: roleB.id, billingOrder: 1 },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.updated).toBe(2)
  })

  it('persists the new billingOrder values in the database', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const media = await createMedia()
    const actorA = await createActor({ name: 'Actor A' })
    const actorB = await createActor({ name: 'Actor B' })
    const roleA = await createCastRole(media.id, actorA.id, { billingOrder: 1 })
    const roleB = await createCastRole(media.id, actorB.id, { billingOrder: 2 })

    await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .set('Cookie', `token=${token}`)
      .send({
        order: [
          { id: roleA.id, billingOrder: 5 },
          { id: roleB.id, billingOrder: 10 },
        ],
      })

    // Verify via GET /api/media/:id that cast returns updated billingOrder values
    const getRes = await request(app)
      .get(`/api/media/${media.id}`)
      .set('Cookie', `token=${token}`)

    expect(getRes.status).toBe(200)
    const castMap = new Map(getRes.body.cast.map((c: { id: string; billingOrder: number }) => [c.id, c.billingOrder]))
    expect(castMap.get(roleA.id)).toBe(5)
    expect(castMap.get(roleB.id)).toBe(10)
  })

  it('happy path: ADMIN can reorder cast', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const media = await createMedia()
    const actor = await createActor()
    const role = await createCastRole(media.id, actor.id, { billingOrder: 1 })

    const res = await request(app)
      .put(`/api/media/${media.id}/cast-reorder`)
      .set('Cookie', `token=${token}`)
      .send({ order: [{ id: role.id, billingOrder: 99 }] })

    expect(res.status).toBe(200)
    expect(res.body.updated).toBe(1)
  })
})
