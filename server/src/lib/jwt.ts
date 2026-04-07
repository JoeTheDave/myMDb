import jwt from 'jsonwebtoken'

export interface JwtPayload {
  sub: string
  email: string
  role: string
}

export function signToken(payload: JwtPayload): string {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET is not set')
  const expiresIn = process.env['JWT_EXPIRES_IN'] ?? '30d'
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions)
}

export function verifyToken(token: string): JwtPayload {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET is not set')
  const decoded = jwt.verify(token, secret)
  if (typeof decoded === 'string') throw new Error('Invalid token payload')
  const { sub, email, role } = decoded as jwt.JwtPayload & JwtPayload
  if (!sub || !email || !role) throw new Error('Invalid token payload')
  return { sub, email, role }
}
