import { Router } from 'express'
import { z } from 'zod'
import { ok, handler } from '../../utils/http.js'
import { p, q, validate } from '../../middleware/validate.js'
import { me, requireAuth, requireRole } from '../../middleware/auth.js'
import { writeLimiter } from '../../middleware/security.js'
import { idParams, objectId, pageQuery } from '../../utils/schemas.js'
import { User, publicUser } from '../../models/User.js'
import { Quiz } from '../../models/Quiz.js'
import { Team } from '../../models/Team.js'
import { GameRoom } from '../../models/GameRoom.js'
import { GameResult } from '../../models/GameResult.js'
import { Category, Report } from '../../models/Misc.js'
import { badRequest, forbidden, notFound } from '../../utils/errors.js'

/**
 * Every route here is protected on the SERVER: requireAuth + requireRole.
 * Hiding the admin button in the UI is only cosmetic.
 */
export const adminRouter = Router()
adminRouter.use(requireAuth)

const staff = requireRole('admin', 'moderator')
const adminOnly = requireRole('admin')
const sid = (v: unknown) => String(v)
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

adminRouter.get('/overview', staff, handler(async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  const [users, quizzes, teams, activeGames, openReports, gamesWeek, newUsersWeek] = await Promise.all([
    User.countDocuments(),
    Quiz.countDocuments(),
    Team.countDocuments(),
    GameRoom.countDocuments({ status: { $in: ['active', 'paused'] } }),
    Report.countDocuments({ status: 'open' }),
    GameResult.countDocuments({ completedAt: { $gte: weekAgo } }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
  ])
  const topCategories = await Quiz.aggregate<{ _id: string; count: number; plays: number }>([
    { $group: { _id: '$category', count: { $sum: 1 }, plays: { $sum: '$playCount' } } },
    { $sort: { plays: -1 } },
    { $limit: 7 },
  ])
  ok(res, { users, quizzes, teams, activeGames, openReports, gamesWeek, newUsersWeek, topCategories })
}))

// ───────── users (admin only) ─────────
const userQuery = z.object({ q: z.string().trim().max(60).optional(), ...pageQuery })
adminRouter.get('/users', adminOnly, validate({ query: userQuery }), handler(async (_req, res) => {
  const f = q<z.infer<typeof userQuery>>(res)
  const filter = f.q ? { $or: [{ name: rx(f.q) }, { username: rx(f.q) }, { email: rx(f.q) }] } : {}
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((f.page - 1) * f.limit).limit(f.limit), User.countDocuments(filter)])
  ok(res, { items: items.map((u) => ({ ...publicUser(u), banned: u.banned, lastSeenAt: u.lastSeenAt })), total, pages: Math.max(1, Math.ceil(total / f.limit)) })
}))

adminRouter.patch('/users/:id', adminOnly, writeLimiter, validate({ params: idParams, body: z.object({ role: z.enum(['user', 'moderator', 'admin']).optional(), banned: z.boolean().optional() }) }), handler(async (req, res) => {
  const { id } = p<{ id: string }>(res)
  if (id === sid(me(req)._id)) throw badRequest('CANNOT_MODIFY_SELF') // prevents locking yourself out
  const user = await User.findById(id).select('+tokenVersion')
  if (!user) throw notFound('USER_NOT_FOUND')
  if (req.body.role) user.role = req.body.role
  if (typeof req.body.banned === 'boolean') {
    user.banned = req.body.banned
    if (req.body.banned) user.set('tokenVersion', ((user.get('tokenVersion') as number) ?? 0) + 1) // revoke sessions
  }
  await user.save()
  ok(res, { user: { ...publicUser(user), banned: user.banned } })
}))

// ───────── quiz moderation (staff) ─────────
const quizAdminQuery = z.object({ q: z.string().trim().max(60).optional(), status: z.enum(['active', 'hidden']).optional(), ...pageQuery })
adminRouter.get('/quizzes', staff, validate({ query: quizAdminQuery }), handler(async (_req, res) => {
  const f = q<z.infer<typeof quizAdminQuery>>(res)
  const filter: Record<string, unknown> = {}
  if (f.q) filter.title = rx(f.q)
  if (f.status) filter.status = f.status
  const [items, total] = await Promise.all([
    Quiz.find(filter).sort({ createdAt: -1 }).skip((f.page - 1) * f.limit).limit(f.limit).populate('creator', 'name username'),
    Quiz.countDocuments(filter),
  ])
  ok(res, { items: items.map((x) => ({ id: sid(x._id), title: x.title, category: x.category, language: x.language, status: x.status, visibility: x.visibility, playCount: x.playCount, questionCount: x.questions.length, isDemo: x.isSeed, creator: (x.creator as unknown as { name?: string; username?: string })?.username ?? '' })), total, pages: Math.max(1, Math.ceil(total / f.limit)) })
}))
adminRouter.patch('/quizzes/:id', staff, writeLimiter, validate({ params: idParams, body: z.object({ status: z.enum(['active', 'hidden']) }) }), handler(async (req, res) => {
  const r = await Quiz.updateOne({ _id: p<{ id: string }>(res).id }, { status: req.body.status })
  if (!r.matchedCount) throw notFound('QUIZ_NOT_FOUND')
  ok(res, { updated: true })
}))
adminRouter.delete('/quizzes/:id', adminOnly, writeLimiter, validate({ params: idParams }), handler(async (_req, res) => {
  const r = await Quiz.deleteOne({ _id: p<{ id: string }>(res).id })
  if (!r.deletedCount) throw notFound('QUIZ_NOT_FOUND')
  ok(res, { deleted: true })
}))

// ───────── teams & rooms moderation ─────────
adminRouter.get('/teams', staff, validate({ query: z.object({ q: z.string().trim().max(40).optional(), ...pageQuery }) }), handler(async (_req, res) => {
  const f = q<{ q?: string; page: number; limit: number }>(res)
  const filter = f.q ? { name: rx(f.q) } : {}
  const [items, total] = await Promise.all([Team.find(filter).sort({ createdAt: -1 }).skip((f.page - 1) * f.limit).limit(f.limit), Team.countDocuments(filter)])
  ok(res, { items: items.map((t) => ({ id: sid(t._id), name: t.name, category: t.category, members: t.members.length, capacity: t.capacity, visibility: t.visibility, banned: t.banned })), total, pages: Math.max(1, Math.ceil(total / f.limit)) })
}))
adminRouter.patch('/teams/:id', staff, writeLimiter, validate({ params: idParams, body: z.object({ banned: z.boolean() }) }), handler(async (req, res) => {
  const r = await Team.updateOne({ _id: p<{ id: string }>(res).id }, { banned: req.body.banned })
  if (!r.matchedCount) throw notFound('TEAM_NOT_FOUND')
  ok(res, { updated: true })
}))
adminRouter.get('/rooms', staff, handler(async (_req, res) => {
  const rooms = await GameRoom.find({ status: { $in: ['lobby', 'active', 'paused'] } }).sort({ createdAt: -1 }).limit(50).populate('quiz', 'title')
  ok(res, { items: rooms.map((r) => ({ code: r.roomCode, status: r.status, quizTitle: (r.quiz as unknown as { title?: string })?.title ?? '', players: r.participants.length, teamMode: r.teamMode, createdAt: (r as unknown as { createdAt: Date }).createdAt })) })
}))
adminRouter.delete('/rooms/:code', staff, writeLimiter, validate({ params: z.object({ code: z.string().regex(/^[A-Za-z0-9]{6}$/) }) }), handler(async (_req, res) => {
  const r = await GameRoom.updateOne({ roomCode: p<{ code: string }>(res).code.toUpperCase() }, { status: 'ended', endedAt: new Date() })
  if (!r.matchedCount) throw notFound('ROOM_NOT_FOUND')
  ok(res, { closed: true })
}))

// ───────── reports ─────────
adminRouter.get('/reports', staff, handler(async (_req, res) => {
  const items = await Report.find({ status: 'open' }).sort({ createdAt: -1 }).limit(100).populate('reporter', 'username')
  ok(res, { items: items.map((r) => ({ id: sid(r._id), targetType: r.targetType, targetId: sid(r.targetId), reason: r.reason, reporter: (r.reporter as unknown as { username?: string })?.username ?? '', createdAt: (r as unknown as { createdAt: Date }).createdAt })) })
}))
adminRouter.patch('/reports/:id', staff, writeLimiter, validate({ params: idParams, body: z.object({ status: z.enum(['resolved', 'dismissed']) }) }), handler(async (req, res) => {
  const r = await Report.updateOne({ _id: p<{ id: string }>(res).id }, { status: req.body.status, resolvedBy: me(req)._id })
  if (!r.matchedCount) throw notFound('REPORT_NOT_FOUND')
  ok(res, { updated: true })
}))

// ───────── categories (admin) ─────────
const catBody = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,30}$/),
  names: z.object({ uz: z.string().trim().min(1).max(40), ru: z.string().trim().min(1).max(40), en: z.string().trim().min(1).max(40) }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#8b5cf6'),
  icon: z.string().max(30).default('lightbulb'),
  order: z.number().int().min(0).max(100).default(50),
})
adminRouter.post('/categories', adminOnly, writeLimiter, validate({ body: catBody }), handler(async (req, res) => {
  await Category.updateOne({ slug: req.body.slug }, { $set: req.body }, { upsert: true })
  ok(res, { saved: true }, 201)
}))
adminRouter.delete('/categories/:slug', adminOnly, writeLimiter, validate({ params: z.object({ slug: z.string().regex(/^[a-z0-9_-]{2,30}$/) }) }), handler(async (_req, res) => {
  const slug = p<{ slug: string }>(res).slug
  if (await Quiz.exists({ category: slug })) throw forbidden('CATEGORY_IN_USE')
  await Category.deleteOne({ slug })
  ok(res, { deleted: true })
}))

void objectId
