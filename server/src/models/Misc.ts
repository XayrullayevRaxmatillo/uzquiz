import { Schema, model } from 'mongoose'

const categorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    names: { uz: { type: String, required: true }, ru: { type: String, required: true }, en: { type: String, required: true } },
    color: { type: String, default: '#8b5cf6' },
    icon: { type: String, default: 'lightbulb' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
)
export const Category = model('Category', categorySchema)

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['quiz', 'team', 'room', 'user'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
)
export const Report = model('Report', reportSchema)

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true }, // e.g. team_request, team_accepted, team_rejected
    data: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
)
export const Notification = model('Notification', notificationSchema)
