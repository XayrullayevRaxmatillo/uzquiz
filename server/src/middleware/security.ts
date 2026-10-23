import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { badRequest } from '../utils/errors.js'

/** Reject MongoDB operator injection ({"$gt": ""}) and dotted keys anywhere in the payload. */
function hasUnsafeKey(v: unknown, depth = 0): boolean {
  if (depth > 12) return true
  if (Array.isArray(v)) return v.some((x) => hasUnsafeKey(x, depth + 1))
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k.startsWith('$') || k.includes('.')) return true
      if (hasUnsafeKey(val, depth + 1)) return true
    }
  }
  return false
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query) || hasUnsafeKey(req.params)) {
    return next(badRequest('INVALID_INPUT', 'Unsafe characters in request'))
  }
  next()
}

const limiterMessage = { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down.' } }

const make = (windowMs: number, limit: number) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: limiterMessage, skip: () => process.env.NODE_ENV === 'test' })

export const apiLimiter = make(60_000, 300)
export const loginLimiter = make(15 * 60_000, 10)
export const registerLimiter = make(60 * 60_000, 20)
export const sensitiveLimiter = make(60 * 60_000, 8) // forgot / reset / resend
export const writeLimiter = make(60_000, 60)
