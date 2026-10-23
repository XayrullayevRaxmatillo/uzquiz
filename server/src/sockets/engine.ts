import type { Server } from 'socket.io'
import { Types } from 'mongoose'
import { GameRoom, type RoomDoc } from '../models/GameRoom.js'
import { GameResult } from '../models/GameResult.js'
import { Quiz } from '../models/Quiz.js'
import { Team } from '../models/Team.js'
import { applyGameProgress, type AchievementType } from '../modules/stats/progress.js'

/** Timing constants. GAME_FAST=1 (tests) shrinks the pauses; question time limits stay as configured. */
export const TIMING =
  process.env.GAME_FAST === '1'
    ? { countdown: 30, reveal: 60, grace: 40, idleEndMs: 5_000 }
    : { countdown: 3_000, reveal: 6_000, grace: 300, idleEndMs: 120_000 }

type Phase = 'countdown' | 'question' | 'reveal' | 'paused' | 'ended'

interface Q {
  id: string
  text: string
  options: string[]
  correctIndex: number
  timeLimit: number
  explanation: string
}
interface PlayerScore {
  score: number
  correct: number
  totalTimeMs: number
  answered: number
}
interface Answer {
  choice: number
  timeMs: number
  correct: boolean
  points: number
}
interface Runtime {
  code: string
  roomId: Types.ObjectId
  quizId: Types.ObjectId
  category: string
  teamMode: boolean
  basePoints: number
  speedBonus: number
  questions: Q[]
  phase: Phase
  index: number
  startedAt: number
  endsAt: number
  timer: NodeJS.Timeout | null
  pausedFrom: 'countdown' | 'question' | 'reveal' | null
  pausedRemaining: number
  answers: Map<number, Map<string, Answer>>
  scores: Map<string, PlayerScore>
  lastReveal: unknown
  lastActivity: number
}

const sid = (v: unknown) => String(v)

export class GameEngine {
  private runtimes = new Map<string, Runtime>()
  private watchdog: NodeJS.Timeout

  constructor(private io: Server) {
    this.watchdog = setInterval(() => void this.sweepIdle(), 15_000)
    this.watchdog.unref()
  }

  has(code: string) {
    return this.runtimes.has(code)
  }

  stop() {
    clearInterval(this.watchdog)
    for (const rt of this.runtimes.values()) if (rt.timer) clearTimeout(rt.timer)
    this.runtimes.clear()
  }

  // ───────────── Public state ─────────────

  /** Full state for one viewer; never contains the correct answer of an unrevealed question. */
  async stateFor(room: RoomDoc, viewerId: string) {
    const rt = this.runtimes.get(room.roomCode)
    const quiz = await Quiz.findById(room.quiz).select('title category language')
    const scores = rt?.scores
    const base = {
      code: room.roomCode,
      status: room.status,
      host: { id: sid(room.host), name: room.participants.find((p) => sid(p.user) === sid(room.host))?.name ?? '' },
      quiz: { id: sid(room.quiz), title: quiz?.title ?? '', category: quiz?.category ?? '', language: quiz?.language ?? 'en', questionCount: room.settings.questionCount },
      teamMode: room.teamMode,
      settings: { maxPlayers: room.settings.maxPlayers, questionCount: room.settings.questionCount, timeLimit: room.settings.timeLimit, visibility: room.settings.visibility, speedBonus: room.settings.speedBonus },
      participants: room.participants
        .filter((p) => !p.kicked)
        .map((p) => ({ id: sid(p.user), name: p.name, teamId: p.team ? sid(p.team) : null, ready: p.ready, connected: p.connected, score: scores?.get(sid(p.user))?.score ?? p.score })),
      me: { id: viewerId, isHost: sid(room.host) === viewerId },
      phase: (rt?.phase ?? (room.status === 'ended' ? 'ended' : 'lobby')) as Phase | 'lobby',
      question: null as null | {
        index: number
        total: number
        text: string
        options: string[]
        endsAt: number
        serverNow: number
        myChoice: number | null
      },
      reveal: rt?.phase === 'reveal' || (rt?.phase === 'paused' && rt.pausedFrom === 'reveal') ? rt.lastReveal : null,
      paused: rt?.phase === 'paused',
    }
    if (rt && (rt.phase === 'question' || (rt.phase === 'paused' && rt.pausedFrom === 'question') || rt.phase === 'countdown')) {
      const q = rt.questions[rt.index]
      if (q && rt.phase !== 'countdown') {
        base.question = {
          index: rt.index,
          total: rt.questions.length,
          text: q.text,
          options: q.options,
          endsAt: rt.phase === 'paused' ? Date.now() + rt.pausedRemaining : rt.endsAt,
          serverNow: Date.now(),
          myChoice: rt.answers.get(rt.index)?.get(viewerId)?.choice ?? null,
        }
      }
    }
    return base
  }

  /** Broadcasts a personalised snapshot to every socket in the room. */
  async broadcastState(code: string) {
    const room = await GameRoom.findOne({ roomCode: code })
    if (!room) return
    const sockets = await this.io.in(code).fetchSockets()
    await Promise.all(
      sockets.map(async (s) => {
        const uid = (s.data as { userId?: string }).userId
        if (uid) s.emit('room:state', await this.stateFor(room, uid))
      }),
    )
  }

  // ───────────── Game lifecycle ─────────────

  async start(code: string, hostId: string): Promise<void> {
    if (this.runtimes.has(code)) throw new Error('ALREADY_STARTED')
    const room = await GameRoom.findOne({ roomCode: code })
    if (!room) throw new Error('ROOM_NOT_FOUND')
    if (sid(room.host) !== hostId) throw new Error('NOT_HOST')
    if (room.status !== 'lobby') throw new Error('NOT_IN_LOBBY')
    const active = room.participants.filter((p) => !p.kicked)
    if (active.length < 1) throw new Error('NO_PLAYERS')

    const quiz = await Quiz.findById(room.quiz)
    if (!quiz) throw new Error('QUIZ_NOT_FOUND')
    const all = quiz.questions.map((q, i) => ({ q, i }))
    // Fisher–Yates on indexes, then keep the requested number.
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[all[i], all[j]] = [all[j], all[i]]
    }
    const chosen = all.slice(0, Math.min(room.settings.questionCount, all.length))
    const override = room.settings.timeLimit
    const questions: Q[] = chosen.map(({ q }) => ({
      id: sid(q._id),
      text: q.text,
      options: q.options.map((o) => o.text),
      correctIndex: q.correctIndex,
      timeLimit: override > 0 ? override : q.timeLimit,
      explanation: q.explanation ?? '',
    }))

    room.status = 'active'
    room.questionOrder = chosen.map((c) => c.i)
    room.currentQuestionIndex = -1
    await room.save()

    const rt: Runtime = {
      code,
      roomId: room._id,
      quizId: room.quiz as Types.ObjectId,
      category: quiz.category,
      teamMode: room.teamMode,
      basePoints: room.settings.basePoints,
      speedBonus: room.settings.speedBonus,
      questions,
      phase: 'countdown',
      index: -1,
      startedAt: 0,
      endsAt: 0,
      timer: null,
      pausedFrom: null,
      pausedRemaining: 0,
      answers: new Map(),
      scores: new Map(active.map((p) => [sid(p.user), { score: 0, correct: 0, totalTimeMs: 0, answered: 0 }])),
      lastReveal: null,
      lastActivity: Date.now(),
    }
    this.runtimes.set(code, rt)
    this.hostCache.set(code, hostId)

    this.io.to(code).emit('game:starting', { inMs: TIMING.countdown, total: questions.length })
    await this.broadcastState(code)
    rt.timer = setTimeout(() => void this.nextQuestion(rt), TIMING.countdown)
  }

  private async nextQuestion(rt: Runtime) {
    rt.timer = null
    rt.index += 1
    if (rt.index >= rt.questions.length) return this.finish(rt, 'completed')
    const q = rt.questions[rt.index]
    rt.phase = 'question'
    rt.startedAt = Date.now()
    rt.endsAt = rt.startedAt + q.timeLimit * 1000
    rt.answers.set(rt.index, new Map())
    rt.lastReveal = null
    rt.lastActivity = Date.now()
    await GameRoom.updateOne({ roomCode: rt.code }, { currentQuestionIndex: rt.index, questionStartedAt: new Date(rt.startedAt), questionEndsAt: new Date(rt.endsAt) })
    this.io.to(rt.code).emit('question:start', {
      index: rt.index,
      total: rt.questions.length,
      text: q.text,
      options: q.options,
      endsAt: rt.endsAt,
      serverNow: Date.now(),
    })
    rt.timer = setTimeout(() => void this.reveal(rt), q.timeLimit * 1000)
  }

  /** Called from the socket handler. Server decides correctness, timing and points. */
  submitAnswer(code: string, userId: string, questionIndex: number, choice: number): { ok: true } | { ok: false; reason: string } {
    const rt = this.runtimes.get(code)
    if (!rt || rt.phase !== 'question') return { ok: false, reason: 'NOT_ACCEPTING' }
    if (questionIndex !== rt.index) return { ok: false, reason: 'STALE_QUESTION' }
    const score = rt.scores.get(userId)
    if (!score) return { ok: false, reason: 'NOT_PLAYER' }
    const q = rt.questions[rt.index]
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return { ok: false, reason: 'BAD_CHOICE' }
    const now = Date.now()
    if (now > rt.endsAt + TIMING.grace) return { ok: false, reason: 'TOO_LATE' }
    const bucket = rt.answers.get(rt.index)!
    if (bucket.has(userId)) return { ok: false, reason: 'ALREADY_ANSWERED' } // duplicate submission

    const timeMs = Math.max(0, Math.min(now, rt.endsAt) - rt.startedAt)
    const correct = choice === q.correctIndex
    const limitMs = q.timeLimit * 1000
    const points = correct ? Math.round(rt.basePoints + rt.speedBonus * Math.max(0, 1 - timeMs / limitMs)) : 0
    bucket.set(userId, { choice, timeMs, correct, points })
    rt.lastActivity = now

    this.io.to(rt.code).emit('answer:count', { answered: bucket.size, total: this.connectedPlayers(rt).length })
    // Everyone present has answered → reveal early.
    if (this.connectedPlayers(rt).every((id) => bucket.has(id))) {
      if (rt.timer) clearTimeout(rt.timer)
      rt.timer = setTimeout(() => void this.reveal(rt), 400)
    }
    return { ok: true }
  }

  private connectedPlayers(rt: Runtime): string[] {
    const sockets = this.io.sockets.adapter.rooms.get(rt.code)
    const present = new Set<string>()
    if (sockets) {
      for (const sId of sockets) {
        const s = this.io.sockets.sockets.get(sId)
        const uid = (s?.data as { userId?: string } | undefined)?.userId
        if (uid) present.add(uid)
      }
    }
    // Only players of this game who are currently connected; if nobody is, fall back to all so the timer still resolves.
    const ids = [...rt.scores.keys()].filter((id) => present.has(id))
    return ids.length ? ids : [...rt.scores.keys()]
  }

  private async reveal(rt: Runtime) {
    if (rt.phase !== 'question') return
    rt.timer = null
    rt.phase = 'reveal'
    const q = rt.questions[rt.index]
    const bucket = rt.answers.get(rt.index) ?? new Map<string, Answer>()
    const distribution = q.options.map(() => 0)
    const perPlayer: Record<string, { answered: boolean; correct: boolean; points: number; choice: number | null }> = {}
    const persist: { user: Types.ObjectId; questionIndex: number; choice: number; timeMs: number; correct: boolean; points: number }[] = []

    for (const [uid, s] of rt.scores) {
      const a = bucket.get(uid)
      if (a) {
        distribution[a.choice] += 1
        s.score += a.points
        s.answered += 1
        s.totalTimeMs += a.timeMs
        if (a.correct) s.correct += 1
        persist.push({ user: new Types.ObjectId(uid), questionIndex: rt.index, choice: a.choice, timeMs: a.timeMs, correct: a.correct, points: a.points })
      }
      perPlayer[uid] = { answered: !!a, correct: a?.correct ?? false, points: a?.points ?? 0, choice: a?.choice ?? null }
    }

    const leaderboard = this.leaderboard(rt)
    rt.lastReveal = {
      index: rt.index,
      total: rt.questions.length,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      distribution,
      players: perPlayer,
      leaderboard,
      reveal_ms: TIMING.reveal,
      isLast: rt.index === rt.questions.length - 1,
    }
    this.io.to(rt.code).emit('question:reveal', rt.lastReveal)

    // Persist progress so a crash/restart keeps what was played.
    await GameRoom.updateOne({ roomCode: rt.code }, { $push: { answers: { $each: persist } } }).catch(() => undefined)
    for (const [uid, s] of rt.scores) {
      await GameRoom.updateOne({ roomCode: rt.code, 'participants.user': new Types.ObjectId(uid) }, { $set: { 'participants.$.score': s.score, 'participants.$.correct': s.correct } }).catch(() => undefined)
    }

    rt.timer = setTimeout(() => void this.nextQuestion(rt), TIMING.reveal)
  }

  private leaderboard(rt: Runtime) {
    return this.ranked(rt).map((r) => ({ id: r.id, rank: r.rank, score: r.score, correct: r.correct }))
  }

  private ranked(rt: Runtime) {
    const rows = [...rt.scores.entries()].map(([id, s]) => ({ id, score: s.score, correct: s.correct, avgMs: s.answered ? s.totalTimeMs / s.answered : Number.MAX_SAFE_INTEGER, answered: s.answered }))
    rows.sort((a, b) => b.score - a.score || b.correct - a.correct || a.avgMs - b.avgMs)
    let rank = 0
    return rows.map((r, i) => {
      const prev = rows[i - 1]
      if (!prev || prev.score !== r.score || prev.correct !== r.correct || prev.avgMs !== r.avgMs) rank = i + 1
      return { ...r, rank }
    })
  }

  // ───────────── Host controls ─────────────

  pause(code: string, hostId: string): boolean {
    const rt = this.runtimes.get(code)
    if (!rt || !this.isHost(code, hostId) || rt.phase === 'paused' || rt.phase === 'ended') return false
    const from = rt.phase as 'countdown' | 'question' | 'reveal'
    if (rt.timer) clearTimeout(rt.timer)
    rt.timer = null
    rt.pausedFrom = from
    rt.pausedRemaining = from === 'question' ? Math.max(0, rt.endsAt - Date.now()) : TIMING.reveal
    rt.phase = 'paused'
    this.io.to(code).emit('game:paused', { remainingMs: rt.pausedRemaining })
    return true
  }

  resume(code: string, hostId: string): boolean {
    const rt = this.runtimes.get(code)
    if (!rt || !this.isHost(code, hostId) || rt.phase !== 'paused' || !rt.pausedFrom) return false
    const from = rt.pausedFrom
    rt.pausedFrom = null
    if (from === 'question') {
      rt.phase = 'question'
      rt.endsAt = Date.now() + rt.pausedRemaining
      rt.timer = setTimeout(() => void this.reveal(rt), rt.pausedRemaining)
      this.io.to(rt.code).emit('game:resumed', { phase: 'question', endsAt: rt.endsAt, serverNow: Date.now() })
    } else {
      rt.phase = from
      rt.timer = setTimeout(() => void this.nextQuestion(rt), from === 'countdown' ? TIMING.countdown : rt.pausedRemaining)
      this.io.to(rt.code).emit('game:resumed', { phase: from, serverNow: Date.now() })
    }
    return true
  }

  async end(code: string, hostId: string): Promise<boolean> {
    const rt = this.runtimes.get(code)
    if (!rt || !this.isHost(code, hostId)) return false
    await this.finish(rt, 'host_ended')
    return true
  }

  /** room code → host user id, set when the game starts. */
  private hostCache = new Map<string, string>()
  private isHost(code: string, userId: string) {
    return this.hostCache.get(code) === userId
  }

  /** Removes a kicked player from the live game. */
  removePlayer(code: string, userId: string) {
    const rt = this.runtimes.get(code)
    if (rt) rt.scores.delete(userId)
  }

  // ───────────── Finish & persistence ─────────────

  private async finish(rt: Runtime, reason: 'completed' | 'host_ended' | 'abandoned') {
    if (rt.phase === 'ended') return
    if (rt.timer) clearTimeout(rt.timer)
    rt.timer = null
    rt.phase = 'ended'
    this.runtimes.delete(rt.code)
    this.hostCache.delete(rt.code)

    const room = await GameRoom.findOne({ roomCode: rt.code })
    if (!room) return
    const ranked = this.ranked(rt)
    const playerCount = ranked.length
    const total = rt.questions.length
    const names = new Map(room.participants.map((p) => [sid(p.user), p]))

    // Team aggregation: average of members' scores, so team size never decides the winner.
    const teamBoard: { teamId: string; name: string; score: number; members: number; rank: number }[] = []
    const teamScoreOf = new Map<string, number>()
    const teamRankOf = new Map<string, number>()
    if (rt.teamMode) {
      const groups = new Map<string, number[]>()
      for (const r of ranked) {
        const t = names.get(r.id)?.team
        if (!t) continue
        groups.set(sid(t), [...(groups.get(sid(t)) ?? []), r.score])
      }
      const teamDocs = await Team.find({ _id: { $in: [...groups.keys()] } }).select('name')
      const nm = new Map(teamDocs.map((t) => [sid(t._id), t.name]))
      const rows = [...groups.entries()].map(([teamId, scores]) => ({ teamId, name: nm.get(teamId) ?? '—', score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), members: scores.length, rank: 0 }))
      rows.sort((a, b) => b.score - a.score)
      rows.forEach((r, i) => {
        r.rank = i > 0 && rows[i - 1].score === r.score ? rows[i - 1].rank : i + 1
        teamScoreOf.set(r.teamId, r.score)
        teamRankOf.set(r.teamId, r.rank)
        teamBoard.push(r)
      })
    }

    const completedAt = new Date()
    const outcomes: { userId: string; xp: number; level: number; streak: number; achievements: AchievementType[] }[] = []

    for (const r of ranked) {
      const p = names.get(r.id)
      if (!p) continue
      const teamId = p.team ? sid(p.team) : null
      const rank = rt.teamMode && teamId ? teamRankOf.get(teamId) ?? r.rank : r.rank
      const won = rank === 1 && playerCount >= 1 && r.answered > 0
      const accuracy = total ? Math.round((r.correct / total) * 100) : 0
      try {
        await GameResult.create({
          user: new Types.ObjectId(r.id),
          room: rt.roomId,
          quiz: rt.quizId,
          team: p.team ?? null,
          category: rt.category,
          teamMode: rt.teamMode,
          teamScore: teamId ? teamScoreOf.get(teamId) ?? 0 : 0,
          score: r.score,
          rank,
          playerCount,
          correctAnswers: r.correct,
          totalQuestions: total,
          accuracy,
          avgResponseMs: r.answered ? Math.round(r.avgMs) : 0,
          won,
          completedAt,
        })
      } catch (e) {
        if ((e as { code?: number }).code === 11000) continue // already persisted: never double-count
        throw e
      }
      const prog = await applyGameProgress({ userId: new Types.ObjectId(r.id), quizId: rt.quizId, playerCount, won, correct: r.correct, total, teamMode: rt.teamMode, at: completedAt })
      await GameResult.updateOne({ user: r.id, room: rt.roomId }, { xpAwarded: prog.xp })
      outcomes.push({ userId: r.id, ...prog })
    }

    await Quiz.updateOne({ _id: rt.quizId }, { $inc: { playCount: 1 } })
    room.status = 'ended'
    room.endedAt = completedAt
    for (const p of room.participants) {
      const s = rt.scores.get(sid(p.user))
      if (s) {
        p.score = s.score
        p.correct = s.correct
      }
    }
    await room.save()

    const ranking = ranked.map((r) => {
      const p = names.get(r.id)
      return {
        id: r.id,
        name: p?.name ?? '',
        teamId: p?.team ? sid(p.team) : null,
        rank: r.rank,
        score: r.score,
        correct: r.correct,
        total,
        accuracy: total ? Math.round((r.correct / total) * 100) : 0,
        avgResponseMs: r.answered ? Math.round(r.avgMs) : 0,
      }
    })
    const payload = { reason, ranking, teams: teamBoard, winnerId: ranking.find((r) => r.rank === 1 && r.score > 0)?.id ?? null, total }
    const sockets = await this.io.in(rt.code).fetchSockets()
    for (const s of sockets) {
      const uid = (s.data as { userId?: string }).userId
      const mine = outcomes.find((o) => o.userId === uid)
      s.emit('game:ended', { ...payload, me: mine ? { xp: mine.xp, level: mine.level, streak: mine.streak, achievements: mine.achievements } : null })
    }
  }

  private async sweepIdle() {
    const now = Date.now()
    for (const rt of [...this.runtimes.values()]) {
      const sockets = this.io.sockets.adapter.rooms.get(rt.code)
      if ((!sockets || sockets.size === 0) && now - rt.lastActivity > TIMING.idleEndMs) await this.finish(rt, 'abandoned').catch(() => undefined)
    }
  }

  /** Called on server start: games that were running when the process died cannot be resumed. */
  static async closeOrphanedRooms() {
    await GameRoom.updateMany({ status: { $in: ['active', 'paused'] } }, { status: 'ended', endedAt: new Date() })
  }
}
