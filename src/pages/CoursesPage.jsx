import { useState, useEffect } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'
import EyeIcon from '../components/EyeIcon.jsx'

export default function CoursesPage() {
  const { state, loadCourses, createCourse, updateCourse, removeCourse } = useCourses()
  const { courses, loading } = state

  const [newName, setNewName]                   = useState('')
  const [newRate, setNewRate]                   = useState('')
  const [newTeacherRate, setNewTeacherRate]     = useState('')
  const [newDiscountPct, setNewDiscountPct]     = useState('100')
  const [editId, setEditId]                     = useState(null)
  const [editName, setEditName]                 = useState('')
  const [editRate, setEditRate]                 = useState('')
  const [editTeacherRate, setEditTeacherRate]   = useState('')
  const [editDiscountPct, setEditDiscountPct]   = useState('100')
  const [error, setError]                       = useState('')
  const [saving, setSaving]                     = useState(false)
  const [showAmounts, setShowAmounts]           = useState(false)

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
    if (isNaN(hourlyRate) || hourlyRate <= 0) { setError('請輸入學生時薪'); return }
    const teacherHourlyRate = parseFloat(newTeacherRate)
    if (isNaN(teacherHourlyRate) || teacherHourlyRate <= 0) { setError('請輸入老師時薪'); return }
    const pct = parseFloat(newDiscountPct)
    if (isNaN(pct) || pct <= 0 || pct > 500) { setError('遞減百分比格式不正確（0–500）'); return }
    setSaving(true); setError('')
    try {
      await createCourse(name, hourlyRate, teacherHourlyRate, pct / 100)
      setNewName(''); setNewRate(''); setNewTeacherRate(''); setNewDiscountPct('100')
    }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleUpdate(id) {
    const name = editName.trim()
    if (!name) return
    const hourly_rate = parseFloat(editRate)
    if (isNaN(hourly_rate) || hourly_rate < 0) { setError('學生時薪格式不正確'); return }
    const teacher_hourly_rate = parseFloat(editTeacherRate)
    if (isNaN(teacher_hourly_rate) || teacher_hourly_rate < 0) { setError('老師時薪格式不正確'); return }
    const pct = parseFloat(editDiscountPct)
    if (isNaN(pct) || pct <= 0 || pct > 500) { setError('遞減百分比格式不正確（0–500）'); return }
    setSaving(true); setError('')
    try { await updateCourse(id, { name, hourly_rate, teacher_hourly_rate, discount_multiplier: pct / 100 }); setEditId(null) }
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

      <div className="lesson-form-card">
        <div className="form-section-title">家教課目錄</div>
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
            placeholder="學生時薪"
            type="number"
            min="0"
            step="1"
            value={newRate}
            onChange={e => setNewRate(e.target.value)}
          />
          <input
            className="add-input"
            style={{ width: '120px' }}
            placeholder="老師時薪"
            type="number"
            min="0"
            step="1"
            value={newTeacherRate}
            onChange={e => setNewTeacherRate(e.target.value)}
          />
          <span className="input-with-suffix" title="N 人時學生時薪 = 預設時薪 × (此百分比 ÷ 100)^(N-1)。100 = 不打折">
            <input
              className="add-input"
              style={{ width: '180px' }}
              placeholder="每多一人乘 (例如 90)"
              type="number"
              min="1"
              max="200"
              step="1"
              value={newDiscountPct}
              onChange={e => setNewDiscountPct(e.target.value)}
            />
            <span className="input-suffix">%</span>
          </span>
          <button
            className="btn-primary"
            type="submit"
            disabled={
              saving
              || !newName.trim()
              || !newRate.trim() || parseFloat(newRate) <= 0
              || !newTeacherRate.trim() || parseFloat(newTeacherRate) <= 0
            }
          >新增家教課</button>
        </form>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : courses.length === 0 ? (
        <div className="empty-hint">尚未新增任何家教課</div>
      ) : (
        <table className="entity-table">
          <thead>
            <tr><th>家教課名稱</th><th>學生時薪</th><th>老師時薪</th><th>每多一人 ×</th><th></th></tr>
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
                <td>
                  {editId === c.id ? (
                    <input
                      className="inline-edit-input"
                      type="number"
                      min="0"
                      step="1"
                      value={editTeacherRate}
                      onChange={e => setEditTeacherRate(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    amt(c.teacher_hourly_rate ?? 0)
                  )}
                </td>
                <td>
                  {editId === c.id ? (
                    <input
                      className="inline-edit-input"
                      type="number"
                      min="1"
                      max="200"
                      step="1"
                      value={editDiscountPct}
                      onChange={e => setEditDiscountPct(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    c.discount_multiplier && parseFloat(c.discount_multiplier) !== 1
                      ? `${Math.round(parseFloat(c.discount_multiplier) * 10000) / 100}%`
                      : '—'
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
                      <button className="btn-sm" onClick={() => {
                        setEditId(c.id)
                        setEditName(c.name)
                        setEditRate(String(c.hourly_rate))
                        setEditTeacherRate(String(c.teacher_hourly_rate ?? 0))
                        setEditDiscountPct(c.discount_multiplier != null ? String(Math.round(parseFloat(c.discount_multiplier) * 10000) / 100) : '100')
                      }}>編輯</button>
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
