import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { badRequest } from '../utils/errors.js'

interface Schemas {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const key = i.path.map(String).join('.') || '_'
    if (!(key in out)) out[key] = i.message
  }
  return out
}

/** Validates and replaces body; parsed query/params are exposed on res.locals (Express 5 makes req.query read-only). */
export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) {
      const r = schemas.body.safeParse(req.body ?? {})
      if (!r.success) return next(badRequest('VALIDATION', 'Invalid input', fieldErrors(r.error.issues)))
      req.body = r.data
    }
    if (schemas.query) {
      const r = schemas.query.safeParse(req.query)
      if (!r.success) return next(badRequest('VALIDATION', 'Invalid query', fieldErrors(r.error.issues)))
      res.locals.query = r.data
    }
    if (schemas.params) {
      const r = schemas.params.safeParse(req.params)
      if (!r.success) return next(badRequest('VALIDATION', 'Invalid parameters', fieldErrors(r.error.issues)))
      res.locals.params = r.data
    }
    next()
  }
}

export const q = <T>(res: Response) => res.locals.query as T
export const p = <T>(res: Response) => res.locals.params as T
