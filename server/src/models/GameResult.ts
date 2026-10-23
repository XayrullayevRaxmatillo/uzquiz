import { Schema, model } from 'mongoose'

const resultSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    room: { type: Schema.Types.ObjectId, ref: 'GameRoom', required: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    team: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    category: { type: String, required: true, index: true },
    teamMode: { type: Boolean, default: false },
    teamScore: { type: Number, default: 0 }, // average score of the team for this game (team mode only)
    score: { type: Number, required: true, min: 0 },
    rank: { type: Number, required: true, min: 1 },
    playerCount: { type: Number, required: true, min: 1 },
    correctAnswers: { type: Number, required: true, min: 0 },
    totalQuestions: { type: Number, required: true, min: 1 },
    accuracy: { type: Number, required: true, min: 0, max: 100 },
    avgResponseMs: { type: Number, default: 0 },
    won: { type: Boolean, default: false },
    xpAwarded: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
)
// One result per user per room: replays and duplicate submissions cannot inflate rankings.
resultSchema.index({ user: 1, room: 1 }, { unique: true })
resultSchema.index({ completedAt: -1, score: -1 })

export const GameResult = model('GameResult', resultSchema)
