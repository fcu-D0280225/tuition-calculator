import { useState, useEffect } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'
import EyeIcon from '../components/EyeIcon.jsx'

export default function CoursesPage() {
  const { state, loadCourses, createCourse, updateCourse, removeCourse } = useCourses()
  const { courses, loading } = state

  const [newName, setNewName]         = useState('')
  const [newRate, setNewRate]         = useState('')
  const [editId, setEditId]           = useState(null)
  const [editName, setEditName]       = useState('')
  const [editRate, setEditRate]       = useState('')
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [showAmounts, setShowAmounts] = useState(false)

  function amt(value) {
    if (!showAmounts) return '••••'
    return parseFloat(value).toLocaleString()
  }

  useEffect(() => { loadCourses() }, [loadCourses])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setError('請輸入家教課名稱'); return }
    const hourlyRate = parseFloat(newRate)
    if (isNaN(hourlyRate) || hourlyRate <= 0) { setError('請輸入時薪'); return }
    setSaving(true); setError('')
    try { await createCourse(name, hourlyRate); setNewName(''); setNewRate('') }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleUpdate(id) {
    const name = editName.trim()
    if (!name) return
    const hourly_rate = parseFloat(editRate)
    if (isNaN(hourly_rate) || hourly_rate < 0) { setError('時薪格式不正確'); return }
    setSaving(true); setError('')
    try { await updateCourse(id, { name, hourly_rate }); setEditId(null) }
    catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定要刪除此家教課？（若有上課紀錄使用此家教課，刪除將失敗）')) return
    setSaving(true); setError('')
    try { await removeCourse(id) }
    catch (e) { setError(e.message.includes('foreign key') ? '此家教課有關聯資料，無法刪除' : '刪除失敗') }
    finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>家教課目錄</h1>
        <button className="btn-sm" onClick={() => setShowAmounts(v => !v)} title={showAmounts ? '隱藏金額' : '顯示金額'}>
          <EyeIcon open={showAmounts} />{showAmounts ? '隱藏金額' : '顯示金額'}
        </button>
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          className="add-input"
          placeholder="家教課名稱（如：國中英文）"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input
          className="add-input"
          style={{ width: '120px' }}
          placeholder="時薪（元）"
          type="number"
          min="0"
          step="1"
          value={newRate}
          onChange={e => setNewRate(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={saving || !newName.trim() || !newRate.trim() || parseFloat(newRate) <= 0}>新增家教課</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : courses.length === 0 ? (
        <div className="empty-hint">尚未新增任何家教課</div>
      ) : (
        <table className="entity-table">
          <thead>
            <tr><th>家教課名稱</th><th>時薪（元/小時）</th><th></th></tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.id}>
                <td>
                  {editId === c.id ? (
                    <input
                      autoFocus
                      className="inline-edit-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    c.name
                  )}
                </td>
                <td>
                  {editId === c.id ? (
                    <input
                      className="inline-edit-input"
                      type="number"
                      min="0"
                      step="1"
                      value={editRate}
                      onChange={e => setEditRate(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    amt(c.hourly_rate)
                  )}
                </td>
                <td className="row-actions">
                  {editId === c.id ? (
                    <>
                      <button className="btn-sm btn-primary" onClick={() => handleUpdate(c.id)} disabled={saving}>儲存</button>
                      <button className="btn-sm" onClick={() => setEditId(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-sm" onClick={() => { setEditId(c.id); setEditName(c.name); setEditRate(String(c.hourly_rate)) }}>編輯</button>
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
