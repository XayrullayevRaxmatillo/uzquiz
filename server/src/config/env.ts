import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

/**
 * Development convenience only: if JWT_SECRET is not configured, generate one once and keep it in
 * server/.dev-secret (git-ignored) so sessions survive restarts. Production never does this.
 */
if (process.env.NODE_ENV !== 'production' && (process.env.JWT_SECRET ?? '').length < 32) {
  const file = resolve(process.cwd(), '.dev-secret')
  let secret = existsSync(file) ? readFileSync(file, 'utf8').trim() : ''
  if (secret.length < 32) {
    secret = randomBytes(48).toString('hex')
    writeFileSync(file, secret, { mode: 0o600 })
  }
  process.env.JWT_SECRET = secret
  console.warn('[env] JWT_SECRET not set — using a generated development secret (.dev-secret).')
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/uzquiz'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(60).default(7),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('UZQUIZ <no-reply@example.com>'),
  APP_URL: z.string().default('http://localhost:5173'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  // Never print values — only which keys are wrong.
  const keys = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')
  console.error(`Invalid environment configuration:\n  ${keys}`)
  process.exit(1)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'
export const clientOrigins = env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
