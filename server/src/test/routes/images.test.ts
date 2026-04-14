import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { createUser, makeToken } from '../helpers'

// Mock axios so tests don't hit real external APIs
vi.mock('axios')
import axios from 'axios'
const mockAxiosGet = vi.mocked(axios.get)

// Mock S3 uploadBufferToS3 to avoid hitting AWS in tests
vi.mock('../../lib/s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/s3')>()
  return {
    ...actual,
    uploadBufferToS3: vi.fn().mockResolvedValue('https://mock-bucket.s3.us-east-1.amazonaws.com/imports/mock-uuid-role-image.jpg'),
  }
})
import { uploadBufferToS3 } from '../../lib/s3'
const mockUploadBufferToS3 = vi.mocked(uploadBufferToS3)

function makeBraveResponse(results: Array<{ thumbnailUrl: string; fullUrl: string }>) {
  return {
    data: {
      results: results.map(r => ({
        thumbnail: { src: r.thumbnailUrl },
        properties: { url: r.fullUrl },
      })),
    },
  }
}

function makeBraveResult(i: number) {
  return {
    thumbnailUrl: `https://imgs.search.brave.com/thumb${i}.jpg`,
    fullUrl: `https://example.com/image${i}.jpg`,
  }
}

describe('GET /api/images/search', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset()
    process.env['BRAVE_SEARCH_API_KEY'] = 'test-brave-key'
  })

  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).get('/api/images/search?q=test')
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(403)
  })

  it('returns 400 when query parameter is missing', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .get('/api/images/search')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('returns Brave results on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    const items = Array.from({ length: 10 }, (_, i) => makeBraveResult(i))
    mockAxiosGet.mockResolvedValueOnce(makeBraveResponse(items))

    const res = await request(app)
      .get('/api/images/search?q=Keanu+Reeves+Neo')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.results)).toBe(true)
    expect(res.body.results).toHaveLength(10)
    expect(res.body.results[0]).toHaveProperty('thumbnailUrl')
    expect(res.body.results[0]).toHaveProperty('fullUrl')
    expect(res.body.hasMore).toBe(true)
  })

  it('hasMore is false when fewer than 10 results returned', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    const items = Array.from({ length: 5 }, (_, i) => makeBraveResult(i))
    mockAxiosGet.mockResolvedValueOnce(makeBraveResponse(items))

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(5)
    expect(res.body.hasMore).toBe(false)
  })

  it('works for ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)

    mockAxiosGet.mockResolvedValueOnce(makeBraveResponse([makeBraveResult(0)]))

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(1)
  })

  it('returns 502 when Brave returns 429', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    const error429 = Object.assign(new Error('Rate limited'), { response: { status: 429 } })
    mockAxiosGet.mockRejectedValueOnce(error429)

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(502)
  })

  it('returns 502 when Brave fails with a network error', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    mockAxiosGet.mockRejectedValueOnce(new Error('Network error'))

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(502)
  })

  it('returns 502 when Brave is not configured', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    delete process.env['BRAVE_SEARCH_API_KEY']

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(502)
  })
})

describe('POST /api/images/download', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset()
    mockUploadBufferToS3.mockReset()
    mockUploadBufferToS3.mockResolvedValue('https://mock-bucket.s3.us-east-1.amazonaws.com/imports/mock-uuid-role-image.jpg')
  })

  it('returns 401 when no auth is provided', async () => {
    const res = await request(app)
      .post('/api/images/download')
      .send({ url: 'https://example.com/image.jpg' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for VIEWER role', async () => {
    const viewer = await createUser({ role: 'VIEWER' })
    const token = makeToken(viewer)
    const res = await request(app)
      .post('/api/images/download')
      .set('Cookie', `token=${token}`)
      .send({ url: 'https://example.com/image.jpg' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when url is missing', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/images/download')
      .set('Cookie', `token=${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('returns 400 when url is empty string', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const res = await request(app)
      .post('/api/images/download')
      .set('Cookie', `token=${token}`)
      .send({ url: '' })
    expect(res.status).toBe(400)
  })

  it('returns imageUrl on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    const s3Url = 'https://mock-bucket.s3.us-east-1.amazonaws.com/imports/test-role-image.jpg'
    mockAxiosGet.mockResolvedValueOnce({
      data: Buffer.from('fake-image-bytes'),
      headers: { 'content-type': 'image/jpeg' },
    })
    mockUploadBufferToS3.mockResolvedValueOnce(s3Url)

    const res = await request(app)
      .post('/api/images/download')
      .set('Cookie', `token=${token}`)
      .send({ url: 'https://example.com/actor-image.jpg' })

    expect(res.status).toBe(200)
    expect(res.body.imageUrl).toBe(s3Url)
  })

  it('works for ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)
    mockAxiosGet.mockResolvedValueOnce({
      data: Buffer.from('image-data'),
      headers: { 'content-type': 'image/png' },
    })

    const res = await request(app)
      .post('/api/images/download')
      .set('Cookie', `token=${token}`)
      .send({ url: 'https://example.com/image.png' })

    expect(res.status).toBe(200)
    expect(res.body.imageUrl).toContain('amazonaws.com')
  })

  it('returns 502 when image download fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    mockAxiosGet.mockRejectedValueOnce(new Error('Download failed'))

    const res = await request(app)
      .post('/api/images/download')
      .set('Cookie', `token=${token}`)
      .send({ url: 'https://example.com/broken-image.jpg' })

    expect(res.status).toBe(502)
  })

  it('returns 500 when S3 upload fails', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    mockAxiosGet.mockResolvedValueOnce({
      data: Buffer.from('image-data'),
      headers: { 'content-type': 'image/jpeg' },
    })
    mockUploadBufferToS3.mockRejectedValueOnce(new Error('S3 upload failed'))

    const res = await request(app)
      .post('/api/images/download')
      .set('Cookie', `token=${token}`)
      .send({ url: 'https://example.com/image.jpg' })

    expect(res.status).toBe(500)
  })

  it('defaults content-type to image/jpeg when header is missing', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)
    mockAxiosGet.mockResolvedValueOnce({
      data: Buffer.from('image-data'),
      headers: {},
    })
    const s3Url = 'https://mock-bucket.s3.us-east-1.amazonaws.com/imports/test.jpg'
    mockUploadBufferToS3.mockResolvedValueOnce(s3Url)

    const res = await request(app)
      .post('/api/images/download')
      .set('Cookie', `token=${token}`)
      .send({ url: 'https://example.com/image' })

    expect(res.status).toBe(200)
    expect(mockUploadBufferToS3).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/jpeg',
      'role-image.jpg',
    )
  })
})
