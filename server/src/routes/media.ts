import { Router, Request, Response } from 'express'
import { z } from 'zod'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { deleteS3Object } from '../lib/s3'
import { logger } from '../lib/logger'
import { fetchRTRatings, RTNotFoundError } from '../lib/rtScraper'

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const router = Router()

const MOVIE_RATINGS = ['G', 'PG', 'PG_13', 'R', 'NC_17', 'NR'] as const
const TV_RATINGS = ['TV_Y', 'TV_Y7', 'TV_G', 'TV_PG', 'TV_14', 'TV_MA'] as const
type MovieRating = (typeof MOVIE_RATINGS)[number]
type TvRating = (typeof TV_RATINGS)[number]

const contentRatingEnum = z.enum([...MOVIE_RATINGS, ...TV_RATINGS])

const createMediaSchema = z.object({
  title: z.string().min(1),
  mediaType: z.enum(['MOVIE', 'SHOW']),
  imageUrl: z.string().url().optional(),
  releaseYear: z.coerce.number().int().min(1888).max(2100).optional(),
  contentRating: contentRatingEnum.optional(),
})

const updateMediaSchema = createMediaSchema.partial()

function validateContentRating(mediaType: 'MOVIE' | 'SHOW', contentRating?: string): boolean {
  if (!contentRating) return true
  if (mediaType === 'MOVIE') return (MOVIE_RATINGS as readonly string[]).includes(contentRating)
  return (TV_RATINGS as readonly string[]).includes(contentRating)
}

const listQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(['MOVIE', 'SHOW']).optional(),
  contentRating: z.string().optional(),
  yearFrom: z.string().optional(),
  yearTo: z.string().optional(),
  actorId: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
})

function isS3Url(url: string | null | undefined): boolean {
  return !!url && url.includes('.s3.') && url.includes('amazonaws.com')
}


// GET /api/media
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { q, type, contentRating, yearFrom, yearTo, actorId, page, limit } = parsed.data
  const pageNum = Math.max(1, parseInt(page ?? '1', 10))
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '24', 10)))
  const skip = (pageNum - 1) * limitNum

  try {
    // Build where clause as a typed object
    type ContentRatingValue = MovieRating | TvRating

    const whereClause: {
      title?: { contains: string; mode: 'insensitive' }
      mediaType?: 'MOVIE' | 'SHOW'
      contentRating?: { in: ContentRatingValue[] }
      releaseYear?: { gte?: number; lte?: number }
      castRoles?: { some: { actorId: string } }
    } = {}

    if (q) {
      whereClause.title = { contains: q, mode: 'insensitive' }
    }
    if (type) {
      whereClause.mediaType = type
    }
    if (contentRating) {
      const ratings = contentRating
        .split(',')
        .map(r => r.trim())
        .filter(Boolean) as ContentRatingValue[]
      if (ratings.length > 0) {
        whereClause.contentRating = { in: ratings }
      }
    }
    if (yearFrom || yearTo) {
      whereClause.releaseYear = {}
      if (yearFrom) {
        whereClause.releaseYear.gte = parseInt(yearFrom, 10)
      }
      if (yearTo) {
        whereClause.releaseYear.lte = parseInt(yearTo, 10)
      }
    }
    if (actorId) {
      whereClause.castRoles = { some: { actorId } }
    }

    const [items, total] = await Promise.all([
      prisma.media.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { title: 'asc' },
        select: {
          id: true,
          title: true,
          imageUrl: true,
          releaseYear: true,
          mediaType: true,
          contentRating: true,
          criticRating: true,
          audienceRating: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.media.count({ where: whereClause }),
    ])

    res.json({
      items,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    })
  } catch (err) {
    logger.error({ logId: 'amber-seeking-leaf', err }, 'Failed to list media')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/media/:id
router.get('/:id', authenticate, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  try {
    const media = await prisma.media.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        releaseYear: true,
        mediaType: true,
        contentRating: true,
        criticRating: true,
        audienceRating: true,
        amazonPrimeUrl: true,
        trailerUrl: true,
        createdAt: true,
        updatedAt: true,
        castRoles: {
          select: {
            id: true,
            characterName: true,
            roleImageUrl: true,
            actor: {
              select: { id: true, name: true, imageUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    res.json({
      id: media.id,
      title: media.title,
      imageUrl: media.imageUrl,
      releaseYear: media.releaseYear,
      mediaType: media.mediaType,
      contentRating: media.contentRating,
      criticRating: media.criticRating,
      audienceRating: media.audienceRating,
      amazonPrimeUrl: media.amazonPrimeUrl,
      trailerUrl: media.trailerUrl,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
      cast: media.castRoles,
    })
  } catch (err) {
    logger.error({ logId: 'rich-finding-peak', err }, 'Failed to fetch media by id')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/media
router.post('/', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createMediaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { contentRating, mediaType } = parsed.data
  if (!validateContentRating(mediaType, contentRating)) {
    res.status(400).json({ error: `Invalid contentRating for mediaType ${mediaType}` })
    return
  }
  try {
    const media = await prisma.media.create({
      data: {
        title: parsed.data.title,
        mediaType: parsed.data.mediaType,
        imageUrl: parsed.data.imageUrl ?? null,
        releaseYear: parsed.data.releaseYear ?? null,
        contentRating: parsed.data.contentRating ?? null,
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        releaseYear: true,
        mediaType: true,
        contentRating: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    logger.info({ logId: 'keen-making-shore', mediaId: media.id }, 'Media created')
    res.status(201).json(media)
  } catch (err) {
    logger.error({ logId: 'stout-pushing-cliff', err }, 'Failed to create media')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/media/:id
router.put('/:id', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  const parsed = updateMediaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { contentRating, mediaType } = parsed.data
  if (mediaType && contentRating !== undefined && !validateContentRating(mediaType, contentRating)) {
    res.status(400).json({ error: `Invalid contentRating for mediaType ${mediaType}` })
    return
  }
  try {
    const existing = await prisma.media.findUnique({ where: { id }, select: { id: true, imageUrl: true } })
    if (!existing) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    const media = await prisma.media.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.mediaType !== undefined ? { mediaType: parsed.data.mediaType } : {}),
        ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl } : {}),
        ...(parsed.data.releaseYear !== undefined ? { releaseYear: parsed.data.releaseYear } : {}),
        ...(parsed.data.contentRating !== undefined ? { contentRating: parsed.data.contentRating } : {}),
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        releaseYear: true,
        mediaType: true,
        contentRating: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Clean up old S3 image if imageUrl changed
    if (
      parsed.data.imageUrl !== undefined &&
      parsed.data.imageUrl !== existing.imageUrl &&
      isS3Url(existing.imageUrl)
    ) {
      await deleteS3Object(existing.imageUrl!)
    }

    logger.info({ logId: 'solid-marking-path', mediaId: media.id }, 'Media updated')
    res.json(media)
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Media not found' })
      return
    }
    logger.error({ logId: 'grim-driving-hull', err }, 'Failed to update media')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/media/:id
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  try {
    const media = await prisma.media.findUnique({
      where: { id },
      select: {
        id: true,
        imageUrl: true,
        castRoles: { select: { roleImageUrl: true } },
      },
    })
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    // Delete cast role S3 images
    const castRoles = media.castRoles as Array<{ roleImageUrl: string | null }>
    for (const role of castRoles) {
      if (isS3Url(role.roleImageUrl)) {
        await deleteS3Object(role.roleImageUrl!)
      }
    }
    // Delete media image
    if (isS3Url(media.imageUrl as string | null)) {
      await deleteS3Object((media.imageUrl as string)!)
    }

    await prisma.media.delete({ where: { id } })
    logger.info({ logId: 'sharp-cutting-vine', mediaId: id }, 'Media deleted')
    res.status(204).send()
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Media not found' })
      return
    }
    logger.error({ logId: 'thin-falling-grove', err }, 'Failed to delete media')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/media/:id/fetch-ratings
router.patch('/:id/fetch-ratings', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  try {
    const media = await prisma.media.findUnique({
      where: { id },
      select: { id: true, title: true, releaseYear: true, mediaType: true },
    })
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    const { criticRating, audienceRating } = await fetchRTRatings(
      media.title,
      media.releaseYear,
      media.mediaType as 'MOVIE' | 'SHOW',
    )

    const updated = await prisma.media.update({
      where: { id },
      data: { criticRating, audienceRating },
      select: { criticRating: true, audienceRating: true },
    })

    logger.info({ logId: 'swift-pulling-score', mediaId: id, criticRating, audienceRating }, 'RT ratings fetched and saved')
    res.json({ criticRating: updated.criticRating, audienceRating: updated.audienceRating })
  } catch (err) {
    if (err instanceof RTNotFoundError) {
      res.status(422).json({ error: 'Could not find this title on Rotten Tomatoes.' })
      return
    }
    logger.error({ logId: 'dark-failing-scrape', err }, 'Failed to fetch RT ratings')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/media/:id/cast/import
router.post('/:id/cast/import', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  const { imdbId } = req.body as { imdbId?: string }

  if (!imdbId || !/^tt\d+$/.test(imdbId)) {
    res.status(400).json({ error: 'Invalid imdbId. Must match /^tt\\d+$/' })
    return
  }

  const media = await prisma.media.findUnique({ where: { id }, select: { id: true } })
  if (!media) {
    res.status(404).json({ error: 'Media not found' })
    return
  }

  let html: string
  try {
    const response = await axios.get(`https://www.imdb.com/title/${imdbId}/fullcredits/`, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
    })
    html = response.data as string
  } catch (err) {
    logger.error({ logId: 'faint-pulling-mast', err, imdbId }, 'Failed to fetch IMDB full credits page')
    res.status(422).json({ error: 'Could not retrieve cast from IMDB. Check the ID and try again.' })
    return
  }

  let $ : cheerio.CheerioAPI
  try {
    $ = cheerio.load(html)
  } catch (err) {
    logger.error({ logId: 'blunt-breaking-net', err }, 'Failed to parse IMDB HTML')
    res.status(422).json({ error: 'Could not retrieve cast from IMDB. Check the ID and try again.' })
    return
  }

  const castTable = $('.cast_list, #cast')
  if (!castTable.length) {
    logger.warn({ logId: 'pale-missing-list', imdbId }, 'No cast table found on IMDB page')
    res.status(422).json({ error: 'Could not retrieve cast from IMDB. Check the ID and try again.' })
    return
  }

  const castEntries: Array<{ actorName: string; character: string }> = []
  let stopProcessing = false

  castTable.find('tr').each((_i, row) => {
    if (stopProcessing) return
    const rowText = $(row).text()
    if (rowText.includes('Rest of cast listed alphabetically')) {
      stopProcessing = true
      return
    }

    // Try .primary_photo + td a first, then any /name/ link
    let actorName = $(row).find('.primary_photo + td a').first().text().trim()
    if (!actorName) {
      $(row).find('a').each((_j, a) => {
        const href = $(a).attr('href') ?? ''
        if (href.includes('/name/') && !actorName) {
          actorName = $(a).text().trim()
        }
      })
    }

    if (!actorName) return

    const character = $(row).find('.character').text().replace(/\s+/g, ' ').trim()
    castEntries.push({ actorName, character })
  })

  let imported = 0
  let matched = 0
  let created = 0
  let skipped = 0

  for (let i = 0; i < castEntries.length; i++) {
    const entry = castEntries[i]
    if (!entry) continue
    const { actorName, character } = entry
    try {
      const existingActor = await prisma.actor.findFirst({
        where: { name: { equals: actorName, mode: 'insensitive' } },
        select: { id: true },
      })

      if (existingActor) {
        matched++
        const existingRole = await prisma.castRole.findFirst({
          where: { mediaId: id, actorId: existingActor.id },
          select: { id: true },
        })
        if (existingRole) {
          skipped++
          continue
        }
        await prisma.castRole.create({
          data: { mediaId: id, actorId: existingActor.id, characterName: character || null },
        })
        imported++
      } else {
        created++
        const newActor = await prisma.actor.create({ data: { name: actorName } })
        await prisma.castRole.create({
          data: { mediaId: id, actorId: newActor.id, characterName: character || null },
        })
        imported++
      }
    } catch (err) {
      logger.error({ logId: 'dull-skipping-cast', err, actorName }, 'Failed to import cast member')
      skipped++
    }
  }

  logger.info({ logId: 'swift-loading-cast', mediaId: id, imdbId, imported, matched, created, skipped }, 'Cast import complete')
  res.json({ imported, matched, created, skipped })
})

// POST /api/media/:id/amazon-lookup
router.post('/:id/amazon-lookup', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params

  const media = await prisma.media.findUnique({
    where: { id },
    select: { id: true, title: true, releaseYear: true },
  })
  if (!media) {
    res.status(404).json({ error: 'Media not found' })
    return
  }

  const query = encodeURIComponent(`"${media.title}" ${media.releaseYear ?? ''} amazon prime video`.trim())

  let html: string
  try {
    const response = await axios.get(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
    })
    html = response.data as string
  } catch (err) {
    logger.error({ logId: 'grey-searching-prime', err, mediaId: id }, 'Failed to fetch DuckDuckGo results for Amazon lookup')
    res.status(500).json({ error: 'Internal server error' })
    return
  }

  const $ = cheerio.load(html)
  const amazonPatterns = ['/dp/', '/gp/video/', '/Amazon-Video/', '/Prime-Video/']
  let amazonPrimeUrl: string | null = null

  $('a').each((_i, el) => {
    if (amazonPrimeUrl) return
    const href = $(el).attr('href') ?? ''
    if (href.includes('amazon.com') && amazonPatterns.some(p => href.includes(p))) {
      try {
        const url = new URL(href)
        // Strip tracking params — keep only the pathname
        amazonPrimeUrl = `${url.origin}${url.pathname}`
      } catch {
        amazonPrimeUrl = href
      }
    }
  })

  if (!amazonPrimeUrl) {
    logger.info({ logId: 'calm-missing-prime', mediaId: id }, 'No Amazon Prime link found')
    res.json({ amazonPrimeUrl: null, message: 'No Amazon Prime link found.' })
    return
  }

  await prisma.media.update({ where: { id }, data: { amazonPrimeUrl } })
  logger.info({ logId: 'keen-saving-prime', mediaId: id, amazonPrimeUrl }, 'Amazon Prime URL saved')
  res.json({ amazonPrimeUrl })
})

// PATCH /api/media/:id/amazon-prime-url
router.patch('/:id/amazon-prime-url', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  const { amazonPrimeUrl } = req.body as { amazonPrimeUrl?: string | null }

  const media = await prisma.media.findUnique({ where: { id }, select: { id: true } })
  if (!media) {
    res.status(404).json({ error: 'Media not found' })
    return
  }

  try {
    const updated = await prisma.media.update({
      where: { id },
      data: { amazonPrimeUrl: amazonPrimeUrl ?? null },
      select: { id: true, amazonPrimeUrl: true },
    })
    logger.info({ logId: 'bold-setting-prime', mediaId: id }, 'Amazon Prime URL updated')
    res.json(updated)
  } catch (err) {
    logger.error({ logId: 'dark-patching-prime', err, mediaId: id }, 'Failed to update Amazon Prime URL')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/media/:id/trailer-lookup
router.post('/:id/trailer-lookup', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params

  const media = await prisma.media.findUnique({
    where: { id },
    select: { id: true, title: true, releaseYear: true },
  })
  if (!media) {
    res.status(404).json({ error: 'Media not found' })
    return
  }

  const query = encodeURIComponent(`"${media.title}" ${media.releaseYear ?? ''} official trailer youtube`.trim())

  let html: string
  try {
    const response = await axios.get(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
    })
    html = response.data as string
  } catch (err) {
    logger.error({ logId: 'pale-searching-reel', err, mediaId: id }, 'Failed to fetch DuckDuckGo results for trailer lookup')
    res.status(500).json({ error: 'Internal server error' })
    return
  }

  const $ = cheerio.load(html)
  let trailerUrl: string | null = null

  $('a').each((_i, el) => {
    if (trailerUrl) return
    const href = $(el).attr('href') ?? ''
    let videoId: string | null = null

    if (href.includes('youtube.com/watch')) {
      try {
        const url = new URL(href)
        videoId = url.searchParams.get('v')
      } catch { /* ignore */ }
    } else if (href.includes('youtu.be/')) {
      const match = href.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)
      if (match) videoId = match[1] ?? null
    }

    if (videoId) {
      trailerUrl = `https://www.youtube.com/watch?v=${videoId}`
    }
  })

  if (!trailerUrl) {
    logger.info({ logId: 'soft-missing-reel', mediaId: id }, 'No trailer found')
    res.json({ trailerUrl: null, message: 'No trailer found.' })
    return
  }

  await prisma.media.update({ where: { id }, data: { trailerUrl } })
  logger.info({ logId: 'clear-saving-reel', mediaId: id, trailerUrl }, 'Trailer URL saved')
  res.json({ trailerUrl })
})

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2025'
  )
}

export default router
