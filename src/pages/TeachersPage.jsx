import { useState, useEffect } from 'react'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { apiReorderTeachers } from '../data/api.js'

export default function TeachersPage() {
  const { state, loadTeachers, createTeacher, updateTeacher, removeTeacher } = useTeachers()
  const { teachers, loading } = state

  const [newName, setNewName]   = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [editId, setEditId]     = useState(null)
  const [editName, setEditName]   = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)

  // 拖曳排序
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [orderOverride, setOrderOverride] = useState(null)

  function startDrag(id) { setDragId(id) }
  function endDrag() { setDragId(null); setOverId(null) }

  async function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { endDrag(); return }
    const baseList = orderOverride ?? teachers
    const list = baseList.map(t => t.id)
    const fromIdx = list.indexOf(dragId)
    const toIdx   = list.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) { endDrag(); return }
    const next = list.slice()
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, dragId)
    const idMap = new Map(teachers.map(t => [t.id, t]))
    setOrderOverride(next.map(id => idMap.get(id)).filter(Boolean))
    endDrag()
    try {
      await apiReorderTeachers(next)
      await loadTeachers()
      setOrderOverride(null)
    } catch {
      setError('排序儲存失敗')
      setOrderOverride(null)
    }
  }

  const displayTeachers = orderOverride ?? teachers

  useEffect(() => { loadTeachers() }, [loadTeachers])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await createTeacher({ name, contact_phone: newPhone.trim() })
      setNewName(''); setNewPhone('')
    }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  function startEdit(t) {
    setEditId(t.id)
    setEditName(t.name)
    setEditPhone(t.contact_phone || '')
  }

  async function handleSaveEdit(id) {
    const name = editName.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await updateTeacher(id, { name, contact_phone: editPhone.trim() })
      setEditId(null)
    } catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定要刪除此老師？（連帶刪除其所有上課紀錄）')) return
    setSaving(true); setError('')
    try { await removeTeacher(id) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>老師名冊</h1>
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          className="add-input"
          placeholder="新老師姓名"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input
          className="add-input"
          placeholder="聯絡電話（選填）"
          value={newPhone}
          onChange={e => setNewPhone(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={saving || !newName.trim()}>新增老師</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : teachers.length === 0 ? (
        <div className="empty-hint">尚未新增任何老師</div>
      ) : (
        <table className="entity-table">
          <colgroup>
            <col style={{ width: 36 }} />
            <col />
            <col />
            <col style={{ width: 150 }} />
          </colgroup>
          <thead>
            <tr><th aria-label="拖曳排序"></th><th>老師姓名</th><th>聯絡電話</th><th></th></tr>
          </thead>
          <tbody>
            {displayTeachers.map(t => (
              <tr
                key={t.id}
                className={`${dragId === t.id ? 'row-dragging' : ''} ${overId === t.id ? 'row-drop-target' : ''}`}
                onDragOver={e => { if (dragId && editId === null) { e.preventDefault(); setOverId(t.id) } }}
                onDragLeave={() => { if (overId === t.id) setOverId(null) }}
                onDrop={e => { e.preventDefault(); handleDrop(t.id) }}
              >
                <td
                  className="drag-handle"
                  draggable={editId === null}
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; startDrag(t.id) }}
                  onDragEnd={endDrag}
                  title="拖曳調整順序"
                >⋮⋮</td>
                <td>
                  {editId === t.id ? (
                    <input
                      autoFocus
                      className="inline-edit-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(t.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    t.name
                  )}
                </td>
                <td>
                  {editId === t.id ? (
                    <input
                      className="inline-edit-input"
                      placeholder="聯絡電話"
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                    />
                  ) : (
                    t.contact_phone
                      ? <a href={`tel:${t.contact_phone}`}>{t.contact_phone}</a>
                      : <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </td>
                <td className="row-actions">
                  {editId === t.id ? (
                    <>
                      <button className="btn-sm btn-primary" onClick={() => handleSaveEdit(t.id)} disabled={saving}>儲存</button>
                      <button className="btn-sm" onClick={() => setEditId(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-sm" onClick={() => startEdit(t)}>編輯</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(t.id)} disabled={saving}>刪除</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
