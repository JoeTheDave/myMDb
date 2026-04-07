import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { createUser, makeToken } from '../helpers'

describe('GET /api/auth/me', () => {
  it('returns 401 when no cookie is provided', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error).toBeDefined()
  })

  it('returns 200 with user data when a valid cookie is provided', async () => {
    const user = await createUser({ email: 'me@example.com', role: 'VIEWER' })
    const token = makeToken(user)

    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(user.id)
    expect(res.body.email).toBe('me@example.com')
    expect(res.body.role).toBe('VIEWER')
  })

  it('returns 401 when cookie contains an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=invalid-jwt')
    expect(res.status).toBe(401)
  })
})
