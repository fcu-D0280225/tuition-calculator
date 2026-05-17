import { useEffect, useState } from 'react'
import { apiCareParent, apiCareParentLeave } from '../../data/api.js'

// 從 URL 取得 token：/care/parent/:token
function getTokenFromPath() {
  const m = window.location.pathname.match(/\/care\/parent\/([^/]+)/)
  return m ? m[1] : null
}

const STATUS_LABEL = { pending: '待審', approved: '核准', rejected: '拒絕' }
const STATUS_COLOR = {
  pending: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
}

export default function ParentPortalPage() {
  const token = getTokenFromPath()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 請假表單
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
  const [leaveDate, setLeaveDate] = useState(tomorrow)
  const [leaveReason, setLeaveReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [leaveResult, setLeaveResult] = useState(null) // 'ok' | 'dup' | 'err'

  useEffect(() => {
    if (!token) { setError('invalid_token'); setLoading(false); return }
    apiCareParent(token)
      .then(setData)
      .catch(() => setError('not_found'))
      .finally(() => setLoading(false))
  }, [token])

  async function submitLeave(e) {
    e.preventDefault()
    if (!leaveDate) return
    setSubmitting(true)
    setLeaveResult(null)
    try {
      await apiCareParentLeave(token, { leave_date: leaveDate, reason: leaveReason.trim() })
      setLeaveResult('ok')
      setLeaveReason('')
      // 重新載入
      const fresh = await apiCareParent(token)
      setData(fresh)
    } catch (err) {
      setLeaveResult(err.status === 409 ? 'dup' : 'err')
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <div style={shellStyle}>
        <div style={{ color: '#6b7280', textAlign: 'center', marginTop: 60 }}>載入中…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={shellStyle}>
        <div style={{
          textAlign: 'center', marginTop: 80, padding: '0 24px',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h2 style={{ fontSize: 18, color: '#111', marginBottom: 8 }}>連結已失效</h2>
          <p style={{ color: '#6b7280', fontSize: 14 }}>請聯絡老師取得新的 QR code</p>
        </div>
      </div>
    )
  }

  const { student, today_log, leave_requests } = data

  return (
    <div style={shellStyle}>
      {/* Header */}
      <div style={{ background: '#6366f1', color: '#fff', padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 13, opacity: .8, marginBottom: 4 }}>安親班家長入口</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{student.name}</div>
        {student.care_class && <div style={{ fontSize: 13, opacity: .8, marginTop: 2 }}>{student.care_class}</div>}
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 今日聯絡簿 */}
        <Section title="今日聯絡簿">
          {today_log?.teacher_note ? (
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{today_log.teacher_note}</p>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>老師今天還沒填寫</p>
          )}
        </Section>

        {/* 請假申請 */}
        <Section title="申請請假">
          {leaveResult === 'ok' && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#166534', fontSize: 13 }}>
              請假申請已送出，等待老師審核
            </div>
          )}
          {leaveResult === 'dup' && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
              該日期已有請假申請
            </div>
          )}
          {leaveResult === 'err' && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
              送出失敗，請稍後再試
            </div>
          )}
          <form onSubmit={submitLeave}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>請假日期</label>
              <input
                type="date"
                value={leaveDate}
                onChange={e => setLeaveDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                required
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>原因（選填）</label>
              <textarea
                value={leaveReason}
                onChange={e => setLeaveReason(e.target.value)}
                placeholder="請假原因…"
                style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !leaveDate}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                background: '#6366f1', color: '#fff', border: 'none',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? '送出中…' : '送出請假申請'}
            </button>
          </form>
        </Section>

        {/* 近期請假紀錄 */}
        {leave_requests.length > 0 && (
          <Section title="近期請假紀錄">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leave_requests.map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.leave_date}</div>
                    {r.reason && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{r.reason}</div>}
                    {r.reject_reason && (
                      <div style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>拒絕原因：{r.reject_reason}</div>
                    )}
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 12,
                    background: STATUS_COLOR[r.status] + '22',
                    color: STATUS_COLOR[r.status], fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 600, color: '#374151' }}>
        {title}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

const shellStyle = {
  minHeight: '100vh',
  background: '#f3f4f6',
  maxWidth: 480,
  margin: '0 auto',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
  background: '#fff',
  boxSizing: 'border-box',
  color: '#111',
}
