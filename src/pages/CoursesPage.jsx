import { useState, useEffect } from 'react'
import { useCourses } from '../contexts/CoursesContext.jsx'
import { apiListCourseRates, apiSetCourseRates } from '../data/api.js'
import EyeIcon from '../components/EyeIcon.jsx'

export default function CoursesPage() {
  const { state, loadCourses, createCourse, updateCourse, removeCourse } = useCourses()
  const { courses, loading } = state

  const [newName, setNewName]                   = useState('')
  const [newRate, setNewRate]                   = useState('')
  const [newTeacherRate, setNewTeacherRate]     = useState('')
  const [editId, setEditId]                     = useState(null)
  const [editName, setEditName]                 = useState('')
  const [editRate, setEditRate]                 = useState('')
  const [editTeacherRate, setEditTeacherRate]   = useState('')
  const [error, setError]                       = useState('')
  const [saving, setSaving]                     = useState(false)
  const [showAmounts, setShowAmounts]           = useState(false)

  // 人數→鐘點費對照表 modal
  const [rateCourse, setRateCourse]   = useState(null)
  const [rateRows, setRateRows]       = useState([])  // [{count, rate}]
  const [rateLoading, setRateLoading] = useState(false)
  const [rateSaving, setRateSaving]   = useState(false)
  // 各課程已設定的人數段數快取
  const [rateCounts, setRateCounts]   = useState({})

  useEffect(() => {
    let cancelled = false
    const ids = courses.map(c => c.id).filter(id => !(id in rateCounts))
    if (ids.length === 0) return
    Promise.all(ids.map(id =>
      apiListCourseRates(id).then(rows => [id, rows.length]).catch(() => [id, 0])
    )).then(pairs => {
      if (cancelled) return
      setRateCounts(prev => {
        const next = { ...prev }
        for (const [id, n] of pairs) next[id] = n
        return next
      })
    })
    return () => { cancelled = true }
  }, [courses, rateCounts])

  async function openRateEditor(c) {
    setRateCourse({ id: c.id, name: c.name })
    setRateLoading(true)
    try {
      const rows = await apiListCourseRates(c.id)
      setRateRows(rows.length ? rows.map(r => ({ count: r.attendee_count, rate: r.hourly_rate })) : [])
    } catch {
      setRateRows([])
      setError('讀取人數鐘點費失敗')
    } finally {
      setRateLoading(false)
    }
  }
  function addRateRow() {
    const usedCounts = new Set(rateRows.map(r => r.count))
    let n = 1
    while (usedCounts.has(n) && n <= 50) n++
    setRateRows(rs => [...rs, { count: n, rate: 0 }])
  }
  function updateRateRow(idx, field, value) {
    setRateRows(rs => rs.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
  function removeRateRow(idx) {
    setRateRows(rs => rs.filter((_, i) => i !== idx))
  }
  async function saveRates() {
    if (!rateCourse || rateSaving) return
    setRateSaving(true); setError('')
    try {
      const cleaned = rateRows
        .map(r => ({ attendee_count: parseInt(r.count, 10), hourly_rate: parseFloat(r.rate) }))
        .filter(r => Number.isInteger(r.attendee_count) && r.attendee_count > 0 && Number.isFinite(r.hourly_rate) && r.hourly_rate >= 0)
      const rows = await apiSetCourseRates(rateCourse.id, cleaned)
      setRateCounts(prev => ({ ...prev, [rateCourse.id]: rows.length }))
      setRateCourse(null)
    } catch {
      setError('儲存人數鐘點費失敗')
    } finally {
      setRateSaving(false)
    }
  }

  function amt(value) {
    if (!showAmounts) return '••••'
    return parseFloat(value).toLocaleString()
  }

  useEffect(() => { loadCourses() }, [loadCourses])

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setError('請輸入家教課名稱'); return }
    const hourlyRate = parseFloat(newRate)
    if (isNaN(hourlyRate) || hourlyRate <= 0) { setError('請輸入學生時薪'); return }
    const teacherHourlyRate = parseFloat(newTeacherRate)
    if (isNaN(teacherHourlyRate) || teacherHourlyRate <= 0) { setError('請輸入老師時薪'); return }
    setSaving(true); setError('')
    try {
      await createCourse(name, hourlyRate, teacherHourlyRate)
      setNewName(''); setNewRate(''); setNewTeacherRate('')
    }
    catch { setError('新增失敗') }
    finally { setSaving(false) }
  }

  async function handleUpdate(id) {
    const name = editName.trim()
    if (!name) return
    const hourly_rate = parseFloat(editRate)
    if (isNaN(hourly_rate) || hourly_rate < 0) { setError('學生時薪格式不正確'); return }
    const teacher_hourly_rate = parseFloat(editTeacherRate)
    if (isNaN(teacher_hourly_rate) || teacher_hourly_rate < 0) { setError('老師時薪格式不正確'); return }
    setSaving(true); setError('')
    try { await updateCourse(id, { name, hourly_rate, teacher_hourly_rate }); setEditId(null) }
    catch { setError('更新失敗') }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定要刪除此家教課？（若有上課紀錄使用此家教課，刪除將失敗）')) return
    setSaving(true); setError('')
    try { await removeCourse(id) }
    catch (e) { setError(e.message.includes('foreign key') ? '此家教課有關聯資料，無法刪除' : '刪除失敗') }
    finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>家教課目錄</h1>
        <button className="btn-sm" onClick={() => setShowAmounts(v => !v)} title={showAmounts ? '隱藏金額' : '顯示金額'}>
          <EyeIcon open={showAmounts} />{showAmounts ? '隱藏金額' : '顯示金額'}
        </button>
      </div>

      <div className="lesson-form-card">
        <div className="form-section-title">家教課目錄</div>
        <form className="add-form" onSubmit={handleAdd}>
          <input
            className="add-input"
            placeholder="家教課名稱（如：國中英文）"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            className="add-input"
            style={{ width: '120px' }}
            placeholder="學生時薪"
            type="number"
            min="0"
            step="1"
            value={newRate}
            onChange={e => setNewRate(e.target.value)}
          />
          <input
            className="add-input"
            style={{ width: '120px' }}
            placeholder="老師時薪"
            type="number"
            min="0"
            step="1"
            value={newTeacherRate}
            onChange={e => setNewTeacherRate(e.target.value)}
          />
          <button
            className="btn-primary"
            type="submit"
            disabled={
              saving
              || !newName.trim()
              || !newRate.trim() || parseFloat(newRate) <= 0
              || !newTeacherRate.trim() || parseFloat(newTeacherRate) <= 0
            }
          >新增家教課</button>
        </form>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">載入中⋯</div>
      ) : courses.length === 0 ? (
        <div className="empty-hint">尚未新增任何家教課</div>
      ) : (
        <table className="entity-table">
          <thead>
            <tr><th>家教課名稱</th><th>學生時薪</th><th>老師時薪</th><th>人數鐘點費</th><th></th></tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.id}>
                <td>
                  {editId === c.id ? (
                    <input
                      autoFocus
                      className="inline-edit-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    c.name
                  )}
                </td>
                <td>
                  {editId === c.id ? (
                    <input
                      className="inline-edit-input"
                      type="number"
                      min="0"
                      step="1"
                      value={editRate}
                      onChange={e => setEditRate(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    amt(c.hourly_rate)
                  )}
                </td>
                <td>
                  {editId === c.id ? (
                    <input
                      className="inline-edit-input"
                      type="number"
                      min="0"
                      step="1"
                      value={editTeacherRate}
                      onChange={e => setEditTeacherRate(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                    />
                  ) : (
                    amt(c.teacher_hourly_rate ?? 0)
                  )}
                </td>
                <td>
                  {rateCounts[c.id] > 0
                    ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{rateCounts[c.id]} 段</span>
                    : <span style={{ color: 'var(--muted)' }}>未設定</span>}
                </td>
                <td className="row-actions">
                  {editId === c.id ? (
                    <>
                      <button className="btn-sm btn-primary" onClick={() => handleUpdate(c.id)} disabled={saving}>儲存</button>
                      <button className="btn-sm" onClick={() => setEditId(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-sm" onClick={() => openRateEditor(c)}>人數鐘點費</button>
                      <button className="btn-sm" onClick={() => {
                        setEditId(c.id)
                        setEditName(c.name)
                        setEditRate(String(c.hourly_rate))
                        setEditTeacherRate(String(c.teacher_hourly_rate ?? 0))
                      }}>編輯</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(c.id)} disabled={saving}>刪除</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── 人數→鐘點費 modal ── */}
      {rateCourse && (
        <div className="modal-overlay" onClick={() => !rateSaving && setRateCourse(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{rateCourse.name}・人數鐘點費</h3>
              <button type="button" className="modal-close" onClick={() => !rateSaving && setRateCourse(null)}>✕</button>
            </div>
            <div className="modal-body">
              {rateLoading ? (
                <div className="empty-hint">載入中…</div>
              ) : (
                <>
                  <div className="roster-summary">
                    依當天「同課同師」實際出席人數查表計算學費。表中沒有的人數會 fallback 到課程預設學生時薪。
                  </div>
                  <div className="course-rate-list">
                    {rateRows.length === 0 ? (
                      <div className="empty-hint">尚未設定，下方點「+ 加一段」開始</div>
                    ) : rateRows.map((r, i) => (
                      <div key={i} className="course-rate-row">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          step="1"
                          value={r.count}
                          onChange={e => updateRateRow(i, 'count', e.target.value)}
                          aria-label="人數"
                        />
                        <span>人</span>
                        <span style={{ color: 'var(--muted)' }}>→</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={r.rate}
                          onChange={e => updateRateRow(i, 'rate', e.target.value)}
                          aria-label="時薪"
                        />
                        <span>元/小時</span>
                        <button type="button" className="btn-sm btn-danger" onClick={() => removeRateRow(i)}>刪</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn-sm" onClick={addRateRow}>+ 加一段</button>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setRateCourse(null)} disabled={rateSaving}>取消</button>
              <button type="button" className="btn-primary" onClick={saveRates} disabled={rateSaving || rateLoading}>
                {rateSaving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
