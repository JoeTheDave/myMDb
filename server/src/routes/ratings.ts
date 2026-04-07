import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { logger } from '../lib/logger'

const router = Router({ mergeParams: true })

const upsertRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
})

// PUT /api/media/:id/ratings
router.put('/', authenticate, authorize('VIEWER'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const mediaId = req.params['id']
  if (!mediaId) {
    res.status(400).json({ error: 'Missing media id' })
    return
  }
  const parsed = upsertRatingSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const userId = req.user!.id
  try {
    const media = await prisma.media.findUnique({ where: { id: mediaId }, select: { id: true } })
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    const rating = await prisma.rating.upsert({
      where: { userId_mediaId: { userId, mediaId } },
      create: { userId, mediaId, stars: parsed.data.stars },
      update: { stars: parsed.data.stars },
      select: { id: true, stars: true, userId: true, mediaId: true, createdAt: true, updatedAt: true },
    })
    logger.info({ logId: 'warm-sending-star', ratingId: rating.id }, 'Rating upserted')
    res.json(rating)
  } catch (err) {
    logger.error({ logId: 'bold-rolling-tide', err }, 'Failed to upsert rating')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/media/:id/ratings
router.delete('/', authenticate, authorize('VIEWER'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const mediaId = req.params['id']
  if (!mediaId) {
    res.status(400).json({ error: 'Missing media id' })
    return
  }
  const userId = req.user!.id
  try {
    const existing = await prisma.rating.findUnique({
      where: { userId_mediaId: { userId, mediaId } },
      select: { id: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Rating not found' })
      return
    }
    await prisma.rating.delete({ where: { userId_mediaId: { userId, mediaId } } })
    logger.info({ logId: 'slim-cutting-dusk', userId, mediaId }, 'Rating deleted')
    res.status(204).send()
  } catch (err) {
    logger.error({ logId: 'rough-falling-reed', err }, 'Failed to delete rating')
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
