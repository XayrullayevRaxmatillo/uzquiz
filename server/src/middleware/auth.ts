import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { timingSafeEqual } from 'node:crypto'
import { env, isProd } from '../config/env.js'
import { User, type UserDoc } from '../models/User.js'
import { forbidden, unauthorized } from '../utils/errors.js'
import { randomToken } from '../utils/crypto.js'

export const SESSION_COOKIE = 'uzquiz_session'

interface Claims {
  sub: string
  csrf: string
  tv: number
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { user: UserDoc; csrf: string }
  }
}

export function issueSession(res: Response, user: { id: string }, tokenVersion: number): string {
  const csrf = randomToken(24)
  const token = jwt.sign({ sub: user.id, csrf, tv: tokenVersion } satisfies Claims, env.JWT_SECRET, {
    expiresIn: `${env.SESSION_DAYS}d`,
    algorithm: 'HS256',
  })
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    maxAge: env.SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  })
  return csrf
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: isProd || env.COOKIE_SAMESITE === 'none', sameSite: env.COOKIE_SAMESITE, path: '/' })
}

export function verifyToken(token: string | undefined): Claims | null {
  if (!token) return null
  try {
    const c = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as Claims
    return c && typeof c.sub === 'string' ? c : null
  } catch {
    return null
  }
}

export async function loadUserFromClaims(c: Claims): Promise<UserDoc | null> {
  const user = await User.findById(c.sub).select('+tokenVersion')
  if (!user || user.banned) return null
  if ((user.get('tokenVersion') as number) !== c.tv) return null
  return user
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function csrfOk(expected: string, got: unknown): boolean {
  if (typeof got !== 'string') return false
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Requires a valid session; enforces the CSRF token on state-changing requests. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const claims = verifyToken(req.cookies?.[SESSION_COOKIE])
    if (!claims) return next(unauthorized())
    if (!SAFE_METHODS.has(req.method) && !csrfOk(claims.csrf, req.get('x-csrf-token'))) return next(forbidden('CSRF'))
    const user = await loadUserFromClaims(claims)
    if (!user) return next(unauthorized())
    req.auth = { user, csrf: claims.csrf }
    touchPresence(user)
    next()
  } catch (e) {
    next(e)
  }
}

/** Presence for "online"/"available now": updated at most once a minute per user. */
function touchPresence(user: UserDoc) {
  const last = user.lastSeenAt?.getTime() ?? 0
  if (Date.now() - last > 60_000) {
    user.lastSeenAt = new Date()
    void User.updateOne({ _id: user._id }, { lastSeenAt: user.lastSeenAt }).catch(() => undefined)
  }
}

/** Attaches the user when a valid session exists, otherwise continues anonymously. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const claims = verifyToken(req.cookies?.[SESSION_COOKIE])
    if (claims) {
      const user = await loadUserFromClaims(claims)
      if (user) req.auth = { user, csrf: claims.csrf }
    }
    next()
  } catch (e) {
    next(e)
  }
}

/** Server-side role check. Always chain after requireAuth. */
export const requireRole =
  (...roles: Array<'user' | 'moderator' | 'admin'>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized())
    if (!roles.includes(req.auth.user.role)) return next(forbidden())
    next()
  }

export const me = (req: Request): UserDoc => {
  if (!req.auth) throw unauthorized()
  return req.auth.user
}
