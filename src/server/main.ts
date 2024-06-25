import express from 'express'
import ViteExpress from 'vite-express'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import apiRoutes from './lib/apiRoutes.ts'
import { setGenericUserCookie } from '@/server/lib/authorization.ts'

dotenv.config()

const port = parseInt(process.env.PORT || '')
const app = express()
app.use(express.json())
app.use(cookieParser())
app.use(setGenericUserCookie)

apiRoutes(app)

ViteExpress.listen(app, port, () => {
  const url = `http://localhost:${port}`
  console.log(`Server running at ${url}`)
})
