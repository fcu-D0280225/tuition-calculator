import { Fragment, useMemo, useState, useEffect, useCallback } from 'react'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import {
  apiGetStudentEnrollment, apiSetStudentEnrollment,
  apiListStudentCourses, apiListLessons,
} from '../data/api.js'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function isActive(s) { return s?.active === undefined ? true : !!s.active }

function slotsFromLessons(lessons) {
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()
  const map = new Map() // course_id -> Set<"w|HH:MM">
  for (const l of lessons) {
    if (!l.lesson_date || l.lesson_date < todayStr) continue
    const w = new Date(l.lesson_date).getDay()
    const t = l.start_time ? String(l.start_time).slice(0, 5) : ''
    const key = `${w}|${t}`
    if (!map.has(l.course_id)) map.set(l.course_id, new Set())
    map.get(l.course_id).add(key)
  }
  return map
}

function formatSlots(set) {
  if (!set || set.size === 0) return ''
  return [...set]
    .map(k => { const [w, t] = k.split('|'); return { w: Number(w), t } })
    .sort((a, b) => a.w - b.w || a.t.localeCompare(b.t))
    .map(s => `週${WEEKDAY_LABELS[s.w]} ${s.t || '未排定'}`)
    .join(' / ')
}

export default function StudentsPage({ onEnroll }) {
  const { state, loadStudents, createStudent, updateStudent, setStudentActive } = useStudents()
  const { state: coursesState, loadCourses } = useCourses()
  const { state: groupsState, loadGroups } = useGroups()
  const { state: teachersState, loadTeachers } = useTeachers()
  const { students, loading } = state

  const [newName, setNewName]           = useState('')
  const [newSchool, setNewSchool]       = useState('')
  const [newGrade, setNewGrade]         = useState('')
  const [newContact, setNewContact]     = useState('')
  const [newPhone, setNewPhone]         = useState('')

  const [editId, setEditId]             = useState(null)
  const [editName, setEditName]         = useState('')
  const [editSchool, setEditSchool]     = useState('')
  const [editGrade, setEditGrade]       = useState('')
  const [editContact, setEditContact]   = useState('')
  const [editPhone, setEditPhone]       = useState('')

  const [error, setError]               = useState('')
  const [saving, setSaving]             = useState(false)

  const [expandedId, setExpandedId]         = useState(null)
  const [enrollmentById, setEnrollmentById] = useState({})
  const [historyById, setHistoryById]       = useState({})
  const [lessonsByStudent, setLessonsByStudent] = useState({}) // { [id]: { loading, lessons } }
  const [removingKey, setRemovingKey]       = useState(null)

  // 名稱排序：null 維持後端順序，'asc' 升冪，'desc' 降冪
  const [nameSort, setNameSort] = useState(null)
  // 搜尋：比對姓名／聯絡人／電話（含子字串即匹配，不分大小寫）
  const [query, setQuery] = useState('')

  useEffect(() => { loadStudents(); loadCourses(); loadGroups(); loadTeachers() },
    [loadStudents, loadCourses, loadGroups, loadTeachers])

  function toggleNameSort() {
    setNameSort(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')
  }

  // 顯示順序：啟用中在前、已停用置底；點名稱欄位可切換升/降冪；query 套用於姓名/學校/年級/聯絡人/電話
  const displayStudents = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q
      ? students.filter(s =>
          String(s.name || '').toLowerCase().includes(q) ||
          String(s.school || '').toLowerCase().includes(q) ||
          String(s.grade || '').toLowerCase().includes(q) ||
          String(s.contact_name || '').toLowerCase().includes(q) ||
          String(s.contact_phone || '').toLowerCase().includes(q)
        )
      : students
    const actives = matches.filter(isActive)
    const inactives = matches.filter(s => !isActive(s))
    if (nameSort) {
      const cmp = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant')
      actives.sort(nameSort === 'asc' ? cmp : (a, b) => cmp(b, a))
      inactives.sort(nameSort === 'asc' ? cmp : (a, b) => cmp(b, a))
    }
    return [...actives, ...inactives]
  }, [students, nameSort, query])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await createStudent({
        name,
        school:        newSchool.trim(),
        grade:         newGrade.trim(),
        contact_name:  newContact.trim(),
        contact_phone: newPhone.trim(),
      })
      setNewName(''); setNewSchool(''); setNewGrade(''); setNewContact(''); setNewPhone('')
    }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  function startEdit(s) {
    setEditId(s.id)
    setEditName(s.name)
    setEditSchool(s.school || '')
    setEditGrade(s.grade || '')
    setEditContact(s.contact_name || '')
    setEditPhone(s.contact_phone || '')
  }

  async function handleSaveEdit(id) {
    const name = editName.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await updateStudent(id, {
        name,
        school:        editSchool.trim(),
        grade:         editGrade.trim(),
        contact_name:  editContact.trim(),
        contact_phone: editPhone.trim(),
      })
      setEditId(null)
    } catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleToggleActive(s) {
    const turningOff = isActive(s)
    if (turningOff && !window.confirm(
      `確定要停用「${s.name}」？\n\n` +
      `停用後該名學生不會出現在點名/上課紀錄等下拉選單。\n\n` +
      `⚠️ 注意：尚未點名的家教課與團課紀錄會一併刪除；已點名（attended）與請假（leave）的歷史紀錄保留。`
    )) return
    setSaving(true); setError('')
    try { await setStudentActive(s.id, !turningOff) }
    catch { setError(turningOff ? '停用失敗' : '啟用失敗') }
    finally { setSaving(false) }
  }

  async function loadEnrollment(studentId) {
    setEnrollmentById(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), loading: true } }))
    try {
      const data = await apiGetStudentEnrollment(studentId)
      setEnrollmentById(prev => ({
        ...prev,
        [studentId]: { loading: false, course_ids: data.course_ids || [], group_ids: data.group_ids || [] },
      }))
    } catch {
      setEnrollmentById(prev => ({
        ...prev,
        [studentId]: { loading: false, error: true, course_ids: [], group_ids: [] },
      }))
    }
  }

  async function removeEnrollment(studentId, kind, id) {
    const key = `${studentId}:${kind}:${id}`
    if (removingKey) return
    const current = enrollmentById[studentId]
    if (!current) return
    const targetName =
      kind === 'course' ? (courseById(id)?.name || '此家教課')
                        : (groupById(id)?.name  || '此團課')
    const msg = kind === 'course'
      ? `確定要把「${targetName}」從「已選課程」中移除？\n\n` +
        `⚠️ 注意：\n` +
        `• 由「選課批次建立」且未點名／尚未開始的紀錄會一併刪除\n` +
        `• 已點名、請假，以及手動建立的紀錄都保留，仍會列入學費計算\n` +
        `• 若再次選回此課程並建立日期，可能與既有紀錄重複`
      : `確定要把學生從團課「${targetName}」移除？\n\n` +
        `⚠️ 注意：\n` +
        `• 該團課既有的點名紀錄不會被刪除，仍會列入學費計算\n` +
        `• 不需要的紀錄請操作人員手動到「團課」頁刪除`
    if (!window.confirm(msg)) return
    const courseIds = kind === 'course' ? current.course_ids.filter(x => x !== id) : current.course_ids
    const groupIds  = kind === 'group'  ? current.group_ids.filter(x => x !== id)  : current.group_ids
    setRemovingKey(key)
    setEnrollmentById(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], course_ids: courseIds, group_ids: groupIds },
    }))
    try {
      await apiSetStudentEnrollment(studentId, { course_ids: courseIds, group_ids: groupIds })
    } catch {
      setError('移除失敗')
      loadEnrollment(studentId)
    } finally {
      setRemovingKey(null)
    }
  }

  async function loadHistory(studentId) {
    setHistoryById(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), loading: true } }))
    try {
      const items = await apiListStudentCourses(studentId)
      setHistoryById(prev => ({ ...prev, [studentId]: { loading: false, items } }))
    } catch {
      setHistoryById(prev => ({ ...prev, [studentId]: { loading: false, error: true, items: [] } }))
    }
  }

  async function loadStudentLessons(studentId) {
    setLessonsByStudent(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), loading: true } }))
    try {
      const lessons = await apiListLessons({ student_id: studentId })
      setLessonsByStudent(prev => ({ ...prev, [studentId]: { loading: false, lessons } }))
    } catch {
      setLessonsByStudent(prev => ({ ...prev, [studentId]: { loading: false, lessons: [] } }))
    }
  }

  const toggleExpand = useCallback(async (id) => {
    if (editId === id) return
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!enrollmentById[id]?.course_ids) await loadEnrollment(id)
    if (!historyById[id]?.items)         await loadHistory(id)
    if (!lessonsByStudent[id]?.lessons)  await loadStudentLessons(id)
  }, [editId, expandedId, enrollmentById, historyById, lessonsByStudent])

  function teacherName(id) {
    return teachersState.teachers.find(t => t.id === id)?.name || ''
  }
  function courseLabel(c) {
    const tName = c.default_teacher_id ? teacherName(c.default_teacher_id) : ''
    return tName ? `${c.name} - ${tName}` : c.name
  }
  function courseById(id)  { return coursesState.courses.find(c => c.id === id) }
  function groupById(id)   { return groupsState.groups.find(g => g.id === id) }

  return (
    <div className="page">
      <div className="page-header">
          <div className="page-header-body">
            <h1>學生名冊</h1>
            <p className="page-desc">管理所有學生資料、選課與學費設定</p>
          </div>
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          className="add-input"
          placeholder="新學生姓名"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input
          className="add-input"
          placeholder="學校（選填）"
          value={newSchool}
          onChange={e => setNewSchool(e.target.value)}
        />
        <input
          className="add-input"
          placeholder="年級（選填）"
          value={newGrade}
          onChange={e => setNewGrade(e.target.value)}
        />
        <input
          className="add-input"
          placeholder="聯絡人（選填）"
          value={newContact}
          onChange={e => setNewContact(e.target.value)}
        />
        <input
          className="add-input"
          placeholder="聯絡電話（選填）"
          value={newPhone}
          onChange={e => setNewPhone(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={saving || !newName.trim()}>新增學生</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {students.length > 0 && (
        <div className="roster-toolbar" style={{ marginTop: 16 }}>
          <input
            type="search"
            className="roster-search"
            placeholder="搜尋姓名 / 學校 / 年級 / 聯絡人 / 電話…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : students.length === 0 ? (
        <div className="empty-hint">尚未新增任何學生</div>
      ) : displayStudents.length === 0 ? (
        <div className="empty-hint">找不到符合「{query}」的學生</div>
      ) : (
        <table className="entity-table">
          <colgroup>
            <col />
            <col />
            <col style={{ width: 80 }} />
            <col />
            <col />
            <col style={{ width: 260 }} />
          </colgroup>
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="th-sort-btn"
                  onClick={toggleNameSort}
                  aria-label={`學生姓名（${nameSort === 'asc' ? '升冪' : nameSort === 'desc' ? '降冪' : '預設順序'}，點擊切換）`}
                  title="點擊切換排序"
                >
                  學生姓名
                  <span className="th-sort-icon" aria-hidden="true">
                    {nameSort === 'asc' ? '▲' : nameSort === 'desc' ? '▼' : '⇅'}
                  </span>
                </button>
              </th>
              <th>學校</th>
              <th>年級</th>
              <th>聯絡人</th>
              <th>聯絡電話</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayStudents.map(s => {
              const isEditing  = editId === s.id
              const isExpanded = expandedId === s.id
              const enrollInfo = enrollmentById[s.id]
              const historyInfo = historyById[s.id]
              const active = isActive(s)
              return (
                <Fragment key={s.id}>
                  <tr className={active ? '' : 'row-inactive'}>
                    <td>
                      {isEditing ? (
                        <input
                          autoFocus
                          className="inline-edit-input"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(s.id); if (e.key === 'Escape') setEditId(null) }}
                        />
                      ) : (
                        <span className="expandable-name" onClick={() => toggleExpand(s.id)}>
                          {s.name}
                          {!active && <span className="inactive-tag">已停用</span>}
                          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-edit-input"
                          placeholder="學校"
                          value={editSchool}
                          onChange={e => setEditSchool(e.target.value)}
                        />
                      ) : (
                        s.school || <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-edit-input"
                          placeholder="年級"
                          value={editGrade}
                          onChange={e => setEditGrade(e.target.value)}
                        />
                      ) : (
                        s.grade || <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-edit-input"
                          placeholder="聯絡人"
                          value={editContact}
                          onChange={e => setEditContact(e.target.value)}
                        />
                      ) : (
                        s.contact_name || <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-edit-input"
                          placeholder="聯絡電話"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                        />
                      ) : (
                        s.contact_phone
                          ? <a href={`tel:${s.contact_phone}`}>{s.contact_phone}</a>
                          : <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td className="row-actions">
                      {isEditing ? (
                        <>
                          <button className="btn-sm btn-primary" onClick={() => handleSaveEdit(s.id)} disabled={saving}>儲存</button>
                          <button className="btn-sm" onClick={() => setEditId(null)}>取消</button>
                        </>
                      ) : (
                        <>
                          {active && (
                            <button className="btn-sm" onClick={() => onEnroll && onEnroll(s)}>選課</button>
                          )}
                          <button className="btn-sm" onClick={() => startEdit(s)}>編輯</button>
                          {active ? (
                            <button className="btn-sm btn-danger" onClick={() => handleToggleActive(s)} disabled={saving}>停用</button>
                          ) : (
                            <button className="btn-sm btn-primary" onClick={() => handleToggleActive(s)} disabled={saving}>重新啟用</button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                  {isExpanded && !isEditing && (
                    <tr className="expanded-row">
                      <td colSpan={6}>
                        <div className="expanded-section">
                          <div className="expanded-label">已選課程</div>
                          {enrollInfo?.loading ? (
                            <div className="loading">載入中⋯</div>
                          ) : enrollInfo?.error ? (
                            <div className="error-msg">載入失敗</div>
                          ) : (() => {
                            const courseIds = enrollInfo?.course_ids || []
                            const groupIds  = enrollInfo?.group_ids  || []
                            if (!courseIds.length && !groupIds.length) {
                              return <div className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>尚未選任何課程</div>
                            }
                            const slotMap = slotsFromLessons(lessonsByStudent[s.id]?.lessons || [])
                            return (
                              <ul className="enrollment-list">
                                {courseIds.map(cid => {
                                  const c = courseById(cid)
                                  if (!c) return null
                                  const key = `${s.id}:course:${cid}`
                                  const slotLabel = formatSlots(slotMap.get(cid))
                                  return (
                                    <li key={`c-${cid}`} className="enrollment-item">
                                      <span className="enrollment-name">
                                        {courseLabel(c)}
                                        {slotLabel && (
                                          <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>
                                            （{slotLabel}）
                                          </span>
                                        )}
                                      </span>
                                      <button
                                        type="button"
                                        className="btn-sm btn-danger"
                                        disabled={removingKey === key}
                                        onClick={() => removeEnrollment(s.id, 'course', cid)}
                                      >移除</button>
                                    </li>
                                  )
                                })}
                                {groupIds.map(gid => {
                                  const g = groupById(gid)
                                  if (!g) return null
                                  const key = `${s.id}:group:${gid}`
                                  return (
                                    <li key={`g-${gid}`} className="enrollment-item">
                                      <span className="enrollment-name">
                                        {g.name}
                                        <span style={{ color: 'var(--muted)', marginLeft: 6 }}>（團課）</span>
                                      </span>
                                      <button
                                        type="button"
                                        className="btn-sm btn-danger"
                                        disabled={removingKey === key}
                                        onClick={() => removeEnrollment(s.id, 'group', gid)}
                                      >移除</button>
                                    </li>
                                  )
                                })}
                              </ul>
                            )
                          })()}
                          <div className="expanded-label" style={{ marginTop: 16 }}>已上過的課程</div>
                          {historyInfo?.loading ? (
                            <div className="loading">載入中⋯</div>
                          ) : historyInfo?.error ? (
                            <div className="error-msg">載入失敗</div>
                          ) : !historyInfo?.items?.length ? (
                            <div className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>尚無上課紀錄</div>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: '1.2em', lineHeight: 1.8 }}>
                              {historyInfo.items.map(it => (
                                <li key={`${it.course_id}::${it.teacher_id || 'none'}`}>
                                  {it.course_name}
                                  <span style={{ color: 'var(--muted)' }}>（{it.teacher_name || '未指派'}）</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
