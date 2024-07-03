import { Movie } from '@/shared/types.ts'
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

const saveMovie = async (movie: Movie) =>
  await db.movie.create({
    data: {
      name: movie.movieName,
      movieImage: movie.movieImage,
      movieThumbnail: movie.movieThumbnail,
      mpaRating: movie.mpaRating,
      releaseDate: new Date(`${movie.releaseYear}-01-01`),
    },
  })

const dataService = {
  createAppUser,
  getAppUserByEmail,
  saveMovie,
}

export default dataService
