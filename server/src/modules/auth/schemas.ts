import { z } from 'zod'

export const usernameSchema = z.string().trim().regex(/^[a-zA-Z0-9_]{3,20}$/, 'USERNAME_INVALID')
export const passwordSchema = z
  .string()
  .min(8, 'PASSWORD_SHORT')
  .max(128, 'PASSWORD_LONG')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'PASSWORD_WEAK')
const lang = z.enum(['uz', 'ru', 'en'])

export const registerBody = z.object({
  name: z.string().trim().min(2, 'NAME_SHORT').max(60),
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email('EMAIL_INVALID').max(254),
  password: passwordSchema,
  preferredLanguage: lang.default('uz'),
  avatar: z.string().max(300).optional(),
})

export const loginBody = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
})

export const forgotBody = z.object({ email: z.string().trim().toLowerCase().email() })
export const resetBody = z.object({ token: z.string().min(20).max(200), password: passwordSchema })
export const verifyBody = z.object({ token: z.string().min(20).max(200) })

export const profileBody = z
  .object({
    name: z.string().trim().min(2).max(60),
    avatar: z
      .string()
      .max(300)
      .refine((v) => v === '' || /^#[0-9a-fA-F]{6}$/.test(v) || /^https:\/\//.test(v), 'AVATAR_INVALID'),
    preferredLanguage: lang,
    interests: z.array(z.string().trim().max(30)).max(12),
  })
  .partial()

export const onboardingBody = z.object({
  interests: z.array(z.string().trim().min(1).max(30)).max(12),
  educationLevel: z.enum(['', 'school', 'college', 'university', 'work']).default(''),
  playMode: z.enum(['solo', 'join', 'find']),
})

export const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })
