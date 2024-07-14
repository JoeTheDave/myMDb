import { Express } from 'express'
import {
  authorizeRequest,
  generatePasswordHash,
  getAccountIdFromRequest,
  signAccessToken,
  validateAccountPassword,
} from '@/server/lib/authorization.ts'
import dataService from '@/server/prisma/dataService.ts'
import { validateEmail, validatePassword, appConstants } from '@/shared/utils.ts'
import imageProcessingService from '@/server/lib/imageProcessingService.ts'
import { AppUserIdentity } from '@/server/lib/types.ts'
import { createResponse } from '@/server/lib/util.ts'
import { Movie } from '@/shared/types.ts'

const apiRoutes = (app: Express) => {
  app.post('/api/create-account', async (req, res) => {
    try {
      const { email, password } = req.body as {
        email: string
        password: string
      }
      if (validateEmail(email)) {
        throw new Error('Not a valid email address.')
      }
      if (validatePassword(password)) {
        throw new Error('Password does not meet requirements.')
      }
      const passwordHash = await generatePasswordHash(password)
      const appUser = await dataService.createAppUser(email, passwordHash)
      if (!appUser) {
        throw new Error('Error creating appUser.')
      }
    } catch (e) {
      console.log((e as Error).message)
      return res.status(200).send({ success: false, message: 'Unable to create account.' })
    }
    console.log('Account created successfully.')
    return res.status(200).send({ success: true, message: '' })
  })

  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body as {
        email: string
        password: string
      }
      const appUser = await dataService.getAppUserByEmail(email)
      if (!appUser) {
        console.log('Cannot find account')
        throw new Error('Cannot find account')
      }
      const validCredentials = await validateAccountPassword(password, appUser.passwordHash)
      if (!validCredentials) {
        console.log('Invalid Credentials')
        throw new Error('Invalid Credentials')
      }
      const accessToken = await signAccessToken(appUser.id)
      res.cookie(appConstants.cookies.authorization, accessToken, {
        httpOnly: true,
        // TODO: Make this cookie more secure and implement refresh tokens
        // secure: true,
        // maxAge: 1000000,
        // signed: true,
      })
      res.cookie(appConstants.cookies.appUserIdentity, {
        user: appUser.email,
        role: appUser.role,
        loggedIn: true,
      } as AppUserIdentity)
      return res.status(200).send({ success: true, message: '' })
    } catch (e) {
      console.log((e as Error).message)
      return res.status(200).send({ success: false, message: 'Unable to login.' })
    }
  })

  // app.get('/api/is-logged-in', authorizeRequest, (req, res) => {
  //   const accountId = getAccountIdFromRequest(req)
  //   if (!accountId) {
  //     return res.status(200).send({ authorized: false })
  //   }
  //   return res.status(200).send({ authorized: true })
  // })

  app.post('/api/logout', (req, res) => {
    res.clearCookie(appConstants.cookies.authorization)
    res.clearCookie(appConstants.cookies.appUserIdentity)
    return res.status(200).send({ success: true })
  })

  // app.get('/node-environment', (req, res) => {
  //   res.send(`Node.js environment: ${process.env.NODE_ENV}, ${process.env.NODE_ENV === 'development'}`)
  // })

  app.post('/api/pre-process-img', async (req, res) => {
    const { file } = req.body as {
      file: string
    }
    const processedFile = await imageProcessingService.processImageLg(file)
    return res.status(200).send({ success: true, data: { processedFile } })
  })

  app.post('/api/save-movie', async (req, res) => {
    const movie = req.body as Movie
    const smallImage = await imageProcessingService.processImageSm(movie.movieImage)
    const imageKey = await imageProcessingService.uploadImage(movie.movieImage)
    const thumbnailKey = await imageProcessingService.uploadImage(smallImage)
    movie.movieImage = imageKey
    movie.movieThumbnail = thumbnailKey
    const savedMovie = await dataService.saveMovie(movie)
    return res.status(200).send(createResponse<Movie>({ data: savedMovie }))
  })
}

export default apiRoutes
