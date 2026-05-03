import { useState, useEffect, useMemo } from 'react'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import {
  apiListLessons, apiListGroupRecords,
  apiListStudentLeaveRequests, apiCreateLeaveRequest, apiDeleteLeaveRequest,
} from '../data/api.js'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n) { return String(n).padStart(2, '0') }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function startOfWeek(d) {
  const x = new Date(d)
  const dow = x.getDay() // 0=Sun
  const diff = (dow + 6) % 7 // 週一為起始
  x.setDate(x.getDate() - diff)
  x.setHours(0, 0, 0, 0)
  return x
}
function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function timeToMinutes(t) {
  if (!t) return null
  const [h, m] = String(t).split(':').map(s => parseInt(s, 10))
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

const HOUR_PX = 48
const MIN_HOUR = 7
const MAX_HOUR = 22 // 顯示 7:00 ~ 22:00（最後一格 22:00 起算 1 小時）

export default function SchedulePage() {
  const { state: studentsState, loadStudents } = useStudents()
  const { state: teachersState, loadTeachers } = useTeachers()
  const { state: groupsState, loadGroups } = useGroups()

  const [mode, setMode] = useState('student')   // 'student' | 'teacher'
  const [personId, setPersonId] = useState('')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [lessons, setLessons] = useState([])
  const [groupRecords, setGroupRecords] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 請假 modal 狀態
  const [leaveModal, setLeaveModal] = useState(null) // { lessonId, studentId, studentName, courseId, courseName, leaveDate, reason }
  const [leaveSaving, setLeaveSaving] = useState(false)
  const [leaveErr, setLeaveErr] = useState('')

  useEffect(() => { loadStudents(); loadTeachers(); loadGroups() }, [loadStudents, loadTeachers, loadGroups])

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const fromStr = fmtDate(weekStart)
  const toStr   = fmtDate(weekEnd)

  async function reloadLeaves(studentId) {
    if (!studentId) { setLeaveRequests([]); return }
    try {
      const lr = await apiListStudentLeaveRequests(studentId, { from: fromStr, to: toStr })
      setLeaveRequests(lr)
    } catch { /* keep silent — UI without 請假 標記 is acceptable */ }
  }

  useEffect(() => {
    if (!personId) { setLessons([]); setGroupRecords([]); setLeaveRequests([]); return }
    let cancelled = false
    setLoading(true); setError('')
    const lessonReq = apiListLessons(
      mode === 'student'
        ? { from: fromStr, to: toStr, student_id: personId }
        : { from: fromStr, to: toStr, teacher_id: personId }
    )
    const groupReq = mode === 'student'
      ? apiListGroupRecords({ from: fromStr, to: toStr, student_id: personId })
      : Promise.resolve([])
    const leaveReq = mode === 'student'
      ? apiListStudentLeaveRequests(personId, { from: fromStr, to: toStr })
      : Promise.resolve([])
    Promise.all([lessonReq, groupReq, leaveReq])
      .then(([ls, grs, lvs]) => {
        if (cancelled) return
        setLessons(ls); setGroupRecords(grs); setLeaveRequests(lvs)
      })
      .catch(() => { if (!cancelled) setError('載入課表失敗') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mode, personId, fromStr, toStr])

  // (student_id, course_id, leave_date) → leave request
  const leaveMap = useMemo(() => {
    const m = new Map()
    for (const lv of leaveRequests) {
      const key = `${lv.student_id}::${lv.course_id}::${String(lv.leave_date).slice(0, 10)}`
      m.set(key, lv)
    }
    return m
  }, [leaveRequests])

  function findLeaveForLesson(l) {
    if (!l) return null
    return leaveMap.get(`${l.student_id || personId}::${l.course_id}::${String(l.lesson_date).slice(0, 10)}`) || null
  }

  function openLeaveModal(lesson) {
    setLeaveErr('')
    setLeaveModal({
      lessonId: lesson.id,
      studentId: lesson.student_id || personId,
      studentName: lesson.student_name || '',
      courseId: lesson.course_id,
      courseName: lesson.course_name,
      leaveDate: String(lesson.lesson_date).slice(0, 10),
      reason: '',
    })
  }

  async function submitLeave() {
    if (!leaveModal) return
    const reason = leaveModal.reason.trim()
    if (!reason) { setLeaveErr('請填寫請假原因'); return }
    setLeaveSaving(true); setLeaveErr('')
    try {
      await apiCreateLeaveRequest({
        student_id: leaveModal.studentId,
        course_id:  leaveModal.courseId,
        leave_date: leaveModal.leaveDate,
        reason,
      })
      await reloadLeaves(mode === 'student' ? personId : leaveModal.studentId)
      setLeaveModal(null)
    } catch (e) {
      setLeaveErr('送出失敗：' + (e?.message?.includes('400') ? '請檢查資料格式' : '伺服器錯誤'))
    } finally { setLeaveSaving(false) }
  }

  async function cancelLeave(leaveId) {
    if (!window.confirm('確定要取消這筆請假？')) return
    try {
      await apiDeleteLeaveRequest(leaveId)
      await reloadLeaves(personId)
    } catch { setError('取消請假失敗') }
  }

  const personList = mode === 'student'
    ? studentsState.students.filter(s => s.active !== 0)
    : teachersState.teachers.filter(t => t.active !== 0)
  const personLabel = mode === 'student' ? '學生' : '老師'

  // 把 lessons / group records 攤平成 calendar items
  const items = useMemo(() => {
    const out = []
    for (const l of lessons) {
      const t = timeToMinutes(l.start_time)
      if (t === null) continue
      const dateStr = String(l.lesson_date).slice(0, 10)
      const d = new Date(dateStr + 'T00:00:00')
      const dayIdx = (d.getDay() + 6) % 7 // 週一=0
      out.push({
        kind: 'lesson',
        id: l.id,
        dayIdx,
        startMin: t,
        durationMin: Math.max(15, Math.round(parseFloat(l.hours) * 60)),
        title: l.course_name,
        sub: mode === 'student' ? (l.teacher_name || '未指派老師') : l.student_name,
        note: l.note,
        lesson: l,
      })
    }
    for (const gr of groupRecords) {
      const t = timeToMinutes(gr.group_start_time)
      if (t === null) continue
      const dateStr = String(gr.record_date).slice(0, 10)
      const d = new Date(dateStr + 'T00:00:00')
      const dayIdx = (d.getDay() + 6) % 7
      const dh = parseFloat(gr.group_duration_hours || 0)
      out.push({
        kind: 'group',
        id: gr.id,
        dayIdx,
        startMin: t,
        durationMin: Math.max(15, Math.round((dh > 0 ? dh : 1) * 60)),
        title: '團 ' + gr.group_name,
        sub: mode === 'student' ? '' : '',
        note: gr.note,
      })
    }
    return out
  }, [lessons, groupRecords, mode])

  const noTimeItems = useMemo(() => (
    [
      ...lessons.filter(l => !l.start_time).map(l => ({
        kind: 'lesson', id: l.id,
        date: String(l.lesson_date).slice(0, 10),
        title: l.course_name,
        sub: mode === 'student' ? (l.teacher_name || '未指派老師') : l.student_name,
        hours: l.hours,
        lesson: l,
      })),
    ]
  ), [lessons, mode])

  function shiftWeek(delta) {
    setWeekStart(prev => addDays(prev, 7 * delta))
  }
  function gotoToday() {
    setWeekStart(startOfWeek(new Date()))
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>課表</h1>
      </div>

      <div className="filter-bar">
        <select value={mode} onChange={e => { setMode(e.target.value); setPersonId('') }}>
          <option value="student">學生課表</option>
          <option value="teacher">老師課表</option>
        </select>
        <select value={personId} onChange={e => setPersonId(e.target.value)}>
          <option value="">── 請選擇{personLabel} ──</option>
          {personList.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <button className="btn-sm" type="button" onClick={() => shiftWeek(-1)}>← 上一週</button>
        <button className="btn-sm" type="button" onClick={gotoToday}>本週</button>
        <button className="btn-sm" type="button" onClick={() => shiftWeek(1)}>下一週 →</button>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{fromStr} ~ {toStr}</span>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!personId ? (
        <div className="empty-hint">請從上方選擇{personLabel}，即可查看當週課表</div>
      ) : loading ? (
        <div className="loading">載入中⋯</div>
      ) : (
        <>
          <div className="schedule-grid">
            <div className="schedule-corner"></div>
            {Array.from({ length: 7 }).map((_, i) => {
              const d = addDays(weekStart, i)
              const isToday = fmtDate(d) === fmtDate(new Date())
              return (
                <div key={i} className={`schedule-day-header${isToday ? ' is-today' : ''}`}>
                  <div className="schedule-dow">週{WEEKDAYS[d.getDay()]}</div>
                  <div className="schedule-date">{pad(d.getMonth() + 1)}/{pad(d.getDate())}</div>
                </div>
              )
            })}

            <div className="schedule-times">
              {Array.from({ length: MAX_HOUR - MIN_HOUR + 1 }).map((_, i) => (
                <div key={i} className="schedule-time-cell" style={{ height: HOUR_PX }}>
                  {pad(MIN_HOUR + i)}:00
                </div>
              ))}
            </div>

            {Array.from({ length: 7 }).map((_, dayIdx) => (
              <div
                key={dayIdx}
                className="schedule-day-col"
                style={{ height: HOUR_PX * (MAX_HOUR - MIN_HOUR + 1) }}
              >
                {Array.from({ length: MAX_HOUR - MIN_HOUR + 1 }).map((_, i) => (
                  <div key={i} className="schedule-hour-line" style={{ top: HOUR_PX * i }}></div>
                ))}
                {items.filter(it => it.dayIdx === dayIdx).map(it => {
                  const startOffsetMin = it.startMin - MIN_HOUR * 60
                  const top = (startOffsetMin / 60) * HOUR_PX
                  const height = (it.durationMin / 60) * HOUR_PX
                  if (top + height < 0 || top > HOUR_PX * (MAX_HOUR - MIN_HOUR + 1)) return null
                  const leave = it.kind === 'lesson' && mode === 'student' ? findLeaveForLesson(it.lesson) : null
                  const isOnLeave = !!leave
                  return (
                    <div
                      key={`${it.kind}-${it.id}`}
                      className={`schedule-item schedule-item--${it.kind}${isOnLeave ? ' schedule-item--leave' : ''}`}
                      style={{ top: Math.max(0, top), height: Math.max(20, height) }}
                      title={leave ? `(請假) ${leave.reason}` : (it.note || '')}
                    >
                      <div className="schedule-item-time">
                        {pad(Math.floor(it.startMin / 60))}:{pad(it.startMin % 60)}
                      </div>
                      <div className="schedule-item-title">
                        {isOnLeave && <span className="leave-tag">(請假)</span>}
                        {it.title}
                      </div>
                      {it.sub && <div className="schedule-item-sub">{it.sub}</div>}
                      {it.kind === 'lesson' && mode === 'student' && (
                        isOnLeave ? (
                          <button
                            type="button"
                            className="schedule-item-leave-btn"
                            onClick={(e) => { e.stopPropagation(); cancelLeave(leave.id) }}
                            title={`原因：${leave.reason}（點擊取消請假）`}
                          >取消請假</button>
                        ) : (
                          <button
                            type="button"
                            className="schedule-item-leave-btn"
                            onClick={(e) => { e.stopPropagation(); openLeaveModal(it.lesson) }}
                          >請假</button>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {noTimeItems.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="form-section-title" style={{ marginBottom: 8 }}>未排時段的紀錄</div>
              <ul className="schedule-no-time-list">
                {noTimeItems.map(it => {
                  const leave = it.kind === 'lesson' && mode === 'student' ? findLeaveForLesson(it.lesson) : null
                  return (
                    <li key={it.id}>
                      {it.date}・{leave && <span className="leave-tag">(請假)</span>}{it.title}
                      {it.sub && <span style={{ color: 'var(--muted)' }}>（{it.sub}）</span>}
                      {it.hours && <span style={{ color: 'var(--muted)' }}>・{it.hours} 小時</span>}
                      {it.kind === 'lesson' && mode === 'student' && (
                        leave ? (
                          <button className="btn-sm" style={{ marginLeft: 8 }} onClick={() => cancelLeave(leave.id)}>取消請假</button>
                        ) : (
                          <button className="btn-sm" style={{ marginLeft: 8 }} onClick={() => openLeaveModal(it.lesson)}>請假</button>
                        )
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {leaveModal && (
            <div className="leave-modal-overlay" onClick={() => !leaveSaving && setLeaveModal(null)}>
              <div className="leave-modal" onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>申請請假</h3>
                <div style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 14 }}>
                  {leaveModal.studentName ? `${leaveModal.studentName}・` : ''}{leaveModal.courseName}
                </div>
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>請假日期</div>
                  <input
                    type="date"
                    value={leaveModal.leaveDate}
                    onChange={e => setLeaveModal(m => ({ ...m, leaveDate: e.target.value }))}
                    disabled={leaveSaving}
                  />
                </label>
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>請假原因 <span style={{ color: 'var(--danger, #d33)' }}>*</span></div>
                  <textarea
                    rows={4}
                    value={leaveModal.reason}
                    onChange={e => setLeaveModal(m => ({ ...m, reason: e.target.value }))}
                    placeholder="例如：身體不適、家庭因素…"
                    disabled={leaveSaving}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </label>
                {leaveErr && <div className="error-msg">{leaveErr}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button className="btn-sm" type="button" onClick={() => setLeaveModal(null)} disabled={leaveSaving}>取消</button>
                  <button className="btn-sm btn-primary" type="button" onClick={submitLeave} disabled={leaveSaving}>
                    {leaveSaving ? '送出中⋯' : '送出'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
