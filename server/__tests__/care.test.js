// @vitest-environment node
/**
 * care module integration tests (mock-based)
 * 直接掛載 careRouter 在 minimal express app，mock pool 回應
 *
 * TC-001：雙重請假 → 409
 * TC-002：出席 UPSERT 同日兩次都成功
 * TC-003：過期 token → 404
 * TC-004：tenant 隔離（token 屬於 tenant 1 的 student 不能被 tenant 2 查到）
 * TC-005：家長正常提交請假 → 201
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'

// ── Mock db.js pool ───────────────────────────────────────────────────────────
vi.mock('../db.js', () => ({
  pool: { query: vi.fn() },
}))

import { pool } from '../db.js'
import { careRouter } from '../routes/care.js'

// ── Minimal app（模擬已通過 requireAuth，user 已注入）────────────────────────
function makeApp(tenantId = 1) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { tenant_id: tenantId }
    next()
  })
  app.use('/api/care', careRouter)
  return app
}

// ─────────────────────────────────────────────────────────────────────────────

describe('care module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── TC-001：雙重請假 → 409 ─────────────────────────────────────────────────
  it('TC-001: 雙重請假 → 409', async () => {
    // 第一次 token lookup 成功
    pool.query
      .mockResolvedValueOnce([[{ tenant_id: 1, student_id: 'stu_1', expires_at: new Date(Date.now() + 86400_000) }]])
      // INSERT 觸發 ER_DUP_ENTRY
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }))

    const app = makeApp()
    const res = await supertest(app)
      .post('/api/care/parent/valid_token/leave')
      .send({ leave_date: '2026-05-20', reason: '感冒' })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('leave_already_requested')
  })

  // ── TC-002：出席 UPSERT 同日兩次都成功 ────────────────────────────────────
  it('TC-002: 出席 UPSERT 同日兩次都成功', async () => {
    const mockRow = { id: 'ca_1', tenant_id: 1, student_id: 'stu_1', attend_date: '2026-05-17', status: 'present', note: '' }

    // 第一次呼叫
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT ... ON DUPLICATE KEY UPDATE
      .mockResolvedValueOnce([[mockRow]])            // SELECT 回傳

    const app = makeApp()
    const res1 = await supertest(app)
      .post('/api/care/attendance')
      .send({ student_id: 'stu_1', attend_date: '2026-05-17', status: 'present' })

    expect(res1.status).toBe(200)

    // 第二次（同日，更新 checkout_at）
    const mockRow2 = { ...mockRow, checkout_at: '2026-05-17 17:30:00', status: 'present' }
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 2 }]) // ON DUPLICATE KEY → 2 表示 update
      .mockResolvedValueOnce([[mockRow2]])

    const res2 = await supertest(app)
      .post('/api/care/attendance')
      .send({ student_id: 'stu_1', attend_date: '2026-05-17', status: 'present', checkout_at: '2026-05-17 17:30:00' })

    expect(res2.status).toBe(200)
    expect(res2.body.checkout_at).toBe('2026-05-17 17:30:00')
  })

  // ── TC-003：過期 token → 404 ───────────────────────────────────────────────
  it('TC-003: 過期 token → 404', async () => {
    // token 存在但 expires_at 已過期
    pool.query.mockResolvedValueOnce([[{
      tenant_id: 1,
      student_id: 'stu_1',
      expires_at: new Date(Date.now() - 86400_000), // 昨天
    }]])

    const app = makeApp()
    const res = await supertest(app)
      .get('/api/care/parent/expired_token')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not_found')
  })

  // ── TC-004：tenant 隔離 ────────────────────────────────────────────────────
  it('TC-004: token 屬於 tenant 1，tenant 2 的請求無法取得資料', async () => {
    // token 查到的 tenant_id = 1
    pool.query
      .mockResolvedValueOnce([[{ tenant_id: 1, student_id: 'stu_1', expires_at: new Date(Date.now() + 86400_000) }]])
      // student query：用 tenant_id=1 + student_id 去查，回傳資料
      .mockResolvedValueOnce([[{ id: 'stu_1', name: '王小明', care_class: 'A班' }]])
      // today log
      .mockResolvedValueOnce([[]])
      // leave requests
      .mockResolvedValueOnce([[]])

    // 用 tenant 2 的身份發請求（但家長端不帶 auth，tenant 來自 token row）
    const app = makeApp(2)
    const res = await supertest(app)
      .get('/api/care/parent/token_of_tenant1')

    // 回應成功，但資料是 token row 裡的 tenant_id=1 的學生，不是 tenant 2
    expect(res.status).toBe(200)
    expect(res.body.student.id).toBe('stu_1')

    // 確認 pool.query 第二次呼叫（查學生）帶的是 tenant_id=1，不是 2
    const studentQueryCall = pool.query.mock.calls[1]
    const params = studentQueryCall[1]
    expect(params[0]).toBe('stu_1')   // student_id from token
    expect(params[1]).toBe(1)         // tenant_id from token (not 2)
  })

  // ── TC-005：家長正常提交請假 → 201 ────────────────────────────────────────
  it('TC-005: 家長正常提交請假 → 201', async () => {
    pool.query
      // token lookup
      .mockResolvedValueOnce([[{ tenant_id: 1, student_id: 'stu_1', expires_at: new Date(Date.now() + 86400_000) }]])
      // INSERT leave request 成功
      .mockResolvedValueOnce([{ insertId: 0, affectedRows: 1 }])

    const app = makeApp()
    const res = await supertest(app)
      .post('/api/care/parent/valid_token/leave')
      .send({ leave_date: '2026-05-21', reason: '出遊' })

    expect(res.status).toBe(201)
    expect(res.body.student_id).toBe('stu_1')
    expect(res.body.leave_date).toBe('2026-05-21')
    expect(res.body.status).toBe('pending')
  })
})
