import { Fragment, useState, useEffect } from 'react'
import { useLessons } from '../contexts/LessonsContext.jsx'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import Combobox from '../components/Combobox.jsx'
import { useDirtyTracker } from '../contexts/UnsavedContext.jsx'
import { apiListAllEnrollments, apiCreateLeaveRequest, apiDeleteLeaveRequest } from '../data/api.js'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_OPTIONS = [
  { value: 'attended',   label: '已點名' },
  { value: 'pending',    label: '未點名' },
  { value: 'pre_enroll', label: '尚未開始' },
  { value: 'leave',      label: '請假' },
]

function getDisplayStatus(record) {
  const status = record.status || 'attended'
  if (record.is_on_leave || status === 'leave') return 'leave'
  return status
}

function LessonStatus({ record }) {
  const s = getDisplayStatus(record)
  const map = {
    leave:     { label: '請假',     cls: 'status-leave' },
    pre_enroll:{ label: '尚未開始', cls: 'status-pre' },
    pending:   { label: '未點名',   cls: 'status-pending' },
    attended:  { label: '已點名',   cls: 'status-attended' },
  }
  const { label, cls } = map[s] || map.attended
  return <span className={`status-tag ${cls}`} title={record.leave_reason || ''}>{label}</span>
}

const EMPTY_FORM = { student_id: '', course_id: '', teacher_id: '', hours: '1', lesson_dates: [todayStr()], start_time: '', note: '' }

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
    loadLessons({})
  }

  async function handleCreate(e) {
    e.preventDefault()
    const hours = parseFloat(form.hours)
    if (!form.student_id || !form.course_id || !form.teacher_id) { setError('請選擇學生、課程和老師'); return }
    if (isNaN(hours) || hours <= 0) { setError('請輸入有效時數'); return }
    const dates = (form.lesson_dates || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    if (dates.length === 0) { setError('請選擇至少一個上課日期'); return }
    setSaving(true); setError('')
    const failures = []
    try {
      for (const d of dates) {
        try {
          await createLesson({
            student_id: form.student_id,
            course_id:  form.course_id,
            teacher_id: form.teacher_id,
            hours,
            lesson_date: d,
            start_time: form.start_time || null,
            unit_price: null,
            teacher_unit_price: null,
            note: form.note || '',
          })
        } catch (e) {
          failures.push(`${d}：${e?.message || e}`)
        }
      }
      await loadLessons({})
      setForm({ ...EMPTY_FORM, lesson_dates: form.lesson_dates, start_time: form.start_time })
      if (failures.length) setError(`部分日期建立失敗：\n${failures.join('\n')}`)
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
        <h1>家教課上課紀錄</h1>
      </div>

      <div className="add-mode-switcher">
        <button
          type="button"
          className={`mode-toggle${showForm ? ' active' : ''}`}
          onClick={() => { setError(''); setShowForm(v => !v) }}
          aria-pressed={showForm}
        >
          {showForm ? '收起新增表單' : '＋ 新增家教課上課紀錄'}
        </button>
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
                  items={coursesForStudent(form.student_id)}
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

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : lessons.length === 0 ? (
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
            {lessons.map(l => (
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
                          items={coursesForStudent(editForm.student_id)}
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
                    <td>{l.lesson_date}</td>
                    <td>{l.student_name}</td>
                    <td>{l.course_name}</td>
                    <td>{l.teacher_name}</td>
                    <td>{l.hours}</td>
                    <td><LessonStatus record={l} /></td>
                    <td className="note-cell">{l.note}</td>
                    <td className="row-actions">
                      <button className="btn-sm" onClick={() => {
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
                          // 用於 save 時對照是否要同步 leave_request
                          _origStatus: getDisplayStatus(l),
                          _leaveRequestId: l.leave_request_id || null,
                        })
                      }}>編輯</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(l.id)} disabled={saving}>刪除</button>
                    </td>
                  </Fragment>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
