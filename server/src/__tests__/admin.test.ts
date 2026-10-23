import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { clearDb, makeAdmin, makeApp, registerUser, startDb, stopDb } from './helpers.js'

let app: Express
beforeAll(async () => { await startDb(); app = await makeApp() })
afterAll(stopDb)
beforeEach(clearDb)

describe('admin RBAC (enforced on the server)', () => {
  it('rejects anonymous and regular users', async () => {
    const user = await registerUser(app)
    const anon = await (await import('supertest')).default(app).get('/api/admin/overview')
    expect(anon.status).toBe(401)
    expect((await user.agent.get('/api/admin/overview')).status).toBe(403)
    expect((await user.agent.get('/api/admin/users')).status).toBe(403)
    expect((await user.agent.patch(`/api/admin/users/${user.id}`).set('X-CSRF-Token', user.csrf).send({ role: 'admin' })).status).toBe(403)
  })

  it('lets admins view stats, ban users (revoking sessions) and blocks self-modification', async () => {
    const admin = await registerUser(app), victim = await registerUser(app)
    await makeAdmin(admin)
    const overview = await admin.agent.get('/api/admin/overview')
    expect(overview.status).toBe(200)
    expect(overview.body.data.users).toBe(2)
    expect((await admin.agent.patch(`/api/admin/users/${admin.id}`).set('X-CSRF-Token', admin.csrf).send({ banned: true })).status).toBe(400)
    const ban = await admin.agent.patch(`/api/admin/users/${victim.id}`).set('X-CSRF-Token', admin.csrf).send({ banned: true })
    expect(ban.status).toBe(200)
    expect((await victim.agent.get('/api/auth/me')).status).toBe(401)
  })
})
