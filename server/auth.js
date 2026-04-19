import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
  countUsers, getUserByUsername, getUserById, insertUser, updateUserPassword,
} from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'tuition-calculator-dev-secret-change-me'
const JWT_EXPIRES_IN = '8h'
const BCRYPT_ROUNDS = 10

function genUserId() {
  return `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export async function ensureBootstrapUser() {
  if ((await countUsers()) > 0) return
  const hash = await bcrypt.hash('admin123', BCRYPT_ROUNDS)
  await insertUser({
    id: genUserId(),
    username: 'admin',
    passwordHash: hash,
    role: 'admin',
    mustChange: true,
  })
  console.log('[auth] bootstrap user created: admin / admin123 (must change on first login)')
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return res.status(401).json({ error: 'unauthorized' })
  try {
    const payload = jwt.verify(m[1], JWT_SECRET)
    req.user = { id: payload.sub, username: payload.username, role: payload.role }
    next()
  } catch {
    return res.status(401).json({ error: 'invalid_token' })
  }
}

export function mountAuth(app) {
  app.post('/api/login', async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!username || !password) return res.status(400).json({ error: 'username_and_password_required' })
    try {
      const user = await getUserByUsername(username)
      if (!user) return res.status(401).json({ error: 'invalid_credentials' })
      const ok = await bcrypt.compare(password, user.password_hash)
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
      const token = signToken(user)
      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role, must_change: !!user.must_change },
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  app.post('/api/logout', (_req, res) => {
    res.status(204).end()
  })

  app.get('/api/me', requireAuth, async (req, res) => {
    try {
      const user = await getUserById(req.user.id)
      if (!user) return res.status(401).json({ error: 'unauthorized' })
      res.json({ id: user.id, username: user.username, role: user.role, must_change: !!user.must_change })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  app.post('/api/change-password', requireAuth, async (req, res) => {
    const currentPassword = typeof req.body?.current_password === 'string' ? req.body.current_password : ''
    const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : ''
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'new_password_too_short' })
    try {
      const user = await getUserByUsername(req.user.username)
      if (!user) return res.status(401).json({ error: 'unauthorized' })
      const ok = await bcrypt.compare(currentPassword, user.password_hash)
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
      const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
      await updateUserPassword(user.id, hash)
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })
}
