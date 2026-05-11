import { useMemo, useState, useEffect } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import Combobox from '../components/Combobox.jsx'

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
  // 列表只顯示至關欄位；其他欄位（學費／老師時薪／每多一人折扣／備註）改在獨立的編輯頁修改
  const [error, setError]                       = useState('')
  const [saving, setSaving]                     = useState(false)

  // 名稱排序：null 維持後端順序，'asc' 升冪，'desc' 降冪
  const [nameSort, setNameSort] = useState(null)
  function toggleNameSort() {
    setNameSort(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')
  }
  const displayCourses = useMemo(() => {
    if (!nameSort) return courses
    const cmp = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant')
    return [...courses].sort(nameSort === 'asc' ? cmp : (a, b) => cmp(b, a))
  }, [courses, nameSort])

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
    setSaving(true); setError('')
    try {
      // 老師時薪 / 每多一人折扣 / 備註 改在獨立的編輯頁設定；時數於排課與上課紀錄時逐筆輸入
      await createCourse(name, hourlyRate, 0, 0, newDefaultTeacher || null, 1, '')
      setNewName(''); setNewRate(''); setNewDefaultTeacher('')
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
          <div className="page-header-body">
            <h1>家教課目錄</h1>
            <p className="page-desc">建立與管理家教課程，設定單價與授課老師</p>
          </div>
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
            <col />
            {canViewRates && <col style={{ width: 100 }} />}
            <col style={{ width: 160 }} />
            <col style={{ width: 130 }} />
          </colgroup>
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="th-sort-btn"
                  onClick={toggleNameSort}
                  aria-label={`家教課名稱（${nameSort === 'asc' ? '升冪' : nameSort === 'desc' ? '降冪' : '預設順序'}，點擊切換）`}
                  title="點擊切換排序"
                >
                  家教課名稱
                  <span className="th-sort-icon" aria-hidden="true">
                    {nameSort === 'asc' ? '▲' : nameSort === 'desc' ? '▼' : '⇅'}
                  </span>
                </button>
              </th>
              {canViewRates && <th>學費</th>}
              <th>預設老師</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayCourses.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                {canViewRates && <td>{amt(c.hourly_rate)}</td>}
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
