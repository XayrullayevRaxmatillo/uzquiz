import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { clearDb, makeApp, registerUser, startDb, stopDb, type TestUser } from './helpers.js'

let app: Express
beforeAll(async () => { await startDb(); app = await makeApp() })
afterAll(stopDb)
beforeEach(clearDb)

const post = (u: TestUser, url: string, body: object = {}) => u.agent.post(url).set('X-CSRF-Token', u.csrf).send(body)
const quiz = (over: object = {}) => ({
  title: 'My Quiz', description: 'desc', category: 'it', language: 'en', difficulty: 'easy', visibility: 'public',
  questions: [{ text: 'What is 1+1?', options: ['1', '2', '3'], correctIndex: 1, timeLimit: 20, explanation: '' }], ...over,
})

describe('quizzes', () => {
  it('validates content on the server', async () => {
    const u = await registerUser(app)
    expect((await post(u, '/api/quizzes', quiz({ questions: [] }))).status).toBe(400)
    expect((await post(u, '/api/quizzes', quiz({ questions: [{ text: 'Q?????', options: ['a', 'b'], correctIndex: 3 }] }))).status).toBe(400)
    expect((await post(u, '/api/quizzes', quiz({ coverImage: 'javascript:alert(1)' }))).status).toBe(400)
  })

  it('never exposes correct answers in public responses', async () => {
    const u = await registerUser(app), other = await registerUser(app)
    const id = (await post(u, '/api/quizzes', quiz())).body.data.quiz.id
    const pub = await other.agent.get(`/api/quizzes/${id}`)
    expect(JSON.stringify(pub.body)).not.toMatch(/correctIndex/)
    expect((await other.agent.get(`/api/quizzes/${id}/edit`)).status).toBe(403)
    expect((await u.agent.get(`/api/quizzes/${id}/edit`)).body.data.quiz.questions[0].correctIndex).toBe(1)
  })

  it('only the owner can edit or delete', async () => {
    const u = await registerUser(app), other = await registerUser(app)
    const id = (await post(u, '/api/quizzes', quiz())).body.data.quiz.id
    expect((await other.agent.put(`/api/quizzes/${id}`).set('X-CSRF-Token', other.csrf).send(quiz({ title: 'Hacked' }))).status).toBe(403)
    expect((await other.agent.delete(`/api/quizzes/${id}`).set('X-CSRF-Token', other.csrf)).status).toBe(403)
    expect((await u.agent.put(`/api/quizzes/${id}`).set('X-CSRF-Token', u.csrf).send(quiz({ title: 'Renamed' }))).body.data.quiz.title).toBe('Renamed')
  })

  it('hides private quizzes from others and supports search, filters and sorting', async () => {
    const u = await registerUser(app), other = await registerUser(app)
    await post(u, '/api/quizzes', quiz({ title: 'Public Alpha' }))
    await post(u, '/api/quizzes', quiz({ title: 'Private Beta', visibility: 'private' }))
    await post(u, '/api/quizzes', quiz({ title: 'Math Gamma', category: 'math' }))
    const list = await other.agent.get('/api/quizzes')
    expect(list.body.data.items.map((i: { title: string }) => i.title).sort()).toEqual(['Math Gamma', 'Public Alpha'])
    expect((await other.agent.get('/api/quizzes?q=alph')).body.data.items).toHaveLength(1)
    expect((await other.agent.get('/api/quizzes?category=math')).body.data.items).toHaveLength(1)
    expect((await other.agent.get('/api/quizzes?sort=popular')).status).toBe(200)
  })

  it('favorites toggle idempotently and duplicates become private copies', async () => {
    const u = await registerUser(app), other = await registerUser(app)
    const id = (await post(u, '/api/quizzes', quiz())).body.data.quiz.id
    await post(other, `/api/quizzes/${id}/favorite`); await post(other, `/api/quizzes/${id}/favorite`)
    expect((await other.agent.get(`/api/quizzes/${id}`)).body.data.quiz.favoritesCount).toBe(1)
    const copy = await post(other, `/api/quizzes/${id}/duplicate`)
    expect(copy.status).toBe(201)
    expect(copy.body.data.quiz.visibility).toBe('private')
  })

  it('only players who finished a quiz can rate it', async () => {
    const u = await registerUser(app), other = await registerUser(app)
    const id = (await post(u, '/api/quizzes', quiz())).body.data.quiz.id
    expect((await post(other, `/api/quizzes/${id}/rate`, { value: 5 })).status).toBe(403)
  })
})
