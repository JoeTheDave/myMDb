import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { deleteS3Object } from '../lib/s3'
import { logger } from '../lib/logger'

const router = Router()

const listQuerySchema = z.object({
  q: z.string().optional(),
  birthYearFrom: z.string().optional(),
  birthYearTo: z.string().optional(),
  deceased: z.string().optional(),
  mediaId: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
})

const createActorSchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().url().optional(),
  birthday: z.string().datetime({ offset: true }).optional(),
  deathDay: z.string().datetime({ offset: true }).optional(),
})

const updateActorSchema = createActorSchema.partial()

function isS3Url(url: string | null | undefined): boolean {
  return !!url && url.includes('.s3.') && url.includes('amazonaws.com')
}

// GET /api/actors
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { q, birthYearFrom, birthYearTo, deceased, mediaId, page, limit } = parsed.data
  const pageNum = Math.max(1, parseInt(page ?? '1', 10))
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '24', 10)))
  const skip = (pageNum - 1) * limitNum

  try {
    const where: {
      name?: { contains: string; mode: 'insensitive' }
      birthday?: { gte?: Date; lte?: Date }
      deathDay?: { not: null } | null
      castRoles?: { some: { mediaId: string } }
    } = {}

    if (q) {
      where.name = { contains: q, mode: 'insensitive' }
    }
    if (birthYearFrom || birthYearTo) {
      where.birthday = {}
      if (birthYearFrom) {
        where.birthday.gte = new Date(`${birthYearFrom}-01-01T00:00:00.000Z`)
      }
      if (birthYearTo) {
        where.birthday.lte = new Date(`${birthYearTo}-12-31T23:59:59.999Z`)
      }
    }
    if (deceased !== undefined) {
      if (deceased === 'true') {
        where.deathDay = { not: null }
      } else if (deceased === 'false') {
        where.deathDay = null
      }
    }
    if (mediaId) {
      where.castRoles = { some: { mediaId } }
    }

    const [actors, total] = await Promise.all([
      prisma.actor.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          birthday: true,
          deathDay: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.actor.count({ where }),
    ])

    res.json({ items: actors, total, page: pageNum, totalPages: Math.ceil(total / limitNum) })
  } catch (err) {
    logger.error({ logId: 'mild-seeking-fern', err }, 'Failed to list actors')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/actors/:id
router.get('/:id', authenticate, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  try {
    const actor = await prisma.actor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        birthday: true,
        deathDay: true,
        createdAt: true,
        updatedAt: true,
        castRoles: {
          select: {
            id: true,
            characterName: true,
            roleImageUrl: true,
            media: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                mediaType: true,
                releaseYear: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!actor) {
      res.status(404).json({ error: 'Actor not found' })
      return
    }
    res.json({
      id: actor.id,
      name: actor.name,
      imageUrl: actor.imageUrl,
      birthday: actor.birthday,
      deathDay: actor.deathDay,
      filmography: actor.castRoles.map((role: { id: string; characterName: string; roleImageUrl: string | null; media: { id: string; title: string; imageUrl: string | null; mediaType: string; releaseYear: number | null } }) => ({
        id: role.media.id,
        title: role.media.title,
        imageUrl: role.media.imageUrl,
        mediaType: role.media.mediaType,
        releaseYear: role.media.releaseYear,
        characterName: role.characterName,
        roleImageUrl: role.roleImageUrl,
      })),
    })
  } catch (err) {
    logger.error({ logId: 'pure-finding-hawk', err }, 'Failed to fetch actor by id')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/actors
router.post('/', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createActorSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const actor = await prisma.actor.create({
      data: {
        name: parsed.data.name,
        imageUrl: parsed.data.imageUrl ?? null,
        birthday: parsed.data.birthday ? new Date(parsed.data.birthday) : null,
        deathDay: parsed.data.deathDay ? new Date(parsed.data.deathDay) : null,
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        birthday: true,
        deathDay: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    logger.info({ logId: 'bright-making-jay', actorId: actor.id }, 'Actor created')
    res.status(201).json(actor)
  } catch (err) {
    logger.error({ logId: 'cold-pushing-reed', err }, 'Failed to create actor')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/actors/:id
router.put('/:id', authenticate, authorize('EDITOR'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  const parsed = updateActorSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const existing = await prisma.actor.findUnique({ where: { id }, select: { id: true, imageUrl: true } })
    if (!existing) {
      res.status(404).json({ error: 'Actor not found' })
      return
    }

    const actor = await prisma.actor.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl } : {}),
        ...(parsed.data.birthday !== undefined
          ? { birthday: parsed.data.birthday ? new Date(parsed.data.birthday) : null }
          : {}),
        ...(parsed.data.deathDay !== undefined
          ? { deathDay: parsed.data.deathDay ? new Date(parsed.data.deathDay) : null }
          : {}),
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        birthday: true,
        deathDay: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (
      parsed.data.imageUrl !== undefined &&
      parsed.data.imageUrl !== existing.imageUrl &&
      isS3Url(existing.imageUrl)
    ) {
      await deleteS3Object(existing.imageUrl!)
    }

    logger.info({ logId: 'calm-marking-elm', actorId: actor.id }, 'Actor updated')
    res.json(actor)
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Actor not found' })
      return
    }
    logger.error({ logId: 'dense-rolling-bark', err }, 'Failed to update actor')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/actors/:id
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  try {
    const actor = await prisma.actor.findUnique({ where: { id }, select: { id: true, imageUrl: true } })
    if (!actor) {
      res.status(404).json({ error: 'Actor not found' })
      return
    }
    if (isS3Url(actor.imageUrl)) {
      await deleteS3Object(actor.imageUrl!)
    }
    await prisma.actor.delete({ where: { id } })
    logger.info({ logId: 'sharp-cutting-yew', actorId: id }, 'Actor deleted')
    res.status(204).send()
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Actor not found' })
      return
    }
    logger.error({ logId: 'dark-falling-pine', err }, 'Failed to delete actor')
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
