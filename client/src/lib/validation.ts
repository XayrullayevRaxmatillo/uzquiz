import { z } from 'zod'
import type { TKey } from '../i18n'

type T = (k: TKey) => string

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export const loginSchema = (t: T) =>
  z.object({
    identifier: z.string().trim().min(1, t('auth.required')),
    password: z.string().min(1, t('auth.required')),
  })

export const registerSchema = (t: T) =>
  z
    .object({
      name: z.string().trim().min(2, t('auth.nameShort')).max(60),
      username: z.string().trim().regex(USERNAME_RE, t('auth.usernameInvalid')),
      email: z.string().trim().email(t('auth.emailInvalid')),
      password: z
        .string()
        .min(8, t('auth.passwordShort'))
        .max(128)
        .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), t('auth.passwordWeak')),
      confirmPassword: z.string().min(1, t('auth.required')),
      preferredLanguage: z.enum(['uz', 'ru', 'en']),
    })
    .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: t('auth.passwordMismatch') })

export type LoginForm = z.infer<ReturnType<typeof loginSchema>>
export type RegisterForm = z.infer<ReturnType<typeof registerSchema>>
