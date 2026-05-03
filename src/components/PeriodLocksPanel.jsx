import { useEffect, useState, useCallback } from 'react'
import { apiListPeriodLocks, apiCreatePeriodLock, apiDeletePeriodLock } from '../data/api.js'

export default function PeriodLocksPanel({ from, to }) {
  const [locks, setLocks] = useState([])
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try { setLocks(await apiListPeriodLocks()) }
    catch (e) { setError(`載入鎖定區段失敗：${e?.message || e}`) }
  }, [])

  useEffect(() => { reload() }, [reload])

  async function lockCurrent() {
    if (!from || !to) { setError('請先選擇日期區間'); return }
    if (!window.confirm(`確定要鎖定 ${from} ～ ${to} 區間？\n鎖定後此區間的上課紀錄將不能新增 / 編輯 / 刪除。`)) return
    setBusy(true); setError('')
    try {
      await apiCreatePeriodLock({ period_from: from, period_to: to, note: '' })
      await reload()
    } catch (e) {
      setError(`鎖定失敗：${e?.message || e}`)
    } finally { setBusy(false) }
  }

  async function unlock(id) {
    if (!window.confirm('確定要解鎖此區段？解鎖後該區段的上課紀錄即可再被編輯。')) return
    setBusy(true); setError('')
    try {
      await apiDeletePeriodLock(id)
      await reload()
    } catch (e) {
      setError(`解鎖失敗：${e?.message || e}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="settlement-section" style={{ marginTop: 16 }}>
      <div className="settlement-section-header">
        <h2>鎖定區段</h2>
        <button type="button" className="btn-sm btn-primary" onClick={lockCurrent} disabled={busy}>
          鎖定目前區間（{from} ～ {to}）
        </button>
      </div>
      {error && <div className="error-msg">{error}</div>}
      {locks.length === 0 ? (
        <div className="empty-hint" style={{ textAlign: 'left', padding: '8px 0' }}>目前沒有鎖定區段</div>
      ) : (
        <ul className="enrollment-list">
          {locks.map(l => (
            <li key={l.id} className="enrollment-item">
              <span className="enrollment-name">
                <strong>{String(l.period_from).slice(0, 10)} ～ {String(l.period_to).slice(0, 10)}</strong>
                <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>
                  鎖定於 {String(l.locked_at).slice(0, 16).replace('T', ' ')}
                </span>
              </span>
              <button type="button" className="btn-sm btn-danger" disabled={busy} onClick={() => unlock(l.id)}>解鎖</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
