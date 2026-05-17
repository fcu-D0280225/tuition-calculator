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
  'lessons_tutoring',
  'lessons_group',
  'attendance',
  'materials',
  'misc',
  'settlement',
  'settlement_tuition',
  'settlement_salary',
  'profit_loss',
  // 功能權限（非實際 nav）：是否可看時薪/金額欄位
  'view_rates',
  // 功能權限：可進入家教課編輯頁修改名稱／時薪／折扣／備註等
  'manage_courses',
  'students',
  'teachers',
  'schedule',
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
  // 舊版本的 per-user 權限表，保留欄位但已停用
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_user_permissions (
      user_id  VARCHAR(64) NOT NULL,
      nav_id   VARCHAR(32) NOT NULL,
      PRIMARY KEY (user_id, nav_id),
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  // 群組表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_groups (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      name        VARCHAR(64)  NOT NULL UNIQUE,
      is_admin    TINYINT(1)   NOT NULL DEFAULT 0,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_group_permissions (
      group_id  VARCHAR(64) NOT NULL,
      nav_id    VARCHAR(32) NOT NULL,
      PRIMARY KEY (group_id, nav_id),
      FOREIGN KEY (group_id) REFERENCES auth_groups(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: auth_users 補上 is_admin / group_id 欄位
  const [adminCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_users' AND COLUMN_NAME = 'is_admin'`
  )
  if (adminCols.length === 0) {
    await pool.query(`ALTER TABLE auth_users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0`)
  }
  const [gidCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_users' AND COLUMN_NAME = 'group_id'`
  )
  if (gidCols.length === 0) {
    await pool.query(`ALTER TABLE auth_users ADD COLUMN group_id VARCHAR(64) NULL`)
    await pool.query(`ALTER TABLE auth_users ADD CONSTRAINT fk_auth_users_group FOREIGN KEY (group_id) REFERENCES auth_groups(id) ON DELETE SET NULL`)
  }

  // Migration: auth_users 加 teacher_id（若使用者是「老師」群組，連到 teachers 表的某一筆）
  const [tidCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_users' AND COLUMN_NAME = 'teacher_id'`
  )
  if (tidCols.length === 0) {
    await pool.query(`ALTER TABLE auth_users ADD COLUMN teacher_id VARCHAR(64) NULL`)
    await pool.query(`ALTER TABLE auth_users ADD CONSTRAINT fk_auth_users_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL`)
  }

  // 預設群組：管理員（全權限） / 一般使用者（無權限）
  const [adminGroupRows] = await pool.query("SELECT id FROM auth_groups WHERE name = '管理員' LIMIT 1")
  let adminGroupId = adminGroupRows[0]?.id
  if (!adminGroupId) {
    adminGroupId = `ag_${Date.now()}_admin`
    await pool.query('INSERT INTO auth_groups (id, name, is_admin) VALUES (?, ?, 1)', [adminGroupId, '管理員'])
  }
  const [defaultGroupRows] = await pool.query("SELECT id FROM auth_groups WHERE name = '一般使用者' LIMIT 1")
  let defaultGroupId = defaultGroupRows[0]?.id
  if (!defaultGroupId) {
    defaultGroupId = `ag_${Date.now()}_default`
    await pool.query('INSERT INTO auth_groups (id, name, is_admin) VALUES (?, ?, 0)', [defaultGroupId, '一般使用者'])
  }

  // 預設群組：老師（教學相關頁面，不含結算 / 使用者管理）
  const [teacherGroupRows] = await pool.query("SELECT id FROM auth_groups WHERE name = '老師' LIMIT 1")
  let teacherGroupId = teacherGroupRows[0]?.id
  if (!teacherGroupId) {
    teacherGroupId = `ag_${Date.now()}_teacher`
    await pool.query('INSERT INTO auth_groups (id, name, is_admin) VALUES (?, ?, 0)', [teacherGroupId, '老師'])
    const teacherPerms = [
      'attendance',
      'lessons', 'lessons_tutoring', 'lessons_group',
      'schedule', 'students', 'materials', 'courses', 'groups',
      // 注意：刻意不含 'view_rates'，老師預設看不到時薪/金額
    ]
    const values = teacherPerms.map(n => [teacherGroupId, n])
    await pool.query('INSERT INTO auth_group_permissions (group_id, nav_id) VALUES ?', [values])
  }

  // Migration: 既有的非「老師」群組，若還沒有 view_rates 權限就補上一筆
  // （新加入的功能權限，舊用戶要保持看得到時薪／金額）
  await pool.query(
    `INSERT IGNORE INTO auth_group_permissions (group_id, nav_id)
     SELECT g.id, 'view_rates'
       FROM auth_groups g
       WHERE g.name <> '老師'
         AND NOT EXISTS (
           SELECT 1 FROM auth_group_permissions p
            WHERE p.group_id = g.id AND p.nav_id = 'view_rates'
         )`
  )

  // Migration: 既有的非「老師」群組若已有 courses 權限，補上 manage_courses；
  // 老師群組預設沒有 → 老師可看課程列表但不能進編輯頁
  await pool.query(
    `INSERT IGNORE INTO auth_group_permissions (group_id, nav_id)
     SELECT g.id, 'manage_courses'
       FROM auth_groups g
       WHERE g.name <> '老師'
         AND EXISTS (
           SELECT 1 FROM auth_group_permissions p
            WHERE p.group_id = g.id AND p.nav_id = 'courses'
         )
         AND NOT EXISTS (
           SELECT 1 FROM auth_group_permissions p
            WHERE p.group_id = g.id AND p.nav_id = 'manage_courses'
         )`
  )

  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM auth_users')
  if (rows[0].n === 0) {
    const id = `au_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    await pool.query(
      'INSERT INTO auth_users (id, username, password_hash, is_admin, group_id) VALUES (?, ?, ?, 1, ?)',
      [id, DEFAULT_ADMIN_USER, hashPassword(DEFAULT_ADMIN_PASS), adminGroupId]
    )
    console.log(`[tuition-calculator-backend] seeded default admin user "${DEFAULT_ADMIN_USER}"`)
  } else {
    // 補：所有沒群組的使用者依舊欄位 is_admin 分配
    await pool.query('UPDATE auth_users SET group_id = ? WHERE is_admin = 1 AND group_id IS NULL', [adminGroupId])
    await pool.query('UPDATE auth_users SET group_id = ? WHERE is_admin = 0 AND group_id IS NULL', [defaultGroupId])
    // 確保至少有一個 admin 群組成員
    const [admins] = await pool.query(
      `SELECT COUNT(*) AS n FROM auth_users u JOIN auth_groups g ON g.id = u.group_id WHERE g.is_admin = 1`
    )
    if (admins[0].n === 0) {
      await pool.query('UPDATE auth_users SET group_id = ? WHERE username = ?', [adminGroupId, DEFAULT_ADMIN_USER])
    }
  }

  // ─── FEAT-012 Step 1: 多租戶 — auth_users / auth_groups 加 tenant_id ───
  // initSchema() 已建好 tenants 表（含預設 id=1）；這裡只負責 auth 層。
  // 此 step 不改 query 邏輯，僅讓 schema 帶 tenant 維度、既有資料 backfill = 1。
  for (const tbl of ['auth_users', 'auth_groups']) {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'tenant_id'`,
      [tbl]
    )
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE ${tbl} ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1`)
      await pool.query(`UPDATE ${tbl} SET tenant_id = 1`)
      await pool.query(`ALTER TABLE ${tbl} ADD INDEX idx_${tbl}_tenant (tenant_id)`)
      await pool.query(
        `ALTER TABLE ${tbl} ADD CONSTRAINT fk_${tbl}_tenant ` +
        `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`
      )
    }
  }

  // auth_groups.name UNIQUE → (tenant_id, name) UNIQUE（不同 tenant 可同名群組）
  const [agOldIdx] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_groups' AND INDEX_NAME = 'name'`
  )
  if (agOldIdx.length > 0) {
    await pool.query('ALTER TABLE auth_groups DROP INDEX `name`')
  }
  const [agNewIdx] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_groups' AND INDEX_NAME = 'uk_auth_groups_tenant_name'`
  )
  if (agNewIdx.length === 0) {
    await pool.query('ALTER TABLE auth_groups ADD UNIQUE KEY uk_auth_groups_tenant_name (tenant_id, name)')
  }

  // auth_users.username UNIQUE → (tenant_id, username) UNIQUE（不同 tenant 可同名帳號）
  const [auOldIdx] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_users' AND INDEX_NAME = 'username'`
  )
  if (auOldIdx.length > 0) {
    await pool.query('ALTER TABLE auth_users DROP INDEX `username`')
  }
  const [auNewIdx] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_users' AND INDEX_NAME = 'uk_auth_users_tenant_username'`
  )
  if (auNewIdx.length === 0) {
    await pool.query('ALTER TABLE auth_users ADD UNIQUE KEY uk_auth_users_tenant_username (tenant_id, username)')
  }

  // tenant_invites：邀請 token 表（骨架先就位，邏輯在後續 step 實作）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_invites (
      token            VARCHAR(64)  NOT NULL PRIMARY KEY,
      tenant_id        INT UNSIGNED NOT NULL,
      group_id         VARCHAR(64)  NOT NULL,
      created_by       VARCHAR(64)  NOT NULL,
      expires_at       DATETIME     NOT NULL,
      used_at          DATETIME     NULL DEFAULT NULL,
      used_by_user_id  VARCHAR(64)  NULL DEFAULT NULL,
      created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tenant_invites_tenant (tenant_id),
      INDEX idx_tenant_invites_expires (expires_at),
      FOREIGN KEY (tenant_id)       REFERENCES tenants(id)     ON DELETE CASCADE,
      FOREIGN KEY (group_id)        REFERENCES auth_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by)      REFERENCES auth_users(id)  ON DELETE CASCADE,
      FOREIGN KEY (used_by_user_id) REFERENCES auth_users(id)  ON DELETE SET NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
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

async function findUserByUsername(tenantId, username) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.password_hash, u.group_id, u.teacher_id, u.tenant_id, g.name AS group_name, g.is_admin
       FROM auth_users u
       LEFT JOIN auth_groups g ON g.id = u.group_id
      WHERE u.tenant_id = ? AND u.username = ? LIMIT 1`,
    [tenantId, username]
  )
  return rows[0] || null
}

async function findUserById(id) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.group_id, u.teacher_id, u.tenant_id, g.name AS group_name, g.is_admin
       FROM auth_users u
       LEFT JOIN auth_groups g ON g.id = u.group_id
      WHERE u.id = ? LIMIT 1`,
    [id]
  )
  return rows[0] || null
}

async function getPermissionsForUser(user) {
  if (!user || !user.group_id) return []
  if (user.is_admin) return VALID_NAV_IDS
  const [rows] = await pool.query(
    'SELECT nav_id FROM auth_group_permissions WHERE group_id = ?',
    [user.group_id]
  )
  return rows.map(r => r.nav_id)
}

async function setGroupPermissions(groupId, navIds) {
  const cleaned = Array.from(new Set(
    (navIds || []).filter(n => VALID_NAV_IDS.includes(n) && n !== 'users')
  ))
  await pool.query('DELETE FROM auth_group_permissions WHERE group_id = ?', [groupId])
  if (cleaned.length === 0) return
  const values = cleaned.map(n => [groupId, n])
  await pool.query(
    'INSERT INTO auth_group_permissions (group_id, nav_id) VALUES ?',
    [values]
  )
}

async function findGroupById(id) {
  const [rows] = await pool.query('SELECT id, name, is_admin FROM auth_groups WHERE id = ? LIMIT 1', [id])
  return rows[0] || null
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
    `SELECT u.id, u.username, u.group_id, u.teacher_id, u.tenant_id, g.name AS group_name, g.is_admin, s.expires_at,
            t.name AS tenant_name
       FROM auth_sessions s
       JOIN auth_users u ON u.id = s.user_id
       LEFT JOIN auth_groups g ON g.id = u.group_id
       LEFT JOIN tenants     t ON t.id = u.tenant_id
      WHERE s.token = ? LIMIT 1`,
    [token]
  )
  const row = rows[0]
  if (!row) return null
  if (new Date(row.expires_at) < new Date()) {
    await pool.query('DELETE FROM auth_sessions WHERE token = ?', [token])
    return null
  }
  return {
    id: row.id, username: row.username,
    group_id: row.group_id, group_name: row.group_name,
    teacher_id: row.teacher_id || null,
    tenant_id: row.tenant_id || 1,
    tenant_name: row.tenant_name || null,
    is_admin: !!row.is_admin,
  }
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
  '/api/auth/register-with-invite',
])

function isPublicPath(p) {
  if (PUBLIC_PATHS.has(p)) return true
  if (p.startsWith('/api/share/')) return true
  if (p.startsWith('/api/invites/')) return true
  if (p.startsWith('/api/care/parent/')) return true
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
  // courses
  if (p === '/api/courses/reorder')                    return ['courses']
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
  if (/^\/api\/settlement\//.test(p)) return ['settlement', 'dashboard', 'settlement_tuition', 'settlement_salary']
  // payment-records
  if (/^\/api\/payment-records(\/[^/]+)?$/.test(p)) return ['settlement', 'settlement_tuition']
  // misc-expenses
  if (/^\/api\/misc-expenses(\/[^/]+)?$/.test(p)) return method === 'GET' ? ['misc', 'dashboard'] : ['misc']

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

      const perms = await getPermissionsForUser(user)
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
    const tenantId = parseInt(req.body?.tenant_id, 10) || 1
    if (!username || !password) return res.status(400).json({ error: 'username_and_password_required' })
    try {
      const user = await findUserByUsername(tenantId, username)
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'invalid_credentials' })
      }
      const { token } = await createSession(user.id)
      res.setHeader('Set-Cookie', buildSessionCookie(token, SESSION_TTL_MS / 1000))
      const perms = await getPermissionsForUser(user)
      // 拿 tenant_name
      const [tenantRows] = await pool.query('SELECT name FROM tenants WHERE id = ? LIMIT 1', [user.tenant_id])
      const tenantName = tenantRows[0]?.name || null
      res.json({
        user: { id: user.id, username: user.username },
        group: user.group_id ? { id: user.group_id, name: user.group_name } : null,
        is_admin: !!user.is_admin,
        teacher_id: user.teacher_id || null,
        tenant_id: user.tenant_id || 1,
        tenant_name: tenantName,
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
      const perms = await getPermissionsForUser(user)
      res.json({
        user: { id: user.id, username: user.username },
        group: user.group_id ? { id: user.group_id, name: user.group_name } : null,
        is_admin: !!user.is_admin,
        teacher_id: user.teacher_id || null,
        tenant_id: user.tenant_id || 1,
        tenant_name: user.tenant_name || null,
        permissions: perms,
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  // ─── 邀請 Token（public）───────────────────────────────────────────────────

  // GET /api/invites/:token — 查詢邀請資訊（public，不需登入）
  app.get('/api/invites/:token', async (req, res) => {
    const token = req.params.token
    try {
      const [rows] = await pool.query(
        `SELECT i.token, i.tenant_id, i.group_id, i.expires_at, i.used_at,
                t.name AS tenant_name,
                g.name AS group_name
           FROM tenant_invites i
           JOIN tenants     t ON t.id = i.tenant_id
           JOIN auth_groups g ON g.id = i.group_id
          WHERE i.token = ? LIMIT 1`,
        [token]
      )
      if (!rows[0]) return res.status(404).json({ error: 'not_found' })
      const inv = rows[0]
      if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'expired' })
      if (inv.used_at) return res.status(410).json({ error: 'already_used' })
      res.json({
        tenant: { id: inv.tenant_id, name: inv.tenant_name },
        group:  { id: inv.group_id,  name: inv.group_name  },
        expires_at: inv.expires_at,
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  // POST /api/auth/register-with-invite — 用 token 完成註冊（public）
  app.post('/api/auth/register-with-invite', async (req, res) => {
    const token    = typeof req.body?.token    === 'string' ? req.body.token.trim()    : ''
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password        : ''
    if (!token)    return res.status(400).json({ error: 'token_required' })
    if (!username) return res.status(400).json({ error: 'username_required' })
    if (password.length < 6) return res.status(400).json({ error: 'password_too_short' })

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 用 FOR UPDATE 鎖住 token row，防止 race condition
      const [invRows] = await conn.query(
        `SELECT i.token, i.tenant_id, i.group_id, i.expires_at, i.used_at,
                g.is_admin AS group_is_admin,
                t.name AS tenant_name
           FROM tenant_invites i
           JOIN auth_groups g ON g.id = i.group_id
           JOIN tenants     t ON t.id = i.tenant_id
          WHERE i.token = ? LIMIT 1 FOR UPDATE`,
        [token]
      )
      if (!invRows[0]) {
        await conn.rollback()
        return res.status(404).json({ error: 'not_found' })
      }
      const inv = invRows[0]
      if (new Date(inv.expires_at) < new Date()) {
        await conn.rollback()
        return res.status(410).json({ error: 'expired' })
      }
      if (inv.used_at) {
        await conn.rollback()
        return res.status(410).json({ error: 'already_used' })
      }

      // 檢查同 tenant 是否有同名帳號
      const [dupRows] = await conn.query(
        'SELECT id FROM auth_users WHERE tenant_id = ? AND username = ? LIMIT 1',
        [inv.tenant_id, username]
      )
      if (dupRows.length > 0) {
        await conn.rollback()
        return res.status(409).json({ error: 'username_taken' })
      }

      // 建立新使用者
      const newUserId = `au_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      await conn.query(
        'INSERT INTO auth_users (id, tenant_id, username, password_hash, is_admin, group_id) VALUES (?, ?, ?, ?, ?, ?)',
        [newUserId, inv.tenant_id, username, hashPassword(password), inv.group_is_admin ? 1 : 0, inv.group_id]
      )

      // 標記 token 已使用
      await conn.query(
        'UPDATE tenant_invites SET used_at = NOW(), used_by_user_id = ? WHERE token = ?',
        [newUserId, token]
      )

      await conn.commit()

      // 建立 session，自動登入
      const sessionToken = crypto.randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString().slice(0, 19).replace('T', ' ')
      await pool.query(
        'INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
        [sessionToken, newUserId, expiresAt]
      )
      res.setHeader('Set-Cookie', buildSessionCookie(sessionToken, SESSION_TTL_MS / 1000))

      // 取得群組資訊
      const [grpRows] = await pool.query(
        'SELECT id, name, is_admin FROM auth_groups WHERE id = ? LIMIT 1',
        [inv.group_id]
      )
      const grp = grpRows[0]
      const perms = grp?.is_admin ? VALID_NAV_IDS : (await (async () => {
        const [p] = await pool.query('SELECT nav_id FROM auth_group_permissions WHERE group_id = ?', [inv.group_id])
        return p.map(r => r.nav_id)
      })())

      res.json({
        user: { id: newUserId, username },
        group: grp ? { id: grp.id, name: grp.name } : null,
        is_admin: !!grp?.is_admin,
        teacher_id: null,
        tenant_id: inv.tenant_id,
        tenant_name: inv.tenant_name || null,
        permissions: perms,
      })
    } catch (e) {
      await conn.rollback()
      console.error(e)
      res.status(500).json({ error: 'failed' })
    } finally {
      conn.release()
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

async function countAdminGroupMembers() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM auth_users u
       JOIN auth_groups g ON g.id = u.group_id
      WHERE g.is_admin = 1`
  )
  return rows[0].n
}

async function listGroupsWithPerms() {
  const [groups] = await pool.query(
    `SELECT g.id, g.name, g.is_admin,
            (SELECT COUNT(*) FROM auth_users WHERE group_id = g.id) AS member_count
       FROM auth_groups g
      ORDER BY g.is_admin DESC, g.name ASC`
  )
  const [perms] = await pool.query('SELECT group_id, nav_id FROM auth_group_permissions')
  const byGroup = new Map()
  for (const r of perms) {
    if (!byGroup.has(r.group_id)) byGroup.set(r.group_id, [])
    byGroup.get(r.group_id).push(r.nav_id)
  }
  return groups.map(g => ({
    id: g.id,
    name: g.name,
    is_admin: !!g.is_admin,
    member_count: g.member_count,
    permissions: g.is_admin ? VALID_NAV_IDS : (byGroup.get(g.id) || []),
  }))
}

export function registerAdminRoutes(app) {
  // ─── 群組 CRUD ───────────────────────────────────────────────────────────
  app.get('/api/admin/groups', requireAdmin(), async (_req, res) => {
    try { res.json(await listGroupsWithPerms()) }
    catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
  })

  app.post('/api/admin/groups', requireAdmin(), async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name || name.length > 64) return res.status(400).json({ error: 'invalid_name' })
    const isAdmin = !!req.body?.is_admin
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : []
    try {
      const [exists] = await pool.query('SELECT id FROM auth_groups WHERE name = ? LIMIT 1', [name])
      if (exists.length) return res.status(409).json({ error: 'name_taken' })
      const id = `ag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      await pool.query('INSERT INTO auth_groups (id, name, is_admin) VALUES (?, ?, ?)', [id, name, isAdmin ? 1 : 0])
      if (!isAdmin) await setGroupPermissions(id, permissions)
      const groups = await listGroupsWithPerms()
      res.status(201).json(groups.find(g => g.id === id))
    } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
  })

  app.patch('/api/admin/groups/:id', requireAdmin(), async (req, res) => {
    const id = req.params.id
    try {
      const target = await findGroupById(id)
      if (!target) return res.status(404).json({ error: 'not_found' })

      if (req.body?.name !== undefined) {
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
        if (!name || name.length > 64) return res.status(400).json({ error: 'invalid_name' })
        const [exists] = await pool.query('SELECT id FROM auth_groups WHERE name = ? AND id <> ? LIMIT 1', [name, id])
        if (exists.length) return res.status(409).json({ error: 'name_taken' })
        await pool.query('UPDATE auth_groups SET name = ? WHERE id = ?', [name, id])
      }
      if (req.body?.is_admin !== undefined) {
        const newIsAdmin = !!req.body.is_admin
        if (target.is_admin && !newIsAdmin) {
          // 把這個 admin 群組降成一般 → 確認有沒有其他 admin 群組成員撐著
          const [otherAdmins] = await pool.query(
            `SELECT COUNT(*) AS n FROM auth_users u
               JOIN auth_groups g ON g.id = u.group_id
              WHERE g.is_admin = 1 AND g.id <> ?`, [id]
          )
          const [thisMembers] = await pool.query('SELECT COUNT(*) AS n FROM auth_users WHERE group_id = ?', [id])
          if (otherAdmins[0].n === 0 && thisMembers[0].n > 0) {
            return res.status(400).json({ error: 'cannot_demote_last_admin_group' })
          }
        }
        await pool.query('UPDATE auth_groups SET is_admin = ? WHERE id = ?', [newIsAdmin ? 1 : 0, id])
      }

      const updated = await findGroupById(id)
      if (req.body?.permissions !== undefined) {
        if (updated.is_admin) {
          await pool.query('DELETE FROM auth_group_permissions WHERE group_id = ?', [id])
        } else {
          await setGroupPermissions(id, Array.isArray(req.body.permissions) ? req.body.permissions : [])
        }
      } else if (updated.is_admin) {
        await pool.query('DELETE FROM auth_group_permissions WHERE group_id = ?', [id])
      }

      const groups = await listGroupsWithPerms()
      res.json(groups.find(g => g.id === id))
    } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
  })

  app.delete('/api/admin/groups/:id', requireAdmin(), async (req, res) => {
    const id = req.params.id
    try {
      const target = await findGroupById(id)
      if (!target) return res.status(404).json({ error: 'not_found' })
      const [members] = await pool.query('SELECT COUNT(*) AS n FROM auth_users WHERE group_id = ?', [id])
      if (members[0].n > 0) return res.status(400).json({ error: 'group_has_members' })
      if (target.is_admin) {
        const [adminGroups] = await pool.query('SELECT COUNT(*) AS n FROM auth_groups WHERE is_admin = 1')
        if (adminGroups[0].n <= 1) return res.status(400).json({ error: 'cannot_delete_last_admin_group' })
      }
      await pool.query('DELETE FROM auth_groups WHERE id = ?', [id])
      res.status(204).end()
    } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
  })

  // ─── 使用者 CRUD（透過 group_id 分配權限） ─────────────────────────────────
  app.get('/api/admin/users', requireAdmin(), async (_req, res) => {
    try {
      const [users] = await pool.query(
        `SELECT u.id, u.username, u.group_id, u.teacher_id, u.created_at,
                g.name AS group_name, g.is_admin AS group_is_admin,
                t.name AS teacher_name
           FROM auth_users u
           LEFT JOIN auth_groups g ON g.id = u.group_id
           LEFT JOIN teachers   t ON t.id = u.teacher_id
          ORDER BY g.is_admin DESC, u.created_at ASC, u.id ASC`
      )
      res.json(users.map(u => ({
        id: u.id, username: u.username,
        group: u.group_id ? { id: u.group_id, name: u.group_name, is_admin: !!u.group_is_admin } : null,
        is_admin: !!u.group_is_admin,
        teacher_id: u.teacher_id || null,
        teacher_name: u.teacher_name || null,
        created_at: u.created_at,
      })))
    } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
  })

  app.post('/api/admin/users', requireAdmin(), async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const groupId  = typeof req.body?.group_id === 'string' ? req.body.group_id : null
    const teacherId = req.body?.teacher_id !== undefined && req.body.teacher_id !== ''
      ? String(req.body.teacher_id) : null
    if (!username || username.length > 64) return res.status(400).json({ error: 'invalid_username' })
    if (!password || password.length < 6) return res.status(400).json({ error: 'password_too_short' })
    if (!groupId) return res.status(400).json({ error: 'group_required' })
    try {
      const group = await findGroupById(groupId)
      if (!group) return res.status(400).json({ error: 'invalid_group' })
      const exists = await findUserByUsername(req.user.tenant_id || 1, username)
      if (exists) return res.status(409).json({ error: 'username_taken' })
      const id = `au_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      await pool.query(
        'INSERT INTO auth_users (id, username, password_hash, is_admin, group_id, teacher_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id, username, hashPassword(password), group.is_admin ? 1 : 0, groupId, teacherId]
      )
      res.status(201).json({
        id, username,
        group: { id: group.id, name: group.name, is_admin: !!group.is_admin },
        is_admin: !!group.is_admin,
        teacher_id: teacherId,
      })
    } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
  })

  app.patch('/api/admin/users/:id', requireAdmin(), async (req, res) => {
    const id = req.params.id
    try {
      const target = await findUserById(id)
      if (!target) return res.status(404).json({ error: 'not_found' })

      if (req.body?.group_id !== undefined) {
        const newGroupId = req.body.group_id
        if (!newGroupId) return res.status(400).json({ error: 'group_required' })
        const newGroup = await findGroupById(newGroupId)
        if (!newGroup) return res.status(400).json({ error: 'invalid_group' })
        // 換出 admin 群組 → 確認還有其他 admin
        if (target.is_admin && !newGroup.is_admin) {
          const adminCount = await countAdminGroupMembers()
          if (adminCount <= 1) return res.status(400).json({ error: 'cannot_demote_last_admin' })
        }
        await pool.query('UPDATE auth_users SET group_id = ?, is_admin = ? WHERE id = ?',
          [newGroupId, newGroup.is_admin ? 1 : 0, id])
      }

      if (req.body?.teacher_id !== undefined) {
        const tid = req.body.teacher_id === '' || req.body.teacher_id === null ? null : String(req.body.teacher_id)
        await pool.query('UPDATE auth_users SET teacher_id = ? WHERE id = ?', [tid, id])
      }

      const updated = await findUserById(id)
      res.json({
        id: updated.id, username: updated.username,
        group: updated.group_id ? { id: updated.group_id, name: updated.group_name, is_admin: !!updated.is_admin } : null,
        is_admin: !!updated.is_admin,
        teacher_id: updated.teacher_id || null,
      })
    } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
  })

  app.delete('/api/admin/users/:id', requireAdmin(), async (req, res) => {
    const id = req.params.id
    if (id === req.user.id) return res.status(400).json({ error: 'cannot_delete_self' })
    try {
      const target = await findUserById(id)
      if (!target) return res.status(404).json({ error: 'not_found' })
      if (target.is_admin) {
        const adminCount = await countAdminGroupMembers()
        if (adminCount <= 1) return res.status(400).json({ error: 'cannot_delete_last_admin' })
      }
      const [r] = await pool.query('DELETE FROM auth_users WHERE id = ?', [id])
      if (r.affectedRows === 0) return res.status(404).json({ error: 'not_found' })
      res.status(204).end()
    } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
  })

  // ─── 邀請 Token 管理（admin only）──────────────────────────────────────────

  // POST /api/admin/invites — 產生邀請 token
  app.post('/api/admin/invites', requireAdmin(), async (req, res) => {
    const groupId     = typeof req.body?.group_id === 'string' ? req.body.group_id.trim() : ''
    const expiresInDays = req.body?.expires_in_days !== undefined
      ? parseInt(req.body.expires_in_days, 10)
      : 7

    if (!groupId) return res.status(400).json({ error: 'group_id_required' })
    if (isNaN(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) {
      return res.status(400).json({ error: 'expires_in_days_out_of_range' })
    }

    try {
      // 確認 group 屬於同一 tenant
      const [grpRows] = await pool.query(
        'SELECT id, name, tenant_id FROM auth_groups WHERE id = ? LIMIT 1',
        [groupId]
      )
      if (!grpRows[0] || grpRows[0].tenant_id !== req.user.tenant_id) {
        return res.status(400).json({ error: 'invalid_group' })
      }

      const token = crypto.randomBytes(48).toString('base64url')
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 19).replace('T', ' ')

      await pool.query(
        `INSERT INTO tenant_invites (token, tenant_id, group_id, created_by, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [token, req.user.tenant_id, groupId, req.user.id, expiresAt]
      )

      res.status(201).json({
        token,
        tenant_id: req.user.tenant_id,
        group_id: groupId,
        expires_at: expiresAt,
        invite_url: `/invite/${token}`,
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  // GET /api/admin/invites — 列出自己 tenant 的所有邀請
  app.get('/api/admin/invites', requireAdmin(), async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT i.token, i.expires_at, i.used_at, i.created_at,
                g.id AS group_id, g.name AS group_name,
                uc.username AS created_by_username,
                uu.username AS used_by_username
           FROM tenant_invites i
           JOIN auth_groups g  ON g.id = i.group_id
           JOIN auth_users  uc ON uc.id = i.created_by
           LEFT JOIN auth_users uu ON uu.id = i.used_by_user_id
          WHERE i.tenant_id = ?
          ORDER BY i.created_at DESC`,
        [req.user.tenant_id]
      )

      const now = new Date()
      res.json(rows.map(r => {
        let status = 'active'
        if (r.used_at) status = 'used'
        else if (new Date(r.expires_at) < now) status = 'expired'
        return {
          token: r.token,
          group: { id: r.group_id, name: r.group_name },
          created_by_username: r.created_by_username,
          expires_at: r.expires_at,
          used_at: r.used_at || null,
          used_by_username: r.used_by_username || null,
          status,
          created_at: r.created_at,
        }
      }))
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })

  // DELETE /api/admin/invites/:token — 撤銷邀請
  app.delete('/api/admin/invites/:token', requireAdmin(), async (req, res) => {
    const token = req.params.token
    try {
      const [rows] = await pool.query(
        'SELECT token, tenant_id, used_at, expires_at FROM tenant_invites WHERE token = ? LIMIT 1',
        [token]
      )
      if (!rows[0] || rows[0].tenant_id !== req.user.tenant_id) {
        return res.status(404).json({ error: 'not_found' })
      }
      const inv = rows[0]
      if (inv.used_at) return res.status(400).json({ error: 'already_used' })

      // 已過期也刪掉（noop 語意但仍清除）
      await pool.query(
        'DELETE FROM tenant_invites WHERE token = ? AND tenant_id = ?',
        [token, req.user.tenant_id]
      )
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'failed' })
    }
  })
}
