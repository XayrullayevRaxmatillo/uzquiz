import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'

export const ROOM_STATUS = ['lobby', 'active', 'paused', 'ended'] as const

const roomSchema = new Schema(
  {
    roomCode: { type: String, required: true, unique: true, index: true },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    teamMode: { type: Boolean, default: false },
    status: { type: String, enum: ROOM_STATUS, default: 'lobby', index: true },
    settings: {
      questionCount: { type: Number, required: true, min: 1, max: 100 },
      timeLimit: { type: Number, default: 0, min: 0, max: 120 }, // 0 = per-question time from quiz
      maxPlayers: { type: Number, default: 8, min: 1, max: 100 },
      visibility: { type: String, enum: ['public', 'private'], default: 'private' },
      speedBonus: { type: Number, default: 500, min: 0, max: 2000 }, // max extra points for instant answer
      basePoints: { type: Number, default: 1000, min: 100, max: 5000 },
    },
    participants: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
        team: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
        ready: { type: Boolean, default: false },
        connected: { type: Boolean, default: true },
        kicked: { type: Boolean, default: false },
        score: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    questionOrder: [{ type: Number }], // indexes into quiz.questions chosen for this game
    currentQuestionIndex: { type: Number, default: -1 },
    questionStartedAt: { type: Date, default: null },
    questionEndsAt: { type: Date, default: null },
    answers: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        questionIndex: { type: Number, required: true },
        choice: { type: Number, required: true },
        timeMs: { type: Number, required: true },
        correct: { type: Boolean, required: true },
        points: { type: Number, required: true },
      },
    ],
    endedAt: { type: Date, default: null },
    // Rooms that never finish are cleaned up automatically.
    expireAt: { type: Date, default: () => new Date(Date.now() + 1000 * 60 * 60 * 24), index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
)

export type RoomAttrs = InferSchemaType<typeof roomSchema>
export type RoomDoc = HydratedDocument<RoomAttrs>
export const GameRoom = model('GameRoom', roomSchema)
