import { Schema, model } from 'mongoose'

export const ACHIEVEMENT_TYPES = ['first_game', 'first_win', 'streak_3', 'streak_7', 'perfect_game', 'team_player', 'quiz_creator', 'games_10', 'level_5'] as const

const achievementSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  achievementType: { type: String, enum: ACHIEVEMENT_TYPES, required: true },
  unlockedAt: { type: Date, default: Date.now },
})
achievementSchema.index({ user: 1, achievementType: 1 }, { unique: true })

export const Achievement = model('Achievement', achievementSchema)
