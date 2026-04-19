import { useState, useEffect } from 'react'
import { useTeachers } from '../contexts/TeachersContext.jsx'

export default function TeachersPage() {
  const { state, loadTeachers, createTeacher, renameTeacher, removeTeacher } = useTeachers()
  const { teachers, loading } = state

  const [newName, setNewName]   = useState('')
  const [editId, setEditId]     = useState(null)
  const [editVal, setEditVal]   = useState('')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => { loadTeachers() }, [loadTeachers])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true); setError('')
    try { await createTeacher(name); setNewName('') }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleRename(id) {
    const name = editVal.trim()
    if (!name) return
    setSaving(true); setError('')
    try { await renameTeacher(id, name); setEditId(null) }
    catch { setError('更新失敗') }
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
        <button className="btn-primary" type="submit" disabled={saving || !newName.trim()}>新增老師</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : teachers.length === 0 ? (
        <div className="empty-hint">尚未新增任何老師</div>
      ) : (
        <table className="entity-table">
          <thead>
            <tr><th>老師姓名</th><th></th></tr>
          </thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.id}>
                <td>
                  {editId === t.id ? (
                    <input
                      autoFocus
                      className="inline-edit-input"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(t.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    t.name
                  )}
                </td>
                <td className="row-actions">
                  {editId === t.id ? (
                    <>
                      <button className="btn-sm btn-primary" onClick={() => handleRename(t.id)} disabled={saving}>儲存</button>
                      <button className="btn-sm" onClick={() => setEditId(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-sm" onClick={() => { setEditId(t.id); setEditVal(t.name) }}>改名</button>
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
