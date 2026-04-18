import { useState, useEffect } from 'react'
import { useLessons } from '../contexts/LessonsContext.jsx'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM = { student_id: '', course_id: '', teacher_id: '', hours: '', lesson_date: todayStr(), note: '' }

export default function LessonRecordsPage() {
  const { state: lessonState, loadLessons, createLesson, updateLesson, removeLesson } = useLessons()
  const { state: studentState, loadStudents } = useStudents()
  const { state: teacherState, loadTeachers } = useTeachers()
  const { state: courseState, loadCourses }   = useCourses()

  const [form, setForm]           = useState(EMPTY_FORM)
  const [editId, setEditId]       = useState(null)
  const [editForm, setEditForm]   = useState(null)
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  // Filters
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')
  const [filterStudent, setFilterStudent] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')
  const [filterCourse, setFilterCourse]   = useState('')

  useEffect(() => {
    loadStudents(); loadTeachers(); loadCourses()
    loadLessons({})
  }, [loadStudents, loadTeachers, loadCourses, loadLessons])

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
    if (!form.lesson_date) { setError('請選擇上課日期'); return }
    setSaving(true); setError('')
    try {
      await createLesson({ ...form, hours })
      setForm({ ...EMPTY_FORM, lesson_date: form.lesson_date })
    } catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleSaveEdit(id) {
    const hours = parseFloat(editForm.hours)
    if (isNaN(hours) || hours <= 0) { setError('請輸入有效時數'); return }
    setSaving(true); setError('')
    try {
      await updateLesson(id, { ...editForm, hours })
      setEditId(null); setEditForm(null)
    } catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定要刪除此筆紀錄？')) return
    setSaving(true); setError('')
    try { await removeLesson(id) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  const { students } = studentState
  const { teachers } = teacherState
  const { courses }  = courseState
  const { lessons, loading } = lessonState

  return (
    <div className="page">
      <div className="page-header">
        <h1>上課紀錄</h1>
      </div>

      {/* 新增表單 */}
      <div className="lesson-form-card">
        <div className="form-section-title">新增上課紀錄</div>
        <form className="lesson-form" onSubmit={handleCreate}>
          <div className="lesson-form-row">
            <label>學生
              <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                <option value="">— 選擇 —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>課程
              <select value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}>
                <option value="">— 選擇 —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>老師
              <select value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                <option value="">— 選擇 —</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label>時數
              <input type="number" min="0.5" step="0.5" placeholder="1.5"
                value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                className="hours-input"
              />
            </label>
            <label>日期
              <input type="date" value={form.lesson_date}
                onChange={e => setForm(f => ({ ...f, lesson_date: e.target.value }))}
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

      {/* 篩選 */}
      <form className="filter-bar" onSubmit={handleFilter}>
        <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
          <option value="">全部學生</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
          <option value="">全部課程</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
          <option value="">全部老師</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="開始日期" />
        <span>—</span>
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="結束日期" />
        <button className="btn-sm btn-primary" type="submit">篩選</button>
        <button className="btn-sm" type="button" onClick={resetFilter}>重設</button>
      </form>

      {/* 列表 */}
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
              <th>備註</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lessons.map(l => (
              <tr key={l.id}>
                {editId === l.id ? (
                  <>
                    <td><input type="date" value={editForm.lesson_date} onChange={e => setEditForm(f => ({ ...f, lesson_date: e.target.value }))} /></td>
                    <td>
                      <select value={editForm.student_id} onChange={e => setEditForm(f => ({ ...f, student_id: e.target.value }))}>
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={editForm.course_id} onChange={e => setEditForm(f => ({ ...f, course_id: e.target.value }))}>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={editForm.teacher_id} onChange={e => setEditForm(f => ({ ...f, teacher_id: e.target.value }))}>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    <td><input type="number" min="0.5" step="0.5" value={editForm.hours} onChange={e => setEditForm(f => ({ ...f, hours: e.target.value }))} className="hours-input" /></td>
                    <td><input type="text" value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} /></td>
                    <td className="row-actions">
                      <button className="btn-sm btn-primary" onClick={() => handleSaveEdit(l.id)} disabled={saving}>儲存</button>
                      <button className="btn-sm" onClick={() => { setEditId(null); setEditForm(null) }}>取消</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{l.lesson_date}</td>
                    <td>{l.student_name}</td>
                    <td>{l.course_name}</td>
                    <td>{l.teacher_name}</td>
                    <td>{l.hours}</td>
                    <td className="note-cell">{l.note}</td>
                    <td className="row-actions">
                      <button className="btn-sm" onClick={() => {
                        setEditId(l.id)
                        setEditForm({ student_id: l.student_id, course_id: l.course_id, teacher_id: l.teacher_id, hours: String(l.hours), lesson_date: l.lesson_date, note: l.note })
                      }}>編輯</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(l.id)} disabled={saving}>刪除</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
