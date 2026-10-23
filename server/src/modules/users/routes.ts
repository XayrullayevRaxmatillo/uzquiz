import { Router } from 'express'
import { ok, handler } from '../../utils/http.js'
import { validate } from '../../middleware/validate.js'
import { me, requireAuth } from '../../middleware/auth.js'
import { writeLimiter } from '../../middleware/security.js'
import { User, publicUser } from '../../models/User.js'
import { onboardingBody, profileBody } from '../auth/schemas.js'
import { z } from 'zod'
import { p, validate as v } from '../../middleware/validate.js'
import { idParams } from '../../utils/schemas.js'
import { badRequest, notFound } from '../../utils/errors.js'

export const usersRouter = Router()
usersRouter.use(requireAuth)

usersRouter.patch(
  '/me',
  writeLimiter,
  validate({ body: profileBody }),
  handler(async (req, res) => {
    const user = me(req)
    for (const k of ['name', 'avatar', 'preferredLanguage', 'interests'] as const) {
      if (req.body[k] !== undefined) user.set(k, req.body[k])
    }
    await user.save()
    ok(res, { user: publicUser(user) })
  }),
)

usersRouter.post(
  '/me/onboarding',
  writeLimiter,
  validate({ body: onboardingBody }),
  handler(async (req, res) => {
    const user = me(req)
    user.interests = req.body.interests
    user.educationLevel = req.body.educationLevel
    user.playMode = req.body.playMode
    user.onboarded = true
    await user.save()
    ok(res, { user: publicUser(user), playMode: user.playMode })
  }),
)


// ───────── friends (one-way "follow", used by the friends leaderboard) ─────────
usersRouter.get('/friends', handler(async (req, res) => {
  const friends = await User.find({ _id: { $in: me(req).friends } }).select('name username avatar xp')
  ok(res, { items: friends.map((f) => ({ id: String(f._id), name: f.name, username: f.username, avatar: f.avatar })) })
}))
usersRouter.post('/friends', writeLimiter, v({ body: z.object({ username: z.string().trim().min(3).max(20) }) }), handler(async (req, res) => {
  const user = me(req)
  const target = await User.findOne({ usernameLower: String(req.body.username).toLowerCase() }).select('_id')
  if (!target) throw notFound('USER_NOT_FOUND')
  if (String(target._id) === String(user._id)) throw badRequest('CANNOT_ADD_SELF')
  await User.updateOne({ _id: user._id }, { $addToSet: { friends: target._id } })
  ok(res, { added: true })
}))
usersRouter.delete('/friends/:id', writeLimiter, v({ params: idParams }), handler(async (req, res) => {
  await User.updateOne({ _id: me(req)._id }, { $pull: { friends: p<{ id: string }>(res).id } })
  ok(res, { removed: true })
}))

void User
