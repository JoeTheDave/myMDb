import { Router, Request, Response } from 'express'
import axios from 'axios'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { uploadBufferToS3 } from '../lib/s3'
import { logger } from '../lib/logger'

const router = Router()

// GET /api/images/search?q={query}&start={start}
router.get('/search', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const q = req.query['q'] as string | undefined
  if (!q || !q.trim()) {
    res.status(400).json({ error: 'Missing query parameter: q' })
    return
  }

  const startParam = req.query['start'] as string | undefined
  const start = startParam ? parseInt(startParam, 10) : 1
  const resolvedStart = isNaN(start) || start < 1 ? 1 : start
  const offset = resolvedStart - 1

  const bingApiKey = process.env['BING_SEARCH_API_KEY']
  const braveApiKey = process.env['BRAVE_SEARCH_API_KEY']

  // Try Bing first
  if (bingApiKey) {
    try {
      type BingValue = { thumbnailUrl: string; contentUrl: string }
      type BingResponse = { value?: BingValue[] }
      const bingResponse = await axios.get<BingResponse>('https://api.bing.microsoft.com/v7.0/images/search', {
        params: { q, count: 10, offset },
        headers: { 'Ocp-Apim-Subscription-Key': bingApiKey },
        timeout: 15000,
      })
      const values = bingResponse.data.value ?? []
      const bingResults = values.map(v => ({ thumbnailUrl: v.thumbnailUrl, fullUrl: v.contentUrl }))
      const hasMore = bingResults.length === 10 && offset === 0
      logger.info({ logId: 'keen-searching-bing', q, count: bingResults.length, hasMore }, 'Bing image search complete')
      res.json({ source: 'bing', results: bingResults, hasMore })
      return
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 429) {
        logger.warn({ logId: 'pale-quota-bing', q }, 'Bing monthly quota exceeded — falling back to Brave')
      } else {
        logger.warn({ logId: 'blunt-failing-bing', err, q }, 'Bing image search failed — falling back to Brave')
      }
    }
  }

  // Brave fallback
  if (braveApiKey) {
    try {
      type BraveResult = { thumbnail: { src: string }; properties: { url: string } }
      type BraveResponse = { results?: BraveResult[] }
      const braveResponse = await axios.get<BraveResponse>('https://api.search.brave.com/res/v1/images/search', {
        params: { q, count: 10, offset },
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': braveApiKey,
        },
        timeout: 15000,
      })
      const results = braveResponse.data.results ?? []
      const braveResults = results.map(r => ({ thumbnailUrl: r.thumbnail.src, fullUrl: r.properties.url }))
      const hasMore = braveResults.length === 10 && offset === 0
      logger.info({ logId: 'wise-searching-brave', q, count: braveResults.length, hasMore }, 'Brave image search complete')
      res.json({ source: 'brave', results: braveResults, hasMore })
      return
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 429 || status === 402) {
        logger.warn({ logId: 'lean-quota-brave', q }, 'Brave monthly credits exhausted — all providers unavailable')
      } else {
        logger.error({ logId: 'dark-failing-brave', err, q }, 'Brave image search failed')
      }
    }
  }

  logger.error({ logId: 'grim-failing-search', q }, 'All image search providers failed or unconfigured')
  res.status(502).json({ error: 'Image search failed. All providers unavailable.' })
})

// POST /api/images/download
router.post('/download', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body as { url?: string }
  if (!url || typeof url !== 'string' || !url.trim()) {
    res.status(400).json({ error: 'Missing or invalid url in request body' })
    return
  }

  let imageBuffer: Buffer
  let contentType: string
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
    imageBuffer = Buffer.from(response.data as ArrayBuffer)
    contentType = (response.headers['content-type'] as string | undefined) ?? 'image/jpeg'
  } catch (err) {
    logger.error({ logId: 'thin-downloading-image', err, url }, 'Failed to download image for upload')
    res.status(502).json({ error: 'Failed to download image from provided URL.' })
    return
  }

  let imageUrl: string
  try {
    imageUrl = await uploadBufferToS3(imageBuffer, contentType, 'role-image.jpg')
  } catch (err) {
    logger.error({ logId: 'harsh-uploading-image', err }, 'Failed to upload downloaded image to S3')
    res.status(500).json({ error: 'Failed to upload image to storage.' })
    return
  }

  logger.info({ logId: 'clear-storing-image', url }, 'Image downloaded and uploaded to S3')
  res.json({ imageUrl })
})

export default router
