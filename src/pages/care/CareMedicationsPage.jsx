import { useEffect, useState } from 'react'
import {
  apiCareMedications, apiCareMedicationCreate,
  apiCareMedicationGiven, apiCareMedicationDelete,
} from '../../data/api.js'

const today = () => new Date().toISOString().slice(0, 10)

export default function CareMedicationsPage() {
  const [date, setDate] = useState(today())
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [studentId, setStudentId] = useState('')
  const [medDate, setMedDate] = useState(today())
  const [drugName, setDrugName] = useState('')
  const [dosage, setDosage] = useState('')
  const [timesPerDay, setTimesPerDay] = useState(3)
  const [note, setNote] = useState('')

  function load(d) {
    setLoading(true)
    apiCareMedications({ date: d }).then(setRecords).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(date) }, [date])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiCareMedicationCreate({ student_id: studentId, med_date: medDate, drug_name: drugName, dosage, times_per_day: timesPerDay, note })
      setStudentId(''); setDrugName(''); setDosage(''); setNote(''); setTimesPerDay(3)
      setShowForm(false); load(date)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  async function markGiven(id) {
    await apiCareMedicationGiven(id).catch(() => {})
    load(date)
  }

  async function handleDelete(id) {
    if (!confirm('確定刪除此託藥單？')) return
    await apiCareMedicationDelete(id).catch(() => {})
    load(date)
  }

  const pending = records.filter(r => !r.given_at)
  const done = records.filter(r => r.given_at)

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>託藥單</h2>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="input" style={{ width: 160 }} />
        {pending.length > 0 && (
          <span style={{ background: '#fef9ec', color: '#b45309', border: '1px solid #fcd34d', borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>
            待給藥 {pending.length}
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
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>託藥日期</label>
                <input type="date" className="input" value={medDate} onChange={e => setMedDate(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>藥品名稱</label>
                <input className="input" value={drugName} onChange={e => setDrugName(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>劑量</label>
                <input className="input" value={dosage} onChange={e => setDosage(e.target.value)} required placeholder="例：一次一顆" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>每日次數</label>
                <input type="number" min="1" max="10" className="input" value={timesPerDay} onChange={e => setTimesPerDay(Number(e.target.value))} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>備註</label>
                <input className="input" value={note} onChange={e => setNote(e.target.value)} style={{ width: '100%' }} placeholder="選填" />
              </div>
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
        <div className="empty-hint">此日無託藥記錄</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...pending, ...done].map(r => (
            <div key={r.id} style={{
              background: 'var(--surface)',
              border: `1px solid ${r.given_at ? 'var(--border)' : '#fcd34d'}`,
              borderRadius: 8, padding: '14px 16px',
              opacity: r.given_at ? 0.65 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>
                    <strong>{r.drug_name}</strong> — {r.dosage}，每日 {r.times_per_day} 次
                  </div>
                  {r.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{r.note}</div>}
                  {r.given_at && (
                    <div style={{ fontSize: 12, color: 'var(--success, #22c55e)', marginTop: 4 }}>
                      已給藥 {r.given_at.slice(11, 16)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!r.given_at && (
                    <button type="button" className="btn" style={{ fontSize: 12, padding: '4px 12px', background: 'var(--success, #22c55e)', borderColor: 'var(--success, #22c55e)', color: '#fff' }}
                      onClick={() => markGiven(r.id)}>
                      已給藥
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px', color: 'var(--danger, #ef4444)' }}
                    onClick={() => handleDelete(r.id)}>刪除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
