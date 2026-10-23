import { Types, type PipelineStage } from 'mongoose'
import { GameResult } from '../../models/GameResult.js'
import { Quiz } from '../../models/Quiz.js'
import { Team } from '../../models/Team.js'
import { User, levelFromXp, type UserDoc } from '../../models/User.js'
import { Achievement } from '../../models/Achievement.js'
import { quizDto } from '../quizzes/service.js'
import { myTeam } from '../teams/service.js'

const sid = (v: unknown) => String(v)
const weekAgo = () => new Date(Date.now() - 7 * 86_400_000)

export type Scope = 'global' | 'weekly' | 'category' | 'friends' | 'teams'

/**
 * Leaderboards come exclusively from persisted, server-computed results.
 * Anti-inflation rules: only multiplayer games (2+ players) count, and only the BEST score
 * per (player, quiz) counts — replaying the same quiz can never stack points.
 */
export async function leaderboard(scope: Scope, viewer: UserDoc | undefined, category?: string) {
  const match: Record<string, unknown> = { playerCount: { $gte: 2 } }
  if (scope === 'weekly') match.completedAt = { $gte: weekAgo() }
  if (scope === 'category' && category) match.category = category
  if (scope === 'friends') {
    if (!viewer) return { scope, items: [], me: null }
    match.user = { $in: [viewer._id, ...viewer.friends] }
  }

  if (scope === 'teams') {
    const pipeline: PipelineStage[] = [
      { $match: { ...match, teamMode: true, team: { $ne: null } } },
      { $group: { _id: { team: '$team', quiz: '$quiz' }, best: { $max: '$teamScore' } } },
      { $group: { _id: '$_id.team', score: { $sum: '$best' }, games: { $sum: 1 } } },
      { $sort: { score: -1 } },
      { $limit: 50 },
    ]
    const rows = await GameResult.aggregate<{ _id: Types.ObjectId; score: number; games: number }>(pipeline)
    const teams = await Team.find({ _id: { $in: rows.map((r) => r._id) } }).select('name avatar category')
    const byId = new Map(teams.map((t) => [sid(t._id), t]))
    return {
      scope,
      items: rows.map((r, i) => ({ rank: i + 1, id: sid(r._id), name: byId.get(sid(r._id))?.name ?? '—', avatar: byId.get(sid(r._id))?.avatar ?? '', score: r.score, games: r.games, isMe: !!viewer?.team && sid(viewer.team) === sid(r._id) })),
      me: null,
    }
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    { $group: { _id: { user: '$user', quiz: '$quiz' }, best: { $max: '$score' } } },
    { $group: { _id: '$_id.user', score: { $sum: '$best' }, games: { $sum: 1 } } },
    { $sort: { score: -1, _id: 1 } },
    { $limit: 1000 },
  ]
  const rows = await GameResult.aggregate<{ _id: Types.ObjectId; score: number; games: number }>(pipeline)
  const users = await User.find({ _id: { $in: rows.slice(0, 50).map((r) => r._id) } }).select('name username avatar xp')
  const byId = new Map(users.map((u) => [sid(u._id), u]))
  const items = rows.slice(0, 50).map((r, i) => {
    const u = byId.get(sid(r._id))
    return { rank: i + 1, id: sid(r._id), name: u?.name ?? '—', username: u?.username ?? '', avatar: u?.avatar ?? '', score: r.score, games: r.games, level: levelFromXp(u?.xp ?? 0), isMe: !!viewer && sid(r._id) === sid(viewer._id) }
  })
  let me: { rank: number; score: number; games: number } | null = null
  if (viewer) {
    const idx = rows.findIndex((r) => sid(r._id) === sid(viewer._id))
    if (idx >= 0) me = { rank: idx + 1, score: rows[idx].score, games: rows[idx].games }
  }
  return { scope, items, me }
}

/** Deterministic quiz of the day among public, active quizzes. */
export async function dailyChallenge(viewer?: UserDoc) {
  const ids = await Quiz.find({ visibility: 'public', status: 'active' }).sort({ _id: 1 }).select('_id')
  if (!ids.length) return null
  const day = Math.floor(Date.now() / 86_400_000)
  const quiz = await Quiz.findById(ids[day % ids.length]._id).populate('creator', 'name username')
  if (!quiz) return null
  const startOfDay = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const completed = viewer ? !!(await GameResult.exists({ user: viewer._id, completedAt: { $gte: startOfDay } })) : false
  return { quiz: quizDto(quiz, viewer), completedToday: completed, bonusXp: 15 }
}

export async function dashboard(user: UserDoc) {
  const [agg, recent, achievements, created, favorites, team, board, daily] = await Promise.all([
    GameResult.aggregate<{ games: number; wins: number; correct: number; total: number }>([
      { $match: { user: user._id } },
      { $group: { _id: null, games: { $sum: 1 }, wins: { $sum: { $cond: ['$won', 1, 0] } }, correct: { $sum: '$correctAnswers' }, total: { $sum: '$totalQuestions' } } },
    ]),
    GameResult.find({ user: user._id }).sort({ completedAt: -1 }).limit(10).populate('quiz', 'title category'),
    Achievement.find({ user: user._id }).sort({ unlockedAt: -1 }),
    Quiz.countDocuments({ creator: user._id }),
    Quiz.find({ _id: { $in: user.favorites }, visibility: 'public', status: 'active' }).limit(6).populate('creator', 'name username'),
    myTeam(user),
    leaderboard('global', user),
    dailyChallenge(user),
  ])
  const a = agg[0] ?? { games: 0, wins: 0, correct: 0, total: 0 }
  const level = levelFromXp(user.xp)
  const floor = (level - 1) ** 2 * 100
  const ceil = level ** 2 * 100
  return {
    totals: { games: a.games, wins: a.wins, accuracy: a.total ? Math.round((a.correct / a.total) * 100) : 0, createdQuizzes: created },
    xp: { total: user.xp, level, into: user.xp - floor, needed: ceil - floor },
    streak: user.streak?.count ?? 0,
    rank: board.me?.rank ?? null,
    recent: recent.map((r) => {
      const q = r.quiz as unknown as { _id: unknown; title: string; category: string } | null
      return { id: sid(r._id), quizId: sid(q?._id), quizTitle: q?.title ?? '—', category: q?.category ?? '', score: r.score, rank: r.rank, playerCount: r.playerCount, accuracy: r.accuracy, won: r.won, completedAt: r.completedAt }
    }),
    achievements: achievements.map((x) => ({ type: x.achievementType, unlockedAt: x.unlockedAt })),
    favorites: favorites.map((q) => quizDto(q, user)),
    team,
    daily,
  }
}
