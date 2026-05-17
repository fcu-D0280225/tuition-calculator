import { useEffect, useState } from 'react'
import { apiCareDashboard } from '../../data/api.js'

export default function CareDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    apiCareDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-loading">載入中…</div>
  if (error) return <div className="empty-hint">載入失敗：{error}</div>

  const absentPct = data.total_students > 0
    ? Math.round((data.present_count / data.total_students) * 100)
    : 0

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <h2 style={{ marginBottom: 24 }}>安親班今日總覽</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>{data.today}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard
          label="到校人數"
          value={`${data.present_count} / ${data.total_students}`}
          sub={`${absentPct}% 出席率`}
          color="var(--success, #22c55e)"
        />
        <StatCard
          label="待審請假"
          value={data.pending_leave_count}
          sub={data.pending_leave_count > 0 ? '需要處理' : '無待審'}
          color={data.pending_leave_count > 0 ? 'var(--warning, #f59e0b)' : 'var(--muted)'}
        />
        <StatCard
          label="聯絡簿已填"
          value={`${data.logs_filled_count} / ${data.total_students}`}
          sub="今日"
          color="var(--accent, #6366f1)"
        />
      </div>

      {data.absent_students.length > 0 && (
        <section>
          <h3 style={{ fontSize: 15, marginBottom: 12, color: 'var(--danger, #ef4444)' }}>
            未到校 / 未記錄（{data.absent_students.length} 人）
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.absent_students.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: s.status === 'absent' ? 'var(--danger, #ef4444)' : 'var(--muted)',
                  flexShrink: 0,
                }} />
                <span style={{ fontWeight: 500 }}>{s.name}</span>
                {s.care_class && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.care_class}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
                  {s.status === 'absent' ? '請假' : '未記錄'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.absent_students.length === 0 && data.total_students > 0 && (
        <div className="empty-hint" style={{ color: 'var(--success, #22c55e)' }}>
          所有學生皆已到校
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 20px 16px',
    }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>
    </div>
  )
}
