import crypto from 'node:crypto'
import { pool } from './db.js'

const SESSION_COOKIE = 'tc_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const DEFAULT_ADMIN_USER = 'admin'
const DEFAULT_ADMIN_PASS = '!abc123456'

export const VALID_NAV_IDS = [
  'dashboard',
  'courses',
  'groups',
  'lessons',
  'attendance',
  'materials',
  'settlement',
  'students',
  'teachers',
  'users',
]

export async function initAuthSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id            VARCHAR(64)  NOT NULL PRIMARY KEY,
      username      VARCHAR(64)  NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_admin      TINYINT(1)   NOT NULL DEFAULT 0,
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token       VARCHAR(64)  NOT NULL PRIMARY KEY,
      user_id     VARCHAR(64)  NOT NULL,
      expires_at  DATETIME     NOT NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
      INDEX idx_auth_sessions_user (user_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_user_permissions (
      user_id  VARCHAR(64) NOT NULL,
      nav_id   VARCHAR(32) NOT NULL,
      PRIMARY KEY (user_id, nav_id),
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: 既有資料庫補上 is_admin 欄位
  const [adminCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_users' AND COLUMN_NAME = 'is_admin'`
  )
  if (adminCols.length === 0) {
    await pool.query(`ALTER TABLE auth_users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0`)
  }

  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM auth_users')
  if (rows[0].n === 0) {
    const id = `au_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    await pool.query(
      'INSERT INTO auth_users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 1)',
      [id, DEFAULT_ADMIN_USER, hashPassword(DEFAULT_ADMIN_PASS)]
    )
    console.log(`[tuition-calculator-backend] seeded default admin user "${DEFAULT_ADMIN_USER}"`)
  } else {
    // 確保至少有一個 is_admin = 1（升級舊資料庫的安全網）
    const [admins] = await pool.query('SELECT COUNT(*) AS n FROM auth_users WHERE is_admin = 1')
    if (admins[0].n === 0) {
      await pool.query('UPDATE auth_users SET is_admin = 1 WHERE username = ?', [DEFAULT_ADMIN_USER])
    }
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const key  = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${key}`
}

function verifyPassword(password, stored) {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, key] = parts
  const expected = Buffer.from(key, 'hex')
  const got      = crypto.scryptSync(password, salt, 64)
  if (expected.length !== got.length) return false
  return crypto.timingSafeEqual(expected, got)
}

function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

function buildSessionCookie(token, maxAgeSec) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
  ]
  return parts.join('; ')
}

async function findUserByUsername(username) {
  const [rows] = await pool.query(
    'SELECT id, username, password_hash, is_admin FROM auth_users WHERE username = ? LIMIT 1',
    [username]
  )
  return rows[0] || null
}

async function findUserById(id) {
  const [rows] = await pool.query(
    'SELECT id, username, is_admin FROM auth_users WHERE id = ? LIMIT 1',
    [id]
  )
  return rows[0] || null
}

async function getPermissions(userId) {
  const [rows] = await pool.query(
    'SELECT nav_id FROM auth_user_permissions WHERE user_id = ?',
    [userId]
  )
  return rows.map(r => r.nav_id)
}

async function setPermissions(userId, navIds) {
  const cleaned = Array.from(new Set(
    (navIds || []).filter(n => VALID_NAV_IDS.includes(n) && n !== 'users')
  ))
  await pool.query('DELETE FROM auth_user_permissions WHERE user_id = ?', [userId])
  if (cleaned.length === 0) return
  const values = cleaned.map(n => [userId, n])
  await pool.query(
    'INSERT INTO auth_user_permissions (user_id, nav_id) VALUES ?',
    [values]
  )
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString().slice(0, 19).replace('T', ' ')
  await pool.query(
    'INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    [token, userId, expiresAt]
  )
  return { token, expiresAt }
}

async function getSessionUser(token) {
  if (!token) return null
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.is_admin, s.expires_at
       FROM auth_sessions s
       JOIN auth_users u ON u.id = s.user_id
      WHERE s.token = ? LIMIT 1`,
    [token]
  )
  const row = rows[0]
  if (!row) return null
  if (new Date(row.expires_at) < new Date()) {
    await pool.query('DELETE FROM auth_sessions WHERE token = ?', [token])
    return null
  }
  return { id: row.id, username: row.username, is_admin: !!row.is_admin }
}

async function deleteSession(token) {
  if (!token) return
  await pool.query('DELETE FROM auth_sessions WHERE token = ?', [token])
}

const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
])

function isPublicPath(p) {
  if (PUBLIC_PATHS.has(p)) return true
  if (p.startsWith('/api/share/')) return true
  return false
}

// Map (method, path) → 需要的 nav 權限陣列。回傳 null 表示「任何已登入使用者皆可」（給 dropdown 抓 list 用）。
function getRequiredNavs(method, p) {
  // admin-only routes 由 requireAdmin 處理
  if (p.startsWith('/api/admin/')) return ['__admin__']

  // 共用 list endpoints — 多個頁籤都要拉 students/teachers/courses/groups/materials 做下拉/顯示
  if (method === 'GET' && (
    p === '/api/students' || p === '/api/teachers' || p === '/api/courses' ||
    p === '/api/groups'   || p === '/api/materials'
  )) return null

  // students
  if (/^\/api\/students\/[^/]+\/share-token$/.test(p)) return ['students']
  if (/^\/api\/students(\/[^/]+)?$/.test(p))           return ['students']
  // teachers
  if (/^\/api\/teachers(\/[^/]+)?$/.test(p))           return ['teachers']
  // courses + rates 表
  if (/^\/api\/courses\/[^/]+\/rates$/.test(p))        return ['courses']
  if (/^\/api\/courses(\/[^/]+)?$/.test(p))            return ['courses']
  // group members（應到名單）— 點名與團課管理都會用到
  if (/^\/api\/groups\/[^/]+\/members$/.test(p)) {
    return method === 'GET'
      ? ['groups', 'attendance', 'lessons']
      : ['groups', 'attendance']
  }
  // groups
  if (/^\/api\/groups(\/[^/]+)?$/.test(p))             return ['groups']
  // group-records
  if (/^\/api\/group-records(\/[^/]+)?$/.test(p)) {
    return method === 'GET'
      ? ['lessons', 'attendance', 'settlement', 'dashboard']
      : ['lessons', 'attendance']
  }
  // lessons
  if (/^\/api\/lessons(\/[^/]+)?$/.test(p)) {
    return method === 'GET'
      ? ['lessons', 'settlement', 'dashboard']
      : ['lessons']
  }
  // materials
  if (/^\/api\/materials(\/[^/]+)?$/.test(p)) return ['materials']
  // material-records
  if (/^\/api\/material-records(\/[^/]+)?$/.test(p)) {
    return method === 'GET'
      ? ['materials', 'settlement', 'dashboard']
      : ['materials']
  }
  // settlement
  if (/^\/api\/settlement\//.test(p)) return ['settlement', 'dashboard']
  // payment-records
  if (/^\/api\/payment-records(\/[^/]+)?$/.test(p)) return ['settlement']

  return null
}

export function requireAuth() {
  return async (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next()
    if (isPublicPath(req.path)) return next()
    try {
      const cookies = parseCookies(req)
      const user = await getSessionUser(cookies[SESSION_COOKIE])
      if (!user) return res.status(401).json({ error: 'unauthorized' })
      req.user = user

      const required = getRequiredNavs(req.method, req.path)
      if (required === null) return next()
      if (user.is_admin) return next()
      if (required.includes('__admin__')) return res.status(403).json({ error: 'admin_only' })

      const perms = await getPermissions(user.id)
      const ok = required.some(n => perms.includes(n))
      if (!ok) return res.status(403).json({ error: 'forbidden' })
      next()
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'auth_failed' })
    }
  }
}

function requireAdmin() {
  return async (req, res, next) => {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'admin_only' })
    next()
  }
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/login', async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!username || !password) return res.status(400).json({ error: 'username_and_password_required' })
    try {
      const user = await findUserByUsername(username)
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'invalid_credentials' })
      }
      const { token } = await createSession(user.id)
      res.setHeader('Set-Cookie', buildSessionCookie(token, SESSION_TTL_MS / 1000))
      const perms = user.is_admin ? VALID_NAV_IDS : await getPermissions(user.id)
      res.json({
        user: { id: user.id, username: user.username },
        is_admin: !!user.is_admin,
        permissions: perms,
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const cookies = parseCookies(req)
      await deleteSession(cookies[SESSION_COOKIE])
      res.setHeader('Set-Cookie', buildSessionCookie('', 0))
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  app.get('/api/auth/me', async (req, res) => {
    try {
      const cookies = parseCookies(req)
      const user = await getSessionUser(cookies[SESSION_COOKIE])
      if (!user) return res.status(401).json({ error: 'unauthorized' })
      const perms = user.is_admin ? VALID_NAV_IDS : await getPermissions(user.id)
      res.json({
        user: { id: user.id, username: user.username },
        is_admin: !!user.is_admin,
        permissions: perms,
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  // 改自己的密碼
  app.post('/api/auth/change-password', async (req, res) => {
    const cookies = parseCookies(req)
    const sessionUser = await getSessionUser(cookies[SESSION_COOKIE])
    if (!sessionUser) return res.status(401).json({ error: 'unauthorized' })
    const { current_password, new_password } = req.body || {}
    if (typeof current_password !== 'string' || typeof new_password !== 'string') {
      return res.status(400).json({ error: 'invalid_body' })
    }
    if (new_password.length < 6) return res.status(400).json({ error: 'new_password_too_short' })
    try {
      const [rows] = await pool.query('SELECT password_hash FROM auth_users WHERE id = ?', [sessionUser.id])
      if (!rows[0] || !verifyPassword(current_password, rows[0].password_hash)) {
        return res.status(401).json({ error: 'invalid_credentials' })
      }
      await pool.query('UPDATE auth_users SET password_hash = ? WHERE id = ?', [hashPassword(new_password), sessionUser.id])
      // 改密碼後讓其他裝置全部登出
      await pool.query('DELETE FROM auth_sessions WHERE user_id = ? AND token <> ?', [sessionUser.id, cookies[SESSION_COOKIE]])
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })
}

export function registerAdminRoutes(app) {
  // 列出所有使用者 + 權限（admin only）
  app.get('/api/admin/users', requireAdmin(), async (_req, res) => {
    try {
      const [users] = await pool.query(
        'SELECT id, username, is_admin, created_at FROM auth_users ORDER BY is_admin DESC, created_at ASC, id ASC'
      )
      const [perms] = await pool.query('SELECT user_id, nav_id FROM auth_user_permissions')
      const byUser = new Map()
      for (const r of perms) {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, [])
        byUser.get(r.user_id).push(r.nav_id)
      }
      res.json(users.map(u => ({
        id: u.id,
        username: u.username,
        is_admin: !!u.is_admin,
        permissions: u.is_admin ? VALID_NAV_IDS : (byUser.get(u.id) || []),
        created_at: u.created_at,
      })))
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  // 建立使用者
  app.post('/api/admin/users', requireAdmin(), async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const isAdmin  = !!req.body?.is_admin
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : []
    if (!username || username.length > 64) return res.status(400).json({ error: 'invalid_username' })
    if (!password || password.length < 6) return res.status(400).json({ error: 'password_too_short' })
    try {
      const exists = await findUserByUsername(username)
      if (exists) return res.status(409).json({ error: 'username_taken' })
      const id = `au_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      await pool.query(
        'INSERT INTO auth_users (id, username, password_hash, is_admin) VALUES (?, ?, ?, ?)',
        [id, username, hashPassword(password), isAdmin ? 1 : 0]
      )
      if (!isAdmin) await setPermissions(id, permissions)
      res.status(201).json({
        id, username,
        is_admin: isAdmin,
        permissions: isAdmin ? VALID_NAV_IDS : permissions.filter(n => VALID_NAV_IDS.includes(n) && n !== 'users'),
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  // 改使用者：權限 / is_admin（不開放改密碼，使用者自己改）
  app.patch('/api/admin/users/:id', requireAdmin(), async (req, res) => {
    const id = req.params.id
    try {
      const target = await findUserById(id)
      if (!target) return res.status(404).json({ error: 'not_found' })

      const updates = []
      const params = []

      if (req.body?.is_admin !== undefined) {
        const newIsAdmin = !!req.body.is_admin
        if (target.is_admin && !newIsAdmin) {
          // 不能把最後一個 admin 拔掉
          const [adminRows] = await pool.query('SELECT COUNT(*) AS n FROM auth_users WHERE is_admin = 1')
          if (adminRows[0].n <= 1) return res.status(400).json({ error: 'cannot_demote_last_admin' })
        }
        updates.push('is_admin = ?')
        params.push(newIsAdmin ? 1 : 0)
      }
      if (updates.length) {
        params.push(id)
        await pool.query(`UPDATE auth_users SET ${updates.join(', ')} WHERE id = ?`, params)
      }

      // 重新讀取最新狀態以決定要不要寫權限表
      const updated = await findUserById(id)
      if (req.body?.permissions !== undefined) {
        if (updated.is_admin) {
          // admin 不存權限表（一律全開）
          await pool.query('DELETE FROM auth_user_permissions WHERE user_id = ?', [id])
        } else {
          const perms = Array.isArray(req.body.permissions) ? req.body.permissions : []
          await setPermissions(id, perms)
        }
      } else if (updated.is_admin) {
        await pool.query('DELETE FROM auth_user_permissions WHERE user_id = ?', [id])
      }

      const finalPerms = updated.is_admin ? VALID_NAV_IDS : await getPermissions(id)
      res.json({ id, username: updated.username, is_admin: !!updated.is_admin, permissions: finalPerms })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  // 刪除使用者：擋自刪、擋刪最後一個 admin
  app.delete('/api/admin/users/:id', requireAdmin(), async (req, res) => {
    const id = req.params.id
    if (id === req.user.id) return res.status(400).json({ error: 'cannot_delete_self' })
    try {
      const target = await findUserById(id)
      if (!target) return res.status(404).json({ error: 'not_found' })
      if (target.is_admin) {
        const [adminRows] = await pool.query('SELECT COUNT(*) AS n FROM auth_users WHERE is_admin = 1')
        if (adminRows[0].n <= 1) return res.status(400).json({ error: 'cannot_delete_last_admin' })
      }
      const [r] = await pool.query('DELETE FROM auth_users WHERE id = ?', [id])
      if (r.affectedRows === 0) return res.status(404).json({ error: 'not_found' })
      res.status(204).end()
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })
}
