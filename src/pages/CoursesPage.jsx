import { useState, useEffect } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'

export default function CoursesPage() {
  const { state, loadCourses, createCourse, renameCourse, removeCourse } = useCourses()
  const { courses, loading } = state

  const [newName, setNewName]     = useState('')
  const [editId, setEditId]       = useState(null)
  const [editVal, setEditVal]     = useState('')
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => { loadCourses() }, [loadCourses])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true); setError('')
    try { await createCourse(name); setNewName('') }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleRename(id) {
    const name = editVal.trim()
    if (!name) return
    setSaving(true); setError('')
    try { await renameCourse(id, name); setEditId(null) }
    catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定要刪除此課程？（若有上課紀錄使用此課程，刪除將失敗）')) return
    setSaving(true); setError('')
    try { await removeCourse(id) }
    catch (e) { setError(e.message.includes('foreign key') ? '此課程有關聯資料，無法刪除' : '刪除失敗') }
    finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>課程目錄</h1>
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          className="add-input"
          placeholder="新課程名稱（如：國中英文）"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={saving || !newName.trim()}>新增課程</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : courses.length === 0 ? (
        <div className="empty-hint">尚未新增任何課程</div>
      ) : (
        <table className="entity-table">
          <thead>
            <tr><th>課程名稱</th><th></th></tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.id}>
                <td>
                  {editId === c.id ? (
                    <input
                      autoFocus
                      className="inline-edit-input"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    c.name
                  )}
                </td>
                <td className="row-actions">
                  {editId === c.id ? (
                    <>
                      <button className="btn-sm btn-primary" onClick={() => handleRename(c.id)} disabled={saving}>儲存</button>
                      <button className="btn-sm" onClick={() => setEditId(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-sm" onClick={() => { setEditId(c.id); setEditVal(c.name) }}>改名</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(c.id)} disabled={saving}>刪除</button>
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
