import { Fragment, useState, useEffect } from 'react'
import { useStudents } from '../contexts/StudentsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useGroups } from '../contexts/GroupsContext.jsx'
import Combobox from '../components/Combobox.jsx'
import { useDirtyTracker } from '../contexts/UnsavedContext.jsx'
import { apiListGroupMembers } from '../data/api.js'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_OPTIONS = [
  { value: 'attended',   label: '已點名' },
  { value: 'pending',    label: '未點名' },
  { value: 'pre_enroll', label: '尚未開始' },
  { value: 'leave',      label: '請假' },
]

function getDisplayStatus(record) {
  const status = record.status || 'attended'
  if (status === 'leave' || (record.note || '').includes('請假')) return 'leave'
  return status
}

function GroupRecordStatus({ record }) {
  const s = getDisplayStatus(record)
  const map = {
    leave:     { label: '請假',     cls: 'status-leave' },
    pre_enroll:{ label: '尚未開始', cls: 'status-pre' },
    pending:   { label: '未點名',   cls: 'status-pending' },
    attended:  { label: '已點名',   cls: 'status-attended' },
  }
  const { label, cls } = map[s] || map.attended
  return <span className={`status-tag ${cls}`}>{label}</span>
}

const EMPTY_GROUP_RECORD = { group_id: '', teacher_id: '', student_ids: [], record_date: todayStr(), note: '' }

export default function GroupLessonsPage() {
  const { state: studentState, loadStudents } = useStudents()
  const { state: teacherState, loadTeachers } = useTeachers()
  const {
    state: groupState,
    loadGroups,
    loadRecords: loadGroupRecords,
    createRecord: createGroupRecord,
    updateRecord: updateGroupRecord,
    removeRecord: removeGroupRecord,
  } = useGroups()

  const [groupForm, setGroupForm]     = useState(EMPTY_GROUP_RECORD)
  const [showForm, setShowForm]       = useState(false)
  const [editGroupRecId, setEditGroupRecId] = useState(null)
  const [editGroupRec, setEditGroupRec]     = useState(null)
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)

  // group_id → Set<student_id>（成員過濾用）
  const [groupMemberMap, setGroupMemberMap] = useState({})

  // 篩選
  const [filterFrom, setFilterFrom]       = useState('')
  const [filterTo, setFilterTo]           = useState('')
  const [filterGroups, setFilterGroups]     = useState([])  // 多選團課
  const [filterStudents, setFilterStudents] = useState([])  // 多選學生
  const [filterTeacher, setFilterTeacher]   = useState('')

  function handleFilter(e) {
    e.preventDefault()
    // 多選的 group/student 走前端過濾，後端僅吃 from/to/teacher
    loadGroupRecords({
      from: filterFrom || undefined,
      to: filterTo || undefined,
      teacher_id: filterTeacher || undefined,
    })
  }
  function resetFilter() {
    setFilterFrom(''); setFilterTo(''); setFilterGroups([]); setFilterStudents([]); setFilterTeacher('')
    loadGroupRecords()
  }
  function addFilterGroup(id) {
    if (!id) return
    setFilterGroups(prev => prev.includes(id) ? prev : [...prev, id])
  }
  function removeFilterGroup(id) { setFilterGroups(prev => prev.filter(x => x !== id)) }
  function addFilterStudent(id) {
    if (!id) return
    setFilterStudents(prev => prev.includes(id) ? prev : [...prev, id])
  }
  function removeFilterStudent(id) { setFilterStudents(prev => prev.filter(x => x !== id)) }

  useEffect(() => {
    loadStudents(); loadTeachers(); loadGroups(); loadGroupRecords()
  }, [loadStudents, loadTeachers, loadGroups, loadGroupRecords])

  useDirtyTracker(
    'lessons_group:add',
    !!(groupForm.group_id || groupForm.teacher_id || groupForm.student_ids.length || groupForm.note)
  )

  function studentsForGroup(groupId) {
    if (!groupId) return studentState.students
    const allowed = groupMemberMap[groupId]
    if (!allowed) return []
    return studentState.students.filter(s => allowed.has(s.id))
  }

  async function handleGroupSelectInForm(id) {
    const g = groupState.groups.find(x => x.id === id)
    const defaultTid = g?.default_teacher_id || ''
    setGroupForm(f => ({ ...f, group_id: id, teacher_id: defaultTid, student_ids: [] }))
    if (id && !groupMemberMap[id]) {
      try {
        const rows = await apiListGroupMembers(id)
        setGroupMemberMap(prev => ({ ...prev, [id]: new Set(rows.map(r => r.id)) }))
      } catch {}
    }
  }

  function addGroupStudent(id) {
    if (!id) return
    setGroupForm(f => f.student_ids.includes(id) ? f : { ...f, student_ids: [...f.student_ids, id] })
  }
  function removeGroupStudent(id) {
    setGroupForm(f => ({ ...f, student_ids: f.student_ids.filter(x => x !== id) }))
  }

  async function handleAddGroupRecord(e) {
    e.preventDefault()
    if (!groupForm.group_id) { setError('請選擇團課'); return }
    if (groupForm.student_ids.length === 0) { setError('請至少選一位學生'); return }
    if (!groupForm.record_date) { setError('請選擇日期'); return }
    setSaving(true); setError('')
    try {
      const { group_id, teacher_id, record_date, note, student_ids } = groupForm
      await Promise.all(student_ids.map(student_id =>
        createGroupRecord({ group_id, student_id, teacher_id: teacher_id || null, record_date, note })
      ))
      await loadGroupRecords()
      setGroupForm({ ...EMPTY_GROUP_RECORD, record_date: groupForm.record_date })
    } catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleDeleteGroupRecord(id) {
    if (!window.confirm('確定要刪除此筆團課上課紀錄？')) return
    setSaving(true); setError('')
    try { await removeGroupRecord(id) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  function startEditGroupRec(r) {
    setEditGroupRecId(r.id)
    setEditGroupRec({
      group_id: r.group_id,
      student_id: r.student_id,
      teacher_id: r.teacher_id || '',
      record_date: r.record_date,
      note: r.note || '',
      status: getDisplayStatus(r),
    })
  }

  async function handleSaveEditGroupRec(id) {
    if (!editGroupRec.group_id) { setError('請選擇團課'); return }
    if (!editGroupRec.student_id) { setError('請選擇學生'); return }
    if (!editGroupRec.record_date) { setError('請選擇日期'); return }
    setSaving(true); setError('')
    try {
      await updateGroupRecord(id, { ...editGroupRec, teacher_id: editGroupRec.teacher_id || null })
      await loadGroupRecords()
      setEditGroupRecId(null); setEditGroupRec(null)
    } catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  const { students } = studentState
  const { teachers } = teacherState
  const { groups, records: groupRecords } = groupState

  return (
    <div className="page">
      <div className="page-header">
        <h1>團課上課紀錄</h1>
      </div>

      <div className="add-mode-switcher">
        <button
          type="button"
          className={`mode-toggle${showForm ? ' active' : ''}`}
          onClick={() => { setError(''); setShowForm(v => !v) }}
          aria-pressed={showForm}
        >
          {showForm ? '收起新增表單' : '＋ 新增團課上課紀錄'}
        </button>
      </div>

      {showForm && (
        <div className="lesson-form-card">
          <div className="form-section-title">新增團課上課紀錄</div>
          <form className="lesson-form" onSubmit={handleAddGroupRecord}>
            <div className="lesson-form-row">
              <label>團課
                <Combobox
                  items={groups}
                  value={groupForm.group_id}
                  onChange={handleGroupSelectInForm}
                  placeholder="搜尋團課…"
                />
              </label>
              <label>老師
                <Combobox
                  key={`grp-teacher-${groupForm.group_id}`}
                  items={teachers}
                  value={groupForm.teacher_id}
                  onChange={id => setGroupForm(f => ({ ...f, teacher_id: id }))}
                  placeholder="搜尋老師…"
                />
              </label>
              <label>日期
                <input type="date" value={groupForm.record_date}
                  onChange={e => setGroupForm(f => ({ ...f, record_date: e.target.value }))}
                />
              </label>
              <label>備註
                <input type="text" placeholder="（選填）"
                  value={groupForm.note}
                  onChange={e => setGroupForm(f => ({ ...f, note: e.target.value }))}
                  className="note-input"
                />
              </label>
            </div>
            <label>學生（可複選）
              <Combobox
                key={`grp-stu-${groupForm.group_id}-${groupForm.student_ids.length}`}
                items={studentsForGroup(groupForm.group_id).filter(s => !groupForm.student_ids.includes(s.id))}
                value=""
                onChange={addGroupStudent}
                placeholder={groupForm.group_id ? '搜尋學生加入…' : '請先選團課'}
              />
              {groupForm.group_id && studentsForGroup(groupForm.group_id).length === 0 && (
                <div className="error-msg" style={{ fontSize: 12, marginTop: 2 }}>該團課尚未報名任何學生，請先到「學生名冊」設定。</div>
              )}
              {groupForm.student_ids.length > 0 && (
                <div className="chip-list">
                  {groupForm.student_ids.map(id => {
                    const s = students.find(x => x.id === id)
                    return (
                      <span className="chip" key={id}>
                        {s?.name ?? id}
                        <button type="button" className="chip-remove" onClick={() => removeGroupStudent(id)} aria-label="移除">×</button>
                      </span>
                    )
                  })}
                </div>
              )}
            </label>
            <button className="btn-primary" type="submit" disabled={saving}>新增</button>
          </form>
          {error && <div className="error-msg">{error}</div>}
        </div>
      )}

      <form className="filter-bar" onSubmit={handleFilter}>
        <Combobox
          key={`fg-${filterGroups.length}`}
          items={groups.filter(g => !filterGroups.includes(g.id))}
          value=""
          onChange={addFilterGroup}
          placeholder="加入團課（可複選）"
        />
        <Combobox
          key={`fs-${filterStudents.length}`}
          items={students.filter(s => !filterStudents.includes(s.id))}
          value=""
          onChange={addFilterStudent}
          placeholder="加入學生（可複選）"
        />
        <Combobox items={teachers} value={filterTeacher} onChange={setFilterTeacher} placeholder="全部老師" allLabel="全部老師" />
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="開始日期" />
        <span>—</span>
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="結束日期" />
        <button className="btn-sm btn-primary" type="submit">篩選</button>
        <button className="btn-sm" type="button" onClick={resetFilter}>重設</button>
      </form>
      {(filterGroups.length > 0 || filterStudents.length > 0) && (
        <div className="chip-list" style={{ margin: '4px 0 12px' }}>
          {filterGroups.map(id => {
            const g = groups.find(x => x.id === id)
            return (
              <span key={`fg-${id}`} className="chip">
                團課：{g?.name || id}
                <button type="button" className="chip-remove" onClick={() => removeFilterGroup(id)} aria-label="移除">×</button>
              </span>
            )
          })}
          {filterStudents.map(id => {
            const s = students.find(x => x.id === id)
            return (
              <span key={`fs-${id}`} className="chip">
                學生：{s?.name || id}
                <button type="button" className="chip-remove" onClick={() => removeFilterStudent(id)} aria-label="移除">×</button>
              </span>
            )
          })}
        </div>
      )}

      {(() => {
        const filtered = groupRecords.filter(r =>
          (filterGroups.length === 0 || filterGroups.includes(r.group_id)) &&
          (filterStudents.length === 0 || filterStudents.includes(r.student_id))
        )
        if (filtered.length === 0) {
          return <div className="empty-hint">目前沒有團課上課紀錄</div>
        }
        return (
        <table className="lesson-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>團課</th>
              <th>學生</th>
              <th>老師</th>
              <th>狀態</th>
              <th>備註</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                {editGroupRecId === r.id ? (
                  <Fragment>
                    <td><input type="date" className="inline-edit-input" value={editGroupRec.record_date} onChange={e => setEditGroupRec(f => ({ ...f, record_date: e.target.value }))} /></td>
                    <td>
                      <div className="combobox-cell">
                        <Combobox
                          items={groups}
                          value={editGroupRec.group_id}
                          onChange={id => setEditGroupRec(f => ({ ...f, group_id: id }))}
                          placeholder="搜尋團課…"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="combobox-cell">
                        <Combobox
                          items={students}
                          value={editGroupRec.student_id}
                          onChange={id => setEditGroupRec(f => ({ ...f, student_id: id }))}
                          placeholder="搜尋學生…"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="combobox-cell">
                        <Combobox
                          items={teachers}
                          value={editGroupRec.teacher_id}
                          onChange={id => setEditGroupRec(f => ({ ...f, teacher_id: id }))}
                          placeholder="搜尋老師…"
                        />
                      </div>
                    </td>
                    <td>
                      <select className="inline-edit-input"
                        value={editGroupRec.status || 'attended'}
                        onChange={e => setEditGroupRec(f => ({ ...f, status: e.target.value }))}
                      >
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td><input type="text" className="inline-edit-input" value={editGroupRec.note} onChange={e => setEditGroupRec(f => ({ ...f, note: e.target.value }))} /></td>
                    <td className="row-actions">
                      <button className="btn-sm btn-primary" onClick={() => handleSaveEditGroupRec(r.id)} disabled={saving}>儲存</button>
                      <button className="btn-sm" onClick={() => { setEditGroupRecId(null); setEditGroupRec(null) }}>取消</button>
                    </td>
                  </Fragment>
                ) : (
                  <Fragment>
                    <td>{r.record_date}</td>
                    <td>{r.group_name}</td>
                    <td>{r.student_name}</td>
                    <td>{r.teacher_name || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td><GroupRecordStatus record={r} /></td>
                    <td className="note-cell">{r.note}</td>
                    <td className="row-actions">
                      <button className="btn-sm" onClick={() => startEditGroupRec(r)}>編輯</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDeleteGroupRecord(r.id)} disabled={saving}>刪除</button>
                    </td>
                  </Fragment>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        )
      })()}
    </div>
  )
}
