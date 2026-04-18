import { useState } from 'react'

/**
 * 通用的單價/時薪管理器。
 * rows: [{ course_id, course_name, unit_price | hourly_rate }]
 * courses: [{ id, name }] — 所有課程清單
 * priceLabel: 欄位標籤（e.g. "學費單價 (元/時)" 或 "時薪 (元/時)"）
 * priceKey: rows 裡的金額欄位名稱 ('unit_price' 或 'hourly_rate')
 * onSet(courseId, value): 呼叫 API 設定
 * onDelete(courseId): 呼叫 API 刪除
 */
export default function PriceManager({ rows, courses, priceLabel, priceKey, onSet, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal]     = useState('')
  const [addCourseId, setAddCourseId] = useState('')
  const [addVal, setAddVal]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const setIds = new Set(rows.map(r => r.course_id))
  const available = courses.filter(c => !setIds.has(c.id))

  async function handleSaveEdit(courseId) {
    const v = parseFloat(editVal)
    if (isNaN(v) || v < 0) { setError('請輸入有效金額'); return }
    setSaving(true); setError('')
    try { await onSet(courseId, v); setEditingId(null) }
    catch { setError('儲存失敗') }
    finally { setSaving(false) }
  }

  async function handleAdd() {
    if (!addCourseId) { setError('請選擇課程'); return }
    const v = parseFloat(addVal)
    if (isNaN(v) || v < 0) { setError('請輸入有效金額'); return }
    setSaving(true); setError('')
    try { await onSet(addCourseId, v); setAddCourseId(''); setAddVal('') }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleDelete(courseId) {
    if (!window.confirm('確定要刪除這筆設定嗎？')) return
    setSaving(true); setError('')
    try { await onDelete(courseId) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  return (
    <div className="price-manager">
      <table className="price-manager-table">
        <thead>
          <tr>
            <th>課程</th>
            <th>{priceLabel}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.course_id}>
              <td>{row.course_name}</td>
              <td>
                {editingId === row.course_id ? (
                  <input
                    type="number" min="0" step="50"
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(row.course_id) }}
                    autoFocus
                    className="price-input"
                  />
                ) : (
                  <span>{row[priceKey]}</span>
                )}
              </td>
              <td className="price-actions">
                {editingId === row.course_id ? (
                  <>
                    <button className="btn-sm btn-primary" onClick={() => handleSaveEdit(row.course_id)} disabled={saving}>儲存</button>
                    <button className="btn-sm" onClick={() => setEditingId(null)}>取消</button>
                  </>
                ) : (
                  <>
                    <button className="btn-sm" onClick={() => { setEditingId(row.course_id); setEditVal(String(row[priceKey])) }}>編輯</button>
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(row.course_id)} disabled={saving}>刪除</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {available.length > 0 && (
            <tr className="price-add-row">
              <td>
                <select value={addCourseId} onChange={e => setAddCourseId(e.target.value)} className="price-select">
                  <option value="">— 選擇課程 —</option>
                  {available.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </td>
              <td>
                <input
                  type="number" min="0" step="50"
                  placeholder="金額"
                  value={addVal}
                  onChange={e => setAddVal(e.target.value)}
                  className="price-input"
                />
              </td>
              <td>
                <button className="btn-sm btn-primary" onClick={handleAdd} disabled={saving}>新增</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {error && <div className="error-msg">{error}</div>}
    </div>
  )
}
