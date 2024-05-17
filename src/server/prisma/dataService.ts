import db from './db.ts'

const createAppUser = async (email: string, passwordHash: string) =>
  await db.appUser.create({
    data: {
      email,
      passwordHash,
      role: 'admin',
    },
  })

const getAppUserByEmail = async (email: string) => await db.appUser.findFirst({ where: { email } })

const dataService = {
  createAppUser,
  getAppUserByEmail,
}

export default dataService
