import { useState, useEffect } from 'react'
import { useMaterials } from '../contexts/MaterialsContext.jsx'
import { useStudents } from '../contexts/StudentsContext.jsx'
import Combobox from '../components/Combobox.jsx'
import EyeIcon from '../components/EyeIcon.jsx'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_RECORD = { student_id: '', material_id: '', quantity: '1', record_date: todayStr(), note: '' }

export default function MaterialsPage() {
  const { state: ms, loadMaterials, createMaterial, updateMaterial, removeMaterial, loadRecords, createRecord, removeRecord } = useMaterials()
  const { state: ss, loadStudents } = useStudents()

  // 教材目錄狀態
  const [newName, setNewName]     = useState('')
  const [newPrice, setNewPrice]   = useState('')
  const [editMatId, setEditMatId] = useState(null)
  const [editMatName, setEditMatName]   = useState('')
  const [editMatPrice, setEditMatPrice] = useState('')

  // 教材紀錄狀態
  const [form, setForm]     = useState(EMPTY_RECORD)
  const [editRecId, setEditRecId] = useState(null)
  const [editRec, setEditRec]     = useState(null)

  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const [showAmounts, setShowAmounts] = useState(false)

  function amt(value) {
    if (!showAmounts) return '••••'
    return parseFloat(value).toLocaleString()
  }

  useEffect(() => { loadMaterials(); loadStudents(); loadRecords() }, [loadMaterials, loadStudents, loadRecords])

  // ── 教材目錄 ──────────────────────────────────────────────────

  async function handleAddMaterial(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setError('請輸入教材名稱'); return }
    const price = parseFloat(newPrice)
    if (isNaN(price) || price <= 0) { setError('請輸入單價'); return }
    setSaving(true); setError('')
    try { await createMaterial(name, price); setNewName(''); setNewPrice('') }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleUpdateMaterial(id) {
    const name = editMatName.trim()
    if (!name) return
    const unit_price = parseFloat(editMatPrice)
    if (isNaN(unit_price) || unit_price < 0) { setError('金額格式不正確'); return }
    setSaving(true); setError('')
    try { await updateMaterial(id, { name, unit_price }); setEditMatId(null) }
    catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleDeleteMaterial(id) {
    if (!window.confirm('確定要刪除此教材？（若有紀錄使用此教材，刪除將失敗）')) return
    setSaving(true); setError('')
    try { await removeMaterial(id) }
    catch (e) { setError(e.message.includes('foreign key') ? '此教材有關聯紀錄，無法刪除' : '刪除失敗') }
    finally { setSaving(false) }
  }

  // ── 教材紀錄 ──────────────────────────────────────────────────

  async function handleAddRecord(e) {
    e.preventDefault()
    if (!form.student_id || !form.material_id) { setError('請選擇學生和教材'); return }
    const quantity = parseFloat(form.quantity)
    if (isNaN(quantity) || quantity <= 0) { setError('數量須大於 0'); return }
    if (!form.record_date) { setError('請選擇日期'); return }
    setSaving(true); setError('')
    try {
      const rec = await createRecord({ ...form, quantity })
      // Reload records to get joined names
      await loadRecords()
      setForm({ ...EMPTY_RECORD, record_date: form.record_date })
    } catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleDeleteRecord(id) {
    if (!window.confirm('確定要刪除此筆教材紀錄？')) return
    setSaving(true); setError('')
    try { await removeRecord(id) }
    catch { setError('刪除失敗') }
    finally { setSaving(false) }
  }

  const { materials, loading } = ms
  const { records } = ms
  const { students } = ss

  return (
    <div className="page">
      <div className="page-header">
        <h1>教材管理</h1>
        <button className="btn-sm" onClick={() => setShowAmounts(v => !v)} title={showAmounts ? '隱藏金額' : '顯示金額'}>
          <EyeIcon open={showAmounts} />{showAmounts ? '隱藏金額' : '顯示金額'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* ── 教材目錄 ── */}
      <div className="lesson-form-card" style={{ marginBottom: '32px' }}>
        <div className="form-section-title">教材目錄</div>

        <form className="add-form" onSubmit={handleAddMaterial} style={{ marginBottom: '16px' }}>
          <input
            className="add-input"
            placeholder="教材名稱（如：數學講義）"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            className="add-input"
            style={{ width: '120px' }}
            type="number"
            min="0"
            step="1"
            placeholder="單價（元）"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={saving || !newName.trim() || !newPrice.trim() || parseFloat(newPrice) <= 0}>新增教材</button>
        </form>

        {loading ? (
          <div className="loading">載入中⋯</div>
        ) : materials.length === 0 ? (
          <div className="empty-hint">尚未新增任何教材</div>
        ) : (
          <table className="entity-table">
            <thead>
              <tr><th>教材名稱</th><th>單價（元）</th><th></th></tr>
            </thead>
            <tbody>
              {materials.map(m => (
                <tr key={m.id}>
                  <td>
                    {editMatId === m.id ? (
                      <input
                        autoFocus
                        className="inline-edit-input"
                        value={editMatName}
                        onChange={e => setEditMatName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateMaterial(m.id); if (e.key === 'Escape') setEditMatId(null) }}
                      />
                    ) : m.name}
                  </td>
                  <td>
                    {editMatId === m.id ? (
                      <input
                        className="inline-edit-input"
                        type="number" min="0" step="1"
                        style={{ width: '100px' }}
                        value={editMatPrice}
                        onChange={e => setEditMatPrice(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateMaterial(m.id); if (e.key === 'Escape') setEditMatId(null) }}
                      />
                    ) : amt(m.unit_price)}
                  </td>
                  <td className="row-actions">
                    {editMatId === m.id ? (
                      <>
                        <button className="btn-sm btn-primary" onClick={() => handleUpdateMaterial(m.id)} disabled={saving}>儲存</button>
                        <button className="btn-sm" onClick={() => setEditMatId(null)}>取消</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-sm" onClick={() => { setEditMatId(m.id); setEditMatName(m.name); setEditMatPrice(String(m.unit_price)) }}>編輯</button>
                        <button className="btn-sm btn-danger" onClick={() => handleDeleteMaterial(m.id)} disabled={saving}>刪除</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 教材紀錄 ── */}
      <div className="lesson-form-card">
        <div className="form-section-title">新增教材費紀錄</div>
        <form className="lesson-form" onSubmit={handleAddRecord}>
          <div className="lesson-form-row">
            <label>學生
              <Combobox
                items={students}
                value={form.student_id}
                onChange={id => setForm(f => ({ ...f, student_id: id }))}
                placeholder="搜尋學生…"
              />
            </label>
            <label>教材
              <Combobox
                items={materials}
                value={form.material_id}
                onChange={id => setForm(f => ({ ...f, material_id: id }))}
                placeholder="搜尋教材…"
              />
            </label>
            <label>數量
              <input type="number" min="1" step="1" placeholder="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="hours-input"
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
          <button className="btn-primary" type="submit" disabled={saving}>新增</button>
        </form>
      </div>

      {/* 紀錄列表 */}
      {records.length > 0 && (
        <table className="lesson-table" style={{ marginTop: '24px' }}>
          <thead>
            <tr>
              <th>日期</th>
              <th>學生</th>
              <th>教材</th>
              <th>單價</th>
              <th>數量</th>
              <th>小計</th>
              <th>備註</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id}>
                <td>{r.record_date}</td>
                <td>{r.student_name}</td>
                <td>{r.material_name}</td>
                <td className="num-cell">{amt(r.unit_price)}</td>
                <td className="num-cell">{parseFloat(r.quantity)}</td>
                <td className="num-cell">{showAmounts ? Math.round(parseFloat(r.unit_price) * parseFloat(r.quantity)).toLocaleString() : '••••'}</td>
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
