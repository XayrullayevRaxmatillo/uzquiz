import { Router } from 'express'
import type { z } from 'zod'
import { ok, handler } from '../../utils/http.js'
import { p, q, validate } from '../../middleware/validate.js'
import { me, optionalAuth, requireAuth } from '../../middleware/auth.js'
import { writeLimiter } from '../../middleware/security.js'
import * as svc from './service.js'
import { listQuizQuery, quizBody, quizIdParams, rateBody, reportBody } from './schemas.js'

export const quizzesRouter = Router()
type Q = z.infer<typeof listQuizQuery>
const id = (res: Parameters<typeof p>[0]) => p<{ id: string }>(res).id

quizzesRouter.get('/', optionalAuth, validate({ query: listQuizQuery }), handler(async (req, res) => ok(res, await svc.listQuizzes(q<Q>(res), req.auth?.user))))
quizzesRouter.get('/mine', requireAuth, validate({ query: listQuizQuery }), handler(async (req, res) => ok(res, await svc.listQuizzes(q<Q>(res), me(req), { mine: true }))))
quizzesRouter.get('/favorites', requireAuth, validate({ query: listQuizQuery }), handler(async (req, res) => ok(res, await svc.listQuizzes(q<Q>(res), me(req), { favorites: true }))))

quizzesRouter.post('/', requireAuth, writeLimiter, validate({ body: quizBody }), handler(async (req, res) => ok(res, { quiz: await svc.createQuiz(me(req), req.body) }, 201)))

quizzesRouter.get('/:id', optionalAuth, validate({ params: quizIdParams }), handler(async (req, res) => ok(res, { quiz: await svc.getQuiz(id(res), req.auth?.user) })))
quizzesRouter.get('/:id/edit', requireAuth, validate({ params: quizIdParams }), handler(async (req, res) => ok(res, { quiz: await svc.getQuizForEdit(id(res), me(req)) })))
quizzesRouter.put('/:id', requireAuth, writeLimiter, validate({ params: quizIdParams, body: quizBody }), handler(async (req, res) => ok(res, { quiz: await svc.updateQuiz(me(req), id(res), req.body) })))
quizzesRouter.delete('/:id', requireAuth, writeLimiter, validate({ params: quizIdParams }), handler(async (req, res) => ok(res, await svc.deleteQuiz(me(req), id(res)))))

quizzesRouter.post('/:id/favorite', requireAuth, writeLimiter, validate({ params: quizIdParams }), handler(async (req, res) => ok(res, await svc.setFavorite(me(req), id(res), true))))
quizzesRouter.delete('/:id/favorite', requireAuth, writeLimiter, validate({ params: quizIdParams }), handler(async (req, res) => ok(res, await svc.setFavorite(me(req), id(res), false))))
quizzesRouter.post('/:id/rate', requireAuth, writeLimiter, validate({ params: quizIdParams, body: rateBody }), handler(async (req, res) => ok(res, await svc.rateQuiz(me(req), id(res), req.body.value))))
quizzesRouter.post('/:id/duplicate', requireAuth, writeLimiter, validate({ params: quizIdParams }), handler(async (req, res) => ok(res, { quiz: await svc.duplicateQuiz(me(req), id(res)) }, 201)))
quizzesRouter.post('/:id/report', requireAuth, writeLimiter, validate({ params: quizIdParams, body: reportBody }), handler(async (req, res) => ok(res, await svc.reportQuiz(me(req), id(res), req.body.reason), 201)))
