import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { deleteS3Object } from '../lib/s3'
import { logger } from '../lib/logger'

const router = Router({ mergeParams: true })

const createRoleSchema = z.object({
  characterName: z.string().min(1),
  actorId: z.string().min(1),
  roleImageUrl: z.string().url().optional(),
})

const updateRoleSchema = z.object({
  characterName: z.string().min(1).optional(),
  roleImageUrl: z.string().url().optional(),
})

function isS3Url(url: string | null | undefined): boolean {
  return !!url && url.includes('.s3.') && url.includes('amazonaws.com')
}

// POST /api/media/:id/roles
router.post('/', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const mediaId = req.params['id']
  if (!mediaId) {
    res.status(400).json({ error: 'Missing media id' })
    return
  }
  const parsed = createRoleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { characterName, actorId, roleImageUrl } = parsed.data
  try {
    const media = await prisma.media.findUnique({ where: { id: mediaId }, select: { id: true } })
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }
    const actor = await prisma.actor.findUnique({ where: { id: actorId }, select: { id: true } })
    if (!actor) {
      res.status(404).json({ error: 'Actor not found' })
      return
    }

    const role = await prisma.castRole.create({
      data: {
        characterName,
        actorId,
        mediaId,
        roleImageUrl: roleImageUrl ?? null,
      },
      select: {
        id: true,
        characterName: true,
        roleImageUrl: true,
        actorId: true,
        mediaId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    logger.info({ logId: 'grand-making-robin', roleId: role.id }, 'Cast role created')
    res.status(201).json(role)
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: 'Actor already has a role in this media' })
      return
    }
    logger.error({ logId: 'blunt-pushing-toad', err }, 'Failed to create cast role')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/roles/:id — handled by the standalone router in index.ts
export const rolesRouter = Router()

rolesRouter.put('/:id', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  const parsed = updateRoleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const existing = await prisma.castRole.findUnique({ where: { id }, select: { id: true, roleImageUrl: true } })
    if (!existing) {
      res.status(404).json({ error: 'Cast role not found' })
      return
    }

    const role = await prisma.castRole.update({
      where: { id },
      data: {
        ...(parsed.data.characterName !== undefined ? { characterName: parsed.data.characterName } : {}),
        ...(parsed.data.roleImageUrl !== undefined ? { roleImageUrl: parsed.data.roleImageUrl } : {}),
      },
      select: {
        id: true,
        characterName: true,
        roleImageUrl: true,
        actorId: true,
        mediaId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (
      parsed.data.roleImageUrl !== undefined &&
      parsed.data.roleImageUrl !== existing.roleImageUrl &&
      isS3Url(existing.roleImageUrl)
    ) {
      await deleteS3Object(existing.roleImageUrl!)
    }

    logger.info({ logId: 'wise-marking-wren', roleId: role.id }, 'Cast role updated')
    res.json(role)
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Cast role not found' })
      return
    }
    logger.error({ logId: 'flat-rolling-kite', err }, 'Failed to update cast role')
    res.status(500).json({ error: 'Internal server error' })
  }
})

rolesRouter.delete('/:id', authenticate, authorize('EDITOR'), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  try {
    const existing = await prisma.castRole.findUnique({ where: { id }, select: { id: true, roleImageUrl: true } })
    if (!existing) {
      res.status(404).json({ error: 'Cast role not found' })
      return
    }

    if (isS3Url(existing.roleImageUrl)) {
      await deleteS3Object(existing.roleImageUrl!)
    }

    await prisma.castRole.delete({ where: { id } })
    logger.info({ logId: 'stern-cutting-crow', roleId: id }, 'Cast role deleted')
    res.status(204).send()
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Cast role not found' })
      return
    }
    logger.error({ logId: 'dull-falling-moth', err }, 'Failed to delete cast role')
    res.status(500).json({ error: 'Internal server error' })
  }
})

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  )
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2025'
  )
}

export default router
