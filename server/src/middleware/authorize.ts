import { Request, Response, NextFunction } from 'express'

type Role = 'VIEWER' | 'EDITOR' | 'ADMIN'

const roleRank: Record<Role, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
}

export function authorize(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as Role | undefined
    if (!userRole || !(userRole in roleRank)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    const rank = roleRank[userRole]
    if (rank === undefined || rank < roleRank[minRole]) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  }
}
