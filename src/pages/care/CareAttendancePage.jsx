import { useEffect, useState } from 'react'
import {
  apiCareAttendance, apiCareAttendanceUpsert,
  apiCareLeaveRequests, apiCareLeaveApprove, apiCareLeaveReject,
} from '../../data/api.js'

const today = () => new Date().toISOString().slice(0, 10)

const STATUS_LABELS = { present: '到校', absent: '缺席', leave_approved: '請假核准' }
const STATUS_COLORS = {
  present:       'var(--success, #22c55e)',
  absent:        'var(--danger, #ef4444)',
  leave_approved:'var(--warning, #f59e0b)',
  not_set:       'var(--muted)',
}

export default function CareAttendancePage() {
  const [activeTab, setActiveTab] = useState('attendance')

  return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[['attendance', '點名'], ['leave', '請假管理']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn${activeTab === key ? '' : ' btn-ghost'}`}
            onClick={() => setActiveTab(key)}
            style={{ minWidth: 90 }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'attendance' && <AttendanceTab />}
      {activeTab === 'leave' && <LeaveTab />}
    </div>
  )
}

function AttendanceTab() {
  const [date, setDate] = useState(today())
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState({})

  function load(d) {
    setLoading(true)
    apiCareAttendance(d)
      .then(r => setStudents(r.students))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(date) }, [date])

  async function setStatus(student, newStatus) {
    const key = student.student_id
    setSaving(s => ({ ...s, [key]: true }))
    try {
      const updated = await apiCareAttendanceUpsert({
        student_id: student.student_id,
        attend_date: date,
        status: newStatus,
        checkin_at: newStatus === 'present' ? (student.checkin_at || new Date().toISOString().slice(0, 19).replace('T', ' ')) : student.checkin_at,
        checkout_at: student.checkout_at,
      })
      setStudents(prev => prev.map(s => s.student_id === key ? { ...s, ...updated } : s))
    } catch { /* ignore */ } finally {
      setSaving(s => ({ ...s, [key]: false }))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="input"
          style={{ width: 160 }}
        />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          {students.length} 位安親班學生
        </span>
      </div>

      {loading ? (
        <div className="page-loading">載入中…</div>
      ) : students.length === 0 ? (
        <div className="empty-hint">尚無安親班學生（請在學生管理中啟用安親班）</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.map(s => {
            const currentStatus = s.status || null
            return (
              <div key={s.student_id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontWeight: 500 }}>{s.student_name}</div>
                  {s.care_class && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.care_class}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['present', 'absent', 'leave_approved'].map(st => (
                    <button
                      key={st}
                      type="button"
                      disabled={saving[s.student_id]}
                      onClick={() => setStatus(s, st)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 20,
                        border: `1.5px solid ${currentStatus === st ? STATUS_COLORS[st] : 'var(--border)'}`,
                        background: currentStatus === st ? STATUS_COLORS[st] + '22' : 'transparent',
                        color: currentStatus === st ? STATUS_COLORS[st] : 'var(--muted)',
                        fontWeight: currentStatus === st ? 600 : 400,
                        cursor: 'pointer',
                        fontSize: 13,
                        transition: 'all .15s',
                      }}
                    >
                      {STATUS_LABELS[st]}
                    </button>
                  ))}
                </div>
                {s.checkin_at && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    到 {s.checkin_at.slice(11, 16)}
                    {s.checkout_at ? ` · 離 ${s.checkout_at.slice(11, 16)}` : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LeaveTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [rejectModal, setRejectModal] = useState(null) // { id, studentName }
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    const params = filter !== 'all' ? { status: filter } : {}
    apiCareLeaveRequests(params)
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  async function approve(id) {
    setSaving(true)
    try {
      await apiCareLeaveApprove(id)
      load()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  async function submitReject() {
    if (!rejectReason.trim()) return
    setSaving(true)
    try {
      await apiCareLeaveReject(rejectModal.id, rejectReason.trim())
      setRejectModal(null)
      setRejectReason('')
      load()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const STATUS_BADGE = {
    pending:  { label: '待審', color: 'var(--warning, #f59e0b)' },
    approved: { label: '核准', color: 'var(--success, #22c55e)' },
    rejected: { label: '拒絕', color: 'var(--danger, #ef4444)' },
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['pending', '待審'], ['approved', '已核准'], ['rejected', '已拒絕'], ['all', '全部']].map(([val, label]) => (
          <button
            key={val}
            type="button"
            className={`btn${filter === val ? '' : ' btn-ghost'}`}
            style={{ fontSize: 13, padding: '4px 14px' }}
            onClick={() => setFilter(val)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading">載入中…</div>
      ) : requests.length === 0 ? (
        <div className="empty-hint">無請假申請</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map(r => {
            const badge = STATUS_BADGE[r.status]
            return (
              <div key={r.id} style={{
                padding: '14px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{r.student_name}</span>
                    {r.care_class && <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>{r.care_class}</span>}
                  </div>
                  <span style={{
                    padding: '2px 10px', borderRadius: 20, fontSize: 12,
                    background: badge.color + '22', color: badge.color, fontWeight: 600,
                  }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                  請假日期：<strong style={{ color: 'var(--text)' }}>{r.leave_date}</strong>
                </div>
                {r.reason && <div style={{ fontSize: 13, marginBottom: 4 }}>原因：{r.reason}</div>}
                {r.reject_reason && (
                  <div style={{ fontSize: 12, color: 'var(--danger, #ef4444)' }}>拒絕原因：{r.reject_reason}</div>
                )}
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 13, padding: '4px 16px', background: 'var(--success, #22c55e)', borderColor: 'var(--success, #22c55e)', color: '#fff' }}
                      disabled={saving}
                      onClick={() => approve(r.id)}
                    >
                      核准
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 13, padding: '4px 16px', color: 'var(--danger, #ef4444)', borderColor: 'var(--danger, #ef4444)' }}
                      disabled={saving}
                      onClick={() => { setRejectModal({ id: r.id, studentName: r.student_name }); setRejectReason('') }}
                    >
                      拒絕
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {rejectModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setRejectModal(null)}>
          <div style={{
            background: 'var(--bg)', borderRadius: 12, padding: 24, width: 360, maxWidth: '90vw',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12 }}>拒絕 {rejectModal.studentName} 的請假申請</h3>
            <textarea
              className="input"
              placeholder="請填寫拒絕原因（必填）"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ width: '100%', minHeight: 80, resize: 'vertical', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setRejectModal(null)}>取消</button>
              <button
                type="button"
                className="btn"
                disabled={!rejectReason.trim() || saving}
                style={{ background: 'var(--danger, #ef4444)', borderColor: 'var(--danger, #ef4444)', color: '#fff' }}
                onClick={submitReject}
              >
                確認拒絕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
