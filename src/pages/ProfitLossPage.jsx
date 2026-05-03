import { useState } from 'react'
import { apiProfitLoss } from '../data/api.js'

function firstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function lastDayOfMonth() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}
function amt(v) { return Math.round(Number(v) || 0).toLocaleString() }

export default function ProfitLossPage() {
  const [from, setFrom] = useState(firstDayOfMonth)
  const [to,   setTo]   = useState(lastDayOfMonth)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate(e) {
    e.preventDefault()
    if (!from || !to) { setError('請選擇日期區間'); return }
    setLoading(true); setError('')
    try {
      const d = await apiProfitLoss(from, to)
      setData(d)
    } catch { setError('載入損益資料失敗') }
    finally { setLoading(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>損益報表</h1>
      </div>

      <form className="filter-bar" onSubmit={handleGenerate} style={{ marginBottom: 12 }}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <span>—</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <button className="btn-sm btn-primary" type="submit" disabled={loading}>
          {loading ? '載入中⋯' : '產出損益'}
        </button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {data && (
        <div className="lesson-form-card">
          <div className="form-section-title">
            {data.from} ~ {data.to} 損益
          </div>

          <table className="entity-table" style={{ marginTop: 8 }}>
            <colgroup>
              <col />
              <col style={{ width: 160 }} />
            </colgroup>
            <tbody>
              <tr style={{ background: 'var(--success-gradient-from)' }}>
                <th style={{ textAlign: 'left' }}>學費收入</th>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{amt(data.revenue.tuition)} 元</td>
              </tr>

              <tr style={{ background: 'var(--danger-light)' }}>
                <th style={{ textAlign: 'left' }}>老師薪資（成本）</th>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>− {amt(data.cost.salary)} 元</td>
              </tr>

              <tr>
                <th style={{ textAlign: 'left' }}>
                  營業費用合計
                  {data.expenses.by_category?.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>
                      {data.expenses.by_category.map(c => (
                        <span key={c.category} style={{ padding: '2px 10px', border: '1px solid var(--border)', borderRadius: 999 }}>
                          {c.category}：<strong style={{ color: 'var(--text)' }}>{amt(c.total)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </th>
                <td style={{ textAlign: 'right', fontWeight: 700, verticalAlign: 'top' }}>− {amt(data.expenses.total)} 元</td>
              </tr>

              <tr style={{
                background: data.profit >= 0 ? 'var(--success-gradient-to)' : 'var(--danger-hover)',
                fontSize: 16,
              }}>
                <th style={{ textAlign: 'left' }}>淨利</th>
                <td style={{ textAlign: 'right', fontWeight: 800, color: data.profit >= 0 ? 'var(--green-dark)' : 'var(--danger)' }}>
                  {data.profit >= 0 ? '' : '−'}{amt(Math.abs(data.profit))} 元
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12 }}>
            注意：教材成本目前尚未列入此表（待實作）。
          </div>
        </div>
      )}
    </div>
  )
}
