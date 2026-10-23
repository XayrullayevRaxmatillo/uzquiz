import { GameRoom, type RoomDoc } from '../../models/GameRoom.js'
import { Quiz } from '../../models/Quiz.js'
import { Team } from '../../models/Team.js'
import { User, type UserDoc } from '../../models/User.js'
import { GameResult } from '../../models/GameResult.js'
import { badRequest, conflict, forbidden, notFound, AppError } from '../../utils/errors.js'
import { randomCode } from '../../utils/crypto.js'

const sid = (v: unknown) => String(v)

export interface CreateRoomInput {
  quizId: string
  teamMode: boolean
  questionCount?: number
  timeLimit: number
  maxPlayers: number
  visibility: 'public' | 'private'
  speedBonus: number
}

export async function createRoom(host: UserDoc, input: CreateRoomInput) {
  const quiz = await Quiz.findById(input.quizId)
  const isOwner = quiz && sid(quiz.creator) === sid(host._id)
  if (!quiz || quiz.status !== 'active' || (quiz.visibility === 'private' && !isOwner)) throw notFound('QUIZ_NOT_FOUND')
  if (input.teamMode && !host.team) throw badRequest('NEED_TEAM', 'Team mode requires being in a team')
  const openRooms = await GameRoom.countDocuments({ host: host._id, status: { $in: ['lobby', 'active', 'paused'] } })
  if (openRooms >= 3) throw conflict('TOO_MANY_ROOMS')

  const questionCount = Math.min(input.questionCount ?? quiz.questions.length, quiz.questions.length)
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const room = await GameRoom.create({
        roomCode: randomCode(6),
        host: host._id,
        quiz: quiz._id,
        teamMode: input.teamMode,
        settings: {
          questionCount,
          timeLimit: input.timeLimit,
          maxPlayers: input.maxPlayers,
          visibility: input.visibility,
          speedBonus: input.speedBonus,
        },
        participants: [{ user: host._id, name: host.name, team: input.teamMode ? host.team : null, ready: true, connected: false }],
      })
      return room
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e
    }
  }
  throw new AppError(503, 'CODE_GENERATION_FAILED')
}

export async function findRoom(code: string): Promise<RoomDoc> {
  const room = await GameRoom.findOne({ roomCode: code.toUpperCase() })
  if (!room) throw notFound('ROOM_NOT_FOUND')
  return room
}

/** What a user may see before joining: host, counts, status — never the questions. */
export async function previewRoom(code: string, viewer: UserDoc) {
  const room = await findRoom(code)
  if (room.status === 'ended') throw new AppError(410, 'ROOM_ENDED')
  const quiz = await Quiz.findById(room.quiz).select('title category language difficulty')
  const active = room.participants.filter((p) => !p.kicked)
  const mine = active.some((p) => sid(p.user) === sid(viewer._id))
  return {
    code: room.roomCode,
    status: room.status,
    teamMode: room.teamMode,
    host: { id: sid(room.host), name: active.find((p) => sid(p.user) === sid(room.host))?.name ?? '' },
    quiz: quiz ? { id: sid(quiz._id), title: quiz.title, category: quiz.category, language: quiz.language, difficulty: quiz.difficulty } : null,
    settings: { questionCount: room.settings.questionCount, maxPlayers: room.settings.maxPlayers, timeLimit: room.settings.timeLimit },
    playerCount: active.length,
    full: active.length >= room.settings.maxPlayers,
    joined: mine,
    canJoin: mine || (room.status === 'lobby' && active.length < room.settings.maxPlayers && (!room.teamMode || !!viewer.team)),
    needsTeam: room.teamMode && !viewer.team && !mine,
    participants: active.map((p) => ({ id: sid(p.user), name: p.name })),
  }
}

export async function publicRooms() {
  const rooms = await GameRoom.find({ status: 'lobby', 'settings.visibility': 'public' }).sort({ createdAt: -1 }).limit(20).populate('quiz', 'title category language')
  return rooms.map((r) => {
    const q = r.quiz as unknown as { title?: string; category?: string; language?: string } | null
    const active = r.participants.filter((p) => !p.kicked)
    return {
      code: r.roomCode,
      quizTitle: q?.title ?? '',
      category: q?.category ?? '',
      language: q?.language ?? 'en',
      teamMode: r.teamMode,
      playerCount: active.length,
      maxPlayers: r.settings.maxPlayers,
      hostName: active.find((p) => sid(p.user) === sid(r.host))?.name ?? '',
    }
  })
}

/**
 * Adds the user to the lobby atomically (capacity + lobby status + no duplicates).
 * Re-joining as an existing participant is always allowed (page refresh / reconnect).
 */
export async function joinRoom(code: string, user: UserDoc): Promise<RoomDoc> {
  const room = await findRoom(code)
  if (room.status === 'ended') throw new AppError(410, 'ROOM_ENDED')
  const existing = room.participants.find((p) => sid(p.user) === sid(user._id))
  if (existing) {
    if (existing.kicked) throw forbidden('KICKED')
    return room
  }
  if (room.status !== 'lobby') throw conflict('GAME_IN_PROGRESS')
  if (room.teamMode && !user.team) throw badRequest('NEED_TEAM')
  const res = await GameRoom.updateOne(
    {
      roomCode: room.roomCode,
      status: 'lobby',
      'participants.user': { $ne: user._id },
      $expr: { $lt: [{ $size: '$participants' }, '$settings.maxPlayers'] },
    },
    { $push: { participants: { user: user._id, name: user.name, team: room.teamMode ? user.team : null, ready: false, connected: true, joinedAt: new Date() } } },
  )
  if (res.modifiedCount !== 1) throw conflict('ROOM_FULL')
  return findRoom(code)
}

export async function resultsFor(code: string, viewer: UserDoc) {
  const room = await findRoom(code)
  if (!room.participants.some((p) => sid(p.user) === sid(viewer._id))) throw forbidden('NOT_PARTICIPANT')
  if (room.status !== 'ended') throw conflict('GAME_NOT_FINISHED')
  const results = await GameResult.find({ room: room._id }).sort({ rank: 1, score: -1 }).populate('user', 'name username avatar')
  const quiz = await Quiz.findById(room.quiz).select('title category')
  const teamIds = [...new Set(results.map((r) => (r.team ? sid(r.team) : null)).filter((x): x is string => !!x))]
  const teams = teamIds.length ? await Team.find({ _id: { $in: teamIds } }).select('name') : []
  const teamName = new Map(teams.map((t) => [sid(t._id), t.name]))
  const rows = results.map((r) => {
    const u = r.user as unknown as { _id: unknown; name: string; username: string; avatar: string }
    return {
      userId: sid(u._id), name: u.name, username: u.username, avatar: u.avatar,
      teamId: r.team ? sid(r.team) : null, teamName: r.team ? teamName.get(sid(r.team)) ?? null : null,
      rank: r.rank, score: r.score, teamScore: r.teamScore, correct: r.correctAnswers, total: r.totalQuestions,
      accuracy: r.accuracy, avgResponseMs: r.avgResponseMs, won: r.won, xp: r.xpAwarded,
    }
  })
  return {
    code: room.roomCode,
    teamMode: room.teamMode,
    quiz: { id: sid(room.quiz), title: quiz?.title ?? '', category: quiz?.category ?? '' },
    endedAt: room.endedAt,
    playerCount: rows.length,
    rows,
    me: rows.find((r) => r.userId === sid(viewer._id)) ?? null,
  }
}

/** Minimal, shareable summary: winner + top 3 display names. No emails, no ids. */
export async function summary(code: string) {
  const room = await findRoom(code)
  if (room.status !== 'ended') throw conflict('GAME_NOT_FINISHED')
  const quiz = await Quiz.findById(room.quiz).select('title')
  const top = await GameResult.find({ room: room._id }).sort({ rank: 1, score: -1 }).limit(3).populate('user', 'name')
  return {
    quizTitle: quiz?.title ?? '',
    playerCount: room.participants.filter((p) => !p.kicked).length,
    top: top.map((r) => ({ rank: r.rank, name: (r.user as unknown as { name: string }).name, score: r.score })),
  }
}

void User
