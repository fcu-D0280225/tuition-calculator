import { useState, useEffect, useMemo } from 'react'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { apiListLessons, apiListGroupRecords } from '../data/api.js'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadStudents(); loadTeachers(); loadGroups() }, [loadStudents, loadTeachers, loadGroups])

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const fromStr = fmtDate(weekStart)
  const toStr   = fmtDate(weekEnd)

  useEffect(() => {
    if (!personId) { setLessons([]); setGroupRecords([]); return }
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
    Promise.all([lessonReq, groupReq])
      .then(([ls, grs]) => {
        if (cancelled) return
        setLessons(ls); setGroupRecords(grs)
      })
      .catch(() => { if (!cancelled) setError('載入課表失敗') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mode, personId, fromStr, toStr])

  const personList = mode === 'student' ? studentsState.students : teachersState.teachers
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
        sub: mode === 'student' ? l.teacher_name : l.student_name,
        note: l.note,
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
        sub: mode === 'student' ? l.teacher_name : l.student_name,
        hours: l.hours,
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
        <div className="empty-hint">請先選擇{personLabel}</div>
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
                  return (
                    <div
                      key={`${it.kind}-${it.id}`}
                      className={`schedule-item schedule-item--${it.kind}`}
                      style={{ top: Math.max(0, top), height: Math.max(20, height) }}
                      title={it.note || ''}
                    >
                      <div className="schedule-item-time">
                        {pad(Math.floor(it.startMin / 60))}:{pad(it.startMin % 60)}
                      </div>
                      <div className="schedule-item-title">{it.title}</div>
                      {it.sub && <div className="schedule-item-sub">{it.sub}</div>}
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
                {noTimeItems.map(it => (
                  <li key={it.id}>
                    {it.date}・{it.title}
                    {it.sub && <span style={{ color: 'var(--muted)' }}>（{it.sub}）</span>}
                    {it.hours && <span style={{ color: 'var(--muted)' }}>・{it.hours} 小時</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
