import { useState, useEffect } from 'react'
import { useStudents } from '../contexts/StudentsContext.jsx'

export default function StudentsPage() {
  const { state, loadStudents, createStudent, renameStudent, removeStudent } = useStudents()
  const { students, loading } = state

  const [newName, setNewName]   = useState('')
  const [editId, setEditId]     = useState(null)
  const [editVal, setEditVal]   = useState('')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => { loadStudents() }, [loadStudents])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true); setError('')
    try { await createStudent(name); setNewName('') }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleRename(id) {
    const name = editVal.trim()
    if (!name) return
    setSaving(true); setError('')
    try { await renameStudent(id, name); setEditId(null) }
    catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定要刪除此學生？（連帶刪除其所有上課紀錄）')) return
    setSaving(true); setError('')
    try { await removeStudent(id) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>學生名冊</h1>
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          className="add-input"
          placeholder="新學生姓名"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={saving || !newName.trim()}>新增學生</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : students.length === 0 ? (
        <div className="empty-hint">尚未新增任何學生</div>
      ) : (
        <table className="entity-table">
          <thead>
            <tr><th>學生姓名</th><th></th></tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id}>
                <td>
                  {editId === s.id ? (
                    <input
                      autoFocus
                      className="inline-edit-input"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(s.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    s.name
                  )}
                </td>
                <td className="row-actions">
                  {editId === s.id ? (
                    <>
                      <button className="btn-sm btn-primary" onClick={() => handleRename(s.id)} disabled={saving}>儲存</button>
                      <button className="btn-sm" onClick={() => setEditId(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-sm" onClick={() => { setEditId(s.id); setEditVal(s.name) }}>改名</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(s.id)} disabled={saving}>刪除</button>
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
