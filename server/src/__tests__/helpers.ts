import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import type { Express } from 'express'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456'

let mongod: MongoMemoryServer

export async function startDb() {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
}
export async function stopDb() {
  await mongoose.disconnect()
  await mongod.stop()
}
export async function clearDb() {
  const cols = await mongoose.connection.db!.collections()
  await Promise.all(cols.map((c) => c.deleteMany({})))
}

export async function makeApp(): Promise<Express> {
  const { createApp } = await import('../app.js')
  return createApp()
}

let counter = 0
export interface TestUser {
  agent: ReturnType<typeof request.agent>
  csrf: string
  id: string
  username: string
}

/** Registers a user and returns an agent that already carries the session cookie + CSRF header helper. */
export async function registerUser(app: Express, overrides: Record<string, unknown> = {}): Promise<TestUser> {
  const n = ++counter
  const agent = request.agent(app)
  const username = (overrides.username as string) ?? `user${n}`
  const res = await agent.post('/api/auth/register').send({
    name: `Test User ${n}`,
    username,
    email: `user${n}@example.com`,
    password: 'Passw0rdOK',
    preferredLanguage: 'uz',
    ...overrides,
  })
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { agent, csrf: res.body.data.csrfToken, id: res.body.data.user.id, username }
}

export async function makeAdmin(u: TestUser) {
  const { User } = await import('../models/User.js')
  await User.updateOne({ _id: u.id }, { role: 'admin' })
}
