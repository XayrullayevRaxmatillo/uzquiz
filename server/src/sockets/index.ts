import type http from 'node:http'
import { Server, type Socket } from 'socket.io'
import { parse as parseCookie } from 'cookie'
import { z } from 'zod'
import { clientOrigins } from '../config/env.js'
import { SESSION_COOKIE, loadUserFromClaims, verifyToken } from '../middleware/auth.js'
import { GameRoom } from '../models/GameRoom.js'
import { AppError } from '../utils/errors.js'
import { GameEngine } from './engine.js'
import { createRoom, joinRoom } from '../modules/rooms/service.js'
import { User } from '../models/User.js'

type Ack = (res: { ok: true; [k: string]: unknown } | { ok: false; code: string }) => void
const sid = (v: unknown) => String(v)

interface SocketData {
  userId: string
  name: string
  room?: string
  events: number[]
}

const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/)
const answerSchema = z.object({ questionIndex: z.number().int().min(0).max(200), choice: z.number().int().min(0).max(3) })

export function createSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: { origin: clientOrigins, credentials: true },
    maxHttpBufferSize: 10_000, // events are tiny; reject anything large
    pingInterval: 10_000,
    pingTimeout: 8_000,
  })
  const engine = new GameEngine(io)

  // ── Authentication: session cookie + Origin check (blocks cross-site WebSocket hijacking).
  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin
      if (origin && !clientOrigins.includes(origin)) return next(new Error('FORBIDDEN_ORIGIN'))
      const cookies = parseCookie(socket.handshake.headers.cookie ?? '')
      const claims = verifyToken(cookies[SESSION_COOKIE])
      if (!claims) return next(new Error('UNAUTHENTICATED'))
      const user = await loadUserFromClaims(claims)
      if (!user) return next(new Error('UNAUTHENTICATED'))
      socket.data = { userId: sid(user._id), name: user.name, events: [] } satisfies SocketData
      next()
    } catch {
      next(new Error('UNAUTHENTICATED'))
    }
  })

  io.on('connection', (socket) => {
    const data = socket.data as SocketData

    /** Simple sliding-window limit: 40 events / 10 s per socket. */
    const allowed = () => {
      const now = Date.now()
      data.events = data.events.filter((t) => now - t < 10_000)
      if (data.events.length >= 40) return false
      data.events.push(now)
      return true
    }

    const guard =
      <T>(schema: z.ZodType<T> | null, fn: (payload: T, ack: Ack) => Promise<void> | void) =>
      async (raw: unknown, ack?: Ack) => {
        const reply: Ack = typeof ack === 'function' ? ack : () => undefined
        if (!allowed()) return reply({ ok: false, code: 'RATE_LIMITED' })
        let payload = raw as T
        if (schema) {
          const parsed = schema.safeParse(raw)
          if (!parsed.success) return reply({ ok: false, code: 'VALIDATION' })
          payload = parsed.data
        }
        try {
          await fn(payload, reply)
        } catch (e) {
          reply({ ok: false, code: e instanceof AppError ? e.code : e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : 'INTERNAL' })
        }
      }

    const requireHost = async () => {
      if (!data.room) throw new AppError(400, 'NOT_IN_ROOM')
      const room = await GameRoom.findOne({ roomCode: data.room })
      if (!room) throw new AppError(404, 'ROOM_NOT_FOUND')
      if (sid(room.host) !== data.userId) throw new AppError(403, 'NOT_HOST')
      return room
    }

    // ───────── join / leave ─────────
    socket.on(
      'room:join',
      guard(z.object({ code: codeSchema }), async ({ code }, ack) => {
        const user = await User.findById(data.userId)
        if (!user) throw new AppError(401, 'UNAUTHENTICATED')
        const room = await joinRoom(code, user)
        if (data.room && data.room !== code) await socket.leave(data.room)
        data.room = code
        await socket.join(code)
        await GameRoom.updateOne({ roomCode: code, 'participants.user': user._id }, { $set: { 'participants.$.connected': true } })
        await engine.broadcastState(code)
        const fresh = (await GameRoom.findOne({ roomCode: code }))!
        ack({ ok: true, state: await engine.stateFor(fresh, data.userId) })
      }),
    )

    socket.on(
      'room:leave',
      guard(null, async (_p, ack) => {
        const code = data.room
        if (!code) return ack({ ok: true })
        const room = await GameRoom.findOne({ roomCode: code })
        await socket.leave(code)
        data.room = undefined
        if (room && room.status === 'lobby') {
          await GameRoom.updateOne({ roomCode: code }, { $pull: { participants: { user: data.userId } } })
          const after = await GameRoom.findOne({ roomCode: code })
          if (!after || after.participants.length === 0) {
            await GameRoom.deleteOne({ roomCode: code })
          } else if (sid(after.host) === data.userId) {
            after.host = after.participants[0].user // hand the room to the longest-waiting player
            await after.save()
          }
          await engine.broadcastState(code)
        }
        ack({ ok: true })
      }),
    )

    socket.on(
      'room:ready',
      guard(z.object({ ready: z.boolean() }), async ({ ready }, ack) => {
        if (!data.room) throw new AppError(400, 'NOT_IN_ROOM')
        const res = await GameRoom.updateOne({ roomCode: data.room, status: 'lobby', 'participants.user': data.userId }, { $set: { 'participants.$.ready': ready } })
        if (res.matchedCount !== 1) throw new AppError(409, 'NOT_IN_LOBBY')
        await engine.broadcastState(data.room)
        ack({ ok: true })
      }),
    )

    // ───────── host controls (verified against the database on every call) ─────────
    socket.on(
      'host:start',
      guard(null, async (_p, ack) => {
        await requireHost()
        await engine.start(data.room!, data.userId)
        ack({ ok: true })
      }),
    )
    socket.on(
      'host:pause',
      guard(null, async (_p, ack) => {
        await requireHost()
        if (!engine.pause(data.room!, data.userId)) throw new AppError(409, 'CANNOT_PAUSE')
        await engine.broadcastState(data.room!)
        ack({ ok: true })
      }),
    )
    socket.on(
      'host:resume',
      guard(null, async (_p, ack) => {
        await requireHost()
        if (!engine.resume(data.room!, data.userId)) throw new AppError(409, 'CANNOT_RESUME')
        await engine.broadcastState(data.room!)
        ack({ ok: true })
      }),
    )
    socket.on(
      'host:end',
      guard(null, async (_p, ack) => {
        const room = await requireHost()
        if (room.status === 'lobby') {
          // Closing a lobby: nobody played, so nothing is persisted as a result.
          await GameRoom.updateOne({ roomCode: room.roomCode }, { status: 'ended', endedAt: new Date() })
          io.to(room.roomCode).emit('room:closed')
        } else if (!(await engine.end(room.roomCode, data.userId))) throw new AppError(409, 'CANNOT_END')
        ack({ ok: true })
      }),
    )
    socket.on(
      'host:kick',
      guard(z.object({ userId: z.string().regex(/^[a-f0-9]{24}$/i) }), async ({ userId }, ack) => {
        const room = await requireHost()
        if (userId === sid(room.host)) throw new AppError(400, 'INVALID_TARGET')
        await GameRoom.updateOne({ roomCode: room.roomCode, 'participants.user': userId }, { $set: { 'participants.$.kicked': true, 'participants.$.connected': false } })
        engine.removePlayer(room.roomCode, userId)
        for (const s of await io.in(room.roomCode).fetchSockets()) {
          if ((s.data as SocketData).userId === userId) {
            s.emit('room:kicked')
            s.leave(room.roomCode)
            ;(s.data as SocketData).room = undefined
          }
        }
        await engine.broadcastState(room.roomCode)
        ack({ ok: true })
      }),
    )
    socket.on(
      'host:rematch',
      guard(null, async (_p, ack) => {
        const room = await requireHost()
        if (room.status !== 'ended') throw new AppError(409, 'NOT_FINISHED')
        const host = await User.findById(data.userId)
        if (!host) throw new AppError(401, 'UNAUTHENTICATED')
        const next = await createRoom(host, {
          quizId: sid(room.quiz),
          teamMode: room.teamMode,
          questionCount: room.settings.questionCount,
          timeLimit: room.settings.timeLimit,
          maxPlayers: room.settings.maxPlayers,
          visibility: room.settings.visibility as 'public' | 'private',
          speedBonus: room.settings.speedBonus,
        })
        io.to(room.roomCode).emit('room:rematch', { code: next.roomCode })
        ack({ ok: true, code: next.roomCode })
      }),
    )

    // ───────── gameplay ─────────
    socket.on(
      'answer:submit',
      guard(answerSchema, (payload, ack) => {
        if (!data.room) throw new AppError(400, 'NOT_IN_ROOM')
        const r = engine.submitAnswer(data.room, data.userId, payload.questionIndex, payload.choice)
        ack(r.ok ? { ok: true } : { ok: false, code: r.reason })
      }),
    )

    socket.on('disconnect', async () => {
      const code = data.room
      if (!code) return
      try {
        // Multi-tab safe: only mark offline when this user has no other socket in the room.
        const others = (await io.in(code).fetchSockets()).some((s) => s.id !== socket.id && (s.data as SocketData).userId === data.userId)
        if (!others) {
          await GameRoom.updateOne({ roomCode: code, 'participants.user': data.userId }, { $set: { 'participants.$.connected': false } })
          await engine.broadcastState(code)
        }
      } catch {
        /* best-effort presence */
      }
    })
  })

  return { io, engine }
}

export type { Socket }
