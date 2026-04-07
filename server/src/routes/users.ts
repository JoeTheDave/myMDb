import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { logger } from '../lib/logger'

const router = Router()

router.use(authenticate, authorize('ADMIN'))

const createUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['VIEWER', 'EDITOR', 'ADMIN']),
})

const updateUserSchema = z.object({
  role: z.enum(['VIEWER', 'EDITOR', 'ADMIN']).optional(),
  active: z.boolean().optional(),
})

// GET /api/users
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        imageUrl: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(users)
  } catch (err) {
    logger.error({ logId: 'bright-seeking-brook', err }, 'Failed to list users')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/users
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { email, role } = parsed.data
  try {
    const user = await prisma.user.create({
      data: { email, role, active: true },
      select: { id: true, email: true, name: true, imageUrl: true, role: true, active: true, createdAt: true },
    })
    logger.info({ logId: 'firm-sending-seed', userId: user.id }, 'User created')
    res.status(201).json(user)
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: 'Email already exists' })
      return
    }
    logger.error({ logId: 'harsh-pushing-thorn', err }, 'Failed to create user')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/users/:id
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = updateUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  const adminId = req.user?.id
  if (parsed.data.active === false && id === adminId) {
    res.status(400).json({ error: 'Cannot deactivate your own account' })
    return
  }
  try {
    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, email: true, name: true, imageUrl: true, role: true, active: true, createdAt: true },
    })
    logger.info({ logId: 'swift-marking-ridge', userId: user.id }, 'User updated')
    res.json(user)
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    logger.error({ logId: 'lean-climbing-mast', err }, 'Failed to update user')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/users/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }
  const adminId = req.user?.id
  if (id === adminId) {
    res.status(400).json({ error: 'Cannot delete your own account' })
    return
  }
  try {
    await prisma.user.delete({ where: { id } })
    logger.info({ logId: 'raw-cutting-root', userId: id }, 'User deleted')
    res.status(204).send()
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    logger.error({ logId: 'dark-rolling-stone', err }, 'Failed to delete user')
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
