import express from 'express'
import crypto from 'node:crypto'
import { pool } from '../db.js'

export const careRouter = express.Router()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ── 出席管理 ──────────────────────────────────────────────────────────────────

careRouter.get('/attendance', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  const { date } = req.query
  if (!date || !DATE_RE.test(date)) return res.status(400).json({ error: 'invalid_date' })
  try {
    const [rows] = await pool.query(
      `SELECT s.id AS student_id, s.name AS student_name, s.care_class,
              a.id, a.checkin_at, a.checkout_at, a.status, a.note
       FROM students s
       LEFT JOIN care_attendance a
         ON a.student_id = s.id AND a.tenant_id = ? AND a.attend_date = ?
       WHERE s.tenant_id = ? AND s.care_enrolled = 1 AND s.active = 1
       ORDER BY s.sort_order ASC, s.name ASC`,
      [tenantId, date, tenantId]
    )
    res.json({ date, students: rows })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

careRouter.post('/attendance', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  const { student_id, attend_date, checkin_at, checkout_at, status, note } = req.body || {}
  if (!student_id) return res.status(400).json({ error: 'student_id_required' })
  if (!attend_date || !DATE_RE.test(attend_date)) return res.status(400).json({ error: 'invalid_attend_date' })
  const allowedStatus = ['present', 'absent', 'leave_approved']
  const st = allowedStatus.includes(status) ? status : 'present'
  const id = genId('ca')
  try {
    await pool.query(
      `INSERT INTO care_attendance (id, tenant_id, student_id, attend_date, checkin_at, checkout_at, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         checkin_at   = COALESCE(VALUES(checkin_at), checkin_at),
         checkout_at  = COALESCE(VALUES(checkout_at), checkout_at),
         status       = VALUES(status),
         note         = VALUES(note)`,
      [id, tenantId, student_id, attend_date, checkin_at || null, checkout_at || null, st, note || '']
    )
    const [[row]] = await pool.query(
      'SELECT * FROM care_attendance WHERE tenant_id = ? AND student_id = ? AND attend_date = ?',
      [tenantId, student_id, attend_date]
    )
    res.status(200).json(row)
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── 聯絡簿 ────────────────────────────────────────────────────────────────────

careRouter.get('/logs', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  const { date, student_id } = req.query
  try {
    const conditions = ['l.tenant_id = ?']
    const params = [tenantId]
    if (date) { conditions.push('l.log_date = ?'); params.push(date) }
    if (student_id) { conditions.push('l.student_id = ?'); params.push(student_id) }
    const [rows] = await pool.query(
      `SELECT l.*, s.name AS student_name, s.care_class
       FROM care_logs l
       JOIN students s ON s.id = l.student_id AND s.tenant_id = l.tenant_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.log_date DESC, s.sort_order ASC`,
      params
    )
    res.json(rows)
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

careRouter.post('/logs', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  const { student_id, log_date, teacher_note, parent_note } = req.body || {}
  if (!student_id) return res.status(400).json({ error: 'student_id_required' })
  if (!log_date || !DATE_RE.test(log_date)) return res.status(400).json({ error: 'invalid_log_date' })
  const id = genId('cl')
  try {
    await pool.query(
      `INSERT INTO care_logs (id, tenant_id, student_id, log_date, teacher_note, parent_note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tenantId, student_id, log_date, teacher_note || null, parent_note || null]
    )
    const [[row]] = await pool.query('SELECT * FROM care_logs WHERE id = ?', [id])
    res.status(201).json(row)
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'log_already_exists' })
    console.error(e); res.status(500).json({ error: 'failed' })
  }
})

careRouter.put('/logs/:id', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  const { teacher_note, parent_note } = req.body || {}
  try {
    const sets = []
    const params = []
    if (teacher_note !== undefined) { sets.push('teacher_note = ?'); params.push(teacher_note) }
    if (parent_note !== undefined) { sets.push('parent_note = ?'); params.push(parent_note) }
    if (sets.length === 0) return res.status(400).json({ error: 'nothing_to_update' })
    params.push(req.params.id, tenantId)
    const [r] = await pool.query(
      `UPDATE care_logs SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'not_found' })
    const [[row]] = await pool.query('SELECT * FROM care_logs WHERE id = ?', [req.params.id])
    res.json(row)
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── 請假管理 ──────────────────────────────────────────────────────────────────

careRouter.get('/leave-requests', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  const { status, date } = req.query
  try {
    const conditions = ['lr.tenant_id = ?']
    const params = [tenantId]
    if (status) { conditions.push('lr.status = ?'); params.push(status) }
    if (date) { conditions.push('lr.leave_date = ?'); params.push(date) }
    const [rows] = await pool.query(
      `SELECT lr.*, s.name AS student_name, s.care_class
       FROM care_leave_requests lr
       JOIN students s ON s.id = lr.student_id AND s.tenant_id = lr.tenant_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY FIELD(lr.status, 'pending', 'approved', 'rejected'), lr.leave_date DESC`,
      params
    )
    res.json(rows)
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

careRouter.post('/leave-requests/:id/approve', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  try {
    const [r] = await pool.query(
      `UPDATE care_leave_requests SET status = 'approved', reject_reason = ''
       WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      [req.params.id, tenantId]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'not_found_or_not_pending' })
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

careRouter.post('/leave-requests/:id/reject', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  const { reject_reason } = req.body || {}
  if (!reject_reason || typeof reject_reason !== 'string' || !reject_reason.trim()) {
    return res.status(400).json({ error: 'reject_reason_required' })
  }
  try {
    const [r] = await pool.query(
      `UPDATE care_leave_requests SET status = 'rejected', reject_reason = ?
       WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      [reject_reason.trim().slice(0, 255), req.params.id, tenantId]
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'not_found_or_not_pending' })
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── 家長 QR Token ─────────────────────────────────────────────────────────────

careRouter.get('/tokens/:studentId', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  const { studentId } = req.params
  try {
    // 確認學生存在且屬於此 tenant
    const [[stu]] = await pool.query(
      'SELECT id FROM students WHERE id = ? AND tenant_id = ? AND care_enrolled = 1',
      [studentId, tenantId]
    )
    if (!stu) return res.status(404).json({ error: 'student_not_found' })

    // 找有效 token（未過期）
    const [[existing]] = await pool.query(
      `SELECT token, expires_at FROM care_share_tokens
       WHERE tenant_id = ? AND student_id = ? AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [tenantId, studentId]
    )
    if (existing) return res.json(existing)

    // 產生新 token（365 天）
    const id = genId('cst')
    const token = crypto.randomBytes(24).toString('base64url')
    const expiresAt = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 19).replace('T', ' ')
    await pool.query(
      `INSERT INTO care_share_tokens (id, tenant_id, student_id, token, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tenantId, studentId, token, expiresAt]
    )
    res.status(201).json({ token, expires_at: expiresAt })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── 家長 Portal（不需 auth，已在 index.js 加 rate limit）────────────────────

careRouter.get('/parent/:token', async (req, res) => {
  try {
    const [[tokenRow]] = await pool.query(
      `SELECT tenant_id, student_id, expires_at FROM care_share_tokens WHERE token = ?`,
      [req.params.token]
    )
    if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
      return res.status(404).json({ error: 'not_found' })
    }
    const { tenant_id, student_id } = tokenRow

    const [[student]] = await pool.query(
      'SELECT id, name, care_class FROM students WHERE id = ? AND tenant_id = ?',
      [student_id, tenant_id]
    )
    if (!student) return res.status(404).json({ error: 'not_found' })

    const today = new Date().toISOString().slice(0, 10)
    const [[log]] = await pool.query(
      'SELECT * FROM care_logs WHERE tenant_id = ? AND student_id = ? AND log_date = ?',
      [tenant_id, student_id, today]
    )

    const [leaveRequests] = await pool.query(
      `SELECT id, leave_date, reason, status, reject_reason, created_at
       FROM care_leave_requests
       WHERE tenant_id = ? AND student_id = ?
       ORDER BY leave_date DESC LIMIT 10`,
      [tenant_id, student_id]
    )

    res.json({ student, today_log: log || null, leave_requests: leaveRequests })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

careRouter.post('/parent/:token/leave', async (req, res) => {
  try {
    const [[tokenRow]] = await pool.query(
      `SELECT tenant_id, student_id, expires_at FROM care_share_tokens WHERE token = ?`,
      [req.params.token]
    )
    if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
      return res.status(404).json({ error: 'not_found' })
    }
    const { tenant_id, student_id } = tokenRow

    const { leave_date, reason } = req.body || {}
    if (!leave_date || !DATE_RE.test(leave_date)) return res.status(400).json({ error: 'invalid_leave_date' })
    const cleanReason = typeof reason === 'string' ? reason.trim() : ''

    const id = genId('clr')
    try {
      await pool.query(
        `INSERT INTO care_leave_requests (id, tenant_id, student_id, leave_date, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [id, tenant_id, student_id, leave_date, cleanReason]
      )
      res.status(201).json({ id, student_id, leave_date, reason: cleanReason, status: 'pending' })
    } catch (inner) {
      if (inner.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'leave_already_requested' })
      throw inner
    }
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── 今日總覽（Dashboard 用）───────────────────────────────────────────────────

careRouter.get('/dashboard', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1
  const today = new Date().toISOString().slice(0, 10)
  try {
    // 安親班學生總數
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM students WHERE tenant_id = ? AND care_enrolled = 1 AND active = 1',
      [tenantId]
    )

    // 今日已到校
    const [[{ present }]] = await pool.query(
      `SELECT COUNT(*) AS present FROM care_attendance
       WHERE tenant_id = ? AND attend_date = ? AND status = 'present'`,
      [tenantId, today]
    )

    // 待審請假
    const [[{ pending_leave }]] = await pool.query(
      `SELECT COUNT(*) AS pending_leave FROM care_leave_requests
       WHERE tenant_id = ? AND status = 'pending'`,
      [tenantId]
    )

    // 今日聯絡簿未填學生數
    const [[{ logs_filled }]] = await pool.query(
      `SELECT COUNT(*) AS logs_filled FROM care_logs
       WHERE tenant_id = ? AND log_date = ?`,
      [tenantId, today]
    )

    // 未到校學生列表（今日出席表中 absent 或未報到）
    const [absent_students] = await pool.query(
      `SELECT s.id, s.name, s.care_class,
              COALESCE(a.status, 'not_recorded') AS status
       FROM students s
       LEFT JOIN care_attendance a
         ON a.student_id = s.id AND a.tenant_id = s.tenant_id AND a.attend_date = ?
       WHERE s.tenant_id = ? AND s.care_enrolled = 1 AND s.active = 1
         AND (a.status IS NULL OR a.status = 'absent')
       ORDER BY s.sort_order ASC`,
      [today, tenantId]
    )

    res.json({
      today,
      total_students: Number(total),
      present_count: Number(present),
      pending_leave_count: Number(pending_leave),
      logs_filled_count: Number(logs_filled),
      absent_students,
    })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})
