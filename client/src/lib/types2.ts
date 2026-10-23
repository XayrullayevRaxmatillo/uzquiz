import type { Lang } from '../i18n/types'

export interface QuizCardData {
  id: string
  title: string
  description: string
  category: string
  language: Lang
  difficulty: 'easy' | 'medium' | 'hard'
  coverImage: string
  visibility: 'public' | 'private'
  questionCount: number
  totalSeconds: number
  ratingAvg: number
  ratingCount: number
  playCount: number
  favoritesCount: number
  isDemo: boolean
  creator: { id: string; name?: string; username?: string }
  isOwner: boolean
  isFavorite: boolean
  myRating: number | null
}
export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pages: number
}
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced'
export type PlayStyle = 'casual' | 'competitive'
export interface TeamData {
  id: string
  name: string
  description: string
  avatar: string
  category: string
  language: Lang
  skillLevel: SkillLevel
  playStyle: PlayStyle
  capacity: number
  memberCount: number
  full: boolean
  visibility: 'public' | 'private'
  leader: { id: string; name: string; username: string } | null
  online: boolean
  onlineCount: number
  isMember: boolean
  myRole: 'owner' | 'moderator' | 'member' | null
  hasRequested: boolean
  members: { id: string; name: string; username: string; avatar: string; role: 'owner' | 'moderator' | 'member'; online: boolean }[]
  inviteCode?: string
  joinRequestCount?: number
}
