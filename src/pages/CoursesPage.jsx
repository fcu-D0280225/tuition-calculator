import { useState, useEffect } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import Combobox from '../components/Combobox.jsx'
import { apiReorderCourses } from '../data/api.js'

export default function CoursesPage() {
  const { state, loadCourses, createCourse, updateCourse, removeCourse } = useCourses()
  const { state: teachersState, loadTeachers } = useTeachers()
  const { courses, loading } = state
  const { teachers } = teachersState
  const activeTeachers = teachers.filter(t => t.active !== 0)

  const [newName, setNewName]                   = useState('')
  const [newRate, setNewRate]                   = useState('')
  const [newTeacherRate, setNewTeacherRate]     = useState('')
  const [newDiscountAmt, setNewDiscountAmt]     = useState('0')
  const [newDefaultTeacher, setNewDefaultTeacher] = useState('')
  const [newDurationHours, setNewDurationHours] = useState('1')
  const [editId, setEditId]                     = useState(null)
  const [editName, setEditName]                 = useState('')
  const [editRate, setEditRate]                 = useState('')
  const [editTeacherRate, setEditTeacherRate]   = useState('')
  const [editDiscountAmt, setEditDiscountAmt]   = useState('0')
  const [editDefaultTeacher, setEditDefaultTeacher] = useState('')
  const [editDurationHours, setEditDurationHours] = useState('1')
  const [error, setError]                       = useState('')
  const [saving, setSaving]                     = useState(false)

  // 拖曳排序
  const [dragId, setDragId]   = useState(null)
  const [overId, setOverId]   = useState(null)
  const [orderOverride, setOrderOverride] = useState(null) // 樂觀更新後的順序

  function startDrag(id) { setDragId(id) }
  function endDrag() { setDragId(null); setOverId(null) }

  async function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { endDrag(); return }
    const list = (orderOverride ?? courses).map(c => c.id)
    const fromIdx = list.indexOf(dragId)
    const toIdx   = list.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) { endDrag(); return }
    const next = list.slice()
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, dragId)
    // 樂觀更新顯示順序
    const idMap = new Map(courses.map(c => [c.id, c]))
    setOrderOverride(next.map(id => idMap.get(id)).filter(Boolean))
    endDrag()
    try {
      await apiReorderCourses(next)
      await loadCourses()
      setOrderOverride(null)
    } catch {
      setError('排序儲存失敗')
      setOrderOverride(null)
    }
  }

  const displayCourses = orderOverride ?? courses

  function amt(value) {
    return parseFloat(value).toLocaleString()
  }

  useEffect(() => { loadCourses(); loadTeachers() }, [loadCourses, loadTeachers])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setError('請輸入家教課名稱'); return }
    const hourlyRate = parseFloat(newRate)
    if (isNaN(hourlyRate) || hourlyRate <= 0) { setError('請輸入學費'); return }
    const teacherHourlyRate = parseFloat(newTeacherRate)
    if (isNaN(teacherHourlyRate) || teacherHourlyRate <= 0) { setError('請輸入老師時薪'); return }
    const discAmt = parseFloat(newDiscountAmt || '0')
    if (isNaN(discAmt) || discAmt < 0 || discAmt > 100000) { setError('每多一人折扣金額格式不正確'); return }
    const durationHours = parseFloat(newDurationHours || '1')
    if (isNaN(durationHours) || durationHours <= 0 || durationHours > 24) { setError('每堂時數需大於 0 且不超過 24'); return }
    setSaving(true); setError('')
    try {
      await createCourse(name, hourlyRate, teacherHourlyRate, discAmt, newDefaultTeacher || null, durationHours)
      setNewName(''); setNewRate(''); setNewTeacherRate(''); setNewDiscountAmt('0'); setNewDefaultTeacher(''); setNewDurationHours('1')
    }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleUpdate(id) {
    const name = editName.trim()
    if (!name) return
    const hourly_rate = parseFloat(editRate)
    if (isNaN(hourly_rate) || hourly_rate < 0) { setError('學費格式不正確'); return }
    const teacher_hourly_rate = parseFloat(editTeacherRate)
    if (isNaN(teacher_hourly_rate) || teacher_hourly_rate < 0) { setError('老師時薪格式不正確'); return }
    const discAmt = parseFloat(editDiscountAmt || '0')
    if (isNaN(discAmt) || discAmt < 0 || discAmt > 100000) { setError('每多一人折扣金額格式不正確'); return }
    const duration_hours = parseFloat(editDurationHours || '1')
    if (isNaN(duration_hours) || duration_hours <= 0 || duration_hours > 24) { setError('每堂時數需大於 0 且不超過 24'); return }
    setSaving(true); setError('')
    try { await updateCourse(id, { name, hourly_rate, teacher_hourly_rate, discount_per_student: discAmt, default_teacher_id: editDefaultTeacher || null, duration_hours }); setEditId(null) }
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
      </div>

      <div className="lesson-form-card">
        <div className="form-section-title">家教課目錄</div>
        <form className="lesson-form" onSubmit={handleAdd} style={{ marginBottom: '16px' }}>
          <div className="lesson-form-row">
            <label>家教課名稱
              <input
                type="text"
                placeholder="如：國中英文"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </label>
            <label>學費（元/小時）
              <input
                type="number"
                min="0"
                step="1"
                placeholder="例如 600"
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
              />
            </label>
            <label>老師時薪（元/小時）
              <input
                type="number"
                min="0"
                step="1"
                placeholder="例如 400"
                value={newTeacherRate}
                onChange={e => setNewTeacherRate(e.target.value)}
              />
            </label>
            <label title="N 人時學費 = 學費 − 此金額 × (N-1)。0 = 不打折">每多一人 −（元）
              <input
                type="number"
                min="0"
                step="1"
                placeholder="例如 100"
                value={newDiscountAmt}
                onChange={e => setNewDiscountAmt(e.target.value)}
              />
            </label>
            <label title="每堂課的預設時數，學生選課建立上課紀錄時會帶入">每堂時數
              <input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="例如 1"
                value={newDurationHours}
                onChange={e => setNewDurationHours(e.target.value)}
              />
            </label>
            <label>預設老師
              <Combobox
                items={activeTeachers}
                value={newDefaultTeacher}
                onChange={setNewDefaultTeacher}
                placeholder="（選填）"
                allLabel="（無預設）"
              />
            </label>
          </div>
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
        <table className="entity-table courses-table">
          <colgroup>
            <col style={{ width: 36 }} />
            <col />
            <col style={{ width: 100 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 150 }} />
          </colgroup>
          <thead>
            <tr><th aria-label="拖曳排序"></th><th>家教課名稱</th><th>學費</th><th>老師時薪</th><th>每多一人 −</th><th>每堂時數</th><th>預設老師</th><th></th></tr>
          </thead>
          <tbody>
            {displayCourses.map(c => (
              <tr
                key={c.id}
                className={`${dragId === c.id ? 'row-dragging' : ''} ${overId === c.id ? 'row-drop-target' : ''}`}
                onDragOver={e => { if (dragId && editId === null) { e.preventDefault(); setOverId(c.id) } }}
                onDragLeave={() => { if (overId === c.id) setOverId(null) }}
                onDrop={e => { e.preventDefault(); handleDrop(c.id) }}
              >
                <td
                  className="drag-handle"
                  draggable={editId === null}
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; startDrag(c.id) }}
                  onDragEnd={endDrag}
                  title="拖曳調整順序"
                >⋮⋮</td>
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
                      min="0"
                      step="1"
                      value={editDiscountAmt}
                      onChange={e => setEditDiscountAmt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    c.discount_per_student && parseFloat(c.discount_per_student) > 0
                      ? `−${parseFloat(c.discount_per_student).toLocaleString()}`
                      : '—'
                  )}
                </td>
                <td>
                  {editId === c.id ? (
                    <input
                      className="inline-edit-input"
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={editDurationHours}
                      onChange={e => setEditDurationHours(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    `${parseFloat(c.duration_hours ?? 1)} 小時`
                  )}
                </td>
                <td>
                  {editId === c.id ? (
                    <div className="combobox-cell">
                      <Combobox
                        items={activeTeachers}
                        value={editDefaultTeacher}
                        onChange={setEditDefaultTeacher}
                        placeholder="（無）"
                        allLabel="（無）"
                      />
                    </div>
                  ) : (
                    teachers.find(t => t.id === c.default_teacher_id)?.name || '—'
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
                        setEditDiscountAmt(c.discount_per_student != null ? String(parseFloat(c.discount_per_student)) : '0')
                        setEditDefaultTeacher(c.default_teacher_id || '')
                        setEditDurationHours(c.duration_hours != null ? String(parseFloat(c.duration_hours)) : '1')
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
