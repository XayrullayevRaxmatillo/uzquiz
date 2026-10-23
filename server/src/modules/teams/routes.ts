import { Router } from 'express'
import { ok, handler } from '../../utils/http.js'
import { p, q, validate } from '../../middleware/validate.js'
import { me, optionalAuth, requireAuth } from '../../middleware/auth.js'
import { writeLimiter } from '../../middleware/security.js'
import { idParams } from '../../utils/schemas.js'
import * as svc from './service.js'
import {
  codeBody, createTeamBody, decisionBody, joinRequestBody, listTeamsQuery, memberParams, queueBody, quickMatchBody, requestParams, roleBody, updateTeamBody,
} from './schemas.js'
import type { z } from 'zod'

export const teamsRouter = Router()

teamsRouter.get('/', optionalAuth, validate({ query: listTeamsQuery }), handler(async (req, res) => {
  ok(res, await svc.listTeams(q<z.infer<typeof listTeamsQuery>>(res), req.auth?.user))
}))

// Fixed paths before "/:id"
teamsRouter.get('/mine', requireAuth, handler(async (req, res) => ok(res, { team: await svc.myTeam(me(req)) })))
teamsRouter.get('/queue', requireAuth, handler(async (req, res) => ok(res, await svc.queueStatus(me(req)))))
teamsRouter.post('/queue', requireAuth, writeLimiter, validate({ body: queueBody }), handler(async (req, res) => ok(res, await svc.joinQueue(me(req), req.body))))
teamsRouter.delete('/queue', requireAuth, writeLimiter, handler(async (req, res) => ok(res, await svc.leaveQueue(me(req)))))

teamsRouter.post('/quick-match', requireAuth, writeLimiter, validate({ body: quickMatchBody }), handler(async (req, res) => {
  const user = me(req)
  const language = req.body.language ?? user.preferredLanguage
  ok(res, await svc.quickMatch(user, { ...req.body, language }))
}))

teamsRouter.post('/join-by-code', requireAuth, writeLimiter, validate({ body: codeBody }), handler(async (req, res) => ok(res, { team: await svc.joinByCode(me(req), req.body.code) })))

teamsRouter.post('/', requireAuth, writeLimiter, validate({ body: createTeamBody }), handler(async (req, res) => ok(res, { team: await svc.createTeam(me(req), req.body) }, 201)))

teamsRouter.get('/:id', optionalAuth, validate({ params: idParams }), handler(async (req, res) => ok(res, { team: await svc.getTeam(p<{ id: string }>(res).id, req.auth?.user) })))

teamsRouter.patch('/:id', requireAuth, writeLimiter, validate({ params: idParams, body: updateTeamBody }), handler(async (req, res) => ok(res, { team: await svc.updateTeam(me(req), p<{ id: string }>(res).id, req.body) })))
teamsRouter.delete('/:id', requireAuth, writeLimiter, validate({ params: idParams }), handler(async (req, res) => ok(res, await svc.disbandTeam(me(req), p<{ id: string }>(res).id))))

teamsRouter.post('/:id/join', requireAuth, writeLimiter, validate({ params: idParams }), handler(async (req, res) => ok(res, { team: await svc.joinPublic(me(req), p<{ id: string }>(res).id) })))
teamsRouter.post('/:id/requests', requireAuth, writeLimiter, validate({ params: idParams, body: joinRequestBody }), handler(async (req, res) => ok(res, await svc.requestJoin(me(req), p<{ id: string }>(res).id, req.body.message), 201)))
teamsRouter.delete('/:id/requests/me', requireAuth, writeLimiter, validate({ params: idParams }), handler(async (req, res) => ok(res, await svc.cancelRequest(me(req), p<{ id: string }>(res).id))))
teamsRouter.get('/:id/requests', requireAuth, validate({ params: idParams }), handler(async (req, res) => ok(res, { requests: await svc.listRequests(me(req), p<{ id: string }>(res).id) })))
teamsRouter.post('/:id/requests/:userId', requireAuth, writeLimiter, validate({ params: requestParams, body: decisionBody }), handler(async (req, res) => {
  const { id, userId } = p<{ id: string; userId: string }>(res)
  ok(res, await svc.decideRequest(me(req), id, userId, req.body.accept))
}))

teamsRouter.post('/:id/leave', requireAuth, writeLimiter, validate({ params: idParams }), handler(async (req, res) => ok(res, await svc.leaveTeam(me(req), p<{ id: string }>(res).id))))
teamsRouter.patch('/:id/members/:userId', requireAuth, writeLimiter, validate({ params: memberParams, body: roleBody }), handler(async (req, res) => {
  const { id, userId } = p<{ id: string; userId: string }>(res)
  ok(res, { team: await svc.setRole(me(req), id, userId, req.body.role) })
}))
teamsRouter.delete('/:id/members/:userId', requireAuth, writeLimiter, validate({ params: memberParams }), handler(async (req, res) => {
  const { id, userId } = p<{ id: string; userId: string }>(res)
  ok(res, { team: await svc.removeMember(me(req), id, userId) })
}))
