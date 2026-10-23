import { Router } from 'express'
import { z } from 'zod'
import { ok, handler } from '../../utils/http.js'
import { q, validate } from '../../middleware/validate.js'
import { me, optionalAuth, requireAuth } from '../../middleware/auth.js'
import * as svc from './service.js'

export const statsRouter = Router()

const lbQuery = z.object({ scope: z.enum(['global', 'weekly', 'category', 'friends', 'teams']).default('global'), category: z.string().max(30).optional() })

statsRouter.get('/leaderboard', optionalAuth, validate({ query: lbQuery }), handler(async (req, res) => {
  const { scope, category } = q<z.infer<typeof lbQuery>>(res)
  ok(res, await svc.leaderboard(scope, req.auth?.user, category))
}))
statsRouter.get('/daily', optionalAuth, handler(async (req, res) => ok(res, { daily: await svc.dailyChallenge(req.auth?.user) })))
statsRouter.get('/stats/me', requireAuth, handler(async (req, res) => ok(res, await svc.dashboard(me(req)))))
