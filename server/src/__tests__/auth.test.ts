import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { clearDb, makeApp, registerUser, startDb, stopDb } from './helpers.js'

let app: Express
beforeAll(async () => {
  await startDb()
  app = await makeApp()
})
afterAll(stopDb)
beforeEach(clearDb)

describe('auth', () => {
  it('registers, hashes the password and sets an httpOnly session cookie', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Aziza Karimova',
      username: 'aziza_k',
      email: 'Aziza@Example.com',
      password: 'Secret123',
      preferredLanguage: 'uz',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.user.email).toBe('aziza@example.com')
    expect(res.body.data.user).not.toHaveProperty('passwordHash')
    expect(res.body.data.csrfToken).toBeTruthy()
    expect(String(res.headers['set-cookie'])).toMatch(/uzquiz_session=.*HttpOnly/i)

    const { User } = await import('../models/User.js')
    const stored = await User.findOne({ username: 'aziza_k' }).select('+passwordHash')
    expect(stored!.passwordHash).toMatch(/^\$argon2/)
    expect(stored!.passwordHash).not.toContain('Secret123')
  })

  it('rejects duplicate email and username with field codes', async () => {
    await registerUser(app, { username: 'dup_user', email: 'dup@example.com' })
    const res = await request(app).post('/api/auth/register').send({
      name: 'Other',
      username: 'DUP_USER',
      email: 'dup@example.com',
      password: 'Secret123',
    })
    expect(res.status).toBe(409)
    expect(res.body.error.fields).toMatchObject({ email: 'EMAIL_TAKEN', username: 'USERNAME_TAKEN' })
  })

  it('validates weak passwords', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Ab', username: 'abc', email: 'a@b.co', password: 'onlyletters' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBe('PASSWORD_WEAK')
  })

  it('logs in by email or username and rejects bad credentials', async () => {
    await registerUser(app, { username: 'login_me', email: 'login@example.com' })
    const a = await request(app).post('/api/auth/login').send({ identifier: 'login@example.com', password: 'Passw0rdOK' })
    const b = await request(app).post('/api/auth/login').send({ identifier: 'LOGIN_ME', password: 'Passw0rdOK' })
    const bad = await request(app).post('/api/auth/login').send({ identifier: 'login_me', password: 'wrong-pass1' })
    const none = await request(app).post('/api/auth/login').send({ identifier: 'ghost', password: 'whatever1' })
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(bad.status).toBe(401)
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(none.body.error.code).toBe('INVALID_CREDENTIALS') // same answer: no account enumeration
  })

  it('protects /me and returns the user with a valid session', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401)
    const u = await registerUser(app)
    const res = await u.agent.get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.data.user.id).toBe(u.id)
  })

  it('requires the CSRF token for state-changing authenticated requests', async () => {
    const u = await registerUser(app)
    const noToken = await u.agent.patch('/api/users/me').send({ name: 'New Name' })
    expect(noToken.status).toBe(403)
    expect(noToken.body.error.code).toBe('CSRF')
    const withToken = await u.agent.patch('/api/users/me').set('X-CSRF-Token', u.csrf).send({ name: 'New Name' })
    expect(withToken.status).toBe(200)
    expect(withToken.body.data.user.name).toBe('New Name')
  })

  it('logout clears the session', async () => {
    const u = await registerUser(app)
    await u.agent.post('/api/auth/logout').set('X-CSRF-Token', u.csrf)
    expect((await u.agent.get('/api/auth/me')).status).toBe(401)
  })

  it('rejects NoSQL operator injection', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: { $gt: '' }, password: { $gt: '' } })
    expect(res.status).toBe(400)
  })

  it('password reset invalidates existing sessions', async () => {
    const u = await registerUser(app, { email: 'reset@example.com' })
    await request(app).post('/api/auth/forgot').send({ email: 'reset@example.com' })
    const { User } = await import('../models/User.js')
    const { sha256 } = await import('../utils/crypto.js')
    const token = 'a'.repeat(64)
    await User.updateOne({ email: 'reset@example.com' }, { resetHash: sha256(token), resetExpires: new Date(Date.now() + 60_000) })
    const r = await request(app).post('/api/auth/reset').send({ token, password: 'BrandNew123' })
    expect(r.status).toBe(200)
    expect((await u.agent.get('/api/auth/me')).status).toBe(401)
    const login = await request(app).post('/api/auth/login').send({ identifier: 'reset@example.com', password: 'BrandNew123' })
    expect(login.status).toBe(200)
  })
})
