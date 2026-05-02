import { useState, useEffect, useRef } from 'react'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import {
  apiListGroupRecords, apiCreateGroupRecord, apiDeleteGroupRecord,
  apiListGroupMembers, apiSetGroupMembers,
  apiListLessons, apiCreateLesson, apiDeleteLesson,
  apiListAllEnrollments,
} from '../data/api.js'
import { genId } from '../utils/ids.js'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function buildLineMessage(groupName, date, studentNames) {
  const d = new Date(date + 'T00:00:00')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const dateStr = `${date.slice(5).replace('-', '/')}（${weekdays[d.getDay()]}）`
  const names = studentNames.join('、')
  return `【補習班】${dateStr} 到班：\n${names}（共 ${studentNames.length} 人）\n✅ 點名完成`
}

function openLineShare(msg) {
  const encoded = encodeURIComponent(msg)
  window.location.href = `line://msg/text/?${encoded}`
  setTimeout(() => {
    if (!document.hidden) {
      window.open(`https://line.me/R/msg/text/?${encoded}`, '_blank')
    }
  }, 1500)
}

export default function AttendancePage() {
  const { state: groupsState, loadGroups } = useGroups()
  const { state: studentsState, loadStudents } = useStudents()
  const { state: coursesState, loadCourses } = useCourses()
  const { state: teachersState, loadTeachers } = useTeachers()

  // 'group' = 團課點名； 'tutoring' = 家教課點名
  const [mode, setMode] = useState('group')

  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedDate, setSelectedDate]   = useState(todayStr)

  // 家教課專用
  const [selectedCourse, setSelectedCourse]   = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [tutoringHours, setTutoringHours]     = useState('1')
  const [tutoringStart, setTutoringStart]     = useState('')
  const [courseMemberIds, setCourseMemberIds] = useState(new Set())

  // student_id -> record_id
  const [existingMap, setExistingMap] = useState({})
  const [checked, setChecked] = useState(new Set())
  // 應到名單 student_id（DB: group_members）
  const [memberIds, setMemberIds] = useState(new Set())

  const [loaded,     setLoaded]     = useState(false)
  const [fetching,   setFetching]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [attendedNames, setAttendedNames] = useState([])

  // 「其他學生」摺疊
  const [showOthers, setShowOthers] = useState(false)
  // 管理應到名單面板
  const [editRoster, setEditRoster] = useState(false)
  const [rosterDraft, setRosterDraft] = useState(new Set())
  const [rosterFilter, setRosterFilter] = useState('')
  const [rosterSaving, setRosterSaving] = useState(false)

  const loadAbortRef = useRef(null)

  useEffect(() => { loadGroups() },   [loadGroups])
  useEffect(() => { loadStudents() }, [loadStudents])
  useEffect(() => { loadCourses() },  [loadCourses])
  useEffect(() => { loadTeachers() }, [loadTeachers])

  // 切換團課時拉應到名單
  useEffect(() => {
    if (mode !== 'group' || !selectedGroup) {
      setMemberIds(new Set())
      return
    }
    apiListGroupMembers(selectedGroup)
      .then(rows => setMemberIds(new Set(rows.map(r => r.id))))
      .catch(() => {})
  }, [mode, selectedGroup])

  // 切換到家教課模式 / 切換家教課時，拉該課程的選課學生（透過 enrollments）
  useEffect(() => {
    if (mode !== 'tutoring' || !selectedCourse) {
      setCourseMemberIds(new Set())
      return
    }
    apiListAllEnrollments()
      .then(({ courses }) => {
        const ids = new Set(courses.filter(r => r.course_id === selectedCourse).map(r => r.student_id))
        setCourseMemberIds(ids)
      })
      .catch(() => {})
  }, [mode, selectedCourse])

  // 選家教課時自動帶預設老師
  useEffect(() => {
    if (mode !== 'tutoring' || !selectedCourse) return
    const c = coursesState.courses.find(c => c.id === selectedCourse)
    if (c?.default_teacher_id && !selectedTeacher) setSelectedTeacher(c.default_teacher_id)
  }, [mode, selectedCourse, coursesState.courses, selectedTeacher])

  // 切換團課/家教課/日期：載入該日點名紀錄
  useEffect(() => {
    setLoaded(false)
    setChecked(new Set())
    setExistingMap({})
    setSuccessMsg('')
    setAttendedNames([])
    setError('')

    if (mode === 'group') {
      if (!selectedGroup || !selectedDate) return
    } else {
      if (!selectedCourse || !selectedTeacher || !selectedDate) return
    }

    const abortCtrl = new AbortController()
    loadAbortRef.current = abortCtrl

    setFetching(true)
    const fetcher = mode === 'group'
      ? apiListGroupRecords({ from: selectedDate, to: selectedDate, group_id: selectedGroup })
      : apiListLessons({ from: selectedDate, to: selectedDate, course_id: selectedCourse, teacher_id: selectedTeacher })
    fetcher
      .then(records => {
        if (abortCtrl.signal.aborted) return
        const map = {}
        const ids = new Set()
        for (const r of records) {
          map[r.student_id] = r.id
          ids.add(r.student_id)
        }
        setExistingMap(map)
        setChecked(ids)
        setLoaded(true)
      })
      .catch(() => {
        if (abortCtrl.signal.aborted) return
        setError('載入失敗，請重新整理再試')
      })
      .finally(() => {
        if (!abortCtrl.signal.aborted) setFetching(false)
      })

    return () => { abortCtrl.abort() }
  }, [mode, selectedGroup, selectedDate, selectedCourse, selectedTeacher])

  function toggleStudent(studentId) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
    setSuccessMsg('')
    setAttendedNames([])
  }

  // 在家教課模式下，應到名單來自選課；團課模式來自 group_members
  const effectiveMemberIds = mode === 'tutoring' ? courseMemberIds : memberIds

  // 全選/取消：只針對應到名單
  function handleToggleAllRoster() {
    const rosterStudents = studentsState.students.filter(s => effectiveMemberIds.has(s.id))
    const all = rosterStudents.map(s => s.id)
    const allChecked = all.length > 0 && all.every(id => checked.has(id))
    setChecked(prev => {
      const next = new Set(prev)
      if (allChecked) all.forEach(id => next.delete(id))
      else            all.forEach(id => next.add(id))
      return next
    })
    setSuccessMsg('')
    setAttendedNames([])
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccessMsg('')
    setAttendedNames([])
    try {
      const toCreate = []
      const toDelete = []

      for (const s of studentsState.students) {
        const wasPresent = s.id in existingMap
        const isPresent  = checked.has(s.id)
        if (isPresent && !wasPresent) toCreate.push(s.id)
        if (!isPresent && wasPresent) toDelete.push(existingMap[s.id])
      }

      if (mode === 'group') {
        await Promise.all([
          ...toCreate.map(student_id =>
            apiCreateGroupRecord({
              id:          genId('grr'),
              group_id:    selectedGroup,
              student_id,
              record_date: selectedDate,
              note:        '',
            })
          ),
          ...toDelete.map(id => apiDeleteGroupRecord(id)),
        ])
      } else {
        const hours = parseFloat(tutoringHours)
        if (isNaN(hours) || hours <= 0) { setError('請輸入有效時數'); setSaving(false); return }
        await Promise.all([
          ...toCreate.map(student_id =>
            apiCreateLesson({
              student_id,
              course_id:   selectedCourse,
              teacher_id:  selectedTeacher,
              hours,
              lesson_date: selectedDate,
              start_time:  tutoringStart || null,
              unit_price:  null,
              teacher_unit_price: null,
              note:        '',
            })
          ),
          ...toDelete.map(id => apiDeleteLesson(id)),
        ])
      }

      const fresh = mode === 'group'
        ? await apiListGroupRecords({ from: selectedDate, to: selectedDate, group_id: selectedGroup })
        : await apiListLessons({ from: selectedDate, to: selectedDate, course_id: selectedCourse, teacher_id: selectedTeacher })
      const newMap = {}
      const newChecked = new Set()
      for (const r of fresh) {
        newMap[r.student_id] = r.id
        newChecked.add(r.student_id)
      }
      setExistingMap(newMap)
      setChecked(newChecked)

      const names = studentsState.students
        .filter(s => newChecked.has(s.id))
        .map(s => s.name)
      setAttendedNames(names)

      const rosterCount = studentsState.students.filter(s => effectiveMemberIds.has(s.id)).length
      setSuccessMsg(`已儲存！出席 ${newChecked.size} 人${rosterCount ? ` / 應到 ${rosterCount} 人` : ''}`)
    } catch {
      setError('儲存失敗，請再試一次')
    } finally {
      setSaving(false)
    }
  }

  // ── 管理應到名單 ──
  function openRosterEditor() {
    setRosterDraft(new Set(memberIds))
    setRosterFilter('')
    setEditRoster(true)
  }
  function toggleRosterDraft(studentId) {
    setRosterDraft(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }
  async function saveRoster() {
    if (rosterSaving) return
    setRosterSaving(true)
    try {
      const rows = await apiSetGroupMembers(selectedGroup, Array.from(rosterDraft))
      setMemberIds(new Set(rows.map(r => r.id)))
      setEditRoster(false)
    } catch {
      setError('儲存應到名單失敗')
    } finally {
      setRosterSaving(false)
    }
  }

  const { groups }   = groupsState
  const { students } = studentsState
  const { courses }  = coursesState
  const { teachers } = teachersState
  const selectedGroupName = groups.find(g => g.id === selectedGroup)?.name || ''
  const selectedCourseName = courses.find(c => c.id === selectedCourse)?.name || ''
  const selectedTeacherName = teachers.find(t => t.id === selectedTeacher)?.name || ''
  const headerLabel = mode === 'group'
    ? selectedGroupName
    : (selectedCourseName ? `${selectedCourseName}・${selectedTeacherName}` : '')

  // 切兩堆：應到 / 其他
  const rosterStudents = students.filter(s => effectiveMemberIds.has(s.id))
  const otherStudents  = students.filter(s => !effectiveMemberIds.has(s.id))
  const rosterFilterLower = rosterFilter.trim().toLowerCase()
  const filteredForRoster = rosterFilterLower
    ? students.filter(s => s.name.toLowerCase().includes(rosterFilterLower))
    : students

  const rosterCount  = rosterStudents.length
  const presentCount = checked.size
  const rosterAllChecked = rosterCount > 0 && rosterStudents.every(s => checked.has(s.id))
  // 「其他學生」中已勾選（臨時加入）的數量
  const otherCheckedCount = otherStudents.filter(s => checked.has(s.id)).length

  return (
    <div className="page">
      <div className="page-header">
        <h1>點名</h1>
      </div>

      {error      && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {successMsg && (
        <div className="attendance-success">
          <div>{successMsg}</div>
          {attendedNames.length > 0 && (
            <>
              <div className="attendance-names-list">
                {attendedNames.map(name => (
                  <span key={name} className="attendance-name-tag">{name}</span>
                ))}
              </div>
              <button
                type="button"
                className="btn-line-share"
                onClick={() => openLineShare(buildLineMessage(headerLabel, selectedDate, attendedNames))}
              >
                <span className="btn-line-icon">LINE</span>
                傳到班級群組
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 模式切換 ── */}
      <div className="add-mode-switcher">
        <button
          type="button"
          className={`mode-toggle${mode === 'group' ? ' active' : ''}`}
          onClick={() => setMode('group')}
          aria-pressed={mode === 'group'}
        >團課點名</button>
        <button
          type="button"
          className={`mode-toggle${mode === 'tutoring' ? ' active' : ''}`}
          onClick={() => setMode('tutoring')}
          aria-pressed={mode === 'tutoring'}
        >家教課點名</button>
      </div>

      {/* ── 選擇課堂 ── */}
      <div className="lesson-form-card">
        <div className="form-section-title">選擇課堂</div>
        <div className="lesson-form">
          <div className="lesson-form-row">
            {mode === 'group' ? (
              <label>團課
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                >
                  <option value="">── 請選擇團課 ──</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label>家教課
                  <select
                    value={selectedCourse}
                    onChange={e => { setSelectedCourse(e.target.value); setSelectedTeacher('') }}
                  >
                    <option value="">── 請選擇家教課 ──</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label>老師
                  <select
                    value={selectedTeacher}
                    onChange={e => setSelectedTeacher(e.target.value)}
                  >
                    <option value="">── 請選擇老師 ──</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label>時數
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={tutoringHours}
                    onChange={e => setTutoringHours(e.target.value)}
                    className="hours-input"
                  />
                </label>
                <label>開始時間
                  <input
                    type="time"
                    step="900"
                    value={tutoringStart}
                    onChange={e => setTutoringStart(e.target.value)}
                  />
                </label>
              </>
            )}
            <label>日期
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── 點名表 ── */}
      {fetching && (
        <div className="lesson-form-card" style={{ color: 'var(--muted)', fontSize: 14 }}>
          載入中…
        </div>
      )}

      {!fetching && loaded && (
        <div className="lesson-form-card">
          <div className="form-section-title attendance-header-row">
            <span>{headerLabel}・{selectedDate}</span>
            <span className="attendance-count">
              出席 <strong>{presentCount}</strong>
              {rosterCount > 0 && <> / 應到 {rosterCount}</>} 人
            </span>
          </div>

          {students.length === 0 ? (
            <div className="empty-hint">尚未新增任何學生</div>
          ) : (
            <>
              {/* 應到名單 */}
              <div className="attendance-section-label attendance-roster-header">
                <span>應到名單（{rosterCount} 人）</span>
                {mode === 'group' && (
                  <button type="button" className="btn-link" onClick={openRosterEditor}>
                    管理應到名單
                  </button>
                )}
              </div>

              {rosterCount === 0 ? (
                <div className="empty-hint">
                  {mode === 'group'
                    ? '尚未設定本班應到學生。請點上方「管理應到名單」加入學員。'
                    : '此家教課尚無已選課學生。請到「學生名冊」幫學生選課。'}
                </div>
              ) : (
                <div className="attendance-list">
                  <label className="attendance-item attendance-item-all">
                    <input
                      type="checkbox"
                      checked={rosterAllChecked}
                      onChange={handleToggleAllRoster}
                    />
                    <span>全選應到</span>
                  </label>
                  {rosterStudents.map(s => (
                    <label
                      key={s.id}
                      className={`attendance-item${checked.has(s.id) ? ' attendance-item--checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                      />
                      <span className="attendance-name">{s.name}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* 其他學生（臨時加入用，預設折疊） */}
              {otherStudents.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className={`btn-disclosure${showOthers ? ' open' : ''}`}
                    onClick={() => setShowOthers(v => !v)}
                    aria-expanded={showOthers}
                  >
                    <span className="chev" aria-hidden="true" />
                    <span>加入未在名單的學生</span>
                    <span className="count-pill count-pill--muted">{otherStudents.length}</span>
                    {otherCheckedCount > 0 && (
                      <span className="count-pill">已勾 {otherCheckedCount}</span>
                    )}
                  </button>
                  {showOthers && (
                    <div className="attendance-list" style={{ marginTop: 8 }}>
                      {otherStudents.map(s => (
                        <label
                          key={s.id}
                          className={`attendance-item${checked.has(s.id) ? ' attendance-item--checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked.has(s.id)}
                            onChange={() => toggleStudent(s.id)}
                          />
                          <span className="attendance-name">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                className="btn-primary"
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ marginTop: 16 }}
              >
                {saving ? '儲存中…' : '儲存點名'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 管理應到名單 modal ── */}
      {editRoster && (
        <div className="modal-overlay" onClick={() => !rosterSaving && setEditRoster(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedGroupName}・應到名單</h3>
              <button type="button" className="modal-close" onClick={() => !rosterSaving && setEditRoster(false)}>✕</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="搜尋學生姓名"
                value={rosterFilter}
                onChange={e => setRosterFilter(e.target.value)}
                className="roster-filter-input"
                autoFocus
              />
              <div className="roster-summary">
                已選 {rosterDraft.size} 人 / 共 {students.length} 人
              </div>
              <div className="roster-list">
                {filteredForRoster.length === 0 ? (
                  <div className="empty-hint">沒有符合條件的學生</div>
                ) : (
                  filteredForRoster.map(s => (
                    <label
                      key={s.id}
                      className={`attendance-item${rosterDraft.has(s.id) ? ' attendance-item--checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={rosterDraft.has(s.id)}
                        onChange={() => toggleRosterDraft(s.id)}
                      />
                      <span className="attendance-name">{s.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setEditRoster(false)} disabled={rosterSaving}>取消</button>
              <button type="button" className="btn-primary" onClick={saveRoster} disabled={rosterSaving}>
                {rosterSaving ? '儲存中…' : '儲存名單'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
