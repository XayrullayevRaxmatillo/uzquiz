import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { AppError } from '../utils/errors.js'
import { isProd } from '../config/env.js'

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message, fields: err.fields } })
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const fields: Record<string, string> = {}
    for (const [k, v] of Object.entries(err.errors)) fields[k] = v.message
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Invalid input', fields } })
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid identifier' } })
  }
  const e = err as { code?: number; type?: string; status?: number }
  if (e?.code === 11000) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Duplicate value' } })
  }
  if (e?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'BAD_JSON', message: 'Malformed JSON' } })
  }
  // Never leak internals or secrets. Log only the message/stack, not request bodies.
  console.error('[error]', err instanceof Error ? (isProd ? err.message : err.stack) : err)
  res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Internal server error' } })
}
