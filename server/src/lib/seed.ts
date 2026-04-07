import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const prisma = new PrismaClient()

export async function seedAdminUser() {
  await prisma.user.upsert({
    where: { email: 'joethedave@gmail.com' },
    update: { role: 'ADMIN', active: true },
    create: {
      email: 'joethedave@gmail.com',
      name: 'Joe',
      role: 'ADMIN',
      active: true,
    },
  })
}

// Allow running standalone
if (require.main === module) {
  seedAdminUser()
    .then(() => {
      logger.info({ logId: 'fresh-rising-bloom' }, 'Admin user seeded')
      process.exit(0)
    })
    .catch((err: unknown) => {
      logger.error({ logId: 'rough-seeding-fault', err }, 'Failed to seed admin user')
      process.exit(1)
    })
}
