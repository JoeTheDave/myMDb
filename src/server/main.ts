import express from 'express'
import ViteExpress from 'vite-express'
import dotenv from 'dotenv'

import dataService from './prisma/dataService.ts'

dotenv.config()

const port = parseInt(process.env.PORT || '')
const app = express()

app.get('/node-environment', (req, res) => {
  res.send(`Node.js environment: ${process.env.NODE_ENV}, ${process.env.NODE_ENV === 'development'}`)
})

app.get('/create', async (req, res) => {
  const user = await dataService.createAppUser('joethedave@gmail.com', 'asdf')
  res.send(`User created: ${user.email}`)
})

app.get('/retreive', async (req, res) => {
  const user = await dataService.getAppUserByEmail('joethedave@gmail.com')
  if (user) {
    res.send(`Found user: ${user.email}`)
  } else {
    res.send(`User not found`)
  }
})

ViteExpress.listen(app, port, () => {
  const url = `http://localhost:${port}`
  console.log(`Server running at ${url}`)
})
