import { Fragment, useState, useEffect, useCallback } from 'react'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import {
  apiGetStudentEnrollment, apiSetStudentEnrollment, apiReorderStudents,
  apiListStudentCourses,
} from '../data/api.js'

export default function StudentsPage() {
  const { state, loadStudents, createStudent, updateStudent, removeStudent } = useStudents()
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
  const [enrollmentById, setEnrollmentById] = useState({}) // id → { loading, error, course_ids, group_ids }
  const [historyById, setHistoryById]       = useState({}) // id → { loading, error, items }
  const [removingKey, setRemovingKey]       = useState(null)

  // 選課 modal
  const [enrollStudent, setEnrollStudent] = useState(null) // { id, name }
  const [enrollDraftCourses, setEnrollDraftCourses] = useState(new Set())
  const [enrollDraftGroups, setEnrollDraftGroups]   = useState(new Set())
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [enrollSaving, setEnrollSaving]   = useState(false)

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

  const displayStudents = orderOverride ?? students

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

  async function handleDelete(id) {
    if (!window.confirm('確定要刪除此學生？（連帶刪除其所有上課紀錄）')) return
    setSaving(true); setError('')
    try { await removeStudent(id) }
    catch { setError('刪除失敗') }
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

  async function openEnrollEditor(s) {
    setEnrollStudent({ id: s.id, name: s.name })
    setEnrollDraftCourses(new Set())
    setEnrollDraftGroups(new Set())
    setEnrollLoading(true)
    try {
      const data = await apiGetStudentEnrollment(s.id)
      setEnrollDraftCourses(new Set(data.course_ids || []))
      setEnrollDraftGroups(new Set(data.group_ids || []))
    } catch {
      setError('讀取選課資料失敗')
    } finally {
      setEnrollLoading(false)
    }
  }

  function toggleEnrollCourse(courseId) {
    setEnrollDraftCourses(prev => {
      const next = new Set(prev)
      if (next.has(courseId)) next.delete(courseId); else next.add(courseId)
      return next
    })
  }

  function toggleEnrollGroup(groupId) {
    setEnrollDraftGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId)
      return next
    })
  }

  async function handleSaveEnrollment() {
    if (!enrollStudent || enrollSaving) return
    setEnrollSaving(true)
    try {
      await apiSetStudentEnrollment(enrollStudent.id, {
        course_ids: Array.from(enrollDraftCourses),
        group_ids:  Array.from(enrollDraftGroups),
      })
      // 同步展開列的快取（如果剛好展開的就是這位學生）
      setEnrollmentById(prev => ({
        ...prev,
        [enrollStudent.id]: {
          loading: false,
          course_ids: Array.from(enrollDraftCourses),
          group_ids:  Array.from(enrollDraftGroups),
        },
      }))
      setEnrollStudent(null)
    } catch {
      setError('儲存選課失敗')
    } finally {
      setEnrollSaving(false)
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
    // 樂觀更新
    setEnrollmentById(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], course_ids: courseIds, group_ids: groupIds },
    }))
    try {
      await apiSetStudentEnrollment(studentId, { course_ids: courseIds, group_ids: groupIds })
    } catch {
      setError('移除失敗')
      // 失敗就重新拉一次回來
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
    if (editId === id) return // 編輯中不展開
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
            <col style={{ width: 220 }} />
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
              return (
                <Fragment key={s.id}>
                  <tr
                    className={`${dragId === s.id ? 'row-dragging' : ''} ${overId === s.id ? 'row-drop-target' : ''}`}
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
                          <button className="btn-sm" onClick={() => openEnrollEditor(s)}>選課</button>
                          <button className="btn-sm" onClick={() => startEdit(s)}>編輯</button>
                          <button className="btn-sm btn-danger" onClick={() => handleDelete(s.id)} disabled={saving}>刪除</button>
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

      {enrollStudent && (
        <div className="modal-overlay" onClick={() => !enrollSaving && setEnrollStudent(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{enrollStudent.name}・選課</h3>
              <button type="button" className="modal-close" onClick={() => !enrollSaving && setEnrollStudent(null)}>✕</button>
            </div>
            <div className="modal-body">
              {enrollLoading ? (
                <div className="empty-hint">載入中⋯</div>
              ) : (
                <>
                  <div className="expanded-label" style={{ marginTop: 0 }}>家教課</div>
                  {coursesState.courses.length === 0 ? (
                    <div className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>尚無家教課可選</div>
                  ) : (
                    <div className="roster-list">
                      {coursesState.courses.map(c => (
                        <label
                          key={c.id}
                          className={`attendance-item${enrollDraftCourses.has(c.id) ? ' attendance-item--checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={enrollDraftCourses.has(c.id)}
                            onChange={() => toggleEnrollCourse(c.id)}
                          />
                          <span className="attendance-name">{courseLabel(c)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="expanded-label" style={{ marginTop: 16 }}>團課</div>
                  {groupsState.groups.length === 0 ? (
                    <div className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>尚無團課可選</div>
                  ) : (
                    <div className="roster-list">
                      {groupsState.groups.map(g => (
                        <label
                          key={g.id}
                          className={`attendance-item${enrollDraftGroups.has(g.id) ? ' attendance-item--checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={enrollDraftGroups.has(g.id)}
                            onChange={() => toggleEnrollGroup(g.id)}
                          />
                          <span className="attendance-name">{g.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setEnrollStudent(null)} disabled={enrollSaving}>取消</button>
              <button type="button" className="btn-primary" onClick={handleSaveEnrollment} disabled={enrollSaving || enrollLoading}>
                {enrollSaving ? '儲存中⋯' : '儲存選課'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
