import { Fragment, useState, useEffect, useCallback } from 'react'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { apiReorderTeachers, apiListTeacherCourses } from '../data/api.js'

function isActive(t) { return t?.active === undefined ? true : !!t.active }

export default function TeachersPage() {
  const { state, loadTeachers, createTeacher, updateTeacher, setTeacherActive } = useTeachers()
  const { state: coursesState, loadCourses } = useCourses()
  const { state: groupsState, loadGroups } = useGroups()
  const { teachers, loading } = state

  const [newName, setNewName]   = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [editId, setEditId]     = useState(null)
  const [editName, setEditName]   = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)

  const [expandedId, setExpandedId] = useState(null)
  const [historyById, setHistoryById] = useState({}) // id → { loading, error, courses, groups }

  // 拖曳排序
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [orderOverride, setOrderOverride] = useState(null)

  function startDrag(id) { setDragId(id) }
  function endDrag() { setDragId(null); setOverId(null) }

  async function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { endDrag(); return }
    const baseList = orderOverride ?? teachers
    const list = baseList.map(t => t.id)
    const fromIdx = list.indexOf(dragId)
    const toIdx   = list.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) { endDrag(); return }
    const next = list.slice()
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, dragId)
    const idMap = new Map(teachers.map(t => [t.id, t]))
    setOrderOverride(next.map(id => idMap.get(id)).filter(Boolean))
    endDrag()
    try {
      await apiReorderTeachers(next)
      await loadTeachers()
      setOrderOverride(null)
    } catch {
      setError('排序儲存失敗')
      setOrderOverride(null)
    }
  }

  // 啟用中在前、已停用置底
  const displayTeachers = (() => {
    const base = orderOverride ?? teachers
    const actives = base.filter(isActive)
    const inactives = base.filter(t => !isActive(t))
    return [...actives, ...inactives]
  })()

  useEffect(() => { loadTeachers(); loadCourses(); loadGroups() },
    [loadTeachers, loadCourses, loadGroups])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await createTeacher({ name, contact_phone: newPhone.trim() })
      setNewName(''); setNewPhone('')
    }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  function startEdit(t) {
    setEditId(t.id)
    setEditName(t.name)
    setEditPhone(t.contact_phone || '')
  }

  async function handleSaveEdit(id) {
    const name = editName.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await updateTeacher(id, { name, contact_phone: editPhone.trim() })
      setEditId(null)
    } catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleToggleActive(t) {
    const turningOff = isActive(t)
    if (turningOff && !window.confirm(`確定要停用「${t.name}」？停用後該老師不會出現在點名/上課紀錄等下拉選單中，但歷史紀錄保留。`)) return
    setSaving(true); setError('')
    try { await setTeacherActive(t.id, !turningOff) }
    catch { setError(turningOff ? '停用失敗' : '啟用失敗') }
    finally { setSaving(false) }
  }

  async function loadHistory(teacherId) {
    setHistoryById(prev => ({ ...prev, [teacherId]: { ...(prev[teacherId] || {}), loading: true } }))
    try {
      const data = await apiListTeacherCourses(teacherId)
      setHistoryById(prev => ({
        ...prev,
        [teacherId]: { loading: false, courses: data.courses || [], groups: data.groups || [] },
      }))
    } catch {
      setHistoryById(prev => ({
        ...prev,
        [teacherId]: { loading: false, error: true, courses: [], groups: [] },
      }))
    }
  }

  const toggleExpand = useCallback(async (id) => {
    if (editId === id) return
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!historyById[id]?.courses) await loadHistory(id)
  }, [editId, expandedId, historyById])

  // 「正在上的」= 課程/團課的預設老師是這位
  function currentAssignments(teacherId) {
    const courses = coursesState.courses.filter(c => c.default_teacher_id === teacherId)
    const groups  = groupsState.groups.filter(g => g.default_teacher_id === teacherId)
    return { courses, groups }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>老師名冊</h1>
      </div>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          className="add-input"
          placeholder="新老師姓名"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input
          className="add-input"
          placeholder="聯絡電話（選填）"
          value={newPhone}
          onChange={e => setNewPhone(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={saving || !newName.trim()}>新增老師</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : teachers.length === 0 ? (
        <div className="empty-hint">尚未新增任何老師</div>
      ) : (
        <table className="entity-table">
          <colgroup>
            <col style={{ width: 36 }} />
            <col />
            <col />
            <col style={{ width: 200 }} />
          </colgroup>
          <thead>
            <tr><th aria-label="拖曳排序"></th><th>老師姓名</th><th>聯絡電話</th><th></th></tr>
          </thead>
          <tbody>
            {displayTeachers.map(t => {
              const active = isActive(t)
              const isEditing = editId === t.id
              const isExpanded = expandedId === t.id
              const historyInfo = historyById[t.id]
              const cur = currentAssignments(t.id)
              return (
                <Fragment key={t.id}>
                  <tr
                    className={`${dragId === t.id ? 'row-dragging' : ''} ${overId === t.id ? 'row-drop-target' : ''} ${active ? '' : 'row-inactive'}`}
                    onDragOver={e => { if (dragId && editId === null) { e.preventDefault(); setOverId(t.id) } }}
                    onDragLeave={() => { if (overId === t.id) setOverId(null) }}
                    onDrop={e => { e.preventDefault(); handleDrop(t.id) }}
                  >
                    <td
                      className="drag-handle"
                      draggable={editId === null}
                      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; startDrag(t.id) }}
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
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(t.id); if (e.key === 'Escape') setEditId(null) }}
                        />
                      ) : (
                        <span className="expandable-name" onClick={() => toggleExpand(t.id)}>
                          {t.name}
                          {!active && <span className="inactive-tag">已停用</span>}
                          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                        </span>
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
                        t.contact_phone
                          ? <a href={`tel:${t.contact_phone}`}>{t.contact_phone}</a>
                          : <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td className="row-actions">
                      {isEditing ? (
                        <>
                          <button className="btn-sm btn-primary" onClick={() => handleSaveEdit(t.id)} disabled={saving}>儲存</button>
                          <button className="btn-sm" onClick={() => setEditId(null)}>取消</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-sm" onClick={() => startEdit(t)}>編輯</button>
                          {active ? (
                            <button className="btn-sm btn-danger" onClick={() => handleToggleActive(t)} disabled={saving}>停用</button>
                          ) : (
                            <button className="btn-sm btn-primary" onClick={() => handleToggleActive(t)} disabled={saving}>重新啟用</button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                  {isExpanded && !isEditing && (
                    <tr className="expanded-row">
                      <td colSpan={4}>
                        <div className="expanded-section">
                          <div className="expanded-label">正在上的課程（被指派為預設老師）</div>
                          {cur.courses.length === 0 && cur.groups.length === 0 ? (
                            <div className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>尚未被指派為任何課程的預設老師</div>
                          ) : (
                            <ul className="enrollment-list">
                              {cur.courses.map(c => (
                                <li key={`c-${c.id}`} className="enrollment-item">
                                  <span className="enrollment-name">{c.name}</span>
                                </li>
                              ))}
                              {cur.groups.map(g => (
                                <li key={`g-${g.id}`} className="enrollment-item">
                                  <span className="enrollment-name">
                                    {g.name}
                                    <span style={{ color: 'var(--muted)', marginLeft: 6 }}>（團課）</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="expanded-label" style={{ marginTop: 16 }}>已上過的課程（依紀錄統計）</div>
                          {historyInfo?.loading ? (
                            <div className="loading">載入中⋯</div>
                          ) : historyInfo?.error ? (
                            <div className="error-msg">載入失敗</div>
                          ) : (() => {
                            const courses = historyInfo?.courses || []
                            const groups  = historyInfo?.groups  || []
                            if (!courses.length && !groups.length) {
                              return <div className="empty-hint" style={{ textAlign: 'left', padding: 0 }}>尚無上課紀錄</div>
                            }
                            return (
                              <ul style={{ margin: 0, paddingLeft: '1.2em', lineHeight: 1.8 }}>
                                {courses.map(c => (
                                  <li key={`hc-${c.course_id}`}>
                                    {c.course_name}
                                    <span style={{ color: 'var(--muted)' }}>（家教課・{c.lesson_count} 堂・最近 {c.last_lesson_date}）</span>
                                  </li>
                                ))}
                                {groups.map(g => (
                                  <li key={`hg-${g.group_id}`}>
                                    {g.group_name}
                                    <span style={{ color: 'var(--muted)' }}>（團課・{g.record_count} 次・最近 {g.last_record_date}）</span>
                                  </li>
                                ))}
                              </ul>
                            )
                          })()}
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
