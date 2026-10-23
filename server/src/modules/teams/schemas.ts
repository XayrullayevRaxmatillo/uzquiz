import { z } from 'zod'
import { boolQuery, lang, objectId, pageQuery, playStyle, skill } from '../../utils/schemas.js'

export const createTeamBody = z.object({
  name: z.string().trim().min(3).max(40),
  description: z.string().trim().max(300).default(''),
  avatar: z.string().max(300).refine((v) => v === '' || /^#[0-9a-fA-F]{6}$/.test(v) || /^https:\/\//.test(v), 'AVATAR_INVALID').default(''),
  category: z.string().trim().min(1).max(30),
  language: lang,
  skillLevel: skill,
  playStyle: playStyle.default('casual'),
  capacity: z.number().int().min(2).max(20),
  visibility: z.enum(['public', 'private']).default('public'),
})

export const updateTeamBody = createTeamBody.partial().omit({ visibility: true }).extend({ visibility: z.enum(['public', 'private']).optional() })

export const listTeamsQuery = z.object({
  category: z.string().max(30).optional(),
  language: lang.optional(),
  skillLevel: skill.optional(),
  playStyle: playStyle.optional(),
  visibility: z.enum(['public', 'private']).optional(),
  minSize: z.coerce.number().int().min(2).max(20).optional(),
  maxSize: z.coerce.number().int().min(2).max(20).optional(),
  availableNow: boolQuery.optional(),
  q: z.string().trim().max(40).optional(),
  ...pageQuery,
})

export const joinRequestBody = z.object({ message: z.string().trim().max(200).default('') })
export const codeBody = z.object({ code: z.string().trim().min(6).max(12).toUpperCase() })
export const memberParams = z.object({ id: objectId, userId: objectId })
export const requestParams = z.object({ id: objectId, userId: objectId })
export const roleBody = z.object({ role: z.enum(['moderator', 'member']) })
export const decisionBody = z.object({ accept: z.boolean() })

export const quickMatchBody = z.object({
  category: z.string().max(30).optional(),
  language: lang.optional(),
  skillLevel: skill.default('beginner'),
  playStyle: playStyle.default('casual'),
})
export const queueBody = z.object({
  category: z.string().trim().min(1).max(30),
  language: lang,
  skillLevel: skill,
  playStyle: playStyle.default('casual'),
})
