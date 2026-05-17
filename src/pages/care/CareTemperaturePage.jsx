import { useEffect, useState } from 'react'
import { apiCareTemperature, apiCareTemperatureCreate, apiCareTemperatureDelete } from '../../data/api.js'

const SESSIONS = [
  { value: 'morning',   label: '早上' },
  { value: 'noon',      label: '中午' },
  { value: 'afternoon', label: '下午' },
]

const SESSION_COLOR = { morning: '#6366f1', noon: '#f59e0b', afternoon: '#22c55e' }

const today = () => new Date().toISOString().slice(0, 10)
const nowDatetime = () => new Date().toISOString().slice(0, 16)

function tempColor(t) {
  if (t >= 38) return '#ef4444'
  if (t >= 37.5) return '#f59e0b'
  return '#22c55e'
}

export default function CareTemperaturePage() {
  const [date, setDate] = useState(today())
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [studentId, setStudentId] = useState('')
  const [measuredAt, setMeasuredAt] = useState(nowDatetime())
  const [temperature, setTemperature] = useState('')
  const [session, setSession] = useState('morning')
  const [note, setNote] = useState('')

  function load(d) {
    setLoading(true)
    apiCareTemperature({ date: d }).then(setRecords).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(date) }, [date])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiCareTemperatureCreate({
        student_id: studentId,
        measured_at: measuredAt.replace('T', ' ') + ':00',
        temperature: parseFloat(temperature),
        session, note,
      })
      setStudentId(''); setTemperature(''); setNote('')
      setShowForm(false); load(date)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    await apiCareTemperatureDelete(id).catch(() => {})
    load(date)
  }

  // 統計：發燒人數（>=38°C）
  const feverCount = records.filter(r => parseFloat(r.temperature) >= 38).length

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>體溫紀錄</h2>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="input" style={{ width: 160 }} />
        {feverCount > 0 && (
          <span style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>
            發燒 {feverCount} 人
          </span>
        )}
        <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(v => !v)}>
          {showForm ? '取消' : '+ 新增'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>學生 ID</label>
                <input className="input" value={studentId} onChange={e => setStudentId(e.target.value)} required placeholder="學生 ID" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>量測時間</label>
                <input type="datetime-local" className="input" value={measuredAt} onChange={e => setMeasuredAt(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>體溫 (°C)</label>
                <input className="input" type="number" step="0.1" min="34" max="42"
                  value={temperature} onChange={e => setTemperature(e.target.value)} required style={{ width: '100%' }} placeholder="37.0" />
              </div>
              <div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>時段</label>
                <select className="input" value={session} onChange={e => setSession(e.target.value)} style={{ width: '100%' }}>
                  {SESSIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>備註</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} style={{ width: '100%' }} placeholder="選填" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>取消</button>
              <button type="submit" className="btn" disabled={saving}>儲存</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="page-loading">載入中…</div>
      ) : records.length === 0 ? (
        <div className="empty-hint">此日無體溫紀錄</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {records.map(r => {
            const temp = parseFloat(r.temperature)
            const color = tempColor(temp)
            const sessionLabel = SESSIONS.find(s => s.value === r.session)?.label || r.session
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 16px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{r.student_name}</div>
                  {r.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{r.note}</div>}
                </div>
                <span style={{ fontSize: 12, color: SESSION_COLOR[r.session] || 'var(--muted)', padding: '2px 8px', borderRadius: 20, background: (SESSION_COLOR[r.session] || '#6366f1') + '18' }}>
                  {sessionLabel}
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color, minWidth: 60, textAlign: 'right' }}>
                  {temp.toFixed(1)}°
                </span>
                {temp >= 38 && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>發燒</span>}
                <button type="button" onClick={() => handleDelete(r.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
