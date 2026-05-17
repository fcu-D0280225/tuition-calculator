import { useEffect, useState } from 'react'
import { apiCareGrowth, apiCareGrowthCreate, apiCareGrowthDelete } from '../../data/api.js'

const CATEGORIES = [
  { value: 'general',  label: '一般' },
  { value: 'learning', label: '學習' },
  { value: 'behavior', label: '行為' },
  { value: 'social',   label: '社交' },
]

const CATEGORY_COLORS = {
  general:  '#6366f1',
  learning: '#22c55e',
  behavior: '#f59e0b',
  social:   '#ec4899',
}

export default function CareGrowthPage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // form state
  const [studentId, setStudentId] = useState('')
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState('general')
  const [content, setContent] = useState('')

  function load() {
    setLoading(true)
    const params = filterCategory ? { category: filterCategory } : {}
    apiCareGrowth(params).then(setRecords).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterCategory])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiCareGrowthCreate({ student_id: studentId, record_date: recordDate, category, content })
      setStudentId(''); setContent(''); setCategory('general')
      setShowForm(false)
      load()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('確定刪除此記錄？')) return
    await apiCareGrowthDelete(id).catch(() => {})
    load()
  }

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>成長記錄</h2>
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
                <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>日期</label>
                <input type="date" className="input" value={recordDate} onChange={e => setRecordDate(e.target.value)} required style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>類別</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <button key={c.value} type="button"
                    onClick={() => setCategory(c.value)}
                    style={{
                      padding: '4px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                      border: `1.5px solid ${category === c.value ? CATEGORY_COLORS[c.value] : 'var(--border)'}`,
                      background: category === c.value ? CATEGORY_COLORS[c.value] + '22' : 'transparent',
                      color: category === c.value ? CATEGORY_COLORS[c.value] : 'var(--muted)',
                      fontWeight: category === c.value ? 600 : 400,
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>內容</label>
              <textarea className="input" value={content} onChange={e => setContent(e.target.value)} required
                style={{ width: '100%', minHeight: 80, resize: 'vertical' }} placeholder="記錄學生今日的成長表現…" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>取消</button>
              <button type="submit" className="btn" disabled={saving}>儲存</button>
            </div>
          </form>
        </div>
      )}

      {/* 類別篩選 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button type="button"
          className={`btn${!filterCategory ? '' : ' btn-ghost'}`}
          style={{ fontSize: 13, padding: '4px 14px' }}
          onClick={() => setFilterCategory('')}>全部</button>
        {CATEGORIES.map(c => (
          <button key={c.value} type="button"
            className={`btn${filterCategory === c.value ? '' : ' btn-ghost'}`}
            style={{ fontSize: 13, padding: '4px 14px' }}
            onClick={() => setFilterCategory(c.value)}>{c.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading">載入中…</div>
      ) : records.length === 0 ? (
        <div className="empty-hint">尚無成長記錄</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {records.map(r => {
            const cat = CATEGORIES.find(c => c.value === r.category) || CATEGORIES[0]
            const color = CATEGORY_COLORS[r.category] || '#6366f1'
            return (
              <div key={r.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 18px',
                borderLeft: `4px solid ${color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{r.student_name}</span>
                  <span style={{ fontSize: 12, padding: '1px 8px', borderRadius: 20, background: color + '22', color }}>{cat.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{r.record_date}</span>
                  <button type="button" onClick={() => handleDelete(r.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
                <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{r.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
