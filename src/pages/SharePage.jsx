import { useEffect, useState } from 'react'
import { apiGetShare } from '../data/api.js'

export default function SharePage({ token }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })

  useEffect(() => {
    let cancelled = false
    apiGetShare(token).then(
      (data) => { if (!cancelled) setState({ loading: false, error: '', data }) },
      (err) => {
        if (cancelled) return
        const msg = /410/.test(err.message) ? '此分享連結已過期'
                  : /404/.test(err.message) ? '連結無效或已被撤銷'
                  : '載入失敗'
        setState({ loading: false, error: msg, data: null })
      }
    )
    return () => { cancelled = true }
  }, [token])

  if (state.loading) return <div className="share-view"><div className="empty-hint">載入中⋯</div></div>
  if (state.error)   return <div className="share-view"><div className="empty-hint">{state.error}</div></div>

  const { student, period, courses, groups = [], materials, total, expires_at } = state.data
  const periodLabel = `${period.from} ~ ${period.to}`
  const expiresLabel = expires_at ? expires_at.slice(0, 10) : ''
  const isEmpty = courses.length === 0 && groups.length === 0 && materials.length === 0

  return (
    <div className="share-view">
      <header className="share-header">
        <h1>{student.name} 的學費明細</h1>
        <div className="share-period">{periodLabel}</div>
      </header>

      {isEmpty ? (
        <div className="empty-hint">此區間沒有任何紀錄</div>
      ) : (
        <table className="settlement-table">
          <thead>
            <tr><th>項目</th><th>時數／月數／數量</th><th>單價</th><th>金額</th></tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={`c-${c.course_id}-${c.unit_price}`}>
                <td>{c.course_name}</td>
                <td className="num-cell">{c.total_hours} 時</td>
                <td className="num-cell">{c.unit_price.toLocaleString()}</td>
                <td className="num-cell">{c.amount.toLocaleString()}</td>
              </tr>
            ))}
            {groups.map(g => (
              <tr key={`g-${g.group_id}`} style={{ background: '#ecfdf5' }}>
                <td style={{ color: '#166534' }}>團課：{g.group_name}</td>
                <td className="num-cell">{g.billable_months} 月</td>
                <td className="num-cell">{g.monthly_fee.toLocaleString()}/月</td>
                <td className="num-cell">{g.amount.toLocaleString()}</td>
              </tr>
            ))}
            {materials.map(m => (
              <tr key={`m-${m.material_id}`} style={{ background: '#fefce8' }}>
                <td style={{ color: '#a16207' }}>教材：{m.material_name}</td>
                <td className="num-cell">{m.total_qty} 本</td>
                <td className="num-cell">{m.unit_price.toLocaleString()}</td>
                <td className="num-cell">{m.amount.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="grand-total-row">
              <td colSpan={3} className="grand-total-label">合計</td>
              <td className="num-cell grand-total-amount">{total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      )}

      {expiresLabel && <div className="share-footer">此連結於 {expiresLabel} 失效</div>}
    </div>
  )
}
