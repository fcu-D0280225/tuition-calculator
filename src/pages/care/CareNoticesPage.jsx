import { useEffect, useState } from 'react'
import {
  apiCareNotices, apiCareNoticeCreate, apiCareNoticeUpdate, apiCareNoticeDelete,
} from '../../data/api.js'

export default function CareNoticesPage() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  function load() {
    setLoading(true)
    apiCareNotices().then(setNotices).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function startNew() { setEditing(null); setShowForm(true) }
  function startEdit(n) { setEditing(n); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }

  async function handleDelete(id) {
    if (!confirm('確定刪除此通知單？')) return
    await apiCareNoticeDelete(id).catch(() => {})
    load()
  }

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>通知單</h2>
        <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={startNew}>+ 新增</button>
      </div>

      {showForm && (
        <NoticeForm
          initial={editing}
          onSave={async (data) => {
            if (editing) {
              await apiCareNoticeUpdate(editing.id, data)
            } else {
              await apiCareNoticeCreate(data)
            }
            closeForm(); load()
          }}
          onCancel={closeForm}
        />
      )}

      {loading ? (
        <div className="page-loading">載入中…</div>
      ) : notices.length === 0 ? (
        <div className="empty-hint">尚無通知單</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notices.map(n => (
            <div key={n.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {n.target === 'class' ? `班級：${n.target_class}` : '全體學生'}
                    {n.published_at
                      ? ` · 已發布 ${n.published_at.slice(0, 10)}`
                      : ' · 草稿'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!n.published_at && (
                    <button type="button" className="btn" style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={() => apiCareNoticeUpdate(n.id, { publish_now: true }).then(load)}>
                      發布
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }}
                    onClick={() => startEdit(n)}>編輯</button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px', color: 'var(--danger, #ef4444)' }}
                    onClick={() => handleDelete(n.id)}>刪除</button>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NoticeForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [content, setContent] = useState(initial?.content || '')
  const [target, setTarget] = useState(initial?.target || 'all')
  const [targetClass, setTargetClass] = useState(initial?.target_class || '')
  const [publishNow, setPublishNow] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ title, content, target, target_class: targetClass, publish_now: publishNow })
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: 20, marginBottom: 20,
    }}>
      <h3 style={{ margin: '0 0 16px' }}>{initial ? '編輯通知單' : '新增通知單'}</h3>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>標題</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>內容</label>
          <textarea className="input" value={content} onChange={e => setContent(e.target.value)} required
            style={{ width: '100%', minHeight: 100, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>發送對象</label>
            <select className="input" value={target} onChange={e => setTarget(e.target.value)} style={{ width: '100%' }}>
              <option value="all">全體學生</option>
              <option value="class">指定班級</option>
            </select>
          </div>
          {target === 'class' && (
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>班級名稱</label>
              <input className="input" value={targetClass} onChange={e => setTargetClass(e.target.value)} style={{ width: '100%' }} />
            </div>
          )}
        </div>
        {!initial && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={publishNow} onChange={e => setPublishNow(e.target.checked)} />
            立即發布
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>取消</button>
          <button type="submit" className="btn" disabled={saving}>儲存</button>
        </div>
      </form>
    </div>
  )
}
