import { useState, useEffect } from 'react'
import { useLessons } from '../contexts/LessonsContext.jsx'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import Combobox from '../components/Combobox.jsx'
import EyeIcon from '../components/EyeIcon.jsx'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM = { student_id: '', course_id: '', teacher_id: '', hours: '', lesson_date: todayStr(), unit_price: '', teacher_unit_price: '', note: '' }
const EMPTY_GROUP_RECORD = { group_id: '', student_ids: [], record_date: todayStr(), note: '' }

export default function LessonRecordsPage() {
  const { state: lessonState, loadLessons, createLesson, updateLesson, removeLesson } = useLessons()
  const { state: studentState, loadStudents } = useStudents()
  const { state: teacherState, loadTeachers } = useTeachers()
  const { state: courseState, loadCourses }   = useCourses()
  const { state: groupState, loadGroups, loadRecords: loadGroupRecords, createRecord: createGroupRecord, updateRecord: updateGroupRecord, removeRecord: removeGroupRecord } = useGroups()

  const [form, setForm]                 = useState(EMPTY_FORM)
  const [groupForm, setGroupForm]       = useState(EMPTY_GROUP_RECORD)
  const [addMode, setAddMode]           = useState(null) // 'lesson' | 'group' | null
  const [editId, setEditId]             = useState(null)
  const [editForm, setEditForm]         = useState(null)
  const [editGroupRecId, setEditGroupRecId] = useState(null)
  const [editGroupRec, setEditGroupRec]     = useState(null)
  const [error, setError]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [showAmounts, setShowAmounts]   = useState(false)

  function amt(value) {
    if (!showAmounts) return '••••'
    return parseFloat(value).toLocaleString()
  }

  // Filters
  const [filterFrom, setFilterFrom]       = useState('')
  const [filterTo, setFilterTo]           = useState('')
  const [filterStudent, setFilterStudent] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')
  const [filterCourse, setFilterCourse]   = useState('')

  useEffect(() => {
    loadStudents(); loadTeachers(); loadCourses()
    loadGroups(); loadGroupRecords()
    loadLessons({})
  }, [loadStudents, loadTeachers, loadCourses, loadGroups, loadGroupRecords, loadLessons])

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
    const unit_price = parseFloat(form.unit_price)
    if (isNaN(unit_price) || unit_price <= 0) { setError('請輸入學生時薪'); return }
    const teacher_unit_price = parseFloat(form.teacher_unit_price)
    if (isNaN(teacher_unit_price) || teacher_unit_price <= 0) { setError('請輸入老師時薪'); return }
    if (!form.lesson_date) { setError('請選擇上課日期'); return }
    setSaving(true); setError('')
    try {
      await createLesson({ ...form, hours, unit_price, teacher_unit_price })
      setForm({ ...EMPTY_FORM, lesson_date: form.lesson_date })
    } catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleSaveEdit(id) {
    const hours = parseFloat(editForm.hours)
    if (isNaN(hours) || hours <= 0) { setError('請輸入有效時數'); return }
    setSaving(true); setError('')
    try {
      const unit_price         = editForm.unit_price         !== '' ? parseFloat(editForm.unit_price)         : null
      const teacher_unit_price = editForm.teacher_unit_price !== '' ? parseFloat(editForm.teacher_unit_price) : null
      await updateLesson(id, { ...editForm, hours, unit_price, teacher_unit_price })
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

  // ── 團課上課紀錄 ─────────────────────────────────────────────
  async function handleAddGroupRecord(e) {
    e.preventDefault()
    if (!groupForm.group_id) { setError('請選擇團課'); return }
    if (groupForm.student_ids.length === 0) { setError('請至少選一位學生'); return }
    if (!groupForm.record_date) { setError('請選擇日期'); return }
    setSaving(true); setError('')
    try {
      const { group_id, record_date, note, student_ids } = groupForm
      await Promise.all(student_ids.map(student_id =>
        createGroupRecord({ group_id, student_id, record_date, note })
      ))
      await loadGroupRecords()
      setGroupForm({ ...EMPTY_GROUP_RECORD, record_date: groupForm.record_date })
    } catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  function addGroupStudent(id) {
    if (!id) return
    setGroupForm(f => f.student_ids.includes(id) ? f : { ...f, student_ids: [...f.student_ids, id] })
  }
  function removeGroupStudent(id) {
    setGroupForm(f => ({ ...f, student_ids: f.student_ids.filter(x => x !== id) }))
  }

  async function handleDeleteGroupRecord(id) {
    if (!window.confirm('確定要刪除此筆團課上課紀錄？')) return
    setSaving(true); setError('')
    try { await removeGroupRecord(id) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  function startEditGroupRec(r) {
    setEditGroupRecId(r.id)
    setEditGroupRec({
      group_id: r.group_id,
      student_id: r.student_id,
      record_date: r.record_date,
      note: r.note || '',
    })
  }

  async function handleSaveEditGroupRec(id) {
    if (!editGroupRec.group_id) { setError('請選擇團課'); return }
    if (!editGroupRec.student_id) { setError('請選擇學生'); return }
    if (!editGroupRec.record_date) { setError('請選擇日期'); return }
    setSaving(true); setError('')
    try {
      await updateGroupRecord(id, { ...editGroupRec })
      await loadGroupRecords()
      setEditGroupRecId(null); setEditGroupRec(null)
    } catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  const { students } = studentState
  const { teachers } = teacherState
  const { courses }  = courseState
  const { lessons, loading } = lessonState
  const { groups, records: groupRecords } = groupState

  // 選課程時自動帶入預設學生時薪與老師時薪
  function handleCourseChange(id, isEdit = false) {
    const course       = courses.find(c => c.id === id)
    const studentRate  = course ? String(course.hourly_rate) : ''
    const teacherRate  = course ? String(course.teacher_hourly_rate ?? 0) : ''
    if (isEdit) {
      setEditForm(f => ({ ...f, course_id: id, unit_price: studentRate, teacher_unit_price: teacherRate }))
    } else {
      setForm(f => ({ ...f, course_id: id, unit_price: studentRate, teacher_unit_price: teacherRate }))
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>上課紀錄</h1>
        <button className="btn-sm" onClick={() => setShowAmounts(v => !v)} title={showAmounts ? '隱藏金額' : '顯示金額'}>
          <EyeIcon open={showAmounts} />{showAmounts ? '隱藏金額' : '顯示金額'}
        </button>
      </div>

      {/* 新增模式切換按鈕 */}
      <div className="add-mode-switcher">
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setError(''); setAddMode(m => m === 'lesson' ? null : 'lesson') }}
        >
          {addMode === 'lesson' ? '收起' : '＋'} 新增上課紀錄
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setError(''); setAddMode(m => m === 'group' ? null : 'group') }}
        >
          {addMode === 'group' ? '收起' : '＋'} 新增團課上課紀錄
        </button>
      </div>

      {/* 新增表單 */}
      {addMode === 'lesson' && (
      <div className="lesson-form-card">
        <div className="form-section-title">新增上課紀錄</div>
        <form className="lesson-form" onSubmit={handleCreate}>
          <div className="lesson-form-row">
            <label>學生
              <Combobox
                items={students}
                value={form.student_id}
                onChange={id => setForm(f => ({ ...f, student_id: id }))}
                placeholder="搜尋學生…"
              />
            </label>
            <label>課程
              <Combobox
                items={courses}
                value={form.course_id}
                onChange={id => handleCourseChange(id)}
                placeholder="搜尋課程…"
              />
            </label>
            <label>老師
              <Combobox
                items={teachers}
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
            <label>學生時薪
              <input type="number" min="0" step="1" placeholder="課程預設"
                value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                className="hours-input"
                style={{ width: '110px' }}
              />
            </label>
            <label>老師時薪
              <input type="number" min="0" step="1" placeholder="課程預設"
                value={form.teacher_unit_price} onChange={e => setForm(f => ({ ...f, teacher_unit_price: e.target.value }))}
                className="hours-input"
                style={{ width: '110px' }}
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
      )}

      {/* 新增團課上課紀錄 */}
      {addMode === 'group' && (
      <div className="lesson-form-card">
        <div className="form-section-title">新增團課上課紀錄</div>
        <form className="lesson-form" onSubmit={handleAddGroupRecord}>
          <div className="lesson-form-row">
            <label>團課
              <Combobox
                items={groups}
                value={groupForm.group_id}
                onChange={id => setGroupForm(f => ({ ...f, group_id: id }))}
                placeholder="搜尋團課…"
              />
            </label>
            <label>日期
              <input type="date" value={groupForm.record_date}
                onChange={e => setGroupForm(f => ({ ...f, record_date: e.target.value }))}
              />
            </label>
            <label>備註
              <input type="text" placeholder="（選填）"
                value={groupForm.note}
                onChange={e => setGroupForm(f => ({ ...f, note: e.target.value }))}
                className="note-input"
              />
            </label>
          </div>
          <label>學生（可複選）
            <Combobox
              key={groupForm.student_ids.length}
              items={students.filter(s => !groupForm.student_ids.includes(s.id))}
              value=""
              onChange={addGroupStudent}
              placeholder="搜尋學生加入…"
            />
            {groupForm.student_ids.length > 0 && (
              <div className="chip-list">
                {groupForm.student_ids.map(id => {
                  const s = students.find(x => x.id === id)
                  return (
                    <span className="chip" key={id}>
                      {s?.name ?? id}
                      <button type="button" className="chip-remove" onClick={() => removeGroupStudent(id)} aria-label="移除">×</button>
                    </span>
                  )
                })}
              </div>
            )}
          </label>
          <button className="btn-primary" type="submit" disabled={saving}>新增</button>
        </form>
        {error && <div className="error-msg">{error}</div>}
      </div>
      )}

      {/* 篩選 */}
      <form className="filter-bar" onSubmit={handleFilter}>
        <Combobox
          items={students}
          value={filterStudent}
          onChange={setFilterStudent}
          placeholder="全部學生"
          allLabel="全部學生"
        />
        <Combobox
          items={courses}
          value={filterCourse}
          onChange={setFilterCourse}
          placeholder="全部課程"
          allLabel="全部課程"
        />
        <Combobox
          items={teachers}
          value={filterTeacher}
          onChange={setFilterTeacher}
          placeholder="全部老師"
          allLabel="全部老師"
        />
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
              <th>學生時薪</th>
              <th>老師時薪</th>
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
                      <Combobox
                        items={students}
                        value={editForm.student_id}
                        onChange={id => setEditForm(f => ({ ...f, student_id: id }))}
                        placeholder="搜尋學生…"
                      />
                    </td>
                    <td>
                      <Combobox
                        items={courses}
                        value={editForm.course_id}
                        onChange={id => handleCourseChange(id, true)}
                        placeholder="搜尋課程…"
                      />
                    </td>
                    <td>
                      <Combobox
                        items={teachers}
                        value={editForm.teacher_id}
                        onChange={id => setEditForm(f => ({ ...f, teacher_id: id }))}
                        placeholder="搜尋老師…"
                      />
                    </td>
                    <td><input type="number" min="0.5" step="0.5" value={editForm.hours} onChange={e => setEditForm(f => ({ ...f, hours: e.target.value }))} className="hours-input" /></td>
                    <td><input type="number" min="0" step="1" value={editForm.unit_price} onChange={e => setEditForm(f => ({ ...f, unit_price: e.target.value }))} className="hours-input" style={{ width: '90px' }} /></td>
                    <td><input type="number" min="0" step="1" value={editForm.teacher_unit_price} onChange={e => setEditForm(f => ({ ...f, teacher_unit_price: e.target.value }))} className="hours-input" style={{ width: '90px' }} /></td>
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
                    <td className="num-cell">
                      {l.unit_price != null
                        ? amt(l.unit_price)
                        : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{amt(l.course_hourly_rate)}（預設）</span>
                      }
                    </td>
                    <td className="num-cell">
                      {l.teacher_unit_price != null
                        ? amt(l.teacher_unit_price)
                        : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{amt(l.course_teacher_hourly_rate ?? 0)}（預設）</span>
                      }
                    </td>
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
                          unit_price: l.unit_price != null ? String(l.unit_price) : String(l.course_hourly_rate),
                          teacher_unit_price: l.teacher_unit_price != null ? String(l.teacher_unit_price) : String(l.course_teacher_hourly_rate ?? 0),
                          note: l.note,
                        })
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

      {/* 團課上課紀錄列表 */}
      {groupRecords.length > 0 && (
        <>
          <div className="form-section-title" style={{ marginTop: '32px', marginBottom: '12px' }}>團課上課紀錄</div>
          <table className="lesson-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>團課</th>
                <th>學生</th>
                <th>備註</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groupRecords.map(r => (
                <tr key={r.id}>
                  {editGroupRecId === r.id ? (
                    <>
                      <td>
                        <input type="date" value={editGroupRec.record_date}
                          onChange={e => setEditGroupRec(f => ({ ...f, record_date: e.target.value }))}
                        />
                      </td>
                      <td>
                        <Combobox
                          items={groups}
                          value={editGroupRec.group_id}
                          onChange={id => setEditGroupRec(f => ({ ...f, group_id: id }))}
                          placeholder="搜尋團課…"
                        />
                      </td>
                      <td>
                        <Combobox
                          items={students}
                          value={editGroupRec.student_id}
                          onChange={id => setEditGroupRec(f => ({ ...f, student_id: id }))}
                          placeholder="搜尋學生…"
                        />
                      </td>
                      <td>
                        <input type="text"
                          value={editGroupRec.note}
                          onChange={e => setEditGroupRec(f => ({ ...f, note: e.target.value }))}
                        />
                      </td>
                      <td className="row-actions">
                        <button className="btn-sm btn-primary" onClick={() => handleSaveEditGroupRec(r.id)} disabled={saving}>儲存</button>
                        <button className="btn-sm" onClick={() => { setEditGroupRecId(null); setEditGroupRec(null) }}>取消</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{r.record_date}</td>
                      <td>{r.group_name}</td>
                      <td>{r.student_name}</td>
                      <td className="note-cell">{r.note}</td>
                      <td className="row-actions">
                        <button className="btn-sm" onClick={() => startEditGroupRec(r)}>編輯</button>
                        <button className="btn-sm btn-danger" onClick={() => handleDeleteGroupRecord(r.id)} disabled={saving}>刪除</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
