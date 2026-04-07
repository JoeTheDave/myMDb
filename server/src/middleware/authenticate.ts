import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies['token'] as string | undefined
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const payload = verifyToken(token)
    req.user = { id: payload.sub, email: payload.email, role: payload.role }
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
