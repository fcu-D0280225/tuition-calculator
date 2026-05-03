import { useState, useEffect } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import Combobox from '../components/Combobox.jsx'
import { apiReorderCourses } from '../data/api.js'

export default function CoursesPage({ onEditCourse }) {
  const { state, loadCourses, createCourse, removeCourse } = useCourses()
  const { state: teachersState, loadTeachers } = useTeachers()
  const { canViewRates, canManageCourses } = useAuth()
  const { courses, loading } = state
  const { teachers } = teachersState
  const activeTeachers = teachers.filter(t => t.active !== 0)

  const [newName, setNewName]                   = useState('')
  const [newRate, setNewRate]                   = useState('')
  const [newDefaultTeacher, setNewDefaultTeacher] = useState('')
  const [newDurationHours, setNewDurationHours] = useState('1')
  // 列表只顯示至關欄位；其他欄位（學費／老師時薪／每多一人折扣／備註）改在獨立的編輯頁修改
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
    const hourlyRate = canViewRates ? parseFloat(newRate) : 0
    if (canViewRates && (isNaN(hourlyRate) || hourlyRate <= 0)) { setError('請輸入學費'); return }
    const durationHours = parseFloat(newDurationHours || '1')
    if (isNaN(durationHours) || durationHours <= 0 || durationHours > 24) { setError('每堂時數需大於 0 且不超過 24'); return }
    setSaving(true); setError('')
    try {
      // 老師時薪 / 每多一人折扣 / 備註 改在獨立的編輯頁設定
      await createCourse(name, hourlyRate, 0, 0, newDefaultTeacher || null, durationHours, '')
      setNewName(''); setNewRate(''); setNewDefaultTeacher(''); setNewDurationHours('1')
    }
    catch { setError('新增失敗') }
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

      {canManageCourses && (
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
            {canViewRates && (
              <>
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
              </>
            )}
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
              || (canViewRates && (!newRate.trim() || parseFloat(newRate) <= 0))
            }
          >新增家教課</button>
        </form>
      </div>
      )}

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
            {canViewRates && <col style={{ width: 100 }} />}
            <col style={{ width: 100 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 130 }} />
          </colgroup>
          <thead>
            <tr>
              <th aria-label="拖曳排序"></th>
              <th>家教課名稱</th>
              {canViewRates && <th>學費</th>}
              <th>每堂時數</th>
              <th>預設老師</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayCourses.map(c => (
              <tr
                key={c.id}
                className={`${dragId === c.id ? 'row-dragging' : ''} ${overId === c.id ? 'row-drop-target' : ''}`}
                onDragOver={e => { if (dragId) { e.preventDefault(); setOverId(c.id) } }}
                onDragLeave={() => { if (overId === c.id) setOverId(null) }}
                onDrop={e => { e.preventDefault(); handleDrop(c.id) }}
              >
                <td
                  className="drag-handle"
                  draggable
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; startDrag(c.id) }}
                  onDragEnd={endDrag}
                  title="拖曳調整順序"
                >⋮⋮</td>
                <td>{c.name}</td>
                {canViewRates && <td>{amt(c.hourly_rate)}</td>}
                <td>{`${parseFloat(c.duration_hours ?? 1)} 小時`}</td>
                <td>{teachers.find(t => t.id === c.default_teacher_id)?.name || '—'}</td>
                <td className="row-actions">
                  {canManageCourses ? (
                    <>
                      <button
                        className="btn-sm"
                        onClick={() => onEditCourse?.(c)}
                      >編輯</button>
                      <button
                        className="btn-sm btn-danger"
                        onClick={() => handleDelete(c.id)}
                        disabled={saving}
                      >刪除</button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
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
