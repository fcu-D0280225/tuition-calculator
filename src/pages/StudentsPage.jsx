import { Fragment, useState, useEffect, useCallback } from 'react'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { apiListStudentCourses, apiGetStudentEnrollment, apiSetStudentEnrollment } from '../data/api.js'

export default function StudentsPage() {
  const { state, loadStudents, createStudent, updateStudent, removeStudent } = useStudents()
  const { state: coursesState, loadCourses } = useCourses()
  const { state: groupsState, loadGroups } = useGroups()
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

  const [expandedId, setExpandedId]     = useState(null)
  const [coursesById, setCoursesById]   = useState({}) // id → { loading, error, items }

  // 選課 modal
  const [enrollStudent, setEnrollStudent] = useState(null) // { id, name }
  const [enrollDraftCourses, setEnrollDraftCourses] = useState(new Set())
  const [enrollDraftGroups, setEnrollDraftGroups]   = useState(new Set())
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [enrollSaving, setEnrollSaving]   = useState(false)

  useEffect(() => { loadStudents(); loadCourses(); loadGroups() }, [loadStudents, loadCourses, loadGroups])

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
      setEnrollStudent(null)
    } catch {
      setError('儲存選課失敗')
    } finally {
      setEnrollSaving(false)
    }
  }

  const toggleExpand = useCallback(async (id) => {
    if (editId === id) return // 編輯中不展開
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (coursesById[id]?.items) return // 已載入
    setCoursesById(prev => ({ ...prev, [id]: { loading: true } }))
    try {
      const items = await apiListStudentCourses(id)
      setCoursesById(prev => ({ ...prev, [id]: { loading: false, items } }))
    } catch {
      setCoursesById(prev => ({ ...prev, [id]: { loading: false, error: true, items: [] } }))
    }
  }, [editId, expandedId, coursesById])

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
          <thead>
            <tr>
              <th>學生姓名</th>
              <th>聯絡人</th>
              <th>聯絡電話</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              const isEditing  = editId === s.id
              const isExpanded = expandedId === s.id
              const courseInfo = coursesById[s.id]
              return (
                <Fragment key={s.id}>
                  <tr>
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
                      <td colSpan={4}>
                        <div className="expanded-section">
                          <div className="expanded-label">上過的課程</div>
                          {courseInfo?.loading ? (
                            <div className="loading">載入中⋯</div>
                          ) : courseInfo?.error ? (
                            <div className="error-msg">載入失敗</div>
                          ) : !courseInfo?.items?.length ? (
                            <div className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>尚無上課紀錄</div>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: '1.2em', lineHeight: 1.8 }}>
                              {courseInfo.items.map(it => (
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
                          <span className="attendance-name">{c.name}</span>
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
