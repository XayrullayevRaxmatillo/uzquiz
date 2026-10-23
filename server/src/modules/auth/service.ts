import { hash, verify } from '@node-rs/argon2'
import { env } from '../../config/env.js'
import { User, publicUser, type UserDoc } from '../../models/User.js'
import { conflict, unauthorized, badRequest } from '../../utils/errors.js'
import { randomToken, sha256 } from '../../utils/crypto.js'
import { sendMail } from '../../utils/mailer.js'

const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } // OWASP-recommended minimum for argon2id
// Pre-computed so unknown users cost the same time as wrong passwords (no user enumeration by timing).
const DUMMY_HASH_PROMISE = hash('dummy-password-for-timing', ARGON_OPTS)

export const hashPassword = (pw: string) => hash(pw, ARGON_OPTS)

export async function registerUser(input: {
  name: string
  username: string
  email: string
  password: string
  preferredLanguage: 'uz' | 'ru' | 'en'
  avatar?: string
}) {
  const [emailTaken, userTaken] = await Promise.all([
    User.exists({ email: input.email }),
    User.exists({ usernameLower: input.username.toLowerCase() }),
  ])
  const fields: Record<string, string> = {}
  if (emailTaken) fields.email = 'EMAIL_TAKEN'
  if (userTaken) fields.username = 'USERNAME_TAKEN'
  if (Object.keys(fields).length) throw conflict('CONFLICT', 'Already registered', fields)

  const verifyToken = randomToken(32)
  try {
    const user = await User.create({
      name: input.name,
      username: input.username,
      usernameLower: input.username.toLowerCase(),
      email: input.email,
      passwordHash: await hashPassword(input.password),
      preferredLanguage: input.preferredLanguage,
      avatar: input.avatar && /^(#[0-9a-fA-F]{6}|https:\/\/.+)$/.test(input.avatar) ? input.avatar : '',
      emailVerifyHash: sha256(verifyToken),
      emailVerifyExpires: new Date(Date.now() + 1000 * 60 * 60 * 24),
    })
    void sendVerification(user.email, verifyToken)
    return user
  } catch (e) {
    // Lost a race with a concurrent registration.
    if ((e as { code?: number }).code === 11000) throw conflict('CONFLICT', 'Already registered', { email: 'EMAIL_TAKEN' })
    throw e
  }
}

async function sendVerification(email: string, token: string) {
  const link = `${env.APP_URL}/verify-email?token=${token}`
  await sendMail(email, 'UZQUIZ — email verification', `Confirm your email:\n${link}\n\nThe link is valid for 24 hours.`).catch(() => undefined)
}

export async function resendVerification(user: UserDoc) {
  if (user.emailVerified) return
  const token = randomToken(32)
  user.emailVerifyHash = sha256(token)
  user.emailVerifyExpires = new Date(Date.now() + 1000 * 60 * 60 * 24)
  await user.save()
  await sendVerification(user.email, token)
}

export async function verifyEmail(token: string) {
  const user = await User.findOne({ emailVerifyHash: sha256(token), emailVerifyExpires: { $gt: new Date() } }).select('+emailVerifyHash +emailVerifyExpires')
  if (!user) throw badRequest('TOKEN_INVALID', 'Invalid or expired token')
  user.emailVerified = true
  user.emailVerifyHash = undefined
  user.emailVerifyExpires = undefined
  await user.save()
  return user
}

export async function authenticate(identifier: string, password: string): Promise<UserDoc> {
  const id = identifier.trim()
  const filter = id.includes('@') ? { email: id.toLowerCase() } : { usernameLower: id.toLowerCase() }
  const user = await User.findOne(filter).select('+passwordHash +tokenVersion')
  const ok = await verify(user?.passwordHash ?? (await DUMMY_HASH_PROMISE), password).catch(() => false)
  if (!user || !ok || user.banned) throw unauthorized('INVALID_CREDENTIALS')
  return user
}

export async function forgotPassword(email: string) {
  const user = await User.findOne({ email }).select('+resetHash +resetExpires')
  if (!user) return // identical response either way: no account enumeration
  const token = randomToken(32)
  user.resetHash = sha256(token)
  user.resetExpires = new Date(Date.now() + 1000 * 60 * 30)
  await user.save()
  const link = `${env.APP_URL}/reset-password?token=${token}`
  await sendMail(email, 'UZQUIZ — password reset', `Reset your password:\n${link}\n\nThe link is valid for 30 minutes. If you did not ask for this, ignore this email.`).catch(() => undefined)
}

export async function resetPassword(token: string, password: string) {
  const user = await User.findOne({ resetHash: sha256(token), resetExpires: { $gt: new Date() } }).select('+resetHash +resetExpires +tokenVersion +passwordHash')
  if (!user) throw badRequest('TOKEN_INVALID', 'Invalid or expired token')
  user.passwordHash = await hashPassword(password)
  user.resetHash = undefined
  user.resetExpires = undefined
  user.set('tokenVersion', ((user.get('tokenVersion') as number) ?? 0) + 1) // log out everywhere
  await user.save()
}

export async function changePassword(user: UserDoc, current: string, next: string) {
  const full = await User.findById(user.id).select('+passwordHash +tokenVersion')
  if (!full || !(await verify(full.passwordHash, current).catch(() => false))) throw unauthorized('INVALID_CREDENTIALS')
  full.passwordHash = await hashPassword(next)
  full.set('tokenVersion', ((full.get('tokenVersion') as number) ?? 0) + 1)
  await full.save()
  return full
}

export { publicUser }
