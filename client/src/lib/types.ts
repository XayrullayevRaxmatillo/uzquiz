import type { Lang } from '../i18n/types'

export type Role = 'user' | 'moderator' | 'admin'

export interface User {
  id: string
  name: string
  username: string
  email: string
  avatar: string
  preferredLanguage: Lang
  interests: string[]
  role: Role
  emailVerified: boolean
  onboarded: boolean
  xp: number
  level: number
  createdAt: string
}

export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string; fields?: Record<string, string> }
}
