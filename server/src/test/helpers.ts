import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

export function makeToken(user: { id: string; email: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env['JWT_SECRET'] ?? 'test-secret',
    { expiresIn: '1h' },
  )
}

export async function createUser(
  overrides: Partial<{ email: string; role: string; active: boolean }> = {},
) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      role: (overrides.role as 'ADMIN' | 'EDITOR' | 'VIEWER') ?? 'VIEWER',
      active: overrides.active ?? true,
    },
  })
}

export async function createMedia(
  overrides: Partial<{ title: string; mediaType: string }> = {},
) {
  return prisma.media.create({
    data: {
      title: overrides.title ?? 'Test Movie',
      mediaType: (overrides.mediaType as 'MOVIE' | 'SHOW') ?? 'MOVIE',
    },
  })
}

export async function createActor(overrides: Partial<{ name: string }> = {}) {
  return prisma.actor.create({
    data: { name: overrides.name ?? 'Test Actor' },
  })
}
