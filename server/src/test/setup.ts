import { PrismaClient } from '@prisma/client'
import { beforeEach, afterAll } from 'vitest'

// Set env vars before any module imports resolve
process.env['DATABASE_URL'] = 'postgresql://postgres:localdev123@localhost:5432/mymdb_test'
process.env['JWT_SECRET'] = 'test-secret-at-least-32-chars-long'
process.env['NODE_ENV'] = 'test'
process.env['GOOGLE_CLIENT_ID'] = 'test-google-client-id'
process.env['GOOGLE_CLIENT_SECRET'] = 'test-google-client-secret'
process.env['GOOGLE_CALLBACK_URL'] = 'http://localhost:3001/api/auth/google/callback'
process.env['FRONTEND_URL'] = 'http://localhost:5173'
process.env['AWS_BUCKET_NAME'] = 'mymdb-test-assets'
process.env['AWS_REGION'] = 'us-east-1'

const databaseUrl = process.env['DATABASE_URL']
const prisma = new PrismaClient(
  databaseUrl !== undefined ? { datasources: { db: { url: databaseUrl } } } : undefined,
)

beforeEach(async () => {
  await prisma.castRole.deleteMany()
  await prisma.media.deleteMany()
  await prisma.actor.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})
