import { useEffect, useMemo, useState } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import Combobox from '../components/Combobox.jsx'

export default function CourseDetailPage({ courseId, onBack }) {
  const { state, loadCourses, updateCourse, removeCourse } = useCourses()
  const { state: teachersState, loadTeachers } = useTeachers()
  const { canViewRates, canManageCourses } = useAuth()

  const course = useMemo(
    () => state.courses.find(c => c.id === courseId),
    [state.courses, courseId]
  )

  const [name, setName]                     = useState('')
  const [hourlyRate, setHourlyRate]         = useState('')
  const [teacherHourlyRate, setTeacherHourlyRate] = useState('')
  const [discountAmt, setDiscountAmt]       = useState('0')
  const [defaultTeacher, setDefaultTeacher] = useState('')
  const [durationHours, setDurationHours]   = useState('1')
  const [note, setNote]                     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState('')

  useEffect(() => { loadCourses(); loadTeachers() }, [loadCourses, loadTeachers])

  // 載入後同步表單
  useEffect(() => {
    if (!course) return
    setName(course.name || '')
    setHourlyRate(String(course.hourly_rate ?? ''))
    setTeacherHourlyRate(String(course.teacher_hourly_rate ?? 0))
    setDiscountAmt(course.discount_per_student != null ? String(parseFloat(course.discount_per_student)) : '0')
    setDefaultTeacher(course.default_teacher_id || '')
    setDurationHours(course.duration_hours != null ? String(parseFloat(course.duration_hours)) : '1')
    setNote(course.note || '')
  }, [course])

  const activeTeachers = teachersState.teachers.filter(t => t.active !== 0)

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) { setError('請輸入家教課名稱'); return }
    const hr = parseFloat(hourlyRate)
    if (canViewRates && (isNaN(hr) || hr < 0)) { setError('學費格式不正確'); return }
    const thr = parseFloat(teacherHourlyRate)
    if (canViewRates && (isNaN(thr) || thr < 0)) { setError('老師時薪格式不正確'); return }
    const da = parseFloat(discountAmt || '0')
    if (canViewRates && (isNaN(da) || da < 0 || da > 100000)) { setError('每多一人折扣格式不正確'); return }
    const dh = parseFloat(durationHours || '1')
    if (isNaN(dh) || dh <= 0 || dh > 24) { setError('每堂時數需大於 0 且不超過 24'); return }
    setSaving(true); setError(''); setDone('')
    try {
      const patch = {
        name: trimmedName,
        default_teacher_id: defaultTeacher || null,
        duration_hours: dh,
        note,
      }
      if (canViewRates) {
        patch.hourly_rate = hr
        patch.teacher_hourly_rate = thr
        patch.discount_per_student = da
      }
      await updateCourse(courseId, patch)
      setDone('已儲存')
    } catch { setError('儲存失敗') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!course) return
    if (!window.confirm(`確定要刪除「${course.name}」？（若有上課紀錄使用此家教課，刪除將失敗）`)) return
    setSaving(true); setError('')
    try {
      await removeCourse(courseId)
      onBack?.()
    } catch (e) {
      setError(e?.message?.includes('foreign key') ? '此家教課有關聯資料，無法刪除' : '刪除失敗')
      setSaving(false)
    }
  }

  if (!canManageCourses) {
    return (
      <div className="page">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn-sm" onClick={onBack}>← 返回家教課</button>
          <h1 style={{ margin: 0 }}>家教課編輯</h1>
        </div>
        <div className="empty-hint">沒有編輯家教課的權限。</div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="page">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn-sm" onClick={onBack}>← 返回家教課</button>
          <h1 style={{ margin: 0 }}>家教課編輯</h1>
        </div>
        <div className="empty-hint">找不到此家教課（可能已被刪除）。</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn-sm" onClick={onBack}>← 返回家教課</button>
        <h1 style={{ margin: 0 }}>編輯家教課・{course.name}</h1>
      </div>

      <div className="lesson-form-card">
        <form className="lesson-form" onSubmit={e => { e.preventDefault(); handleSave() }}>
          <div className="lesson-form-row">
            <label>家教課名稱
              <input type="text" value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label>每堂時數
              <input type="number" min="0.5" step="0.5" value={durationHours}
                onChange={e => setDurationHours(e.target.value)} />
            </label>
            <label>預設老師
              <Combobox
                items={activeTeachers}
                value={defaultTeacher}
                onChange={setDefaultTeacher}
                placeholder="（選填）"
                allLabel="（無預設）"
              />
            </label>
          </div>

          {canViewRates && (
            <div className="lesson-form-row">
              <label>學費（元/小時）
                <input type="number" min="0" step="1" value={hourlyRate}
                  onChange={e => setHourlyRate(e.target.value)} />
              </label>
              <label>老師時薪（元/小時）
                <input type="number" min="0" step="1" value={teacherHourlyRate}
                  onChange={e => setTeacherHourlyRate(e.target.value)} />
              </label>
              <label title="N 人時學費 = 學費 − 此金額 × (N-1)。0 = 不打折">每多一人 −（元）
                <input type="number" min="0" step="1" value={discountAmt}
                  onChange={e => setDiscountAmt(e.target.value)} />
              </label>
            </div>
          )}

          <div className="lesson-form-row">
            <label style={{ flex: 1, minWidth: 240 }}>備註
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="note-input"
                style={{ width: '100%' }}
              />
            </label>
          </div>

          {error && <div className="error-msg">{error}</div>}
          {done  && <div className="success-msg">{done}</div>}

          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={onBack} disabled={saving}>取消</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '儲存中⋯' : '儲存'}
            </button>
            <button
              type="button"
              className="btn-sm btn-danger"
              onClick={handleDelete}
              disabled={saving}
              style={{ marginLeft: 'auto' }}
            >刪除此家教課</button>
          </div>
        </form>
      </div>
    </div>
  )
}
