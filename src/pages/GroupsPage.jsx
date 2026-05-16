import { useMemo, useState, useEffect } from 'react'
import { useGroups } from '../contexts/GroupsContext.jsx'
import { useTeachers } from '../contexts/TeachersContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import Combobox from '../components/Combobox.jsx'
import { apiListGroupMembers } from '../data/api.js'

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

const EMPTY_GROUP = { name: '', weekdays: '', duration_months: 0, monthly_fee: '', start_time: '', duration_hours: '', teacher_hourly_rate: '', salary_type: 'hourly', monthly_salary: '', note: '', default_teacher_id: '' }

export default function GroupsPage() {
  const { state, loadGroups, createGroup, updateGroup, removeGroup } = useGroups()
  const { state: teachersState, loadTeachers } = useTeachers()
  const { canViewRates } = useAuth()

  const [newGroup, setNewGroup]   = useState(EMPTY_GROUP)
  const [editId, setEditId]       = useState(null)
  const [editGroup, setEditGroup] = useState(EMPTY_GROUP)

  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  // 各團課人數快取（id -> count）
  const [memberCounts, setMemberCounts] = useState({})

  // 名稱排序：null 維持後端順序，'asc' 升冪，'desc' 降冪
  const [nameSort, setNameSort] = useState(null)
  function toggleNameSort() {
    setNameSort(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')
  }

  function amt(value) {
    return parseFloat(value).toLocaleString()
  }

  useEffect(() => { loadGroups() }, [loadGroups])
  useEffect(() => { loadTeachers() }, [loadTeachers])

  // 每個團課拉一次成員人數來顯示
  useEffect(() => {
    const ids = state.groups.map(g => g.id).filter(id => !(id in memberCounts))
    if (ids.length === 0) return
    let cancelled = false
    Promise.all(ids.map(id =>
      apiListGroupMembers(id).then(rows => [id, rows.length]).catch(() => [id, 0])
    )).then(pairs => {
      if (cancelled) return
      setMemberCounts(prev => {
        const next = { ...prev }
        for (const [id, n] of pairs) next[id] = n
        return next
      })
    })
    return () => { cancelled = true }
  }, [state.groups, memberCounts])

  async function handleAddGroup(e) {
    e.preventDefault()
    const name = newGroup.name.trim()
    if (!name) { setError('請輸入團課名稱'); return }
    if (!parseWeekdays(newGroup.weekdays).length) { setError('請選擇上課星期'); return }
    if (!Number.isInteger(newGroup.duration_months) || newGroup.duration_months <= 0) { setError('請選擇持續時間'); return }
    const fee = parseFloat(newGroup.monthly_fee)
    if (isNaN(fee) || fee <= 0) { setError('請輸入月費'); return }
    const dh = newGroup.duration_hours === '' ? 0 : parseFloat(newGroup.duration_hours)
    if (isNaN(dh) || dh < 0 || dh > 24) { setError('課堂時數格式不正確'); return }
    const thr = newGroup.teacher_hourly_rate === '' ? 0 : parseFloat(newGroup.teacher_hourly_rate)
    if (isNaN(thr) || thr < 0) { setError('老師時薪格式不正確'); return }
    const salaryType = newGroup.salary_type === 'monthly' ? 'monthly' : 'hourly'
    const ms = newGroup.monthly_salary === '' ? 0 : parseFloat(newGroup.monthly_salary)
    if (isNaN(ms) || ms < 0) { setError('月薪格式不正確'); return }
    if (salaryType === 'monthly' && ms <= 0) { setError('請輸入月薪金額'); return }
    setSaving(true); setError('')
    try {
      await createGroup({ name, weekdays: newGroup.weekdays, duration_months: newGroup.duration_months, monthly_fee: fee, start_time: newGroup.start_time || null, duration_hours: dh, teacher_hourly_rate: thr, salary_type: salaryType, monthly_salary: ms, note: newGroup.note, default_teacher_id: newGroup.default_teacher_id || null })
      setNewGroup(EMPTY_GROUP)
    } catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  function startEdit(g) {
    setEditId(g.id)
    setEditGroup({
      name: g.name,
      weekdays: g.weekdays || '',
      duration_months: g.duration_months ?? 0,
      monthly_fee: g.monthly_fee != null ? String(g.monthly_fee) : '',
      start_time: g.start_time ? String(g.start_time).slice(0, 5) : '',
      duration_hours: g.duration_hours != null ? String(g.duration_hours) : '',
      teacher_hourly_rate: g.teacher_hourly_rate != null ? String(g.teacher_hourly_rate) : '',
      salary_type: g.salary_type === 'monthly' ? 'monthly' : 'hourly',
      monthly_salary: g.monthly_salary != null ? String(g.monthly_salary) : '',
      note: g.note || '',
      default_teacher_id: g.default_teacher_id || '',
    })
  }

  async function handleUpdateGroup(id) {
    const name = editGroup.name.trim()
    if (!name) return
    const fee = parseFloat(editGroup.monthly_fee)
    if (isNaN(fee) || fee < 0) { setError('月費格式不正確'); return }
    const dh = editGroup.duration_hours === '' ? 0 : parseFloat(editGroup.duration_hours)
    if (isNaN(dh) || dh < 0 || dh > 24) { setError('課堂時數格式不正確'); return }
    const thr = editGroup.teacher_hourly_rate === '' ? 0 : parseFloat(editGroup.teacher_hourly_rate)
    if (isNaN(thr) || thr < 0) { setError('老師時薪格式不正確'); return }
    const salaryType = editGroup.salary_type === 'monthly' ? 'monthly' : 'hourly'
    const ms = editGroup.monthly_salary === '' ? 0 : parseFloat(editGroup.monthly_salary)
    if (isNaN(ms) || ms < 0) { setError('月薪格式不正確'); return }
    if (salaryType === 'monthly' && ms <= 0) { setError('請輸入月薪金額'); return }
    setSaving(true); setError('')
    try {
      await updateGroup(id, { name, weekdays: editGroup.weekdays, duration_months: editGroup.duration_months, monthly_fee: fee, start_time: editGroup.start_time || null, duration_hours: dh, teacher_hourly_rate: thr, salary_type: salaryType, monthly_salary: ms, note: editGroup.note, default_teacher_id: editGroup.default_teacher_id || null })
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
  const displayGroups = useMemo(() => {
    if (!nameSort) return groups
    const cmp = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant')
    return [...groups].sort(nameSort === 'asc' ? cmp : (a, b) => cmp(b, a))
  }, [groups, nameSort])

  return (
    <div className="page">
      <div className="page-header">
          <div className="page-header-body">
            <h1>團課管理</h1>
            <p className="page-desc">建立與管理團課課程與分組設定</p>
          </div>
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
                placeholder="例如 3600"
                value={newGroup.monthly_fee}
                onChange={e => setNewGroup(g => ({ ...g, monthly_fee: e.target.value }))}
              />
            </label>
            {canViewRates && (
              <label>計薪方式
                <select
                  value={newGroup.salary_type}
                  onChange={e => setNewGroup(g => ({ ...g, salary_type: e.target.value }))}
                >
                  <option value="hourly">時薪</option>
                  <option value="monthly">月薪</option>
                </select>
              </label>
            )}
            {canViewRates && newGroup.salary_type === 'monthly' && (
              <label title="月薪型團課：預設老師按該月實際上課堂數比例領薪">月薪（元/月）
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="例如 8000"
                  value={newGroup.monthly_salary}
                  onChange={e => setNewGroup(g => ({ ...g, monthly_salary: e.target.value }))}
                />
              </label>
            )}
            {canViewRates && (
              <label title={newGroup.salary_type === 'monthly' ? '代課老師（非預設老師）的鐘點費' : '團課老師時薪：每堂課老師可拿的鐘點費'}>
                {newGroup.salary_type === 'monthly' ? '代課時薪（元/小時）' : '老師時薪（元/小時）'}
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="例如 500"
                  value={newGroup.teacher_hourly_rate}
                  onChange={e => setNewGroup(g => ({ ...g, teacher_hourly_rate: e.target.value }))}
                />
              </label>
            )}
            <label>開始時間
              <input
                type="time"
                step="900"
                value={newGroup.start_time}
                onChange={e => setNewGroup(g => ({ ...g, start_time: e.target.value }))}
              />
            </label>
            <label>課堂時數
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                placeholder="例如 2"
                value={newGroup.duration_hours}
                onChange={e => setNewGroup(g => ({ ...g, duration_hours: e.target.value }))}
              />
            </label>
            <label>預設老師
              <Combobox
                items={teachersState.teachers.filter(t => t.active !== 0)}
                value={newGroup.default_teacher_id}
                onChange={tid => setNewGroup(g => ({ ...g, default_teacher_id: tid }))}
                placeholder="（選填）"
                allLabel="（無預設）"
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
              || !(parseFloat(newGroup.monthly_fee) > 0)
            }
          >新增團課</button>
        </form>

        {loading ? (
          <div className="loading">載入中⋯</div>
        ) : groups.length === 0 ? (
          <div className="empty-hint">尚未新增任何團課</div>
        ) : (
          <table className="entity-table groups-table">
            <colgroup>
              <col style={{ width: 140 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 80 }} />
              {canViewRates && <col style={{ width: 150 }} />}
              <col style={{ width: 110 }} />
              <col style={{ width: 70 }} />
              <col />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={toggleNameSort}
                    aria-label={`團課名稱（${nameSort === 'asc' ? '升冪' : nameSort === 'desc' ? '降冪' : '預設順序'}，點擊切換）`}
                    title="點擊切換排序"
                  >
                    團課名稱
                    <span className="th-sort-icon" aria-hidden="true">
                      {nameSort === 'asc' ? '▲' : nameSort === 'desc' ? '▼' : '⇅'}
                    </span>
                  </button>
                </th>
                <th>上課星期</th>
                <th>上課時段</th>
                <th>持續時間</th>
                <th>月費</th>
                {canViewRates && <th>計薪</th>}
                <th>預設老師</th>
                <th>報名人數</th>
                <th>備註</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayGroups.map(g => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{formatWeekdays(g.weekdays)}</td>
                  <td>{g.start_time ? `${String(g.start_time).slice(0, 5)}（${parseFloat(g.duration_hours || 0)} 小時）` : '—'}</td>
                  <td>{g.duration_months > 0 ? `${g.duration_months} 個月` : '—'}</td>
                  <td>{g.monthly_fee > 0 ? amt(g.monthly_fee) : '—'}</td>
                  {canViewRates && (
                    <td>
                      {g.salary_type === 'monthly' ? (
                        <>
                          <span className="salary-type-badge salary-type-monthly">月薪</span>
                          <span style={{ marginLeft: 6 }}>{g.monthly_salary > 0 ? amt(g.monthly_salary) : '—'}</span>
                          {g.teacher_hourly_rate > 0 && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>代課 {amt(g.teacher_hourly_rate)}/時</div>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="salary-type-badge salary-type-hourly">時薪</span>
                          <span style={{ marginLeft: 6 }}>{g.teacher_hourly_rate > 0 ? amt(g.teacher_hourly_rate) : '—'}</span>
                        </>
                      )}
                    </td>
                  )}
                  <td>{teachersState.teachers.find(t => t.id === g.default_teacher_id)?.name || '—'}</td>
                  <td>{memberCounts[g.id] ?? '—'} 人</td>
                  <td className="note-cell">{g.note || ''}</td>
                  <td className="row-actions">
                    <button className="btn-sm" onClick={() => startEdit(g)}>編輯</button>
                    <button className="btn-sm btn-danger" onClick={() => handleDeleteGroup(g.id)} disabled={saving}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editId && (
        <div className="modal-overlay" onClick={() => !saving && setEditId(null)}>
          <div className="modal-card group-edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>編輯團課</h3>
              <button type="button" className="modal-close" onClick={() => !saving && setEditId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="modal-field">
                <span>團課名稱</span>
                <input
                  type="text"
                  value={editGroup.name}
                  onChange={e => setEditGroup(eg => ({ ...eg, name: e.target.value }))}
                />
              </label>
              <div className="modal-field">
                <span>上課星期</span>
                <WeekdayPicker
                  value={editGroup.weekdays}
                  onChange={w => setEditGroup(eg => ({ ...eg, weekdays: w }))}
                  disabled={saving}
                />
              </div>
              <div className="modal-field-row">
                <label className="modal-field">
                  <span>開始時間</span>
                  <input
                    type="time"
                    step="900"
                    value={editGroup.start_time}
                    onChange={e => setEditGroup(eg => ({ ...eg, start_time: e.target.value }))}
                  />
                </label>
                <label className="modal-field">
                  <span>課堂時數</span>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={editGroup.duration_hours}
                    onChange={e => setEditGroup(eg => ({ ...eg, duration_hours: e.target.value }))}
                  />
                </label>
              </div>
              <div className="modal-field-row">
                <label className="modal-field">
                  <span>持續時間</span>
                  <select
                    value={editGroup.duration_months}
                    onChange={e => setEditGroup(eg => ({ ...eg, duration_months: parseInt(e.target.value, 10) }))}
                  >
                    <option value={0}>未設定</option>
                    <option value={1}>1 個月</option>
                    <option value={2}>2 個月</option>
                    <option value={3}>3 個月</option>
                    <option value={4}>4 個月</option>
                  </select>
                </label>
                <label className="modal-field">
                  <span>月費（元）</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editGroup.monthly_fee}
                    onChange={e => setEditGroup(eg => ({ ...eg, monthly_fee: e.target.value }))}
                  />
                </label>
              </div>
              {canViewRates && (
                <>
                  <label className="modal-field">
                    <span>計薪方式</span>
                    <select
                      value={editGroup.salary_type}
                      onChange={e => setEditGroup(eg => ({ ...eg, salary_type: e.target.value }))}
                    >
                      <option value="hourly">時薪</option>
                      <option value="monthly">月薪</option>
                    </select>
                  </label>
                  {editGroup.salary_type === 'monthly' ? (
                    <div className="modal-field-row">
                      <label className="modal-field">
                        <span>月薪（元/月）</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editGroup.monthly_salary}
                          onChange={e => setEditGroup(eg => ({ ...eg, monthly_salary: e.target.value }))}
                        />
                      </label>
                      <label className="modal-field">
                        <span>代課時薪（元/小時）</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editGroup.teacher_hourly_rate}
                          onChange={e => setEditGroup(eg => ({ ...eg, teacher_hourly_rate: e.target.value }))}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="modal-field">
                      <span>老師時薪（元/小時）</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editGroup.teacher_hourly_rate}
                        onChange={e => setEditGroup(eg => ({ ...eg, teacher_hourly_rate: e.target.value }))}
                      />
                    </label>
                  )}
                </>
              )}
              <div className="modal-field">
                <span>預設老師</span>
                <Combobox
                  items={teachersState.teachers.filter(t => t.active !== 0)}
                  value={editGroup.default_teacher_id}
                  onChange={tid => setEditGroup(eg => ({ ...eg, default_teacher_id: tid }))}
                  placeholder="（無預設）"
                  allLabel="（無預設）"
                />
              </div>
              <label className="modal-field">
                <span>備註</span>
                <input
                  type="text"
                  placeholder="（選填）"
                  value={editGroup.note}
                  onChange={e => setEditGroup(eg => ({ ...eg, note: e.target.value }))}
                />
              </label>
              {error && <div className="error-msg">{error}</div>}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => { setEditId(null); setError('') }} disabled={saving}>取消</button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleUpdateGroup(editId)}
                disabled={saving}
              >{saving ? '儲存中…' : '儲存'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
