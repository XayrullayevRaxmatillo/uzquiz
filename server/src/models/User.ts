import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from 'mongoose'

export const LANGS = ['uz', 'ru', 'en'] as const
export const ROLES = ['user', 'moderator', 'admin'] as const

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 20 },
    usernameLower: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: '', maxlength: 300 },
    preferredLanguage: { type: String, enum: LANGS, default: 'uz' },
    interests: { type: [String], default: [] },
    educationLevel: { type: String, enum: ['', 'school', 'college', 'university', 'work'], default: '' },
    playMode: { type: String, enum: ['solo', 'join', 'find'], default: 'solo' },
    role: { type: String, enum: ROLES, default: 'user', index: true },
    emailVerified: { type: Boolean, default: false },
    onboarded: { type: Boolean, default: false },
    banned: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    team: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    favorites: [{ type: Schema.Types.ObjectId, ref: 'Quiz' }],
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    xp: { type: Number, default: 0, min: 0 },
    streak: {
      count: { type: Number, default: 0 },
      lastPlayedDay: { type: String, default: '' }, // YYYY-MM-DD (UTC)
    },
    emailVerifyHash: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    resetHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0, select: false }, // bump to invalidate sessions
  },
  { timestamps: true },
)

export type UserAttrs = InferSchemaType<typeof userSchema>
export type UserDoc = HydratedDocument<UserAttrs>
export const User = model('User', userSchema)

export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(xp / 100)) + 1

export function publicUser(u: UserDoc | (UserAttrs & { _id: Types.ObjectId })) {
  return {
    id: String(u._id),
    name: u.name,
    username: u.username,
    email: u.email,
    avatar: u.avatar,
    preferredLanguage: u.preferredLanguage,
    interests: u.interests,
    role: u.role,
    emailVerified: u.emailVerified,
    onboarded: u.onboarded,
    xp: u.xp,
    level: levelFromXp(u.xp),
    createdAt: (u as unknown as { createdAt: Date }).createdAt,
  }
}
