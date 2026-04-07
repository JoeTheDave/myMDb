import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { createUser, makeToken } from '../helpers'

describe('GET /api/users', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const user = await createUser({ role: 'VIEWER' })
    const token = makeToken(user)
    const res = await request(app).get('/api/users').set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 403 for EDITOR', async () => {
    const user = await createUser({ role: 'EDITOR' })
    const token = makeToken(user)
    const res = await request(app).get('/api/users').set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with array for ADMIN', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const res = await request(app).get('/api/users').set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
  })
})

describe('POST /api/users', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).post('/api/users').send({ email: 'a@b.com', role: 'VIEWER' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/users')
      .set('Cookie', `token=${token}`)
      .send({ email: 'new@example.com', role: 'VIEWER' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when email is missing', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const res = await request(app)
      .post('/api/users')
      .set('Cookie', `token=${token}`)
      .send({ role: 'VIEWER' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when role is invalid', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const res = await request(app)
      .post('/api/users')
      .set('Cookie', `token=${token}`)
      .send({ email: 'test@example.com', role: 'SUPERUSER' })
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const res = await request(app)
      .post('/api/users')
      .set('Cookie', `token=${token}`)
      .send({ email: 'newuser@example.com', role: 'EDITOR' })
    expect(res.status).toBe(201)
    expect(res.body.email).toBe('newuser@example.com')
    expect(res.body.role).toBe('EDITOR')
    expect(res.body.id).toBeDefined()
  })

  it('returns 409 on duplicate email', async () => {
    const admin = await createUser({ role: 'ADMIN', email: 'admin@example.com' })
    const token = makeToken(admin)

    // Create once
    await request(app)
      .post('/api/users')
      .set('Cookie', `token=${token}`)
      .send({ email: 'dup@example.com', role: 'VIEWER' })

    // Create again with same email
    const res = await request(app)
      .post('/api/users')
      .set('Cookie', `token=${token}`)
      .send({ email: 'dup@example.com', role: 'VIEWER' })
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/users/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).patch('/api/users/some-id').send({ role: 'EDITOR' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-ADMIN', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .patch('/api/users/some-id')
      .set('Cookie', `token=${token}`)
      .send({ role: 'EDITOR' })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown id', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const res = await request(app)
      .patch('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
      .send({ role: 'EDITOR' })
    expect(res.status).toBe(404)
  })

  it('returns 200 and updates role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const target = await createUser({ role: 'VIEWER' })

    const res = await request(app)
      .patch(`/api/users/${target.id}`)
      .set('Cookie', `token=${token}`)
      .send({ role: 'EDITOR' })

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('EDITOR')
  })

  it('returns 200 and updates active status', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const target = await createUser({ role: 'VIEWER', active: true })

    const res = await request(app)
      .patch(`/api/users/${target.id}`)
      .set('Cookie', `token=${token}`)
      .send({ active: false })

    expect(res.status).toBe(200)
    expect(res.body.active).toBe(false)
  })
})

describe('DELETE /api/users/:id', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).delete('/api/users/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-ADMIN', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app).delete('/api/users/some-id').set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown id', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const res = await request(app)
      .delete('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 204 on successful deletion', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    const target = await createUser({ role: 'VIEWER' })

    const res = await request(app)
      .delete(`/api/users/${target.id}`)
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(204)
  })
})
