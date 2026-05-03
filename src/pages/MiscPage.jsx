import { useState, useEffect, useCallback } from 'react'
import { apiListMiscExpenses, apiCreateMiscExpense, apiUpdateMiscExpense, apiDeleteMiscExpense } from '../data/api.js'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const CATEGORIES = ['房租', '水電', '行銷', '其他']
const EMPTY = { name: '', category: '其他', amount: '', expense_date: todayStr(), note: '' }

export default function MiscPage() {
  const [items, setItems]     = useState([])
  const [form, setForm]       = useState(EMPTY)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm,  setEditForm]  = useState(EMPTY)

  const reload = useCallback(async (filters = {}) => {
    setLoading(true)
    try {
      const rows = await apiListMiscExpenses(filters)
      setItems(rows)
    } catch (e) {
      setError(`載入失敗：${e?.message || e}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload({}) }, [reload])

  async function handleAdd(e) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) { setError('請輸入名稱'); return }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount < 0) { setError('請輸入有效金額'); return }
    if (!form.expense_date) { setError('請選擇日期'); return }
    setSaving(true); setError('')
    try {
      await apiCreateMiscExpense({ name, category: form.category || '其他', amount, expense_date: form.expense_date, note: form.note.trim() })
      setForm({ ...EMPTY, category: form.category, expense_date: form.expense_date })
      await reload({
        from: filterFrom || undefined,
        to:   filterTo   || undefined,
        category: filterCategory || undefined,
      })
    } catch (e) {
      setError(`新增失敗：${e?.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定要刪除此筆雜項？')) return
    setSaving(true); setError('')
    try {
      await apiDeleteMiscExpense(id)
      setItems(prev => prev.filter(x => x.id !== id))
    } catch (e) {
      setError(`刪除失敗：${e?.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(it) {
    setEditingId(it.id)
    setEditForm({
      name:         it.name || '',
      category:     it.category || '其他',
      amount:       String(it.amount ?? ''),
      expense_date: String(it.expense_date || '').slice(0, 10),
      note:         it.note || '',
    })
    setError('')
  }
  function cancelEdit() {
    setEditingId(null)
    setEditForm(EMPTY)
  }
  async function handleUpdate(e) {
    e.preventDefault()
    const name = editForm.name.trim()
    if (!name) { setError('請輸入名稱'); return }
    const amount = parseFloat(editForm.amount)
    if (isNaN(amount) || amount < 0) { setError('請輸入有效金額'); return }
    if (!editForm.expense_date) { setError('請選擇日期'); return }
    setSaving(true); setError('')
    try {
      const updated = await apiUpdateMiscExpense(editingId, {
        name,
        category:     editForm.category || '其他',
        amount,
        expense_date: editForm.expense_date,
        note:         editForm.note.trim(),
      })
      setItems(prev => prev.map(x => x.id === editingId ? { ...x, ...updated, amount: parseFloat(updated.amount) } : x))
      cancelEdit()
    } catch (e) {
      setError(`更新失敗：${e?.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  function handleFilter(e) {
    e.preventDefault()
    reload({
      from: filterFrom || undefined,
      to:   filterTo   || undefined,
      category: filterCategory || undefined,
    })
  }
  function resetFilter() {
    setFilterFrom(''); setFilterTo(''); setFilterCategory('')
    reload({})
  }

  const total = items.reduce((s, it) => s + parseFloat(it.amount || 0), 0)
  const subtotalByCategory = items.reduce((map, it) => {
    const k = it.category || '其他'
    map[k] = (map[k] || 0) + parseFloat(it.amount || 0)
    return map
  }, {})

  return (
    <div className="page">
      <div className="page-header">
        <h1>雜項支出</h1>
      </div>

      <div className="lesson-form-card">
        <div className="form-section-title">新增雜項</div>
        <form className="lesson-form" onSubmit={handleAdd}>
          <div className="lesson-form-row">
            <label>類別
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>名稱
              <input type="text" placeholder="例如：水電費"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>金額（元）
              <input type="number" min="0" step="1"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label>日期
              <input type="date"
                value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
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
          <button className="btn-primary" type="submit" disabled={saving}>新增</button>
        </form>
        {error && <div className="error-msg">{error}</div>}
      </div>

      <form className="filter-bar" onSubmit={handleFilter}>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="開始日期" />
        <span>—</span>
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="結束日期" />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} title="類別篩選">
          <option value="">全部類別</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn-sm btn-primary" type="submit">篩選</button>
        <button className="btn-sm" type="button" onClick={resetFilter}>重設</button>
        <span style={{ marginLeft: 12, color: 'var(--muted)' }}>合計：<strong>{total.toLocaleString()}</strong> 元</span>
      </form>

      {items.length > 0 && Object.keys(subtotalByCategory).length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '8px 0 12px', fontSize: 13, color: 'var(--muted)' }}>
          {CATEGORIES.filter(c => subtotalByCategory[c]).map(c => (
            <span key={c} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 999 }}>
              {c}：<strong style={{ color: 'var(--text)' }}>{subtotalByCategory[c].toLocaleString()}</strong> 元
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : items.length === 0 ? (
        <div className="empty-hint">目前沒有雜項紀錄</div>
      ) : (
        <table className="lesson-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>類別</th>
              <th>名稱</th>
              <th>金額</th>
              <th>備註</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => editingId === it.id ? (
              <tr key={it.id}>
                <td>
                  <input type="date" value={editForm.expense_date}
                    onChange={e => setEditForm(f => ({ ...f, expense_date: e.target.value }))} />
                </td>
                <td>
                  <select value={editForm.category}
                    onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <input type="text" value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </td>
                <td>
                  <input type="number" min="0" step="1" value={editForm.amount}
                    onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                </td>
                <td>
                  <input type="text" value={editForm.note}
                    onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} />
                </td>
                <td className="row-actions">
                  <button className="btn-sm btn-primary" onClick={handleUpdate} disabled={saving}>儲存</button>
                  <button className="btn-sm" onClick={cancelEdit} disabled={saving}>取消</button>
                </td>
              </tr>
            ) : (
              <tr key={it.id}>
                <td>{String(it.expense_date).slice(0, 10)}</td>
                <td>{it.category || '其他'}</td>
                <td>{it.name}</td>
                <td>{parseFloat(it.amount).toLocaleString()}</td>
                <td className="note-cell">{it.note}</td>
                <td className="row-actions">
                  <button className="btn-sm" onClick={() => startEdit(it)} disabled={saving || editingId !== null}>編輯</button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(it.id)} disabled={saving || editingId !== null}>刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
