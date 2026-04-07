import { PrismaClient } from '@prisma/client'

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
      console.log('Admin user seeded')
      process.exit(0)
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}
