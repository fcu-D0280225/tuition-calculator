import { useEffect, useMemo, useState } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { apiCreateLesson, apiGetStudentEnrollment } from '../data/api.js'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n) { return String(n).padStart(2, '0') }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function StudentEnrollPage({ studentId, studentName, onBack }) {
  const { state: coursesState, loadCourses } = useCourses()
  const { state: teachersState, loadTeachers } = useTeachers()

  const [step, setStep] = useState('pick-course') // 'pick-course' | 'pick-dates'
  const [courseId, setCourseId] = useState(null)
  const [selectedDates, setSelectedDates] = useState(new Set())
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(null) // null=載入中, Set=已載入

  useEffect(() => { loadCourses(); loadTeachers() }, [loadCourses, loadTeachers])

  useEffect(() => {
    let cancelled = false
    apiGetStudentEnrollment(studentId)
      .then(data => { if (!cancelled) setEnrolledCourseIds(new Set(data.course_ids || [])) })
      .catch(() => { if (!cancelled) setEnrolledCourseIds(new Set()) })
    return () => { cancelled = true }
  }, [studentId])

  const course = useMemo(
    () => coursesState.courses.find(c => c.id === courseId),
    [coursesState.courses, courseId]
  )
  const defaultTeacher = useMemo(() => {
    if (!course?.default_teacher_id) return null
    return teachersState.teachers.find(t => t.id === course.default_teacher_id) || null
  }, [course, teachersState.teachers])

  function teacherName(id) {
    return teachersState.teachers.find(t => t.id === id)?.name || ''
  }
  function courseLabel(c) {
    const tName = c.default_teacher_id ? teacherName(c.default_teacher_id) : ''
    return tName ? `${c.name} - ${tName}` : c.name
  }

  function pickCourse(cid) {
    setCourseId(cid)
    setSelectedDates(new Set())
    setDone(null)
    setError('')
    setStep('pick-dates')
  }

  function backToCourseList() {
    setStep('pick-course')
    setCourseId(null)
    setSelectedDates(new Set())
    setDone(null)
    setError('')
  }

  function toggleDate(dateStr) {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr)
      return next
    })
  }

  function shiftMonth(delta) {
    setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  // 6×7 月曆網格，週日起算
  const calendarDays = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const startWeekday = first.getDay() // 0=Sun
    const start = new Date(first)
    start.setDate(first.getDate() - startWeekday)
    const days = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return days
  }, [viewMonth])

  const today = new Date()

  async function handleSubmit() {
    if (!course) return
    if (!course.default_teacher_id) {
      setError('該課程未設定預設老師，請先到「家教課」頁設定後再回來')
      return
    }
    if (selectedDates.size === 0) {
      setError('請至少選一個日期')
      return
    }
    setSaving(true); setError(''); setDone(null)
    const dates = Array.from(selectedDates).sort()
    const failures = []
    for (const d of dates) {
      try {
        await apiCreateLesson({
          student_id: studentId,
          course_id: course.id,
          teacher_id: course.default_teacher_id,
          hours: 1,
          lesson_date: d,
          start_time: null,
          unit_price: null,
          teacher_unit_price: null,
          note: '',
        })
      } catch (e) {
        failures.push(`${d}：${e?.message || '建立失敗'}`)
      }
    }
    setSaving(false)
    setDone({ total: dates.length, failed: failures.length, failures })
    if (failures.length === 0) setSelectedDates(new Set())
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn-sm" onClick={onBack}>← 返回學生名冊</button>
        <h1 style={{ margin: 0 }}>{studentName}・選課</h1>
      </div>

      {step === 'pick-course' && (
        <div className="enroll-step">
          <div className="form-section-title">第 1 步：選擇要排課的家教課</div>
          {coursesState.loading ? (
            <div className="loading">載入中⋯</div>
          ) : coursesState.courses.length === 0 ? (
            <div className="empty-hint">尚無家教課可選，請先到「家教課」頁新增</div>
          ) : (
            <div className="course-pick-grid">
              {coursesState.courses.map(c => {
                const alreadyPicked = enrolledCourseIds?.has(c.id)
                return (
                  <button
                    type="button"
                    key={c.id}
                    className={`course-pick-card${alreadyPicked ? ' course-pick-card--picked' : ''}`}
                    onClick={() => pickCourse(c.id)}
                  >
                    <div className="course-pick-name">
                      {c.name}
                      {alreadyPicked && <span className="course-pick-badge">已選過</span>}
                    </div>
                    <div className="course-pick-meta">
                      {c.default_teacher_id
                        ? <>預設老師：{teacherName(c.default_teacher_id) || '—'}</>
                        : <span style={{ color: 'var(--danger, #c00)' }}>尚未設定預設老師</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {step === 'pick-dates' && course && (
        <div className="enroll-step">
          <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="btn-sm" onClick={backToCourseList}>← 重新選課程</button>
            <span>第 2 步：在月曆上勾選上課日期</span>
          </div>

          <div className="enroll-summary">
            <div><strong>課程：</strong>{courseLabel(course)}</div>
            <div>
              <strong>老師：</strong>
              {defaultTeacher
                ? defaultTeacher.name
                : <span style={{ color: 'var(--danger, #c00)' }}>未設定（請先到家教課頁補上預設老師）</span>}
            </div>
            <div><strong>每筆時數：</strong>1 小時</div>
          </div>

          <div className="calendar-toolbar">
            <button type="button" className="btn-sm" onClick={() => shiftMonth(-1)} disabled={saving}>‹ 上個月</button>
            <span className="calendar-month-label">
              {viewMonth.getFullYear()} 年 {viewMonth.getMonth() + 1} 月
            </span>
            <button type="button" className="btn-sm" onClick={() => shiftMonth(1)} disabled={saving}>下個月 ›</button>
          </div>

          <div className="calendar-grid">
            {WEEKDAYS.map(w => (
              <div className="calendar-head" key={w}>{w}</div>
            ))}
            {calendarDays.map((d, idx) => {
              const dateStr = fmtDate(d)
              const inMonth = d.getMonth() === viewMonth.getMonth()
              const isToday = isSameDay(d, today)
              const picked  = selectedDates.has(dateStr)
              return (
                <button
                  type="button"
                  key={idx}
                  className={`calendar-cell${inMonth ? '' : ' calendar-cell--out'}${picked ? ' calendar-cell--picked' : ''}${isToday ? ' calendar-cell--today' : ''}`}
                  onClick={() => toggleDate(dateStr)}
                  disabled={saving}
                  title={dateStr}
                >
                  <span className="calendar-day-num">{d.getDate()}</span>
                </button>
              )
            })}
          </div>

          {selectedDates.size > 0 && (
            <div className="enroll-selected">
              已選 {selectedDates.size} 個日期：
              <div className="chip-list" style={{ marginTop: 6 }}>
                {Array.from(selectedDates).sort().map(d => (
                  <span className="chip" key={d}>
                    {d}
                    <button type="button" className="chip-remove" onClick={() => toggleDate(d)} aria-label="移除">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

          {done && (
            <div className={done.failed ? 'error-msg' : 'success-msg'} style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
              {done.failed === 0
                ? `已建立 ${done.total} 筆上課紀錄`
                : `建立完成：${done.total - done.failed} 筆成功、${done.failed} 筆失敗\n${done.failures.join('\n')}`}
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button type="button" onClick={onBack} disabled={saving}>完成</button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={saving || selectedDates.size === 0 || !course.default_teacher_id}
            >
              {saving ? '建立中⋯' : `建立 ${selectedDates.size} 筆上課紀錄`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
