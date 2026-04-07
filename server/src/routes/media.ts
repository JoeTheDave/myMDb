import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { deleteS3Object } from '../lib/s3'
import { logger } from '../lib/logger'

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
  releaseDate: z.string().datetime({ offset: true }).optional(),
  contentRating: contentRatingEnum.optional(),
  synopsis: z.string().optional(),
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
  minRating: z.string().optional(),
  actorId: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
})

function isS3Url(url: string | null | undefined): boolean {
  return !!url && url.includes('.s3.') && url.includes('amazonaws.com')
}

type RatingRecord = { stars: number; userId: string }

type MediaListItem = {
  id: string
  title: string
  imageUrl: string | null
  releaseDate: Date | null
  mediaType: string
  contentRating: string | null
  synopsis: string | null
  createdAt: Date
  updatedAt: Date
  communityAvg: number | null
  communityCount: number
  userRating: number | null
}

type MediaRow = {
  id: string
  title: string
  imageUrl: string | null
  releaseDate: Date | null
  mediaType: string
  contentRating: string | null
  synopsis: string | null
  createdAt: Date
  updatedAt: Date
  ratings: RatingRecord[]
}

// GET /api/media
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { q, type, contentRating, yearFrom, yearTo, minRating, actorId, page, limit } = parsed.data
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
      releaseDate?: { gte?: Date; lte?: Date }
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
      whereClause.releaseDate = {}
      if (yearFrom) {
        whereClause.releaseDate.gte = new Date(`${yearFrom}-01-01T00:00:00.000Z`)
      }
      if (yearTo) {
        whereClause.releaseDate.lte = new Date(`${yearTo}-12-31T23:59:59.999Z`)
      }
    }
    if (actorId) {
      whereClause.castRoles = { some: { actorId } }
    }

    const userId = req.user?.id

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
          releaseDate: true,
          mediaType: true,
          contentRating: true,
          synopsis: true,
          createdAt: true,
          updatedAt: true,
          ratings: {
            select: { stars: true, userId: true },
          },
        },
      }),
      prisma.media.count({ where: whereClause }),
    ])

    const minRatingNum = minRating ? parseFloat(minRating) : undefined

    const results = (items as MediaRow[])
      .map((item: MediaRow) => {
        const ratings = item.ratings
        const communityCount = ratings.length
        const communityAvg =
          communityCount > 0
            ? Math.round((ratings.reduce((sum: number, r: RatingRecord) => sum + r.stars, 0) / communityCount) * 10) /
              10
            : null
        const userRating = userId ? (ratings.find((r: RatingRecord) => r.userId === userId)?.stars ?? null) : null
        return {
          id: item.id,
          title: item.title,
          imageUrl: item.imageUrl,
          releaseDate: item.releaseDate,
          mediaType: item.mediaType,
          contentRating: item.contentRating,
          synopsis: item.synopsis,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          communityAvg,
          communityCount,
          userRating,
        }
      })
      .filter((item: MediaListItem) => {
        if (minRatingNum !== undefined && minRatingNum > 0) {
          return item.communityAvg !== null && item.communityAvg >= minRatingNum
        }
        return true
      })

    res.json({
      data: results,
      total: minRatingNum ? results.length : total,
      page: pageNum,
      limit: limitNum,
    })
  } catch (err) {
    logger.error({ logId: 'amber-seeking-leaf', err }, 'Failed to list media')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/media/:id
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  try {
    const userId = req.user?.id
    const media = await prisma.media.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        releaseDate: true,
        mediaType: true,
        contentRating: true,
        synopsis: true,
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
        ratings: {
          select: { stars: true, userId: true },
        },
      },
    })

    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    const ratings = media.ratings as RatingRecord[]
    const communityCount = ratings.length
    const communityAvg =
      communityCount > 0
        ? Math.round((ratings.reduce((sum: number, r: RatingRecord) => sum + r.stars, 0) / communityCount) * 10) / 10
        : null
    const userRating = userId ? (ratings.find((r: RatingRecord) => r.userId === userId)?.stars ?? null) : null

    res.json({
      id: media.id,
      title: media.title,
      imageUrl: media.imageUrl,
      releaseDate: media.releaseDate,
      mediaType: media.mediaType,
      contentRating: media.contentRating,
      synopsis: media.synopsis,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
      castRoles: media.castRoles,
      communityAvg,
      communityCount,
      userRating,
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
        releaseDate: parsed.data.releaseDate ? new Date(parsed.data.releaseDate) : null,
        contentRating: parsed.data.contentRating ?? null,
        synopsis: parsed.data.synopsis ?? null,
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        releaseDate: true,
        mediaType: true,
        contentRating: true,
        synopsis: true,
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
router.put('/:id', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
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
        ...(parsed.data.releaseDate !== undefined
          ? { releaseDate: parsed.data.releaseDate ? new Date(parsed.data.releaseDate) : null }
          : {}),
        ...(parsed.data.contentRating !== undefined ? { contentRating: parsed.data.contentRating } : {}),
        ...(parsed.data.synopsis !== undefined ? { synopsis: parsed.data.synopsis } : {}),
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        releaseDate: true,
        mediaType: true,
        contentRating: true,
        synopsis: true,
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
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: Request, res: Response): Promise<void> => {
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

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2025'
  )
}

export default router
