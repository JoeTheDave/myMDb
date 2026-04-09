import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { createUser, makeToken } from '../helpers'

// Mock the S3 upload function so tests don't require real AWS credentials
vi.mock('../../lib/s3', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/s3')>()
  return {
    ...actual,
    uploadToS3: vi.fn().mockResolvedValue('https://fake-bucket.s3.us-east-1.amazonaws.com/test-key.jpg'),
  }
})

describe('POST /api/upload', () => {
  it('returns 401 when no auth is provided', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('fake image data'), { filename: 'test.jpg', contentType: 'image/jpeg' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .post('/api/upload')
      .set('Cookie', `token=${token}`)
      .attach('file', Buffer.from('fake image data'), { filename: 'test.jpg', contentType: 'image/jpeg' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when no file is provided', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/upload')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('returns 200 with url when file is uploaded successfully', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    // Minimal valid 1x1 PNG — sharp requires real image data now that it processes uploads
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    const res = await request(app)
      .post('/api/upload')
      .set('Cookie', `token=${token}`)
      .attach('file', pngBuffer, { filename: 'photo.png', contentType: 'image/png' })

    expect(res.status).toBe(200)
    expect(res.body.url).toBeDefined()
    expect(typeof res.body.url).toBe('string')
  })
})
