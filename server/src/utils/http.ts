import type { NextFunction, Request, RequestHandler, Response } from 'express'

export const ok = <T>(res: Response, data: T, status = 200) => res.status(status).json({ success: true, data })

/** Wrap async handlers so rejected promises reach the error middleware (Express 5 does this too, kept explicit for clarity). */
export const handler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }
