import { Router } from 'express'
import { z } from 'zod'
import { ok, handler } from '../../utils/http.js'
import { p, validate } from '../../middleware/validate.js'
import * as svc from './service.js'

/** Unauthenticated, minimal share link data. */
export const sharedRouter = Router()
const codeParams = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, 'INVALID_CODE') })
sharedRouter.get('/:code', validate({ params: codeParams }), handler(async (_req, res) => ok(res, await svc.summary(p<{ code: string }>(res).code))))
