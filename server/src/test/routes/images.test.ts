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

// Also mock axios.post for the download route since it uses axios.get
// The download route uses axios.get with responseType: 'arraybuffer'

function makeGoogleResponse(items: Array<{ link: string; image: { thumbnailLink: string } }>) {
  return { data: { items } }
}

function makeBingResponse(values: Array<{ thumbnailUrl: string; contentUrl: string }>) {
  return { data: { value: values } }
}

function makeGoogleItem(i: number) {
  return { link: `https://example.com/image${i}.jpg`, image: { thumbnailLink: `https://thumb.example.com/t${i}.jpg` } }
}

function makeBingValue(i: number) {
  return { thumbnailUrl: `https://bing-thumb.example.com/t${i}.jpg`, contentUrl: `https://bing-full.example.com/image${i}.jpg` }
}

describe('GET /api/images/search', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset()
    process.env['GOOGLE_SEARCH_API_KEY'] = 'test-google-key'
    process.env['GOOGLE_SEARCH_ENGINE_ID'] = 'test-cx'
    process.env['BING_SEARCH_API_KEY'] = 'test-bing-key'
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

  it('returns Google results on happy path for EDITOR', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    const page1Items = Array.from({ length: 10 }, (_, i) => makeGoogleItem(i))
    const page2Items = Array.from({ length: 10 }, (_, i) => makeGoogleItem(i + 10))
    mockAxiosGet.mockResolvedValueOnce(makeGoogleResponse(page1Items))
    mockAxiosGet.mockResolvedValueOnce(makeGoogleResponse(page2Items))

    const res = await request(app)
      .get('/api/images/search?q=Keanu+Reeves+Neo')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('google')
    expect(Array.isArray(res.body.results)).toBe(true)
    expect(res.body.results).toHaveLength(20)
    expect(res.body.results[0]).toHaveProperty('thumbnailUrl')
    expect(res.body.results[0]).toHaveProperty('fullUrl')
  })

  it('works for ADMIN role', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const token = makeToken(admin)

    mockAxiosGet.mockResolvedValueOnce(makeGoogleResponse([makeGoogleItem(0)]))
    mockAxiosGet.mockResolvedValueOnce(makeGoogleResponse([makeGoogleItem(1)]))

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('google')
  })

  it('falls back to Bing when Google returns 429 on the first request', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    const error429 = Object.assign(new Error('Rate limited'), { response: { status: 429 } })
    mockAxiosGet.mockRejectedValueOnce(error429)
    // Bing fallback
    const bingValues = Array.from({ length: 20 }, (_, i) => makeBingValue(i))
    mockAxiosGet.mockResolvedValueOnce(makeBingResponse(bingValues))

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('bing')
    expect(res.body.results).toHaveLength(20)
    expect(res.body.results[0]).toHaveProperty('thumbnailUrl')
    expect(res.body.results[0]).toHaveProperty('fullUrl')
  })

  it('falls back to Bing when Google returns 429 on the second request', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    const page1Items = Array.from({ length: 10 }, (_, i) => makeGoogleItem(i))
    mockAxiosGet.mockResolvedValueOnce(makeGoogleResponse(page1Items))
    // Second Google request returns 429
    const error429 = Object.assign(new Error('Rate limited'), { response: { status: 429 } })
    mockAxiosGet.mockRejectedValueOnce(error429)
    // Bing fallback
    const bingValues = Array.from({ length: 20 }, (_, i) => makeBingValue(i))
    mockAxiosGet.mockResolvedValueOnce(makeBingResponse(bingValues))

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('bing')
    // Partial Google results should NOT be returned — full Bing results instead
    expect(res.body.results).toHaveLength(20)
  })

  it('falls back to Bing when Google fails with a non-429 error', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    mockAxiosGet.mockRejectedValueOnce(new Error('Network error'))
    const bingValues = Array.from({ length: 5 }, (_, i) => makeBingValue(i))
    mockAxiosGet.mockResolvedValueOnce(makeBingResponse(bingValues))

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('bing')
  })

  it('returns 502 when both Google and Bing fail', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    mockAxiosGet.mockRejectedValueOnce(new Error('Google error'))
    mockAxiosGet.mockRejectedValueOnce(new Error('Bing error'))

    const res = await request(app)
      .get('/api/images/search?q=test')
      .set('Cookie', `token=${token}`)

    expect(res.status).toBe(502)
  })

  it('returns 502 when Google fails and Bing is not configured', async () => {
    const editor = await createUser({ role: 'EDITOR' })
    const token = makeToken(editor)

    delete process.env['BING_SEARCH_API_KEY']
    mockAxiosGet.mockRejectedValueOnce(new Error('Google error'))

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
