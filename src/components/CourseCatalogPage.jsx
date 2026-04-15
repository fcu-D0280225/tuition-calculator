import { useState } from 'react'
import {
  CYCLE_PRESETS,
  createCatalogId,
  emptyCatalogForm,
} from '../data/courseCatalog'

function isPresetCycle(label) {
  return typeof label === 'string' && CYCLE_PRESETS.includes(label.trim())
}

export default function CourseCatalogPage({ items, onChangeItems }) {
  const [form, setForm] = useState(emptyCatalogForm)
  const [editingId, setEditingId] = useState(null)

  function resetForm() {
    setForm(emptyCatalogForm())
    setEditingId(null)
  }

  function handleSave(e) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      window.alert('請填寫課程名稱')
      return
    }
    const hours = form.hours === '' ? 0 : parseFloat(form.hours)
    const defaultAmount = form.defaultAmount === '' ? 0 : parseFloat(form.defaultAmount)
    if (!Number.isFinite(hours) || hours < 0) {
      window.alert('時數需為 0 以上的數字')
      return
    }
    if (!Number.isFinite(defaultAmount) || defaultAmount < 0) {
      window.alert('預設金額需為 0 以上的數字')
      return
    }
    if (hours === 0 && defaultAmount === 0) {
      window.alert('請至少填寫時數與預設金額其中之一（可單獨固定費用）')
      return
    }

    const cycleLabel = (form.cycleLabel || '').trim() || '一個月'
    const payload = { name, hours, cycleLabel, defaultAmount }

    if (editingId) {
      const prev = items.find(x => x.id === editingId)
      onChangeItems(items.map(x => {
        if (x.id !== editingId) return x
        return {
          ...prev,
          ...payload,
          id: editingId,
          subject: prev.billingShape
            ? (prev.subject || name)
            : name,
          billingShape: prev.billingShape,
        }
      }))
    } else {
      onChangeItems([...items, { id: createCatalogId(), ...payload, subject: name }])
    }
    resetForm()
  }

  function startEdit(id) {
    const row = items.find(x => x.id === id)
    if (!row) return
    setEditingId(id)
    setForm({
      name: row.name,
      hours: String(row.hours ?? 0),
      cycleLabel: row.cycleLabel || '一個月',
      defaultAmount: row.defaultAmount === 0 ? '' : String(row.defaultAmount),
    })
  }

  function handleDelete(id) {
    if (!window.confirm('確定刪除此課程範本？')) return
    onChangeItems(items.filter(x => x.id !== id))
    if (editingId === id) resetForm()
  }

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <h1 className="catalog-title">課程庫</h1>
        <p className="catalog-sub">
          設定常用課程：名稱、時數、計費週期與預設金額。資料存於本機瀏覽器。首次使用會自動從內建學生資料匯入不重複的課程列。在「學生與收費」可一鍵將範本加入某位學生。
        </p>
      </header>

      <form className="catalog-form" onSubmit={handleSave}>
        <div className="catalog-form-grid">
          <label className="catalog-field">
            <span className="catalog-label">課程名稱</span>
            <input
              className="catalog-input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例如：國中數學進階"
              maxLength={64}
            />
          </label>
          <label className="catalog-field">
            <span className="catalog-label">時數（堂）</span>
            <input
              type="number"
              className="catalog-input"
              min="0"
              step="0.5"
              value={form.hours}
              onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
              placeholder="0＝僅固定金額"
            />
          </label>
          <label className="catalog-field">
            <span className="catalog-label">一次週期</span>
            <select
              className="catalog-input catalog-select"
              value={(form.cycleLabel || '一個月').trim() || '一個月'}
              onChange={e => setForm(f => ({ ...f, cycleLabel: e.target.value }))}
            >
              {!isPresetCycle(form.cycleLabel || '') && (form.cycleLabel || '').trim() !== '' && (
                <option value={(form.cycleLabel || '').trim()}>
                  {(form.cycleLabel || '').trim()}（舊資料）
                </option>
              )}
              {CYCLE_PRESETS.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="catalog-field">
            <span className="catalog-label">預設金額（NT$）</span>
            <input
              type="number"
              className="catalog-input"
              min="0"
              value={form.defaultAmount}
              onChange={e => setForm(f => ({ ...f, defaultAmount: e.target.value }))}
              placeholder="該週期應收參考"
            />
          </label>
        </div>
        <div className="catalog-cycle-quick">
          <span className="catalog-label-inline">週期快捷：</span>
          {CYCLE_PRESETS.map(p => (
            <button
              key={p}
              type="button"
              className="btn-cycle-chip"
              onClick={() => setForm(f => ({ ...f, cycleLabel: p }))}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="catalog-form-actions">
          <button type="submit" className="btn-catalog-primary">
            {editingId ? '更新課程' : '新增課程'}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              取消編輯
            </button>
          )}
        </div>
      </form>

      <section className="catalog-table-wrap">
        <h2 className="catalog-section-title">已建立的課程</h2>
        {items.length === 0 ? (
          <p className="catalog-empty">尚無範本，請於上方新增。</p>
        ) : (
          <table className="catalog-table">
            <thead>
              <tr>
                <th>課程名稱</th>
                <th className="col-num">時數</th>
                <th>一次週期</th>
                <th className="col-num">預設金額</th>
                <th className="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(row => (
                <tr key={row.id} className={editingId === row.id ? 'is-editing' : ''}>
                  <td>{row.name}</td>
                  <td className="col-num">{row.hours || '—'}</td>
                  <td>{row.cycleLabel}</td>
                  <td className="col-num">NT$ {row.defaultAmount.toLocaleString()}</td>
                  <td className="col-actions">
                    <button type="button" className="btn-table" onClick={() => startEdit(row.id)}>
                      編輯
                    </button>
                    <button type="button" className="btn-table btn-table-danger" onClick={() => handleDelete(row.id)}>
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
