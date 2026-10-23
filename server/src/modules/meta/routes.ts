import { Router } from 'express'
import { ok, handler } from '../../utils/http.js'
import { me, requireAuth } from '../../middleware/auth.js'
import { writeLimiter } from '../../middleware/security.js'
import { Category, Notification } from '../../models/Misc.js'

export const metaRouter = Router()

metaRouter.get('/categories', handler(async (_req, res) => {
  const items = await Category.find().sort({ order: 1, slug: 1 })
  ok(res, { items: items.map((c) => ({ slug: c.slug, names: c.names, color: c.color, icon: c.icon })) })
}))

metaRouter.get('/notifications', requireAuth, handler(async (req, res) => {
  const items = await Notification.find({ user: me(req)._id }).sort({ createdAt: -1 }).limit(30)
  ok(res, {
    unread: items.filter((n) => !n.read).length,
    items: items.map((n) => ({ id: String(n._id), type: n.type, data: n.data, read: n.read, createdAt: (n as unknown as { createdAt: Date }).createdAt })),
  })
}))

metaRouter.post('/notifications/read', requireAuth, writeLimiter, handler(async (req, res) => {
  await Notification.updateMany({ user: me(req)._id, read: false }, { read: true })
  ok(res, { read: true })
}))
