import { useState, useEffect, useRef } from 'react'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import Combobox from '../components/Combobox.jsx'
import {
  apiListGroupRecords, apiCreateGroupRecord, apiUpdateGroupRecord, apiDeleteGroupRecord,
  apiListGroupMembers, apiSetGroupMembers,
  apiListLessons, apiCreateLesson, apiUpdateLesson, apiDeleteLesson,
  apiListAllEnrollments,
  apiCreateLeaveRequest, apiDeleteLeaveRequest, apiListStudentLeaveRequests,
} from '../data/api.js'
import { genId } from '../utils/ids.js'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function buildLineMessage(groupName, date, studentNames, startTime = '') {
  const d = new Date(date + 'T00:00:00')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const dateStr = `${date.slice(5).replace('-', '/')}（${weekdays[d.getDay()]}）`
  const timeStr = startTime ? ` ${startTime}` : ''
  const names = studentNames.join('、')
  return `【補習班】${dateStr}${timeStr} 到班：\n${names}（共 ${studentNames.length} 人）\n✅ 點名完成`
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

// 家教課：單一 session（同老師同開始時間）的點名卡
function TutoringSessionCard({ session, allStudents, teachers, leaveMap, leaveBusy, onToggleLeave, onSaved, headerLabel, selectedDate }) {
  const [teacherId, setTeacherId] = useState(session.teacher_id || '')
  const [startTime, setStartTime] = useState(session.start_time || '')
  const [hours,     setHours]     = useState(session.hours || '1')
  const [checked,   setChecked]   = useState(new Set(session.attendedSet))
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  const rosterIds = Object.keys(session.existingMap)
  const roster = allStudents.filter(s => rosterIds.includes(s.id))
  const presentCount = roster.filter(s => checked.has(s.id)).length
  const allChecked = roster.length > 0 && roster.every(s => checked.has(s.id))

  function toggleAll() {
    setChecked(prev => {
      const n = new Set(prev)
      if (allChecked) roster.forEach(s => n.delete(s.id))
      else            roster.forEach(s => n.add(s.id))
      return n
    })
  }
  function toggleOne(sid) {
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(sid)) n.delete(sid); else n.add(sid)
      return n
    })
  }

  async function save() {
    setSaving(true); setErr('')
    const h = parseFloat(hours)
    if (isNaN(h) || h <= 0) { setErr('請輸入有效時數'); setSaving(false); return }
    try {
      await Promise.all(rosterIds.map(sid =>
        apiUpdateLesson(session.existingMap[sid], {
          teacher_id: teacherId,
          hours: h,
          start_time: startTime || null,
          status: checked.has(sid) ? 'attended' : 'pending',
        })
      ))
      onSaved?.()
    } catch (e) {
      setErr(`儲存失敗：${e?.message || e}`)
    } finally { setSaving(false) }
  }

  const tName = teachers.find(t => t.id === teacherId)?.name || '（未設老師）'

  return (
    <div className="lesson-form-card" style={{ marginTop: 12 }}>
      <div className="form-section-title attendance-header-row">
        <span>{headerLabel}・{selectedDate}{startTime ? `・${startTime}` : ''}・{tName}</span>
        <span className="attendance-count">出席 <strong>{presentCount}</strong> / {roster.length} 人</span>
      </div>

      {/* 課堂資訊（可調整） */}
      <div className="lesson-form" style={{ marginBottom: 12 }}>
        <div className="lesson-form-row">
          <label>老師
            <Combobox items={teachers} value={teacherId} onChange={setTeacherId} placeholder="搜尋老師…" />
          </label>
          <label>開始時間
            <input type="time" step="900" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </label>
          <label>時數
            <input type="number" min="0.5" step="0.5" className="hours-input" value={hours} onChange={e => setHours(e.target.value)} />
          </label>
        </div>
      </div>

      {/* 點名清單 */}
      {roster.length === 0 ? (
        <div className="empty-hint">本堂無學生</div>
      ) : (
        <div className="attendance-list">
          <label className="attendance-item attendance-item-all">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            <span>全選</span>
          </label>
          {roster.map(s => {
            const recId = session.existingMap[s.id]
            const onLeave = !!leaveMap[recId]
            return (
              <div
                key={s.id}
                className={`attendance-item${checked.has(s.id) ? ' attendance-item--checked' : ''}${onLeave ? ' attendance-item--leave' : ''}`}
              >
                <input type="checkbox" checked={checked.has(s.id)} disabled={onLeave} onChange={() => toggleOne(s.id)} />
                <span className="attendance-name">
                  {s.name}
                  {onLeave && <span className="leave-tag" style={{ marginLeft: 6 }}>請假</span>}
                </span>
                <button type="button" className="btn-sm" style={{ marginLeft: 'auto' }}
                  disabled={leaveBusy === recId}
                  onClick={() => onToggleLeave({ studentId: s.id, recordId: recId })}>
                  {onLeave ? '取消請假' : '請假'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {err && <div className="error-msg">{err}</div>}
      <button className="btn-primary" type="button" onClick={save} disabled={saving} style={{ marginTop: 12 }}>
        {saving ? '儲存中…' : '儲存點名'}
      </button>
    </div>
  )
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
  // 團課的老師、開始時間、時數（中間格子可編輯，預設帶該團課的設定）
  const [groupTeacher, setGroupTeacher]   = useState('')
  const [groupStart,   setGroupStart]     = useState('')
  const [groupHours,   setGroupHours]     = useState('')

  // 家教課專用
  const [selectedCourse, setSelectedCourse]   = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [tutoringHours, setTutoringHours]     = useState('1')
  const [tutoringStart, setTutoringStart]     = useState('')
  const [courseMemberIds, setCourseMemberIds] = useState(new Set())

  // 請假：student_id -> leave_request_id（針對目前選定的課/日期）
  const [leaveMap, setLeaveMap] = useState({})
  const [leaveBusy, setLeaveBusy] = useState(null) // student_id 正在處理

  // student_id -> record_id
  const [existingMap, setExistingMap] = useState({})
  const [checked, setChecked] = useState(new Set())
  // 家教課 sessions：依 (teacher_id, start_time) 切成多個堂次
  // [{ key, teacher_id, start_time, hours, records:[], existingMap, attendedSet }]
  const [tutoringSessions, setTutoringSessions] = useState([])
  // 應到名單 student_id（DB: group_members）
  const [memberIds, setMemberIds] = useState(new Set())

  const [reloadTick, setReloadTick] = useState(0)
  const [loaded,     setLoaded]     = useState(false)
  const [fetching,   setFetching]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [attendedNames, setAttendedNames] = useState([])

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

  // 切換團課時拉應到名單 + 帶入預設老師 / 開始時間 / 時數
  useEffect(() => {
    if (mode !== 'group' || !selectedGroup) {
      setMemberIds(new Set())
      return
    }
    apiListGroupMembers(selectedGroup)
      .then(rows => setMemberIds(new Set(rows.map(r => r.id))))
      .catch(() => {})
    const g = groupsState.groups.find(g => g.id === selectedGroup)
    if (g) {
      setGroupTeacher(g.default_teacher_id || '')
      setGroupStart(g.start_time ? String(g.start_time).slice(0, 5) : '')
      setGroupHours(g.duration_hours != null ? String(g.duration_hours) : '')
    }
  }, [mode, selectedGroup, groupsState.groups])

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
      if (!selectedCourse || !selectedDate) return
    }

    const abortCtrl = new AbortController()
    loadAbortRef.current = abortCtrl

    setFetching(true)
    // 同一天同一課程可能有多個班別（不同老師），不過濾 teacher_id 把所有班別合併進來
    const fetcher = mode === 'group'
      ? apiListGroupRecords({ from: selectedDate, to: selectedDate, group_id: selectedGroup })
      : apiListLessons({ from: selectedDate, to: selectedDate, course_id: selectedCourse })
    fetcher
      .then(records => {
        if (abortCtrl.signal.aborted) return
        if (mode === 'group') {
          const map = {}
          const ids = new Set()
          const usable = []
          for (const r of records) {
            if (r.status === 'pre_enroll') continue
            map[r.student_id] = r.id
            if (r.status === 'attended') ids.add(r.student_id)
            usable.push(r)
          }
          setExistingMap(map)
          setChecked(ids)
          const sample = usable[0]
          if (sample?.teacher_id) setGroupTeacher(sample.teacher_id)
        } else {
          // 家教課：按 (teacher_id, start_time) 拆 sessions
          const grouped = new Map()
          for (const r of records) {
            if (r.status === 'pre_enroll') continue
            const tid = r.teacher_id || ''
            const st  = r.start_time ? String(r.start_time).slice(0, 5) : ''
            const key = `${tid}::${st}`
            if (!grouped.has(key)) {
              grouped.set(key, {
                key,
                teacher_id: tid,
                start_time: st,
                hours: r.hours != null ? String(r.hours) : '1',
                records: [],
                existingMap: {},
                attendedSet: new Set(),
              })
            }
            const s = grouped.get(key)
            s.records.push(r)
            s.existingMap[r.student_id] = r.id
            if (r.status === 'attended') s.attendedSet.add(r.student_id)
          }
          // 排序：依 start_time 升冪
          const list = Array.from(grouped.values()).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
          setTutoringSessions(list)
        }
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
  }, [mode, selectedGroup, selectedDate, selectedCourse, reloadTick])

  // 載入請假紀錄；leaveMap key = lesson_record_id（一堂一條）
  useEffect(() => {
    setLeaveMap({})
    if (mode !== 'tutoring' || !selectedDate || !selectedCourse) return
    // 收集所有 session 中 (student_id → record_id) 對應
    const recIdByStudent = new Map()
    const studentIds = new Set()
    for (const s of tutoringSessions) {
      for (const [sid, rid] of Object.entries(s.existingMap)) {
        if (!recIdByStudent.has(sid)) recIdByStudent.set(sid, [])
        recIdByStudent.get(sid).push(rid)
        studentIds.add(sid)
      }
    }
    if (studentIds.size === 0) return
    let cancelled = false
    Promise.all(Array.from(studentIds).map(sid =>
      apiListStudentLeaveRequests(sid, { from: selectedDate, to: selectedDate })
        .then(rows => [sid, rows.filter(r => r.course_id === selectedCourse)])
        .catch(() => [sid, []])
    )).then(pairs => {
      if (cancelled) return
      const m = {}
      for (const [sid, rows] of pairs) {
        for (const lv of rows) {
          if (lv.lesson_record_id) {
            // 精準綁堂次
            m[lv.lesson_record_id] = lv.id
          } else {
            // 舊資料沒綁堂次：套用到該學生今天該課所有 record
            for (const rid of (recIdByStudent.get(sid) || [])) m[rid] = lv.id
          }
        }
      }
      setLeaveMap(m)
    })
    return () => { cancelled = true }
  }, [mode, selectedCourse, selectedDate, tutoringSessions])

  // toggleLeave({ studentId, recordId }) — 必須指定哪一堂
  async function toggleLeave({ studentId, recordId }) {
    if (leaveBusy) return
    if (leaveMap[recordId] && !window.confirm('確定要取消這筆請假？')) return
    setLeaveBusy(recordId)
    try {
      if (leaveMap[recordId]) {
        await apiDeleteLeaveRequest(leaveMap[recordId])
        setLeaveMap(m => { const n = { ...m }; delete n[recordId]; return n })
      } else {
        const reason = window.prompt('請假原因？', '臨時請假')
        if (reason === null) { setLeaveBusy(null); return }
        const r = await apiCreateLeaveRequest({
          student_id: studentId,
          course_id:  selectedCourse,
          leave_date: selectedDate,
          reason: reason.trim() || '臨時請假',
          lesson_record_id: recordId,
        })
        setLeaveMap(m => ({ ...m, [recordId]: r?.id || true }))
        setReloadTick(t => t + 1)
      }
    } catch (e) {
      setError(`請假操作失敗：${e?.message || e}`)
    } finally {
      setLeaveBusy(null)
    }
  }

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

  // 應到名單：必須先有當日的上課紀錄（existingMap 中的學生 id）才會顯示
  // 點名只用來「確認/取消」既有紀錄，不再做新建
  const effectiveMemberIds = new Set(Object.keys(existingMap))

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
      const rosterIds = new Set(Object.keys(existingMap))

      if (mode === 'group') {
        // 對所有現有紀錄 PATCH：teacher_id 同步、status 依勾選決定
        await Promise.all(
          Array.from(rosterIds).map(sid =>
            apiUpdateGroupRecord(existingMap[sid], {
              teacher_id: groupTeacher || null,
              status: checked.has(sid) ? 'attended' : 'pending',
            })
          )
        )
      } else {
        const hours = parseFloat(tutoringHours)
        if (isNaN(hours) || hours <= 0) { setError('請輸入有效時數'); setSaving(false); return }
        await Promise.all(
          Array.from(rosterIds).map(sid =>
            apiUpdateLesson(existingMap[sid], {
              teacher_id: selectedTeacher,
              hours,
              start_time: tutoringStart || null,
              status: checked.has(sid) ? 'attended' : 'pending',
            })
          )
        )
      }

      const fresh = mode === 'group'
        ? await apiListGroupRecords({ from: selectedDate, to: selectedDate, group_id: selectedGroup })
        : await apiListLessons({ from: selectedDate, to: selectedDate, course_id: selectedCourse })
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
  const activeTeachers = teachers.filter(t => t.active !== 0)
  const selectedGroupObj    = groups.find(g => g.id === selectedGroup) || null
  const selectedGroupName   = selectedGroupObj?.name || ''
  const selectedCourseName  = courses.find(c => c.id === selectedCourse)?.name || ''
  const selectedTeacherName = teachers.find(t => t.id === selectedTeacher)?.name || ''
  const startTimeLabel = mode === 'group' ? groupStart : tutoringStart

  // 團課：選定日期是否落在該班週幾
  const groupWeekdays = (selectedGroupObj?.weekdays || '')
    .split(',')
    .map(s => parseInt(s, 10))
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
  const dateWeekday = selectedDate ? new Date(selectedDate + 'T00:00:00').getDay() : null
  const dateMatchesGroup = mode !== 'group' || dateWeekday === null || groupWeekdays.length === 0
    ? true
    : groupWeekdays.includes(dateWeekday)
  const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']
  const headerLabel = mode === 'group'
    ? selectedGroupName
    : (selectedCourseName ? `${selectedCourseName}・${selectedTeacherName}` : '')

  const rosterStudents = students.filter(s => effectiveMemberIds.has(s.id))
  const rosterFilterLower = rosterFilter.trim().toLowerCase()
  const filteredForRoster = rosterFilterLower
    ? students.filter(s => s.name.toLowerCase().includes(rosterFilterLower))
    : students

  const rosterCount  = rosterStudents.length
  const presentCount = rosterStudents.filter(s => checked.has(s.id)).length
  const rosterAllChecked = rosterCount > 0 && rosterStudents.every(s => checked.has(s.id))

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
                onClick={() => openLineShare(buildLineMessage(headerLabel, selectedDate, attendedNames, startTimeLabel))}
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

      {/* ── (1) 選擇課堂與日期 ── */}
      <div className="lesson-form-card">
        <div className="form-section-title">選擇課堂與日期</div>
        <div className="lesson-form">
          <div className="lesson-form-row">
            {mode === 'group' ? (
              <label>團課
                <Combobox
                  items={groups}
                  value={selectedGroup}
                  onChange={setSelectedGroup}
                  placeholder="搜尋團課…"
                />
              </label>
            ) : (
              <label>家教課
                <Combobox
                  items={courses}
                  value={selectedCourse}
                  onChange={id => { setSelectedCourse(id); setSelectedTeacher('') }}
                  placeholder="搜尋家教課…"
                />
              </label>
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

      {/* ── (2) 課堂資訊（團課用，家教課每堂自帶） ── */}
      {mode === 'group' && selectedGroup && (
        <div className="lesson-form-card">
          <div className="form-section-title">課堂資訊（可調整）</div>
          <div className="lesson-form">
            <div className="lesson-form-row">
              <label>老師
                <Combobox items={activeTeachers} value={groupTeacher} onChange={setGroupTeacher} placeholder="搜尋老師…" />
              </label>
              <label>開始時間
                <input type="time" step="900" value={groupStart} onChange={e => setGroupStart(e.target.value)} />
              </label>
              <label>時數
                <input type="number" min="0.5" step="0.5" value={groupHours}
                  onChange={e => setGroupHours(e.target.value)} className="hours-input" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── 點名表 ── */}
      {fetching && (
        <div className="lesson-form-card" style={{ color: 'var(--muted)', fontSize: 14 }}>
          載入中…
        </div>
      )}

      {!fetching && loaded && !dateMatchesGroup && (
        <div className="lesson-form-card" style={{ color: 'var(--muted)' }}>
          <div className="form-section-title">{headerLabel}・{selectedDate}</div>
          <div className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>
            該日期（星期{weekdayLabels[dateWeekday]}）不在此團課的上課日（星期 {groupWeekdays.map(d => weekdayLabels[d]).join('、')}），無需點名。
          </div>
        </div>
      )}

      {/* 團課點名表（單一 session） */}
      {!fetching && loaded && dateMatchesGroup && mode === 'group' && (
        <div className="lesson-form-card">
          <div className="form-section-title attendance-header-row">
            <span>{headerLabel}・{selectedDate}{startTimeLabel ? `・${startTimeLabel}` : ''}</span>
            <span className="attendance-count">
              出席 <strong>{presentCount}</strong>
              {rosterCount > 0 && <> / 應到 {rosterCount}</>} 人
            </span>
          </div>

          {students.length === 0 ? (
            <div className="empty-hint">尚未新增任何學生</div>
          ) : (
            <>
              <div className="attendance-section-label attendance-roster-header">
                <span>應到名單（{rosterCount} 人）</span>
              </div>

              {rosterCount === 0 ? (
                <div className="empty-hint">此團課當日尚無上課紀錄。請先到「團課上課紀錄」頁建立後再來點名。</div>
              ) : (
                <div className="attendance-list">
                  <label className="attendance-item attendance-item-all">
                    <input type="checkbox" checked={rosterAllChecked} onChange={handleToggleAllRoster} />
                    <span>全選應到</span>
                  </label>
                  {rosterStudents.map(s => (
                    <div key={s.id}
                      className={`attendance-item${checked.has(s.id) ? ' attendance-item--checked' : ''}`}>
                      <input type="checkbox" checked={checked.has(s.id)} onChange={() => toggleStudent(s.id)} />
                      <span className="attendance-name">{s.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn-primary" type="button" onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
                {saving ? '儲存中…' : '儲存點名'}
              </button>
            </>
          )}
        </div>
      )}

      {/* 家教課點名表（每堂分卡） */}
      {!fetching && loaded && mode === 'tutoring' && (
        tutoringSessions.length === 0 ? (
          <div className="lesson-form-card" style={{ color: 'var(--muted)' }}>
            <div className="form-section-title">{headerLabel}・{selectedDate}</div>
            <div className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>
              此家教課當日尚無上課紀錄。請先到「家教課上課紀錄」頁建立後再來點名。
            </div>
          </div>
        ) : (
          tutoringSessions.map(s => (
            <TutoringSessionCard
              key={s.key}
              session={s}
              allStudents={students}
              teachers={activeTeachers}
              leaveMap={leaveMap}
              leaveBusy={leaveBusy}
              onToggleLeave={toggleLeave}
              onSaved={() => setReloadTick(t => t + 1)}
              headerLabel={headerLabel}
              selectedDate={selectedDate}
            />
          ))
        )
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
