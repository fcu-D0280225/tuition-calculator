import { Fragment, useState, useEffect, useCallback } from 'react'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import {
  apiGetStudentEnrollment, apiSetStudentEnrollment, apiReorderStudents,
  apiListStudentCourses,
} from '../data/api.js'

function isActive(s) { return s?.active === undefined ? true : !!s.active }

export default function StudentsPage({ onEnroll }) {
  const { state, loadStudents, createStudent, updateStudent, setStudentActive } = useStudents()
  const { state: coursesState, loadCourses } = useCourses()
  const { state: groupsState, loadGroups } = useGroups()
  const { state: teachersState, loadTeachers } = useTeachers()
  const { students, loading } = state

  const [newName, setNewName]           = useState('')
  const [newContact, setNewContact]     = useState('')
  const [newPhone, setNewPhone]         = useState('')

  const [editId, setEditId]             = useState(null)
  const [editName, setEditName]         = useState('')
  const [editContact, setEditContact]   = useState('')
  const [editPhone, setEditPhone]       = useState('')

  const [error, setError]               = useState('')
  const [saving, setSaving]             = useState(false)

  const [expandedId, setExpandedId]         = useState(null)
  const [enrollmentById, setEnrollmentById] = useState({})
  const [historyById, setHistoryById]       = useState({})
  const [removingKey, setRemovingKey]       = useState(null)

  // 拖曳排序
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [orderOverride, setOrderOverride] = useState(null)

  useEffect(() => { loadStudents(); loadCourses(); loadGroups(); loadTeachers() },
    [loadStudents, loadCourses, loadGroups, loadTeachers])

  function startDrag(id) { setDragId(id) }
  function endDrag() { setDragId(null); setOverId(null) }

  async function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { endDrag(); return }
    const baseList = orderOverride ?? students
    const list = baseList.map(s => s.id)
    const fromIdx = list.indexOf(dragId)
    const toIdx   = list.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) { endDrag(); return }
    const next = list.slice()
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, dragId)
    const idMap = new Map(students.map(s => [s.id, s]))
    setOrderOverride(next.map(id => idMap.get(id)).filter(Boolean))
    endDrag()
    try {
      await apiReorderStudents(next)
      await loadStudents()
      setOrderOverride(null)
    } catch {
      setError('排序儲存失敗')
      setOrderOverride(null)
    }
  }

  // 顯示順序：啟用中在前、已停用置底；組內維持後端/拖曳順序
  const displayStudents = (() => {
    const base = orderOverride ?? students
    const actives = base.filter(isActive)
    const inactives = base.filter(s => !isActive(s))
    return [...actives, ...inactives]
  })()

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await createStudent({
        name,
        contact_name:  newContact.trim(),
        contact_phone: newPhone.trim(),
      })
      setNewName(''); setNewContact(''); setNewPhone('')
    }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  function startEdit(s) {
    setEditId(s.id)
    setEditName(s.name)
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
        contact_name:  editContact.trim(),
        contact_phone: editPhone.trim(),
      })
      setEditId(null)
    } catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleToggleActive(s) {
    const turningOff = isActive(s)
    if (turningOff && !window.confirm(`確定要停用「${s.name}」？停用後該名學生不會出現在點名/上課紀錄等下拉選單中，但歷史紀錄保留。`)) return
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
    const label = kind === 'course' ? '家教課' : '團課'
    if (!window.confirm(`確定要移除此${label}選課？`)) return
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

  const toggleExpand = useCallback(async (id) => {
    if (editId === id) return
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!enrollmentById[id]?.course_ids) await loadEnrollment(id)
    if (!historyById[id]?.items)         await loadHistory(id)
  }, [editId, expandedId, enrollmentById, historyById])

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
        <h1>學生名冊</h1>
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

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : students.length === 0 ? (
        <div className="empty-hint">尚未新增任何學生</div>
      ) : (
        <table className="entity-table">
          <colgroup>
            <col style={{ width: 36 }} />
            <col />
            <col />
            <col />
            <col style={{ width: 260 }} />
          </colgroup>
          <thead>
            <tr>
              <th aria-label="拖曳排序"></th>
              <th>學生姓名</th>
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
                  <tr
                    className={`${dragId === s.id ? 'row-dragging' : ''} ${overId === s.id ? 'row-drop-target' : ''} ${active ? '' : 'row-inactive'}`}
                    onDragOver={e => { if (dragId && editId === null) { e.preventDefault(); setOverId(s.id) } }}
                    onDragLeave={() => { if (overId === s.id) setOverId(null) }}
                    onDrop={e => { e.preventDefault(); handleDrop(s.id) }}
                  >
                    <td
                      className="drag-handle"
                      draggable={editId === null}
                      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; startDrag(s.id) }}
                      onDragEnd={endDrag}
                      title="拖曳調整順序"
                    >⋮⋮</td>
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
                      <td colSpan={5}>
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
                            return (
                              <ul className="enrollment-list">
                                {courseIds.map(cid => {
                                  const c = courseById(cid)
                                  if (!c) return null
                                  const key = `${s.id}:course:${cid}`
                                  return (
                                    <li key={`c-${cid}`} className="enrollment-item">
                                      <span className="enrollment-name">{courseLabel(c)}</span>
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
                                <li key={`${it.course_id}::${it.teacher_id}`}>
                                  {it.course_name}
                                  <span style={{ color: 'var(--muted)' }}>（{it.teacher_name}）</span>
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
