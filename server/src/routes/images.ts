import { Router, Request, Response } from 'express'
import axios from 'axios'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { uploadBufferToS3 } from '../lib/s3'
import { logger } from '../lib/logger'

const router = Router()

// GET /api/images/search?q={query}
router.get('/search', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const q = req.query['q'] as string | undefined
  if (!q || !q.trim()) {
    res.status(400).json({ error: 'Missing query parameter: q' })
    return
  }

  const googleApiKey = process.env['GOOGLE_SEARCH_API_KEY']
  const googleCx = process.env['GOOGLE_SEARCH_ENGINE_ID']
  const bingApiKey = process.env['BING_SEARCH_API_KEY']

  // Try Google first (2 sequential requests of 10 results each)
  if (googleApiKey && googleCx) {
    try {
      let googleHit429 = false

      type GoogleItem = { link: string; image: { thumbnailLink: string } }
      type GoogleResponse = { items?: GoogleItem[] }

      const googleResults: Array<{ thumbnailUrl: string; fullUrl: string }> = []

      for (const start of [1, 11]) {
        let googleResponse: { data: GoogleResponse }
        try {
          googleResponse = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: { key: googleApiKey, cx: googleCx, searchType: 'image', q, num: 10, start },
            timeout: 15000,
          })
        } catch (err) {
          const status = (err as { response?: { status?: number } }).response?.status
          if (status === 429) {
            logger.warn({ logId: 'pale-quota-google', q, start }, 'Google image search returned 429 — falling back to Bing')
            googleHit429 = true
            break
          }
          throw err
        }

        const items = googleResponse.data.items ?? []
        for (const item of items) {
          googleResults.push({ thumbnailUrl: item.image.thumbnailLink, fullUrl: item.link })
        }
      }

      if (!googleHit429) {
        logger.info({ logId: 'swift-searching-google', q, count: googleResults.length }, 'Google image search complete')
        res.json({ source: 'google', results: googleResults })
        return
      }
    } catch (err) {
      logger.warn({ logId: 'blunt-failing-google', err, q }, 'Google image search failed — falling back to Bing')
    }
  }

  // Bing fallback
  if (bingApiKey) {
    try {
      type BingValue = { thumbnailUrl: string; contentUrl: string }
      type BingResponse = { value?: BingValue[] }
      const bingResponse = await axios.get<BingResponse>('https://api.bing.microsoft.com/v7.0/images/search', {
        params: { q, count: 20, offset: 0 },
        headers: { 'Ocp-Apim-Subscription-Key': bingApiKey },
        timeout: 15000,
      })
      const values = bingResponse.data.value ?? []
      const bingResults = values.map(v => ({ thumbnailUrl: v.thumbnailUrl, fullUrl: v.contentUrl }))
      logger.info({ logId: 'keen-searching-bing', q, count: bingResults.length }, 'Bing image search complete')
      res.json({ source: 'bing', results: bingResults })
      return
    } catch (err) {
      logger.error({ logId: 'dark-failing-bing', err, q }, 'Bing image search failed')
    }
  }

  logger.error({ logId: 'grim-failing-search', q }, 'All image search providers failed')
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
