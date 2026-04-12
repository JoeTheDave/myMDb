import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { logger } from './lib/logger'
import { seedAdminUser } from './lib/seed'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import mediaRouter from './routes/media'
import actorsRouter from './routes/actors'
import mediaRolesRouter from './routes/roles'
import { rolesRouter } from './routes/roles'
import uploadRouter from './routes/upload'

const app = express()

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'blob:', 'data:', '*.amazonaws.com'],
      },
    },
  }),
)
app.use(
  cors({
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())
app.use(passport.initialize())

// Rate limiting on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests, please try again later' },
})
app.use('/api/auth', authLimiter)

// Mount routers
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/media', mediaRouter)
app.use('/api/media/:id/roles', mediaRolesRouter)
app.use('/api/actors', actorsRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/upload', uploadRouter)

// Serve static files in production
if (process.env['NODE_ENV'] === 'production') {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist')
  app.use(express.static(clientDist))
  app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ logId: 'stark-falling-stone', err }, 'Unhandled server error')
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env['PORT'] ?? 3001

async function start() {
  try {
    await seedAdminUser()
    logger.info({ logId: 'bright-rising-dawn', env: process.env['NODE_ENV'] }, 'Admin user seeded')
  } catch (err) {
    logger.error({ logId: 'harsh-falling-frost', err }, 'Failed to seed admin user')
  }

  app.listen(PORT, () => {
    logger.info({ logId: 'clear-rising-spire', port: PORT }, 'Server started')
  })
}

if (process.env['NODE_ENV'] !== 'test') {
  start().catch(err => {
    logger.error({ logId: 'grim-stopping-hull', err }, 'Failed to start server')
    process.exit(1)
  })
}

export { app }
