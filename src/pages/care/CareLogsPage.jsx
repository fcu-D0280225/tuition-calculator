import { useEffect, useState, useCallback } from 'react'
import { apiCareLogs, apiCareLogCreate, apiCareLogUpdate } from '../../data/api.js'

const today = () => new Date().toISOString().slice(0, 10)

export default function CareLogsPage() {
  const [date, setDate] = useState(today())
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draftNote, setDraftNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback((d) => {
    setLoading(true)
    apiCareLogs({ date: d })
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(date) }, [date, load])

  function startEdit(log) {
    setEditingId(log.id)
    setDraftNote(log.teacher_note || '')
  }

  async function saveNote(log) {
    setSaving(true)
    try {
      const updated = await apiCareLogUpdate(log.id, { teacher_note: draftNote })
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, ...updated } : l))
      setEditingId(null)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  async function createLog(studentId) {
    setSaving(true)
    try {
      const newLog = await apiCareLogCreate({ student_id: studentId, log_date: date, teacher_note: '' })
      setLogs(prev => [...prev, newLog])
      setEditingId(newLog.id)
      setDraftNote('')
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>聯絡簿</h2>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="input"
          style={{ width: 160, marginLeft: 'auto' }}
        />
      </div>

      {loading ? (
        <div className="page-loading">載入中…</div>
      ) : logs.length === 0 ? (
        <div className="empty-hint">此日期尚無聯絡簿記錄</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {logs.map(log => (
            <div key={log.id} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontWeight: 600 }}>{log.student_name}</span>
                {log.care_class && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{log.care_class}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: log.teacher_note ? 'var(--success, #22c55e)' : 'var(--muted)' }}>
                  {log.teacher_note ? '已填寫' : '未填寫'}
                </span>
              </div>

              {editingId === log.id ? (
                <div>
                  <textarea
                    className="input"
                    value={draftNote}
                    onChange={e => setDraftNote(e.target.value)}
                    placeholder="填寫今日聯絡事項…"
                    style={{ width: '100%', minHeight: 100, resize: 'vertical', marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>取消</button>
                    <button type="button" className="btn" disabled={saving} onClick={() => saveNote(log)}>儲存</button>
                  </div>
                </div>
              ) : (
                <div>
                  {log.teacher_note ? (
                    <p style={{ margin: '0 0 10px', whiteSpace: 'pre-wrap', fontSize: 14 }}>{log.teacher_note}</p>
                  ) : (
                    <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13 }}>（尚未填寫）</p>
                  )}
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: '4px 14px' }} onClick={() => startEdit(log)}>
                    {log.teacher_note ? '編輯' : '填寫'}
                  </button>
                </div>
              )}

              {log.parent_note && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>家長回覆</div>
                  <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{log.parent_note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
