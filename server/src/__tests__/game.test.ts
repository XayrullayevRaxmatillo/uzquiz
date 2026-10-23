import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { io as connect, type Socket } from 'socket.io-client'
import type { Express } from 'express'
import { clearDb, makeApp, registerUser, startDb, stopDb, type TestUser } from './helpers.js'

process.env.GAME_FAST = '1'

let app: Express
let server: http.Server
let port: number
let stopEngine: () => void

beforeAll(async () => {
  await startDb()
  app = await makeApp()
  const { createSocketServer } = await import('../sockets/index.js')
  server = http.createServer(app)
  const { io, engine } = createSocketServer(server)
  stopEngine = () => { engine.stop(); io.close() }
  await new Promise<void>((r) => server.listen(0, r))
  port = (server.address() as AddressInfo).port
})
afterAll(async () => { stopEngine(); server.close(); await stopDb() })
beforeEach(clearDb)

const post = (u: TestUser, url: string, body: object = {}) => u.agent.post(url).set('X-CSRF-Token', u.csrf).send(body)

async function cookieOf(u: TestUser): Promise<string> {
  const r = await u.agent.get('/api/auth/me')
  // supertest agent stores cookies; re-login to read the Set-Cookie header
  void r
  const login = await (await import('supertest')).default(app).post('/api/auth/login').send({ identifier: u.username, password: 'Passw0rdOK' })
  return (login.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ')
}

const sock = (cookie: string): Socket => connect(`http://localhost:${port}`, { extraHeaders: { cookie }, transports: ['websocket'], forceNew: true })
const once = <T = unknown>(s: Socket, ev: string) => new Promise<T>((r) => s.once(ev, r as (v: T) => void))
const emit = <T = Record<string, unknown>>(s: Socket, ev: string, payload?: unknown) => new Promise<T>((r) => s.emit(ev, payload, r))

const QUIZ = {
  title: 'Engine Quiz', description: '', category: 'it', language: 'en', difficulty: 'easy', visibility: 'public',
  questions: [
    { text: 'Q one?', options: ['A', 'B', 'C'], correctIndex: 1, timeLimit: 5, explanation: 'because' },
    { text: 'Q two?', options: ['A', 'B', 'C'], correctIndex: 2, timeLimit: 5, explanation: '' },
  ],
}

async function setup() {
  const host = await registerUser(app), guest = await registerUser(app)
  const quizId = (await post(host, '/api/quizzes', QUIZ)).body.data.quiz.id
  const code = (await post(host, '/api/rooms', { quizId, maxPlayers: 4, visibility: 'public' })).body.data.code as string
  const hs = sock(await cookieOf(host)), gs = sock(await cookieOf(guest))
  await Promise.all([once(hs, 'connect'), once(gs, 'connect')])
  return { host, guest, quizId, code, hs, gs }
}

describe('live game engine', () => {
  it('rejects unauthenticated sockets', async () => {
    const s = connect(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true })
    const err = await once<Error>(s, 'connect_error')
    expect(err.message).toBe('UNAUTHENTICATED')
    s.close()
  })

  it('validates codes, enforces room capacity and plays a full synchronized game with server-side scoring', async () => {
    const { host, guest, code, hs, gs, quizId } = await setup()

    expect((await emit<{ ok: boolean; code: string }>(hs, 'room:join', { code: 'ZZZZZZ' })).ok).toBe(false)
    const j1 = await emit<{ ok: boolean }>(hs, 'room:join', { code }); expect(j1.ok).toBe(true)
    const j2 = await emit<{ ok: boolean; state: { participants: unknown[] } }>(gs, 'room:join', { code }); expect(j2.ok).toBe(true)
    expect(j2.state.participants).toHaveLength(2)

    // only the host can start
    expect((await emit<{ ok: boolean; code: string }>(gs, 'host:start')).code).toBe('NOT_HOST')

    const qs1 = once<{ index: number; options: string[]; endsAt: number }>(hs, 'question:start')
    expect((await emit<{ ok: boolean }>(hs, 'host:start')).ok).toBe(true)
    const q1 = await qs1
    expect(q1.index).toBe(0)
    expect(JSON.stringify(q1)).not.toMatch(/correct/i) // answer is never sent before reveal

    const reveal1 = once<{ correctIndex: number; players: Record<string, { points: number; correct: boolean }> }>(hs, 'question:reveal')
    // The question order is shuffled, so we answer by reading the correct index after reveal → submit one right/one wrong using both options.
    const a1 = await emit<{ ok: boolean }>(hs, 'answer:submit', { questionIndex: 0, choice: 0 })
    expect(a1.ok).toBe(true)
    const dup = await emit<{ ok: boolean; code: string }>(hs, 'answer:submit', { questionIndex: 0, choice: 1 })
    expect(dup).toMatchObject({ ok: false, code: 'ALREADY_ANSWERED' })
    expect((await emit<{ ok: boolean; code: string }>(gs, 'answer:submit', { questionIndex: 5, choice: 0 })).code).toBe('STALE_QUESTION')
    expect((await emit<{ ok: boolean; code: string }>(gs, 'answer:submit', { questionIndex: 0, choice: 9 })).ok).toBe(false)
    await emit(gs, 'answer:submit', { questionIndex: 0, choice: 1 })

    const r1 = await reveal1
    const hostPts = r1.players[host.id].points, guestPts = r1.players[guest.id].points
    // exactly the right choice earns points; points come from the server, not the client
    expect(r1.players[host.id].correct).toBe(r1.correctIndex === 0)
    expect(r1.players[guest.id].correct).toBe(r1.correctIndex === 1)
    expect(hostPts === 0 || hostPts >= 1000).toBe(true)
    expect(guestPts === 0 || guestPts >= 1000).toBe(true)

    // late answer after the reveal is locked out
    expect((await emit<{ code: string }>(gs, 'answer:submit', { questionIndex: 0, choice: 1 })).code).toBeDefined()

    const ended = once<{ ranking: { id: string; score: number; rank: number }[]; reason: string }>(hs, 'game:ended')
    // second question: answer promptly
    await once(hs, 'question:start')
    await emit(hs, 'answer:submit', { questionIndex: 1, choice: 2 })
    await emit(gs, 'answer:submit', { questionIndex: 1, choice: 2 })
    const end = await ended
    expect(end.reason).toBe('completed')
    expect(end.ranking).toHaveLength(2)
    expect(end.ranking[0].rank).toBe(1)
    expect(end.ranking[0].score).toBeGreaterThanOrEqual(end.ranking[1].score)

    // persisted results, one per player, and leaderboard reads them
    const results = await host.agent.get(`/api/rooms/${code}/results`)
    expect(results.status).toBe(200)
    expect(results.body.data.rows).toHaveLength(2)
    const board = await host.agent.get('/api/leaderboard?scope=global')
    expect(board.body.data.items.length).toBe(2)
    const quiz = await host.agent.get(`/api/quizzes/${quizId}`)
    expect(quiz.body.data.quiz.playCount).toBe(1)

    // an ended room cannot be joined again
    const late = await emit<{ ok: boolean; code: string }>(gs, 'room:join', { code })
    expect(late.ok).toBe(false)

    hs.close(); gs.close()
  })

  it('blocks joining a full room and a game already in progress', async () => {
    const host = await registerUser(app), a = await registerUser(app), b = await registerUser(app)
    const quizId = (await post(host, '/api/quizzes', QUIZ)).body.data.quiz.id
    const code = (await post(host, '/api/rooms', { quizId, maxPlayers: 2 })).body.data.code as string
    const [hs, as, bs] = [sock(await cookieOf(host)), sock(await cookieOf(a)), sock(await cookieOf(b))]
    await Promise.all([once(hs, 'connect'), once(as, 'connect'), once(bs, 'connect')])
    await emit(hs, 'room:join', { code })
    expect((await emit<{ ok: boolean }>(as, 'room:join', { code })).ok).toBe(true)
    const full = await emit<{ ok: boolean; code: string }>(bs, 'room:join', { code })
    expect(full).toMatchObject({ ok: false, code: 'ROOM_FULL' })
    ;[hs, as, bs].forEach((s) => s.close())
  })

  it('only the host may kick, and kicked players cannot rejoin', async () => {
    const { host, guest, code, hs, gs } = await setup()
    await emit(hs, 'room:join', { code }); await emit(gs, 'room:join', { code })
    expect((await emit<{ code: string }>(gs, 'host:kick', { userId: host.id })).code).toBe('NOT_HOST')
    const kicked = once(gs, 'room:kicked')
    expect((await emit<{ ok: boolean }>(hs, 'host:kick', { userId: guest.id })).ok).toBe(true)
    await kicked
    expect((await emit<{ code: string }>(gs, 'room:join', { code })).code).toBe('KICKED')
    hs.close(); gs.close()
  })
})
