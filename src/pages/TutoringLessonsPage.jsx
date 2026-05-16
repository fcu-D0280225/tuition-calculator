import { Fragment, useMemo, useState, useEffect } from 'react'
import { useLessons } from '../contexts/LessonsContext.jsx'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import Combobox from '../components/Combobox.jsx'
import { useDirtyTracker } from '../contexts/UnsavedContext.jsx'
import { apiListAllEnrollments, apiCreateLeaveRequest, apiDeleteLeaveRequest } from '../data/api.js'

const AVATAR_COLORS = ['', 'green', 'purple', 'orange', 'teal', 'pink']
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

const STATUS_OPTIONS = [
  { value: 'attended',    label: '已點名',   cls: 'status-attended' },
  { value: 'pending',     label: '未點名',   cls: 'status-pending' },
  { value: 'pre_enroll',  label: '尚未開始', cls: 'status-pre' },
  { value: 'leave',       label: '請假',     cls: 'status-leave' },
  { value: 'rescheduled', label: '改課',     cls: 'status-rescheduled' },
  { value: 'makeup',      label: '補課',     cls: 'status-makeup' },
]

function getDisplayStatus(record) {
  const status = record.status || 'attended'
  if (record.is_on_leave || status === 'leave') return 'leave'
  return status
}

function LessonStatus({ record }) {
  const s = getDisplayStatus(record)
  const map = {
    leave:       { label: '請假',           cls: 'status-leave' },
    pre_enroll:  { label: '尚未開始',       cls: 'status-pre' },
    pending:     { label: '未點名',         cls: 'status-pending' },
    attended:    { label: '已點名',         cls: 'status-attended' },
    rescheduled: { label: '改課（不計費）', cls: 'status-rescheduled' },
    makeup:      { label: '補課',           cls: 'status-makeup' },
  }
  const { label, cls } = map[s] || map.attended
  return <span className={`status-tag ${cls}`} title={record.leave_reason || ''}>{label}</span>
}

const EMPTY_FORM = { student_id: '', course_id: '', teacher_id: '', hours: '1', lesson_dates: [], start_time: '', note: '' }

export default function TutoringLessonsPage() {
  const { state: lessonState, loadLessons, createLesson, updateLesson, removeLesson } = useLessons()
  const { state: studentState, loadStudents } = useStudents()
  const { state: teacherState, loadTeachers } = useTeachers()
  const { state: courseState, loadCourses }   = useCourses()

  const [form, setForm]           = useState(EMPTY_FORM)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [editForm, setEditForm]   = useState(null)
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  const [filterFrom, setFilterFrom]       = useState('')
  const [filterTo, setFilterTo]           = useState('')
  const [filterStudent, setFilterStudent] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')
  const [filterCourse, setFilterCourse]   = useState('')
  const [filterStatuses, setFilterStatuses] = useState(() => new Set())

  const [studentCourseMap, setStudentCourseMap] = useState({})

  useEffect(() => {
    loadStudents(); loadTeachers(); loadCourses(); loadLessons({})
    apiListAllEnrollments().then(({ courses }) => {
      const sc = {}
      for (const r of courses) {
        if (!sc[r.student_id]) sc[r.student_id] = new Set()
        sc[r.student_id].add(r.course_id)
      }
      setStudentCourseMap(sc)
    }).catch(() => {})
  }, [loadStudents, loadTeachers, loadCourses, loadLessons])

  useDirtyTracker(
    'lessons_tutoring:add',
    !!(form.student_id || form.course_id || form.teacher_id || (form.hours && form.hours !== '1') || form.start_time || form.note)
  )

  function handleFilter(e) {
    e.preventDefault()
    loadLessons({
      from: filterFrom || undefined,
      to: filterTo || undefined,
      student_id: filterStudent || undefined,
      teacher_id: filterTeacher || undefined,
      course_id: filterCourse || undefined,
    })
  }
  function resetFilter() {
    setFilterFrom(''); setFilterTo(''); setFilterStudent(''); setFilterTeacher(''); setFilterCourse('')
    setFilterStatuses(new Set())
    loadLessons({})
  }
  function toggleStatusFilter(value) {
    setFilterStatuses(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    const hours = parseFloat(form.hours)
    if (!form.student_id || !form.course_id) { setError('請選擇學生和課程'); return }
    if (isNaN(hours) || hours <= 0) { setError('請輸入有效時數'); return }
    const dates = (form.lesson_dates || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    if (dates.length === 0) { setError('請選擇至少一個上課日期'); return }
    setSaving(true); setError('')
    const failures = []
    let skipped = 0
    try {
      for (const d of dates) {
        try {
          await createLesson({
            student_id: form.student_id,
            course_id:  form.course_id,
            teacher_id: form.teacher_id || null,
            hours,
            lesson_date: d,
            start_time: form.start_time || null,
            unit_price: null,
            teacher_unit_price: null,
            note: form.note || '',
          })
        } catch (e) {
          if (e?.skipped) skipped++
          else failures.push(`${d}：${e?.message || e}`)
        }
      }
      await loadLessons({})
      setForm({ ...EMPTY_FORM, lesson_dates: form.lesson_dates, start_time: form.start_time })
      const parts = []
      if (failures.length) parts.push(`部分日期建立失敗：\n${failures.join('\n')}`)
      if (skipped) parts.push(`${skipped} 筆因重複略過`)
      if (parts.length) setError(parts.join('\n'))
    } catch (e) { setError(`新增失敗：${e?.message || e}`) }
    finally { setSaving(false) }
  }

  function addDate(d) {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return
    setForm(f => f.lesson_dates.includes(d) ? f : { ...f, lesson_dates: [...f.lesson_dates, d].sort() })
  }
  function removeDate(d) {
    setForm(f => ({ ...f, lesson_dates: f.lesson_dates.filter(x => x !== d) }))
  }

  async function handleSaveEdit(id) {
    const hours = parseFloat(editForm.hours)
    if (isNaN(hours) || hours <= 0) { setError('請輸入有效時數'); return }
    setSaving(true); setError('')
    try {
      const { _origStatus, _leaveRequestId, ...patch } = editForm
      await updateLesson(id, { ...patch, hours })
      // 同步請假：若狀態改成 leave 但沒既有請假，建立一筆；若從 leave 改成其他，刪除既有請假
      if (editForm.status === 'leave' && !_leaveRequestId) {
        await apiCreateLeaveRequest({
          student_id: editForm.student_id,
          course_id:  editForm.course_id,
          leave_date: editForm.lesson_date,
          reason:     '編輯標記為請假',
          lesson_record_id: id,
        })
      } else if (_origStatus === 'leave' && editForm.status !== 'leave' && _leaveRequestId) {
        try { await apiDeleteLeaveRequest(_leaveRequestId) } catch {}
      }
      await loadLessons({})
      setEditId(null); setEditForm(null)
    } catch (e) { setError(`更新失敗：${e?.message || e}`) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定要刪除此筆紀錄？')) return
    setSaving(true); setError('')
    try { await removeLesson(id) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  function coursesForStudent(studentId) {
    if (!studentId) return courseState.courses
    const allowed = studentCourseMap[studentId]
    if (!allowed) return []
    return courseState.courses.filter(c => allowed.has(c.id))
  }

  // 依 lesson_records 統整每門家教課對應的「週X HH:MM」常態時段（以未來紀錄為主）
  const slotsByStudentCourse = useMemo(() => {
    const todayStr = (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    })()
    const map = new Map() // student_id -> Map<course_id, Set<"w|HH:MM">>
    for (const l of lessonState.lessons) {
      if (!l.lesson_date || l.lesson_date < todayStr) continue
      const w = new Date(l.lesson_date).getDay()
      const t = l.start_time ? String(l.start_time).slice(0, 5) : ''
      const key = `${w}|${t}`
      if (!map.has(l.student_id)) map.set(l.student_id, new Map())
      const inner = map.get(l.student_id)
      if (!inner.has(l.course_id)) inner.set(l.course_id, new Set())
      inner.get(l.course_id).add(key)
    }
    return map
  }, [lessonState.lessons])

  function buildSlotMeta(studentId, courseId) {
    const set = slotsByStudentCourse.get(studentId)?.get(courseId)
    if (!set || set.size === 0) return ''
    return [...set]
      .map(k => { const [w, t] = k.split('|'); return { w: Number(w), t } })
      .sort((a, b) => a.w - b.w || a.t.localeCompare(b.t))
      .map(s => `週${WEEKDAY_LABELS[s.w]} ${s.t || '未排定'}`)
      .join(' / ')
  }

  function coursesWithSlotMeta(studentId) {
    if (!studentId) return coursesForStudent(studentId)
    return coursesForStudent(studentId).map(c => ({
      ...c,
      meta: buildSlotMeta(studentId, c.id),
    }))
  }

  function handleCourseChange(id, isEdit = false) {
    const course = courseState.courses.find(c => c.id === id)
    const defaultTid = course?.default_teacher_id || null
    if (isEdit) {
      setEditForm(f => ({
        ...f,
        course_id: id,
        teacher_id: defaultTid && f.course_id !== id ? defaultTid : f.teacher_id,
      }))
    } else {
      setForm(f => ({ ...f, course_id: id, teacher_id: defaultTid || f.teacher_id }))
    }
  }

  const { students } = studentState
  const { teachers } = teacherState
  const { courses }  = courseState
  const { lessons, loading } = lessonState
  const activeStudents = students.filter(s => s.active !== 0)
  const activeTeachers = teachers.filter(t => t.active !== 0)

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-body">
          <h1>家教課上課紀錄</h1>
          <p className="page-desc">管理並追蹤所有學生的家教課上課出席與進度</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className={`mode-toggle${showForm ? ' active' : ''}`}
            onClick={() => { setError(''); setShowForm(v => !v) }}
            aria-pressed={showForm}
          >
            {showForm ? '✕ 收起表單' : '+ 新增家教課上課紀錄'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="lesson-form-card">
          <div className="form-section-title">新增家教課上課紀錄</div>
          <form className="lesson-form" onSubmit={handleCreate}>
            <div className="lesson-form-row">
              <label>學生
                <Combobox
                  items={activeStudents}
                  value={form.student_id}
                  onChange={id => setForm(f => ({ ...f, student_id: id, course_id: '' }))}
                  placeholder="搜尋學生…"
                />
              </label>
              <label>課程
                <Combobox
                  key={`new-course-${form.student_id}`}
                  items={coursesWithSlotMeta(form.student_id)}
                  value={form.course_id}
                  onChange={id => handleCourseChange(id)}
                  placeholder={form.student_id ? '搜尋課程…' : '請先選學生'}
                />
                {form.student_id && coursesForStudent(form.student_id).length === 0 && (
                  <div className="error-msg" style={{ fontSize: 12, marginTop: 2 }}>該學生尚未選任何家教課，請先到「學生名冊」設定。</div>
                )}
              </label>
              <label>老師
                <Combobox
                  items={activeTeachers}
                  value={form.teacher_id}
                  onChange={id => setForm(f => ({ ...f, teacher_id: id }))}
                  placeholder="搜尋老師…"
                />
              </label>
              <label>時數
                <input type="number" min="0.5" step="0.5" placeholder="1.5"
                  value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                  className="hours-input"
                />
              </label>
              <label>日期（可複選，加入後 chip 顯示）
                <input type="date"
                  onChange={e => { addDate(e.target.value); e.target.value = '' }}
                />
                {form.lesson_dates.length > 0 && (
                  <div className="chip-list" style={{ marginTop: 4 }}>
                    {form.lesson_dates.map(d => (
                      <span className="chip" key={d}>
                        {d}
                        <button type="button" className="chip-remove" onClick={() => removeDate(d)} aria-label="移除">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </label>
              <label>開始時間
                <input type="time" value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  step="900"
                />
              </label>
              <label>備註
                <input type="text" placeholder="（選填）"
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="note-input"
                />
              </label>
            </div>
            <button className="btn-primary" type="submit" disabled={saving}>新增</button>
          </form>
          {error && <div className="error-msg">{error}</div>}
        </div>
      )}

      <form className="filter-bar" onSubmit={handleFilter}>
        <Combobox items={activeStudents} value={filterStudent} onChange={setFilterStudent} placeholder="全部學生" allLabel="全部學生" />
        <Combobox items={courses}  value={filterCourse}  onChange={setFilterCourse}  placeholder="全部課程" allLabel="全部課程" />
        <Combobox items={activeTeachers} value={filterTeacher} onChange={setFilterTeacher} placeholder="全部老師" allLabel="全部老師" />
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="開始日期" />
        <span>—</span>
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="結束日期" />
        <button className="btn-sm btn-primary" type="submit">篩選</button>
        <button className="btn-sm" type="button" onClick={resetFilter}>重設</button>
      </form>

      <div className="status-filter-bar">
        <span className="status-filter-label">點名狀態：</span>
        {STATUS_OPTIONS.map(o => (
          <button
            key={o.value}
            type="button"
            className={`status-filter-chip ${o.cls}${filterStatuses.has(o.value) ? ' active' : ''}`}
            onClick={() => toggleStatusFilter(o.value)}
            aria-pressed={filterStatuses.has(o.value)}
          >{o.label}</button>
        ))}
        {filterStatuses.size === 0
          ? <span className="status-filter-label" style={{ marginLeft: 4 }}>（未選＝顯示全部）</span>
          : <button type="button" className="status-filter-clear" onClick={() => setFilterStatuses(new Set())}>清除狀態</button>
        }
      </div>

      {(() => {
        const displayedLessons = filterStatuses.size === 0
          ? lessons
          : lessons.filter(l => filterStatuses.has(getDisplayStatus(l)))
        return loading ? (
          <div className="loading">載入中⋯</div>
        ) : displayedLessons.length === 0 ? (
          <div className="empty-hint">目前沒有符合條件的紀錄</div>
        ) : (
        <table className="lesson-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>學生</th>
              <th>課程</th>
              <th>老師</th>
              <th>時數</th>
              <th>狀態</th>
              <th>備註</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayedLessons.map(l => (
              <tr key={l.id}>
                {editId === l.id ? (
                  <Fragment>
                    <td><input type="date" className="inline-edit-input" value={editForm.lesson_date} onChange={e => setEditForm(f => ({ ...f, lesson_date: e.target.value }))} /></td>
                    <td>
                      <div className="combobox-cell">
                        <Combobox
                          items={activeStudents}
                          value={editForm.student_id}
                          onChange={id => setEditForm(f => ({ ...f, student_id: id, course_id: '' }))}
                          placeholder="搜尋學生…"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="combobox-cell">
                        <Combobox
                          key={`edit-course-${editForm.student_id}`}
                          items={coursesWithSlotMeta(editForm.student_id)}
                          value={editForm.course_id}
                          onChange={id => handleCourseChange(id, true)}
                          placeholder={editForm.student_id ? '搜尋課程…' : '請先選學生'}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="combobox-cell">
                        <Combobox
                          items={activeTeachers}
                          value={editForm.teacher_id}
                          onChange={id => setEditForm(f => ({ ...f, teacher_id: id }))}
                          placeholder="搜尋老師…"
                        />
                      </div>
                    </td>
                    <td><input type="number" min="0.5" step="0.5" className="inline-edit-input" value={editForm.hours} onChange={e => setEditForm(f => ({ ...f, hours: e.target.value }))} /></td>
                    <td>
                      <select className="inline-edit-input"
                        value={editForm.status || 'attended'}
                        onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      >
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td><input type="text" className="inline-edit-input" value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} /></td>
                    <td className="row-actions">
                      <button className="btn-sm btn-primary" onClick={() => handleSaveEdit(l.id)} disabled={saving}>儲存</button>
                      <button className="btn-sm" onClick={() => { setEditId(null); setEditForm(null) }}>取消</button>
                    </td>
                  </Fragment>
                ) : (
                  <Fragment>
                    <td>
                      <div className="table-date-cell">
                        <span className="table-date-main">{l.lesson_date}</span>
                        {l.start_time && <span className="table-date-time">{String(l.start_time).slice(0, 5)}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="table-name-cell">
                        <div className={`table-avatar table-avatar--${AVATAR_COLORS[l.student_name?.charCodeAt(0) % AVATAR_COLORS.length]}`}>
                          {l.student_name?.charAt(0)}
                        </div>
                        {l.student_name}
                      </div>
                    </td>
                    <td>{l.course_name}</td>
                    <td>{l.teacher_name || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td>{l.hours} 小時</td>
                    <td><LessonStatus record={l} /></td>
                    <td className="note-cell">{l.note}</td>
                    <td className="row-actions">
                      <button className="btn-icon" title="編輯" onClick={() => {
                        setEditId(l.id)
                        setEditForm({
                          student_id: l.student_id,
                          course_id: l.course_id,
                          teacher_id: l.teacher_id,
                          hours: String(l.hours),
                          lesson_date: l.lesson_date,
                          start_time: l.start_time ? String(l.start_time).slice(0, 5) : '',
                          note: l.note,
                          status: getDisplayStatus(l),
                          _origStatus: getDisplayStatus(l),
                          _leaveRequestId: l.leave_request_id || null,
                        })
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button className="btn-icon btn-icon-danger" title="刪除" onClick={() => handleDelete(l.id)} disabled={saving}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </td>
                  </Fragment>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        )
      })()}
    </div>
  )
}
