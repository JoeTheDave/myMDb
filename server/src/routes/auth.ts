import { Router, Request, Response } from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { authenticate } from '../middleware/authenticate'
import { logger } from '../lib/logger'

const router = Router()

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
      callbackURL: process.env['GOOGLE_CALLBACK_URL'] ?? '',
    },
    async (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
      try {
        const email = profile.emails?.[0]?.value
        if (!email) return done(null, false)

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.active) return done(null, false)

        const name = profile.displayName ?? user.name ?? null
        const imageUrl = profile.photos?.[0]?.value ?? user.imageUrl ?? null

        const updated = await prisma.user.update({
          where: { email },
          data: {
            ...(name !== null ? { name } : {}),
            ...(imageUrl !== null ? { imageUrl } : {}),
          },
          select: { id: true, email: true, name: true, imageUrl: true, role: true, active: true },
        })

        return done(null, updated)
      } catch (err) {
        return done(err as Error)
      }
    },
  ),
)

// GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))

// GET /api/auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env['FRONTEND_URL'] ?? ''}/login?error=unauthorized`,
  }),
  (req: Request, res: Response): void => {
    const user = req.user as { id: string; email: string; role: string } | undefined
    if (!user) {
      res.redirect(`${process.env['FRONTEND_URL'] ?? ''}/login?error=unauthorized`)
      return
    }
    const token = signToken({ sub: user.id, email: user.email, role: user.role })
    const isProduction = process.env['NODE_ENV'] === 'production'
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    })
    logger.info({ logId: 'warm-landing-crane', userId: user.id }, 'User logged in via Google OAuth')
    res.redirect(`${process.env['FRONTEND_URL'] ?? ''}/movies`)
  },
)

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token')
  res.status(200).json({ message: 'Logged out' })
})

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, imageUrl: true, role: true },
    })
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    res.json(user)
  } catch (err) {
    logger.error({ logId: 'cold-finding-owl', err }, 'Failed to fetch current user')
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
