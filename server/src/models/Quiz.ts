import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

const questionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 300 },
    options: {
      type: [{ _id: false, text: { type: String, required: true, trim: true, maxlength: 120 } }],
      validate: [(v: unknown[]) => v.length >= 2 && v.length <= 4, 'A question needs 2–4 options'],
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    timeLimit: { type: Number, default: 20, min: 5, max: 120 },
    explanation: { type: String, default: '', maxlength: 300 },
  },
  { _id: true },
)

const quizSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, required: true, index: true },
    language: { type: String, enum: ['uz', 'ru', 'en'], required: true, index: true },
    difficulty: { type: String, enum: DIFFICULTIES, default: 'medium', index: true },
    coverImage: { type: String, default: '', maxlength: 500 },
    questions: {
      type: [questionSchema],
      validate: [(v: unknown[]) => v.length >= 1 && v.length <= 100, 'A quiz needs 1–100 questions'],
    },
    visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
    status: { type: String, enum: ['active', 'hidden'], default: 'active', index: true }, // moderation
    ratings: [{ _id: false, user: { type: Schema.Types.ObjectId, ref: 'User' }, value: { type: Number, min: 1, max: 5 } }],
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    playCount: { type: Number, default: 0, index: true },
    favoritesCount: { type: Number, default: 0 },
    isSeed: { type: Boolean, default: false }, // demo/sample content, kept distinguishable from user content
  },
  { timestamps: true },
)
quizSchema.index({ title: 'text', description: 'text' })
quizSchema.index({ createdAt: -1 })

export type QuizAttrs = InferSchemaType<typeof quizSchema>
export type QuizDoc = HydratedDocument<QuizAttrs>
export const Quiz = model('Quiz', quizSchema)
