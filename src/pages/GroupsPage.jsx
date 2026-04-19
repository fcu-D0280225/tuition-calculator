import { useState, useEffect } from 'react'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { useStudents } from '../contexts/StudentsContext.jsx'
import Combobox from '../components/Combobox.jsx'

const WEEKDAYS = [
  { value: 0, label: '日' },
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function parseWeekdays(raw) {
  if (!raw) return []
  return String(raw).split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
}

function formatWeekdays(raw) {
  const ds = parseWeekdays(raw)
  if (ds.length === 0) return '—'
  const map = Object.fromEntries(WEEKDAYS.map(w => [w.value, w.label]))
  return ds.sort((a, b) => a - b).map(d => map[d]).join('、')
}

function WeekdayPicker({ value, onChange, disabled }) {
  const set = new Set(parseWeekdays(value))
  function toggle(d) {
    const next = new Set(set)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    onChange(Array.from(next).sort((a, b) => a - b).join(','))
  }
  return (
    <div className="weekday-picker">
      {WEEKDAYS.map(w => (
        <button
          key={w.value}
          type="button"
          className={`weekday-chip ${set.has(w.value) ? 'active' : ''}`}
          onClick={() => toggle(w.value)}
          disabled={disabled}
        >
          {w.label}
        </button>
      ))}
    </div>
  )
}

const EMPTY_GROUP  = { name: '', weekdays: '', note: '' }
const EMPTY_RECORD = { group_id: '', student_ids: [], record_date: todayStr(), note: '' }

export default function GroupsPage() {
  const { state, loadGroups, createGroup, updateGroup, removeGroup, loadRecords, createRecord, removeRecord } = useGroups()
  const { state: ss, loadStudents } = useStudents()

  const [newGroup, setNewGroup] = useState(EMPTY_GROUP)
  const [editId, setEditId]     = useState(null)
  const [editGroup, setEditGroup] = useState(EMPTY_GROUP)

  const [form, setForm]     = useState(EMPTY_RECORD)
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadGroups(); loadStudents(); loadRecords() }, [loadGroups, loadStudents, loadRecords])

  // ── 團課目錄 ──────────────────────────────────────────────────

  async function handleAddGroup(e) {
    e.preventDefault()
    const name = newGroup.name.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await createGroup({ name, weekdays: newGroup.weekdays, note: newGroup.note })
      setNewGroup(EMPTY_GROUP)
    } catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  function startEdit(g) {
    setEditId(g.id)
    setEditGroup({ name: g.name, weekdays: g.weekdays || '', note: g.note || '' })
  }

  async function handleUpdateGroup(id) {
    const name = editGroup.name.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await updateGroup(id, { name, weekdays: editGroup.weekdays, note: editGroup.note })
      setEditId(null)
    } catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleDeleteGroup(id) {
    if (!window.confirm('確定要刪除此團課？相關上課紀錄也會一起刪除。')) return
    setSaving(true); setError('')
    try { await removeGroup(id) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  // ── 團課上課紀錄 ─────────────────────────────────────────────

  async function handleAddRecord(e) {
    e.preventDefault()
    if (!form.group_id) { setError('請選擇團課'); return }
    if (form.student_ids.length === 0) { setError('請至少選一位學生'); return }
    if (!form.record_date) { setError('請選擇日期'); return }
    setSaving(true); setError('')
    try {
      const { group_id, record_date, note, student_ids } = form
      await Promise.all(student_ids.map(student_id =>
        createRecord({ group_id, student_id, record_date, note })
      ))
      await loadRecords()
      setForm({ ...EMPTY_RECORD, record_date: form.record_date })
    } catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  function addStudent(id) {
    if (!id) return
    setForm(f => f.student_ids.includes(id) ? f : { ...f, student_ids: [...f.student_ids, id] })
  }
  function removeStudent(id) {
    setForm(f => ({ ...f, student_ids: f.student_ids.filter(x => x !== id) }))
  }

  async function handleDeleteRecord(id) {
    if (!window.confirm('確定要刪除此筆團課上課紀錄？')) return
    setSaving(true); setError('')
    try { await removeRecord(id) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  const { groups, loading, records } = state
  const { students } = ss

  return (
    <div className="page">
      <div className="page-header">
        <h1>團課管理</h1>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* ── 團課目錄 ── */}
      <div className="lesson-form-card" style={{ marginBottom: '32px' }}>
        <div className="form-section-title">團課目錄</div>

        <form className="add-form" onSubmit={handleAddGroup} style={{ marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            className="add-input"
            placeholder="團課名稱（如：週一晚會話班）"
            value={newGroup.name}
            onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))}
          />
          <WeekdayPicker
            value={newGroup.weekdays}
            onChange={w => setNewGroup(g => ({ ...g, weekdays: w }))}
            disabled={saving}
          />
          <input
            className="add-input"
            placeholder="備註（選填）"
            value={newGroup.note}
            onChange={e => setNewGroup(g => ({ ...g, note: e.target.value }))}
          />
          <button className="btn-primary" type="submit" disabled={saving || !newGroup.name.trim()}>新增團課</button>
        </form>

        {loading ? (
          <div className="loading">載入中⋯</div>
        ) : groups.length === 0 ? (
          <div className="empty-hint">尚未新增任何團課</div>
        ) : (
          <table className="entity-table">
            <thead>
              <tr><th>團課名稱</th><th>上課星期</th><th>備註</th><th></th></tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id}>
                  <td>
                    {editId === g.id ? (
                      <input
                        autoFocus
                        className="inline-edit-input"
                        value={editGroup.name}
                        onChange={e => setEditGroup(eg => ({ ...eg, name: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateGroup(g.id); if (e.key === 'Escape') setEditId(null) }}
                      />
                    ) : g.name}
                  </td>
                  <td>
                    {editId === g.id ? (
                      <WeekdayPicker
                        value={editGroup.weekdays}
                        onChange={w => setEditGroup(eg => ({ ...eg, weekdays: w }))}
                        disabled={saving}
                      />
                    ) : formatWeekdays(g.weekdays)}
                  </td>
                  <td className="note-cell">
                    {editId === g.id ? (
                      <input
                        className="inline-edit-input"
                        value={editGroup.note}
                        onChange={e => setEditGroup(eg => ({ ...eg, note: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateGroup(g.id); if (e.key === 'Escape') setEditId(null) }}
                      />
                    ) : (g.note || '')}
                  </td>
                  <td className="row-actions">
                    {editId === g.id ? (
                      <>
                        <button className="btn-sm btn-primary" onClick={() => handleUpdateGroup(g.id)} disabled={saving}>儲存</button>
                        <button className="btn-sm" onClick={() => setEditId(null)}>取消</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-sm" onClick={() => startEdit(g)}>編輯</button>
                        <button className="btn-sm btn-danger" onClick={() => handleDeleteGroup(g.id)} disabled={saving}>刪除</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 團課上課紀錄 ── */}
      <div className="lesson-form-card">
        <div className="form-section-title">新增團課上課紀錄</div>
        <form className="lesson-form" onSubmit={handleAddRecord}>
          <div className="lesson-form-row">
            <label>團課
              <Combobox
                items={groups}
                value={form.group_id}
                onChange={id => setForm(f => ({ ...f, group_id: id }))}
                placeholder="搜尋團課…"
              />
            </label>
            <label>日期
              <input type="date" value={form.record_date}
                onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))}
              />
            </label>
            <label>備註
              <input type="text" placeholder="（選填）"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="note-input"
              />
            </label>
          </div>
          <label>學生（可複選）
            <Combobox
              key={form.student_ids.length}
              items={students.filter(s => !form.student_ids.includes(s.id))}
              value=""
              onChange={addStudent}
              placeholder="搜尋學生加入…"
            />
            {form.student_ids.length > 0 && (
              <div className="chip-list">
                {form.student_ids.map(id => {
                  const s = students.find(x => x.id === id)
                  return (
                    <span className="chip" key={id}>
                      {s?.name ?? id}
                      <button type="button" className="chip-remove" onClick={() => removeStudent(id)} aria-label="移除">×</button>
                    </span>
                  )
                })}
              </div>
            )}
          </label>
          <button className="btn-primary" type="submit" disabled={saving}>新增</button>
        </form>
      </div>

      {records.length > 0 && (
        <table className="lesson-table" style={{ marginTop: '24px' }}>
          <thead>
            <tr>
              <th>日期</th>
              <th>團課</th>
              <th>學生</th>
              <th>備註</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id}>
                <td>{r.record_date}</td>
                <td>{r.group_name}</td>
                <td>{r.student_name}</td>
                <td className="note-cell">{r.note}</td>
                <td className="row-actions">
                  <button className="btn-sm btn-danger" onClick={() => handleDeleteRecord(r.id)} disabled={saving}>刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
