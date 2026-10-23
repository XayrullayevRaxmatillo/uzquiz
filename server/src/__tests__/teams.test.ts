import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { clearDb, makeApp, registerUser, startDb, stopDb, type TestUser } from './helpers.js'

let app: Express
beforeAll(async () => { await startDb(); app = await makeApp() })
afterAll(stopDb)
beforeEach(clearDb)

const post = (u: TestUser, url: string, body: object = {}) => u.agent.post(url).set('X-CSRF-Token', u.csrf).send(body)
const del = (u: TestUser, url: string) => u.agent.delete(url).set('X-CSRF-Token', u.csrf)
const base = { name: 'Alpha Squad', description: 'We love IT', category: 'it', language: 'uz', skillLevel: 'beginner', playStyle: 'casual', capacity: 2, visibility: 'public' }

describe('teams', () => {
  it('creates a team and prevents a second membership', async () => {
    const a = await registerUser(app)
    const r = await post(a, '/api/teams', base)
    expect(r.status).toBe(201)
    expect(r.body.data.team.myRole).toBe('owner')
    expect(r.body.data.team.inviteCode).toBeTruthy()
    const again = await post(a, '/api/teams', { ...base, name: 'Second Team' })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('ALREADY_IN_TEAM')
  })

  it('lets users join public teams, blocks full teams and duplicates', async () => {
    const a = await registerUser(app), b = await registerUser(app), c = await registerUser(app)
    const id = (await post(a, '/api/teams', base)).body.data.team.id
    expect((await post(b, `/api/teams/${id}/join`)).status).toBe(200)
    expect((await post(b, `/api/teams/${id}/join`)).body.error.code).toBe('ALREADY_IN_TEAM')
    const full = await post(c, `/api/teams/${id}/join`)
    expect(full.status).toBe(409)
    expect(full.body.error.code).toBe('TEAM_FULL')
  })

  it('handles private teams via join requests accepted by the owner', async () => {
    const a = await registerUser(app), b = await registerUser(app)
    const id = (await post(a, '/api/teams', { ...base, name: 'Secret Club', visibility: 'private', capacity: 5 })).body.data.team.id
    expect((await post(b, `/api/teams/${id}/join`)).status).toBe(403)
    expect((await post(b, `/api/teams/${id}/requests`, { message: 'hi' })).status).toBe(201)
    expect((await post(b, `/api/teams/${id}/requests`)).status).toBe(409)
    // Non-staff cannot read requests; owner can.
    expect((await b.agent.get(`/api/teams/${id}/requests`)).status).toBe(403)
    const list = await a.agent.get(`/api/teams/${id}/requests`)
    expect(list.body.data.requests).toHaveLength(1)
    expect((await post(a, `/api/teams/${id}/requests/${b.id}`, { accept: true })).body.data.accepted).toBe(true)
    const detail = await b.agent.get(`/api/teams/${id}`)
    expect(detail.body.data.team.isMember).toBe(true)
  })

  it('hides private member lists from outsiders', async () => {
    const a = await registerUser(app), b = await registerUser(app)
    const id = (await post(a, '/api/teams', { ...base, name: 'Hidden Team', visibility: 'private', capacity: 4 })).body.data.team.id
    const view = await b.agent.get(`/api/teams/${id}`)
    expect(view.body.data.team.members).toEqual([])
    expect(view.body.data.team.inviteCode).toBeUndefined()
  })

  it('joins via invite code, even for private teams', async () => {
    const a = await registerUser(app), b = await registerUser(app)
    const team = (await post(a, '/api/teams', { ...base, name: 'Invite Only', visibility: 'private', capacity: 4 })).body.data.team
    const r = await post(b, '/api/teams/join-by-code', { code: team.inviteCode })
    expect(r.status).toBe(200)
    expect(r.body.data.team.memberCount).toBe(2)
  })

  it('enforces role permissions', async () => {
    const a = await registerUser(app), b = await registerUser(app), c = await registerUser(app)
    const id = (await post(a, '/api/teams', { ...base, name: 'Roles Team', capacity: 5 })).body.data.team.id
    await post(b, `/api/teams/${id}/join`); await post(c, `/api/teams/${id}/join`)
    // members cannot promote or kick
    expect((await b.agent.patch(`/api/teams/${id}/members/${c.id}`).set('X-CSRF-Token', b.csrf).send({ role: 'moderator' })).status).toBe(403)
    expect((await del(b, `/api/teams/${id}/members/${c.id}`)).status).toBe(403)
    // owner promotes b; moderator can kick a plain member but not the owner
    await a.agent.patch(`/api/teams/${id}/members/${b.id}`).set('X-CSRF-Token', a.csrf).send({ role: 'moderator' })
    expect((await del(b, `/api/teams/${id}/members/${a.id}`)).status).toBe(400)
    expect((await del(b, `/api/teams/${id}/members/${c.id}`)).status).toBe(200)
  })

  it('transfers ownership when the owner leaves and deletes empty teams', async () => {
    const a = await registerUser(app), b = await registerUser(app)
    const id = (await post(a, '/api/teams', { ...base, name: 'Leave Test' })).body.data.team.id
    await post(b, `/api/teams/${id}/join`)
    await post(a, `/api/teams/${id}/leave`)
    expect((await b.agent.get(`/api/teams/${id}`)).body.data.team.myRole).toBe('owner')
    await post(b, `/api/teams/${id}/leave`)
    expect((await b.agent.get(`/api/teams/${id}`)).status).toBe(404)
  })

  it('quick match returns only real compatible teams and never fakes a match', async () => {
    const a = await registerUser(app), seeker = await registerUser(app)
    const none = await post(seeker, '/api/teams/quick-match', { category: 'it', language: 'uz', skillLevel: 'beginner' })
    expect(none.body.data.matches).toEqual([])
    await post(a, '/api/teams', { ...base, capacity: 4 })
    const hit = await post(seeker, '/api/teams/quick-match', { category: 'it', language: 'uz', skillLevel: 'beginner' })
    expect(hit.body.data.matches).toHaveLength(1)
    const wrongLang = await post(seeker, '/api/teams/quick-match', { category: 'it', language: 'ru', skillLevel: 'beginner' })
    expect(wrongLang.body.data.matches).toEqual([])
  })

  it('waiting queue notifies users when a matching team appears', async () => {
    const a = await registerUser(app), seeker = await registerUser(app)
    expect((await post(seeker, '/api/teams/queue', { category: 'it', language: 'uz', skillLevel: 'beginner' })).body.data.queued).toBe(true)
    await post(a, '/api/teams', base)
    await new Promise((r) => setTimeout(r, 200))
    const n = await seeker.agent.get('/api/notifications')
    expect(n.body.data.items.some((i: { type: string }) => i.type === 'team_available')).toBe(true)
  })
})
