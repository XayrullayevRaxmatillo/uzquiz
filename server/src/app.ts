import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { clientOrigins, isProd } from './config/env.js'
import { apiLimiter, sanitizeInput } from './middleware/security.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { authRouter } from './modules/auth/routes.js'
import { usersRouter } from './modules/users/routes.js'
import { teamsRouter } from './modules/teams/routes.js'
import { quizzesRouter } from './modules/quizzes/routes.js'
import { metaRouter } from './modules/meta/routes.js'
import { roomsRouter } from './modules/rooms/routes.js'
import { sharedRouter } from './modules/rooms/public.js'
import { statsRouter } from './modules/stats/routes.js'
import { adminRouter } from './modules/admin/routes.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  if (isProd) app.set('trust proxy', 1)

  app.use(helmet())
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || clientOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    }),
  )
  app.use(express.json({ limit: '200kb' }))
  app.use(cookieParser())
  app.use('/api', apiLimiter, sanitizeInput)

  app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }))
  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/teams', teamsRouter)
  app.use('/api/quizzes', quizzesRouter)
  app.use('/api/rooms', roomsRouter)
  app.use('/api/shared', sharedRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api', statsRouter)
  app.use('/api', metaRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
