import { useEffect, useMemo, useState } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import Combobox from '../components/Combobox.jsx'
import { apiCreateLessonWithDupCheck, apiGetStudentEnrollment, apiSetStudentEnrollment } from '../data/api.js'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n) { return String(n).padStart(2, '0') }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

export default function StudentEnrollPage({ studentId, studentName, onBack }) {
  const { state: coursesState, loadCourses } = useCourses()
  const { state: teachersState, loadTeachers } = useTeachers()
  const { state: groupsState, loadGroups } = useGroups()

  const [step, setStep] = useState('pick-course') // 'pick-course' | 'pick-dates'
  const [courseId, setCourseId] = useState(null)
  // 第 2 步改為：選週幾 + 設定每個週幾的時間，自動建立本月剩餘的對應日期
  const [weekdayTimes, setWeekdayTimes] = useState(new Map()) // Map<0..6, timeStr>
  const [pendingWeekday, setPendingWeekday] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(null) // null=載入中, Set=已載入
  const [enrolledGroupIds, setEnrolledGroupIds] = useState(null)
  const [groupBusy, setGroupBusy] = useState(null) // group_id 正在處理
  const [groupMsg, setGroupMsg] = useState('')
  const [overrideTeacherId, setOverrideTeacherId] = useState('')

  useEffect(() => { loadCourses(); loadTeachers(); loadGroups() }, [loadCourses, loadTeachers, loadGroups])

  useEffect(() => {
    let cancelled = false
    apiGetStudentEnrollment(studentId)
      .then(data => {
        if (cancelled) return
        setEnrolledCourseIds(new Set(data.course_ids || []))
        setEnrolledGroupIds(new Set(data.group_ids || []))
      })
      .catch(() => {
        if (cancelled) return
        setEnrolledCourseIds(new Set())
        setEnrolledGroupIds(new Set())
      })
    return () => { cancelled = true }
  }, [studentId])

  const [courseBusy, setCourseBusy] = useState(null)
  const [courseMsg, setCourseMsg] = useState('')

  async function removeEnrolledCourse(c) {
    if (courseBusy) return
    const ok = window.confirm(
      `確定要把「${c.name}」從「已選課程」中移除？\n\n` +
      `⚠️ 注意：\n` +
      `• 已建立的上課紀錄不會被刪除，仍會列入學費計算\n` +
      `• 不需要的紀錄請操作人員手動到「上課紀錄」頁刪除\n` +
      `• 若再次選回此課程並建立日期，可能與既有紀錄重複`
    )
    if (!ok) return
    setCourseBusy(c.id); setCourseMsg('')
    const nextSet = new Set(enrolledCourseIds || [])
    nextSet.delete(c.id)
    try {
      await apiSetStudentEnrollment(studentId, {
        course_ids: Array.from(nextSet),
        group_ids:  Array.from(enrolledGroupIds || []),
      })
      setEnrolledCourseIds(nextSet)
      setCourseMsg(`已從「已選課程」移除：${c.name}（既有上課紀錄保留，請手動處理）`)
    } catch {
      setCourseMsg('移除失敗')
    } finally {
      setCourseBusy(null)
    }
  }

  async function toggleGroup(groupId, currentlyJoined) {
    if (groupBusy) return
    if (currentlyJoined) {
      if (!window.confirm('確定要把學生從這堂團課移除？該團課既有的上課紀錄不會被刪除。')) return
    }
    setGroupBusy(groupId); setGroupMsg('')
    const nextSet = new Set(enrolledGroupIds || [])
    if (currentlyJoined) nextSet.delete(groupId); else nextSet.add(groupId)
    try {
      await apiSetStudentEnrollment(studentId, {
        course_ids: Array.from(enrolledCourseIds || []),
        group_ids:  Array.from(nextSet),
      })
      setEnrolledGroupIds(nextSet)
      setGroupMsg(currentlyJoined ? '已從團課移除' : '已加入團課（過去尚未產生的紀錄會自動補上）')
    } catch {
      setGroupMsg(currentlyJoined ? '移除失敗' : '加入失敗')
    } finally {
      setGroupBusy(null)
    }
  }

  const course = useMemo(
    () => coursesState.courses.find(c => c.id === courseId),
    [coursesState.courses, courseId]
  )
  function teacherName(id) {
    return teachersState.teachers.find(t => t.id === id)?.name || ''
  }
  function courseLabel(c) {
    const tName = c.default_teacher_id ? teacherName(c.default_teacher_id) : ''
    return tName ? `${c.name} - ${tName}` : c.name
  }

  function pickCourse(cid) {
    const c = coursesState.courses.find(x => x.id === cid)
    setCourseId(cid)
    setOverrideTeacherId(c?.default_teacher_id || '')
    setWeekdayTimes(new Map())
    setPendingWeekday(null)
    setDone(null)
    setError('')
    setStep('pick-dates')
  }

  function backToCourseList() {
    setStep('pick-course')
    setCourseId(null)
    setOverrideTeacherId('')
    setWeekdayTimes(new Map())
    setPendingWeekday(null)
    setDone(null)
    setError('')
  }

  const effectiveTeacherId = overrideTeacherId || course?.default_teacher_id || ''
  const activeTeachers = teachersState.teachers.filter(t => t.active !== 0)
  const lessonHours = course ? parseFloat(course.duration_hours ?? 1) || 1 : 1

  function toggleWeekday(w) {
    setWeekdayTimes(prev => {
      const next = new Map(prev)
      if (next.has(w)) {
        next.delete(w)
        if (pendingWeekday === w) setPendingWeekday(null)
      } else {
        next.set(w, '')
        setPendingWeekday(w)
      }
      return next
    })
  }

  function setWeekdayTime(w, time) {
    setWeekdayTimes(prev => {
      const next = new Map(prev)
      if (next.has(w)) next.set(w, time)
      return next
    })
  }

  const today = new Date()

  // 依選定的週幾，列出本月（從今天起）剩餘符合的日期
  const entriesToCreate = useMemo(() => {
    if (weekdayTimes.size === 0) return []
    const y = today.getFullYear()
    const m = today.getMonth()
    const startDay = today.getDate()
    const lastDay = new Date(y, m + 1, 0).getDate()
    const out = []
    for (let day = startDay; day <= lastDay; day++) {
      const d = new Date(y, m, day)
      const w = d.getDay()
      if (weekdayTimes.has(w)) {
        out.push({ date: fmtDate(d), time: weekdayTimes.get(w) || '', weekday: w })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekdayTimes])

  const submitDisableReason = saving
    ? '建立中，請稍候'
    : weekdayTimes.size === 0
      ? '請至少選擇一個週幾'
      : entriesToCreate.length === 0
        ? '本月剩餘日期沒有符合的週幾'
        : ''

  async function handleSubmit() {
    if (!course) return
    if (entriesToCreate.length === 0) {
      setError('本月剩餘日期沒有符合的週幾，請至少選一個週幾')
      return
    }
    setSaving(true); setError(''); setDone(null)
    const failures = []
    let skipped = 0
    for (const { date: d, time: t } of entriesToCreate) {
      try {
        await apiCreateLessonWithDupCheck({
          student_id: studentId,
          course_id: course.id,
          teacher_id: effectiveTeacherId || null,
          hours: lessonHours,
          lesson_date: d,
          start_time: t || null,
          unit_price: null,
          teacher_unit_price: null,
          note: '',
        }, (existing) => {
          const lines = existing.map(r => {
            const tt = r.start_time ? String(r.start_time).slice(0, 5) : '未排定時間'
            const teacher = r.teacher_name ? `・${r.teacher_name}` : ''
            return `• ${tt}　${r.hours} 小時${teacher}`
          })
          return window.confirm(
            `⚠️ ${d} 當天「${course.name}」已有此學生的紀錄：\n\n${lines.join('\n')}\n\n仍要再新增一筆嗎？確定後會出現重複的紀錄。`
          )
        })
      } catch (e) {
        if (e?.skipped) skipped++
        else failures.push(`${d}：${e?.message || '建立失敗'}`)
      }
    }
    const successCount = entriesToCreate.length - failures.length - skipped
    if (successCount > 0 && enrolledCourseIds && !enrolledCourseIds.has(course.id)) {
      const nextCourseIds = new Set(enrolledCourseIds)
      nextCourseIds.add(course.id)
      try {
        await apiSetStudentEnrollment(studentId, {
          course_ids: Array.from(nextCourseIds),
          group_ids:  Array.from(enrolledGroupIds || []),
        })
        setEnrolledCourseIds(nextCourseIds)
      } catch {
        // 紀錄已建立，登錄選課狀態失敗不影響本次成果；下次進來會重新載入
      }
    }
    setSaving(false)
    setDone({ total: entriesToCreate.length, failed: failures.length, skipped, failures })
    if (failures.length === 0 && skipped === 0) {
      setWeekdayTimes(new Map())
      setPendingWeekday(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn-sm" onClick={onBack}>← 返回學生名冊</button>
        <h1 style={{ margin: 0 }}>{studentName}・選課</h1>
      </div>

      {step === 'pick-course' && (
        <>
          <div className="enroll-step">
            <div className="form-section-title">家教課（選擇後到月曆排上課日）</div>
            {courseMsg && (
              <div
                className={courseMsg.startsWith('已') ? 'success-msg' : 'error-msg'}
                style={{ marginBottom: 8 }}
              >{courseMsg}</div>
            )}
            {coursesState.loading ? (
              <div className="loading">載入中⋯</div>
            ) : coursesState.courses.length === 0 ? (
              <div className="empty-hint">尚無家教課可選，請先到「家教課」頁新增</div>
            ) : (
              <div className="course-pick-grid">
                {coursesState.courses.map(c => {
                  const alreadyPicked = enrolledCourseIds?.has(c.id)
                  const busy = courseBusy === c.id
                  return (
                    <div
                      key={c.id}
                      className={`course-pick-card${alreadyPicked ? ' course-pick-card--picked' : ''}`}
                      style={{ position: 'relative', cursor: busy ? 'wait' : 'pointer' }}
                      onClick={() => {
                        if (busy) return
                        if (alreadyPicked) removeEnrolledCourse(c)
                        else pickCourse(c.id)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (busy) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          if (alreadyPicked) removeEnrolledCourse(c)
                          else pickCourse(c.id)
                        }
                      }}
                    >
                      <div className="course-pick-name">
                        {c.name}
                        {alreadyPicked && <span className="course-pick-badge">已選過</span>}
                      </div>
                      <div className="course-pick-meta">
                        {c.default_teacher_id
                          ? <>預設老師：{teacherName(c.default_teacher_id) || '—'}</>
                          : <span style={{ color: 'var(--danger, #c00)' }}>尚未設定預設老師</span>}
                        {busy && <span style={{ marginLeft: 8 }}>處理中⋯</span>}
                      </div>
                      {!busy && (
                        <div className="course-pick-meta" style={{ marginTop: 4 }}>
                          {alreadyPicked ? '點此可取消選課（不會刪上課紀錄）' : '點此選擇並排上課日'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="enroll-step">
            <div className="form-section-title">團課（加入後依團課排程自動補上課紀錄）</div>
            {groupMsg && (
              <div
                className={groupMsg.startsWith('已') ? 'success-msg' : 'error-msg'}
                style={{ marginBottom: 8 }}
              >{groupMsg}</div>
            )}
            {groupsState.loading ? (
              <div className="loading">載入中⋯</div>
            ) : groupsState.groups.length === 0 ? (
              <div className="empty-hint">尚無團課可選，請先到「團課」頁新增</div>
            ) : (
              <div className="course-pick-grid">
                {groupsState.groups.map(g => {
                  const joined = enrolledGroupIds?.has(g.id)
                  const busy = groupBusy === g.id
                  return (
                    <button
                      type="button"
                      key={g.id}
                      className={`course-pick-card${joined ? ' course-pick-card--picked' : ''}`}
                      onClick={() => toggleGroup(g.id, joined)}
                      disabled={busy || enrolledGroupIds === null}
                    >
                      <div className="course-pick-name">
                        {g.name}
                        {joined && <span className="course-pick-badge">已加入</span>}
                      </div>
                      <div className="course-pick-meta">
                        {g.default_teacher_id
                          ? <>預設老師：{teacherName(g.default_teacher_id) || '—'}</>
                          : <span style={{ color: 'var(--muted)' }}>尚未設定預設老師</span>}
                        {busy && <span style={{ marginLeft: 8 }}>處理中⋯</span>}
                      </div>
                      {!busy && (
                        <div className="course-pick-meta" style={{ marginTop: 4 }}>
                          {joined ? '點此可移除' : '點此加入'}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {step === 'pick-dates' && course && (
        <div className="enroll-step">
          <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="btn-sm" onClick={backToCourseList}>← 重新選課程</button>
            <span>第 2 步：選擇週幾與每個週幾的開始時間（自動建立本月剩餘對應日期）</span>
          </div>

          <div className="enroll-summary">
            <div className="enroll-summary-row">
              <strong className="enroll-summary-label">課程：</strong>
              <span>{course.name}</span>
            </div>
            <div className="enroll-summary-row">
              <strong className="enroll-summary-label">老師：</strong>
              <div style={{ minWidth: 180 }}>
                <Combobox
                  items={activeTeachers}
                  value={effectiveTeacherId}
                  onChange={setOverrideTeacherId}
                  placeholder="搜尋老師…"
                />
              </div>
              {!course.default_teacher_id && (
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>（此課程未設預設老師，請手動選擇）</span>
              )}
            </div>
            <div className="enroll-summary-row">
              <strong className="enroll-summary-label">每筆時數：</strong>
              <span>{lessonHours} 小時</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                （建立範圍：{fmtDate(today)} ~ {fmtDate(new Date(today.getFullYear(), today.getMonth() + 1, 0))}）
              </span>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              勾選上課的週幾，並設定每個週幾的開始時間（可複選；時間留空表示未排定）
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {WEEKDAYS.map((label, w) => {
                const active = weekdayTimes.has(w)
                const t = active ? weekdayTimes.get(w) : ''
                return (
                  <label
                    key={w}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 12px',
                      border: '1px solid var(--border, #ddd)',
                      borderRadius: 6,
                      background: active ? 'var(--accent-light)' : 'var(--surface)',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      disabled={saving}
                      onChange={() => toggleWeekday(w)}
                    />
                    <span style={{ minWidth: 60, fontWeight: 600 }}>週{label}</span>
                    <input
                      type="time"
                      value={t}
                      step="60"
                      disabled={!active || saving}
                      onChange={e => setWeekdayTime(w, e.target.value)}
                      onClick={e => e.stopPropagation()}
                    />
                    {active && t && (
                      <button
                        type="button"
                        className="btn-sm"
                        onClick={e => { e.preventDefault(); setWeekdayTime(w, '') }}
                        aria-label="清除時間"
                      >清除時間</button>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          {weekdayTimes.size > 0 && (
            <div className="enroll-selected" style={{ marginTop: 12 }}>
              {entriesToCreate.length === 0
                ? <span style={{ color: 'var(--muted)' }}>本月剩餘日期沒有符合所選週幾的日子</span>
                : <>
                    將建立 {entriesToCreate.length} 筆上課紀錄：
                    <div className="chip-list" style={{ marginTop: 6 }}>
                      {entriesToCreate.map(e => (
                        <span className="chip" key={e.date}>
                          {e.date}（週{WEEKDAYS[e.weekday]}）{e.time && `・${e.time}`}
                        </span>
                      ))}
                    </div>
                  </>
              }
            </div>
          )}

          {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

          {done && (
            <div className={done.failed ? 'error-msg' : 'success-msg'} style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
              {(() => {
                const success = done.total - done.failed - (done.skipped || 0)
                const parts = [`${success} 筆成功`]
                if (done.failed) parts.push(`${done.failed} 筆失敗`)
                if (done.skipped) parts.push(`${done.skipped} 筆因重複略過`)
                const head = done.failed ? '建立完成' : '已處理'
                const tail = done.failed ? `\n${done.failures.join('\n')}` : ''
                return `${head}：${parts.join('、')}${tail}`
              })()}
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button type="button" onClick={onBack} disabled={saving}>完成</button>
            <span
              title={submitDisableReason}
              style={{ display: 'inline-block' }}
            >
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!!submitDisableReason}
                title={submitDisableReason}
              >
                {saving ? '建立中⋯' : `建立 ${entriesToCreate.length} 筆上課紀錄`}
              </button>
            </span>
            {submitDisableReason && !saving && (
              <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: 12 }}>
                {submitDisableReason}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
