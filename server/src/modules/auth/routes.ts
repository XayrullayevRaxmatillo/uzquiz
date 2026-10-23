import { Router } from 'express'
import { ok, handler } from '../../utils/http.js'
import { validate } from '../../middleware/validate.js'
import { clearSession, issueSession, me, requireAuth } from '../../middleware/auth.js'
import { loginLimiter, registerLimiter, sensitiveLimiter } from '../../middleware/security.js'
import { User } from '../../models/User.js'
import {
  authenticate,
  changePassword,
  forgotPassword,
  publicUser,
  registerUser,
  resendVerification,
  resetPassword,
  verifyEmail,
} from './service.js'
import { changePasswordBody, forgotBody, loginBody, registerBody, resetBody, verifyBody } from './schemas.js'

export const authRouter = Router()

const tv = (u: { get: (k: string) => unknown }) => ((u.get('tokenVersion') as number | undefined) ?? 0)

authRouter.post(
  '/register',
  registerLimiter,
  validate({ body: registerBody }),
  handler(async (req, res) => {
    const user = await registerUser(req.body)
    const csrfToken = issueSession(res, { id: user.id }, 0)
    ok(res, { user: publicUser(user), csrfToken }, 201)
  }),
)

authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: loginBody }),
  handler(async (req, res) => {
    const user = await authenticate(req.body.identifier, req.body.password)
    const csrfToken = issueSession(res, { id: user.id }, tv(user))
    ok(res, { user: publicUser(user), csrfToken })
  }),
)

authRouter.post('/logout', (_req, res) => {
  clearSession(res)
  ok(res, { loggedOut: true })
})

authRouter.get(
  '/me',
  requireAuth,
  handler(async (req, res) => {
    ok(res, { user: publicUser(me(req)), csrfToken: req.auth!.csrf })
  }),
)

authRouter.post(
  '/forgot',
  sensitiveLimiter,
  validate({ body: forgotBody }),
  handler(async (req, res) => {
    await forgotPassword(req.body.email)
    ok(res, { requested: true }) // same answer whether or not the account exists
  }),
)

authRouter.post(
  '/reset',
  sensitiveLimiter,
  validate({ body: resetBody }),
  handler(async (req, res) => {
    await resetPassword(req.body.token, req.body.password)
    ok(res, { reset: true })
  }),
)

authRouter.post(
  '/verify-email',
  sensitiveLimiter,
  validate({ body: verifyBody }),
  handler(async (req, res) => {
    const user = await verifyEmail(req.body.token)
    ok(res, { user: publicUser(user) })
  }),
)

authRouter.post(
  '/resend-verification',
  requireAuth,
  sensitiveLimiter,
  handler(async (req, res) => {
    await resendVerification(me(req))
    ok(res, { requested: true })
  }),
)

authRouter.post(
  '/change-password',
  requireAuth,
  sensitiveLimiter,
  validate({ body: changePasswordBody }),
  handler(async (req, res) => {
    const user = await changePassword(me(req), req.body.currentPassword, req.body.newPassword)
    const csrfToken = issueSession(res, { id: user.id }, tv(user)) // re-issue: old sessions are now invalid
    ok(res, { user: publicUser(user), csrfToken })
  }),
)

// Keep User import used for type-safe future extension points.
void User
