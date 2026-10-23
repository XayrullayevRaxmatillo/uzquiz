import type { Types } from 'mongoose'
import { User, levelFromXp } from '../../models/User.js'
import { Achievement, ACHIEVEMENT_TYPES } from '../../models/Achievement.js'
import { GameResult } from '../../models/GameResult.js'

export type AchievementType = (typeof ACHIEVEMENT_TYPES)[number]

const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const yesterdayKey = (d: Date) => dayKey(new Date(d.getTime() - 86_400_000))

/** Unlocks achievements idempotently (unique index) and returns only the ones newly unlocked. */
export async function unlock(userId: Types.ObjectId | string, types: AchievementType[]): Promise<AchievementType[]> {
  const fresh: AchievementType[] = []
  for (const t of new Set(types)) {
    const res = await Achievement.updateOne({ user: userId, achievementType: t }, { $setOnInsert: { unlockedAt: new Date() } }, { upsert: true })
    if (res.upsertedCount === 1) fresh.push(t)
  }
  return fresh
}

export interface GameSummary {
  userId: Types.ObjectId
  quizId: Types.ObjectId
  playerCount: number
  won: boolean
  correct: number
  total: number
  teamMode: boolean
  at: Date
}

/**
 * XP, streak and achievements after a finished game.
 * Anti-farming: XP is only granted for games with 2+ players, and only once per user+quiz per UTC day.
 */
export async function applyGameProgress(g: GameSummary): Promise<{ xp: number; level: number; streak: number; achievements: AchievementType[] }> {
  const user = await User.findById(g.userId)
  if (!user) return { xp: 0, level: 1, streak: 0, achievements: [] }

  // Streak (UTC days).
  const today = dayKey(g.at)
  let streak = user.streak?.count ?? 0
  if (user.streak?.lastPlayedDay !== today) {
    streak = user.streak?.lastPlayedDay === yesterdayKey(g.at) ? streak + 1 : 1
  }

  let xp = 0
  if (g.playerCount >= 2) {
    const startOfDay = new Date(`${today}T00:00:00.000Z`)
    const alreadyToday = await GameResult.exists({ user: g.userId, quiz: g.quizId, xpAwarded: { $gt: 0 }, completedAt: { $gte: startOfDay } })
    if (!alreadyToday) {
      xp = 20 + g.correct * 10 + (g.won ? 50 : 0)
      if (user.streak?.lastPlayedDay !== today) xp += 15 // daily-challenge bonus: first game of the day
    }
  }

  user.streak = { count: streak, lastPlayedDay: today }
  user.xp += xp
  await user.save()
  const level = levelFromXp(user.xp)

  const [gamesPlayed, wins] = await Promise.all([GameResult.countDocuments({ user: g.userId }), GameResult.countDocuments({ user: g.userId, won: true })])
  const earned: AchievementType[] = []
  if (gamesPlayed >= 1) earned.push('first_game')
  if (wins >= 1 && g.playerCount >= 2) earned.push('first_win')
  if (gamesPlayed >= 10) earned.push('games_10')
  if (streak >= 3) earned.push('streak_3')
  if (streak >= 7) earned.push('streak_7')
  if (g.total >= 3 && g.correct === g.total) earned.push('perfect_game')
  if (g.teamMode) earned.push('team_player')
  if (level >= 5) earned.push('level_5')

  const achievements = await unlock(g.userId, earned)
  return { xp, level, streak, achievements }
}
