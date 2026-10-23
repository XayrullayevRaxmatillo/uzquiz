import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'

export const SKILLS = ['beginner', 'intermediate', 'advanced'] as const
export const PLAY_STYLES = ['casual', 'competitive'] as const
export const TEAM_ROLES = ['owner', 'moderator', 'member'] as const

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 40 },
    nameLower: { type: String, required: true, unique: true },
    description: { type: String, default: '', maxlength: 300 },
    avatar: { type: String, default: '' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: TEAM_ROLES, default: 'member' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    category: { type: String, required: true, index: true },
    language: { type: String, enum: ['uz', 'ru', 'en'], required: true, index: true },
    skillLevel: { type: String, enum: SKILLS, required: true, index: true },
    playStyle: { type: String, enum: PLAY_STYLES, default: 'casual', index: true },
    capacity: { type: Number, required: true, min: 2, max: 20 },
    visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
    inviteCode: { type: String, required: true, unique: true },
    joinRequests: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        message: { type: String, default: '', maxlength: 200 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    banned: { type: Boolean, default: false },
  },
  { timestamps: true },
)
teamSchema.index({ 'members.user': 1 })
teamSchema.index({ 'joinRequests.user': 1 })

export type TeamAttrs = InferSchemaType<typeof teamSchema>
export type TeamDoc = HydratedDocument<TeamAttrs>
export const Team = model('Team', teamSchema)

/** Waiting queue entries for users who could not find a suitable team. */
const queueSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    category: { type: String, required: true },
    language: { type: String, enum: ['uz', 'ru', 'en'], required: true },
    skillLevel: { type: String, enum: SKILLS, required: true },
    playStyle: { type: String, enum: PLAY_STYLES, default: 'casual' },
  },
  { timestamps: true },
)
export const TeamQueue = model('TeamQueue', queueSchema)
