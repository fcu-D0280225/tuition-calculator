import { useState, useEffect } from 'react'
import { useGroups } from '../contexts/GroupsContext.jsx'
import EyeIcon from '../components/EyeIcon.jsx'

const WEEKDAYS = [
  { value: 0, label: '日' },
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
]

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

const EMPTY_GROUP = { name: '', weekdays: '', duration_months: 0, monthly_fee: 0, note: '' }

export default function GroupsPage() {
  const { state, loadGroups, createGroup, updateGroup, removeGroup } = useGroups()

  const [newGroup, setNewGroup]   = useState(EMPTY_GROUP)
  const [editId, setEditId]       = useState(null)
  const [editGroup, setEditGroup] = useState(EMPTY_GROUP)

  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const [showAmounts, setShowAmounts] = useState(false)

  function amt(value) {
    if (!showAmounts) return '••••'
    return parseFloat(value).toLocaleString()
  }

  useEffect(() => { loadGroups() }, [loadGroups])

  async function handleAddGroup(e) {
    e.preventDefault()
    const name = newGroup.name.trim()
    if (!name) { setError('請輸入團課名稱'); return }
    if (!parseWeekdays(newGroup.weekdays).length) { setError('請選擇上課星期'); return }
    if (!Number.isInteger(newGroup.duration_months) || newGroup.duration_months <= 0) { setError('請選擇持續時間'); return }
    if (isNaN(newGroup.monthly_fee) || newGroup.monthly_fee <= 0) { setError('請輸入月費'); return }
    setSaving(true); setError('')
    try {
      await createGroup({ name, weekdays: newGroup.weekdays, duration_months: newGroup.duration_months, monthly_fee: newGroup.monthly_fee, note: newGroup.note })
      setNewGroup(EMPTY_GROUP)
    } catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  function startEdit(g) {
    setEditId(g.id)
    setEditGroup({ name: g.name, weekdays: g.weekdays || '', duration_months: g.duration_months ?? 0, monthly_fee: g.monthly_fee ?? 0, note: g.note || '' })
  }

  async function handleUpdateGroup(id) {
    const name = editGroup.name.trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      await updateGroup(id, { name, weekdays: editGroup.weekdays, duration_months: editGroup.duration_months, monthly_fee: editGroup.monthly_fee, note: editGroup.note })
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

  const { groups, loading } = state

  return (
    <div className="page">
      <div className="page-header">
        <h1>團課管理</h1>
        <button className="btn-sm" onClick={() => setShowAmounts(v => !v)} title={showAmounts ? '隱藏金額' : '顯示金額'}>
          <EyeIcon open={showAmounts} />{showAmounts ? '隱藏金額' : '顯示金額'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* ── 團課目錄 ── */}
      <div className="lesson-form-card">
        <div className="form-section-title">團課目錄</div>

        <form className="lesson-form" onSubmit={handleAddGroup} style={{ marginBottom: '16px' }}>
          <div className="lesson-form-row">
            <label>團課名稱
              <input
                type="text"
                placeholder="如：週一晚會話班"
                value={newGroup.name}
                onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))}
              />
            </label>
            <label>上課星期
              <WeekdayPicker
                value={newGroup.weekdays}
                onChange={w => setNewGroup(g => ({ ...g, weekdays: w }))}
                disabled={saving}
              />
            </label>
            <label>持續時間
              <select
                value={newGroup.duration_months}
                onChange={e => setNewGroup(g => ({ ...g, duration_months: parseInt(e.target.value, 10) }))}
              >
                <option value={0}>未設定</option>
                <option value={1}>1 個月</option>
                <option value={2}>2 個月</option>
                <option value={3}>3 個月</option>
                <option value={4}>4 個月</option>
              </select>
            </label>
            <label>月費（元）
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={newGroup.monthly_fee}
                onChange={e => setNewGroup(g => ({ ...g, monthly_fee: parseFloat(e.target.value) || 0 }))}
              />
            </label>
            <label>備註
              <input
                type="text"
                placeholder="（選填）"
                value={newGroup.note}
                onChange={e => setNewGroup(g => ({ ...g, note: e.target.value }))}
                className="note-input"
              />
            </label>
          </div>
          <button
            className="btn-primary"
            type="submit"
            disabled={
              saving
              || !newGroup.name.trim()
              || !parseWeekdays(newGroup.weekdays).length
              || !(newGroup.duration_months > 0)
              || !(newGroup.monthly_fee > 0)
            }
          >新增團課</button>
        </form>

        {loading ? (
          <div className="loading">載入中⋯</div>
        ) : groups.length === 0 ? (
          <div className="empty-hint">尚未新增任何團課</div>
        ) : (
          <table className="entity-table">
            <thead>
              <tr><th>團課名稱</th><th>上課星期</th><th>持續時間</th><th>月費</th><th>備註</th><th></th></tr>
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
                  <td>
                    {editId === g.id ? (
                      <select
                        value={editGroup.duration_months}
                        onChange={e => setEditGroup(eg => ({ ...eg, duration_months: parseInt(e.target.value, 10) }))}
                        className="inline-edit-input"
                      >
                        <option value={0}>未設定</option>
                        <option value={1}>1 個月</option>
                        <option value={2}>2 個月</option>
                        <option value={3}>3 個月</option>
                        <option value={4}>4 個月</option>
                      </select>
                    ) : (g.duration_months > 0 ? `${g.duration_months} 個月` : '—')}
                  </td>
                  <td>
                    {editId === g.id ? (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="inline-edit-input"
                        value={editGroup.monthly_fee}
                        onChange={e => setEditGroup(eg => ({ ...eg, monthly_fee: parseFloat(e.target.value) || 0 }))}
                      />
                    ) : (g.monthly_fee > 0 ? amt(g.monthly_fee) : '—')}
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
    </div>
  )
}
