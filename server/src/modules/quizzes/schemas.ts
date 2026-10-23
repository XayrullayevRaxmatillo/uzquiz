import { z } from 'zod'
import { lang, objectId, pageQuery } from '../../utils/schemas.js'

const question = z
  .object({
    text: z.string().trim().min(3, 'QUESTION_SHORT').max(300),
    options: z.array(z.string().trim().min(1, 'OPTION_EMPTY').max(120)).min(2).max(4),
    correctIndex: z.number().int().min(0).max(3),
    timeLimit: z.number().int().min(5).max(120).default(20),
    explanation: z.string().trim().max(300).default(''),
  })
  .refine((q) => q.correctIndex < q.options.length, { path: ['correctIndex'], message: 'CORRECT_OUT_OF_RANGE' })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, { path: ['options'], message: 'OPTIONS_DUPLICATE' })

const cover = z.string().trim().max(500).refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), 'COVER_INVALID')

export const quizBody = z.object({
  title: z.string().trim().min(3, 'TITLE_SHORT').max(80),
  description: z.string().trim().max(500).default(''),
  category: z.string().trim().min(1).max(30),
  language: lang,
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  coverImage: cover.default(''),
  visibility: z.enum(['public', 'private']).default('public'),
  questions: z.array(question).min(1, 'NEED_QUESTIONS').max(100),
})
export type QuizBody = z.infer<typeof quizBody>

export const listQuizQuery = z.object({
  q: z.string().trim().max(60).optional(),
  category: z.string().max(30).optional(),
  language: lang.optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  sort: z.enum(['newest', 'popular', 'rating']).default('newest'),
  ...pageQuery,
})

export const rateBody = z.object({ value: z.number().int().min(1).max(5) })
export const reportBody = z.object({ reason: z.string().trim().min(5).max(500) })
export const quizIdParams = z.object({ id: objectId })
