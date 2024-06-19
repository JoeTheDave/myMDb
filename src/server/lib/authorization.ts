import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'

import { appConstants } from '@/server/lib/util.ts'
import { AppUserIdentity } from '@/server/lib/types.ts'

interface AuthorizationPayload extends JwtPayload {
  accountId: string
}
interface AuthorizedRequest extends Request {
  accountId: string
}

const getAccessTokenSecretKey = () => {
  const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET
  if (!accessTokenSecret) {
    console.log('Could not find JWT Secret Key')
    throw 'Could not find ACCESS_TOKEN_SECRET'
  }
  return accessTokenSecret
}

export const generatePasswordHash = async (password: string) => {
  const salt = await bcrypt.genSalt()
  const passwordHash = await bcrypt.hash(password, salt)
  return passwordHash
}

export const validateAccountPassword = async (password: string, passwordHash: string) =>
  await bcrypt.compare(password, passwordHash)

export const signAccessToken = async (accountId: string) => await jwt.sign({ accountId }, getAccessTokenSecretKey())

export const setGenericUserCookie = (req: Request, res: Response, next: NextFunction) => {
  if (!req.cookies[appConstants.cookies.appUserIdentity]) {
    console.log('no cookie found')
    res.cookie(appConstants.cookies.appUserIdentity, {
      user: uuid(),
      role: 'viewer',
      loggedIn: false,
    } as AppUserIdentity)
  }
  next()
}

export const authorizeRequest = (req: Request, res: Response, next: NextFunction) => {
  const accessToken = req.cookies['authorization']

  if (!accessToken) {
    console.log('No Access Token')
    return res.status(401).send({ authorized: false })
  }
  let accountId: string | null = null
  try {
    const decoded = jwt.verify(accessToken, getAccessTokenSecretKey()) as AuthorizationPayload
    accountId = decoded.accountId
  } catch (e) {
    console.log('Invalid Access Token')
    return res.status(401).send({ authorized: false })
  }
  if (accountId) {
    ;(req as AuthorizedRequest).accountId = accountId
  } else {
    console.log('Missing accountId in Access Token')
    return res.status(401).send({ authorized: false })
  }
  next()
}

export const getAccountIdFromRequest = (req: Request) => {
  return (req as AuthorizedRequest).accountId || null
}
