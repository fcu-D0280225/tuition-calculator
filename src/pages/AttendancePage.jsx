import { useState, useEffect, useRef } from 'react'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { apiListGroupRecords, apiCreateGroupRecord, apiDeleteGroupRecord } from '../data/api.js'
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

  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedDate, setSelectedDate]   = useState(todayStr)

  // student_id -> record_id，代表已存入 DB 的紀錄
  const [existingMap, setExistingMap] = useState({})
  // 目前勾選的 student_id set
  const [checked, setChecked] = useState(new Set())
  // 本班學生（歷史上曾出席此團課的 student_id）
  const [rosterIds, setRosterIds] = useState(new Set())

  const [loaded,     setLoaded]     = useState(false)
  const [fetching,   setFetching]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [attendedNames, setAttendedNames] = useState([])

  // 避免重複觸發
  const loadAbortRef = useRef(null)

  useEffect(() => { loadGroups() },   [loadGroups])
  useEffect(() => { loadStudents() }, [loadStudents])

  // 選取團課後，拉取歷史出席紀錄以推算本班名單
  useEffect(() => {
    if (!selectedGroup) {
      setRosterIds(new Set())
      return
    }
    apiListGroupRecords({ group_id: selectedGroup })
      .then(records => {
        setRosterIds(new Set(records.map(r => r.student_id)))
      })
      .catch(() => {})
  }, [selectedGroup])

  // 切換課堂或日期時自動載入點名紀錄
  useEffect(() => {
    setLoaded(false)
    setChecked(new Set())
    setExistingMap({})
    setSuccessMsg('')
    setAttendedNames([])
    setError('')

    if (!selectedGroup || !selectedDate) return

    // 取消上一次還未完成的請求
    const abortCtrl = new AbortController()
    loadAbortRef.current = abortCtrl

    setFetching(true)
    apiListGroupRecords({ from: selectedDate, to: selectedDate, group_id: selectedGroup })
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
  }, [selectedGroup, selectedDate])

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

  function handleToggleAll() {
    const sortedStudents = getSortedStudents()
    const all = sortedStudents.map(s => s.id)
    const allChecked = all.length > 0 && all.every(id => checked.has(id))
    setChecked(allChecked ? new Set() : new Set(all))
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

      // 重新同步最新狀態
      const fresh = await apiListGroupRecords({
        from: selectedDate,
        to:   selectedDate,
        group_id: selectedGroup,
      })
      const newMap = {}
      const newChecked = new Set()
      for (const r of fresh) {
        newMap[r.student_id] = r.id
        newChecked.add(r.student_id)
      }
      setExistingMap(newMap)
      setChecked(newChecked)

      // 更新本班名單（加入剛出席的新學生）
      setRosterIds(prev => {
        const next = new Set(prev)
        for (const id of newChecked) next.add(id)
        return next
      })

      const names = studentsState.students
        .filter(s => newChecked.has(s.id))
        .map(s => s.name)
      setAttendedNames(names)
      setSuccessMsg(`已儲存！出席 ${newChecked.size} 人 / 共 ${studentsState.students.length} 人`)
    } catch {
      setError('儲存失敗，請再試一次')
    } finally {
      setSaving(false)
    }
  }

  function getSortedStudents() {
    const roster = []
    const others = []
    for (const s of studentsState.students) {
      if (rosterIds.has(s.id)) roster.push(s)
      else others.push(s)
    }
    return { roster, others }
  }

  const { groups }   = groupsState
  const { students } = studentsState
  const allStudents  = getSortedStudents()
  const totalChecked = checked.size
  const selectedGroupName = groups.find(g => g.id === selectedGroup)?.name || ''
  const allChecked = students.length > 0 && students.every(s => checked.has(s.id))

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
                onClick={() => openLineShare(buildLineMessage(selectedGroupName, selectedDate, attendedNames))}
              >
                <span className="btn-line-icon">LINE</span>
                傳到班級群組
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 選擇課堂 ── */}
      <div className="lesson-form-card">
        <div className="form-section-title">選擇課堂</div>
        <div className="lesson-form">
          <div className="lesson-form-row">
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
          <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{selectedGroupName}・{selectedDate}</span>
            <span className="attendance-count">
              出席 <strong>{totalChecked}</strong> / {students.length} 人
            </span>
          </div>

          {students.length === 0 ? (
            <div className="empty-hint">尚未新增任何學生</div>
          ) : (
            <>
              <div className="attendance-list">
                {/* 全選 */}
                <label className="attendance-item attendance-item-all">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={handleToggleAll}
                  />
                  <span>全選</span>
                </label>

                {/* 本班學生 */}
                {allStudents.roster.length > 0 && (
                  <>
                    <div className="attendance-section-label">
                      本班學生（{allStudents.roster.length} 人）
                    </div>
                    {allStudents.roster.map(s => (
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
                  </>
                )}

                {/* 其他學生 */}
                {allStudents.others.length > 0 && (
                  <>
                    <div className="attendance-section-label attendance-section-label--other">
                      其他學生（{allStudents.others.length} 人）
                    </div>
                    {allStudents.others.map(s => (
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
                  </>
                )}
              </div>

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
    </div>
  )
}
