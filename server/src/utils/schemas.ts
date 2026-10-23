import { z } from 'zod'

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'INVALID_ID')
export const idParams = z.object({ id: objectId })
export const lang = z.enum(['uz', 'ru', 'en'])
export const skill = z.enum(['beginner', 'intermediate', 'advanced'])
export const playStyle = z.enum(['casual', 'competitive'])

/** Query helper: '"true"' / '"1"' → boolean. */
export const boolQuery = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1')
export const pageQuery = {
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
}
