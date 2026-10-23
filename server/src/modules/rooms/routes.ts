import { Router } from 'express'
import { z } from 'zod'
import { ok, handler } from '../../utils/http.js'
import { p, validate } from '../../middleware/validate.js'
import { me, requireAuth } from '../../middleware/auth.js'
import { writeLimiter } from '../../middleware/security.js'
import { objectId } from '../../utils/schemas.js'
import * as svc from './service.js'

export const roomsRouter = Router()
roomsRouter.use(requireAuth)

const codeParams = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, 'INVALID_CODE') })
const createBody = z.object({
  quizId: objectId,
  teamMode: z.boolean().default(false),
  questionCount: z.number().int().min(1).max(100).optional(),
  timeLimit: z.number().int().min(0).max(120).default(0),
  maxPlayers: z.number().int().min(1).max(100).default(8),
  visibility: z.enum(['public', 'private']).default('private'),
  speedBonus: z.number().int().min(0).max(2000).default(500),
})

roomsRouter.get('/public', handler(async (_req, res) => ok(res, { items: await svc.publicRooms() })))

roomsRouter.post('/', writeLimiter, validate({ body: createBody }), handler(async (req, res) => {
  const room = await svc.createRoom(me(req), req.body)
  ok(res, { code: room.roomCode }, 201)
}))

roomsRouter.get('/:code', validate({ params: codeParams }), handler(async (req, res) => ok(res, { room: await svc.previewRoom(p<{ code: string }>(res).code, me(req)) })))
roomsRouter.get('/:code/results', validate({ params: codeParams }), handler(async (req, res) => ok(res, await svc.resultsFor(p<{ code: string }>(res).code, me(req)))))
