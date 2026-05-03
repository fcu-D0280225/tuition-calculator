import { useState } from 'react'
import { apiSettlementTuition, apiSettlementSalary, apiListMiscExpenses } from '../data/api.js'

function firstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function lastDayOfMonth() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

const BAR_MAX_H = 160
const BAR_W = 44
const BAR_GAP = 14

function BarChart({ items, color }) {
  if (!items || items.length === 0) {
    return <div className="empty-hint">無資料</div>
  }
  const maxVal = Math.max(...items.map(i => i.value), 1)
  const padL = 8, padR = 8, padTop = 28, padBot = 56
  const chartW = Math.max(items.length * (BAR_W + BAR_GAP) - BAR_GAP + padL + padR, 200)
  const chartH = BAR_MAX_H + padTop + padBot

  return (
    <svg width={chartW} height={chartH}>
      {items.map((item, i) => {
        const barH = Math.max(Math.round((item.value / maxVal) * BAR_MAX_H), 2)
        const x = padL + i * (BAR_W + BAR_GAP)
        const y = padTop + (BAR_MAX_H - barH)
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH} fill={color} rx={4} opacity={0.85} />
            <text
              x={x + BAR_W / 2}
              y={y - 7}
              textAnchor="middle"
              fontSize={10}
              fill="#475569"
              fontFamily="system-ui, sans-serif"
            >
              {item.value.toLocaleString()}
            </text>
            <foreignObject x={x - 6} y={padTop + BAR_MAX_H + 8} width={BAR_W + 12} height={padBot - 8}>
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  color: '#475569',
                  wordBreak: 'break-all',
                  lineHeight: 1.3,
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                {item.label}
              </div>
            </foreignObject>
          </g>
        )
      })}
    </svg>
  )
}

export default function DashboardPage() {
  const [from, setFrom] = useState(firstDayOfMonth)
  const [to, setTo]     = useState(lastDayOfMonth)
  const [tuition, setTuition] = useState(null)
  const [salary, setSalary]   = useState(null)
  const [misc, setMisc]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function amt(value) {
    return typeof value === 'number' ? value.toLocaleString() : String(value)
  }

  async function handleGenerate(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const [t, s, m] = await Promise.all([
        apiSettlementTuition(from, to),
        apiSettlementSalary(from, to),
        apiListMiscExpenses({ from, to }).catch(() => []),
      ])
      setTuition(t); setSalary(s); setMisc(m)
    } catch {
      setError('載入資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const totalIncome  = tuition ? tuition.reduce((sum, s) => sum + s.total, 0) : 0
  const salaryTotal  = salary  ? salary.reduce((sum, t) => sum + t.total, 0)  : 0
  const miscTotal    = misc    ? misc.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0) : 0
  const totalExpense = salaryTotal + miscTotal
  const netProfit    = totalIncome - totalExpense

  const studentBars = (tuition || []).map(s => ({ label: s.student_name, value: s.total }))
  const teacherBars = (salary  || []).map(t => ({ label: t.teacher_name, value: t.total }))

  const hasData = tuition !== null || salary !== null

  return (
    <div className="page">
      <div className="page-header">
        <h1>財務總覽</h1>
      </div>

      <form className="settlement-form" onSubmit={handleGenerate}>
        <label>開始日期
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} required />
        </label>
        <label>結束日期
          <input type="date" value={to} onChange={e => setTo(e.target.value)} required />
        </label>
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? '計算中⋯' : '產生報表'}
        </button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {hasData && (
        <>
          {/* ── 總覽卡片 ── */}
          <div className="dashboard-cards">
            <div className="dashboard-card dashboard-card--income">
              <div className="dashboard-card-label">總收入</div>
              <div className="dashboard-card-value">{amt(totalIncome)}</div>
              <div className="dashboard-card-sub">學費＋團課＋教材</div>
            </div>
            <div className="dashboard-card dashboard-card--expense">
              <div className="dashboard-card-label">總支出</div>
              <div className="dashboard-card-value">{amt(totalExpense)}</div>
              <div className="dashboard-card-sub">老師薪資 {amt(salaryTotal)}　＋雜項 {amt(miscTotal)}</div>
            </div>
            <div className={`dashboard-card ${netProfit >= 0 ? 'dashboard-card--profit' : 'dashboard-card--loss'}`}>
              <div className="dashboard-card-label">淨利</div>
              <div className="dashboard-card-value">
                {(netProfit >= 0 ? '+' : '') + netProfit.toLocaleString()}
              </div>
              <div className="dashboard-card-sub">收入 − 支出</div>
            </div>
          </div>

          {/* ── 柱狀圖 ── */}
          <div className="settlement-section">
            <div className="settlement-section-header">
              <h2>柱狀圖</h2>
            </div>
            <div className="dashboard-charts">
              <div className="dashboard-chart-block">
                <div className="dashboard-chart-title">各學生收入（元）</div>
                <div className="dashboard-chart-scroll">
                  <BarChart items={studentBars} color="#2563eb" />
                </div>
              </div>
              <div className="dashboard-chart-block">
                <div className="dashboard-chart-title">各老師薪資支出（元）</div>
                <div className="dashboard-chart-scroll">
                  <BarChart items={teacherBars} color="#f59e0b" />
                </div>
              </div>
            </div>
          </div>

          {/* ── 學生明細 ── */}
          {tuition && tuition.length > 0 && (
            <div className="settlement-section">
              <div className="settlement-section-header">
                <h2>學生收入明細</h2>
              </div>
              <table className="settlement-table">
                <thead>
                  <tr>
                    <th>學生</th>
                    <th>家教課</th>
                    <th>團課</th>
                    <th>教材</th>
                    <th>合計</th>
                  </tr>
                </thead>
                <tbody>
                  {tuition.map(s => {
                    const courseAmt   = s.courses.reduce((sum, c) => sum + c.amount, 0)
                    const groupAmt    = (s.groups   || []).reduce((sum, g) => sum + g.amount, 0)
                    const materialAmt = (s.materials || []).reduce((sum, m) => sum + m.amount, 0)
                    return (
                      <tr key={s.student_id}>
                        <td>{s.student_name}</td>
                        <td className="num-cell">{amt(courseAmt)}</td>
                        <td className="num-cell">{amt(groupAmt)}</td>
                        <td className="num-cell">{amt(materialAmt)}</td>
                        <td className="num-cell subtotal-amount">{amt(s.total)}</td>
                      </tr>
                    )
                  })}
                  <tr className="grand-total-row">
                    <td className="grand-total-label" colSpan={4}>合計</td>
                    <td className="num-cell grand-total-amount">{amt(totalIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ── 老師明細 ── */}
          {salary && salary.length > 0 && (
            <div className="settlement-section">
              <div className="settlement-section-header">
                <h2>老師薪資明細</h2>
              </div>
              <table className="settlement-table">
                <thead>
                  <tr>
                    <th>老師</th>
                    <th>課程</th>
                    <th>總時數</th>
                    <th>合計</th>
                  </tr>
                </thead>
                <tbody>
                  {salary.map(t => (
                    <tr key={t.teacher_id}>
                      <td>{t.teacher_name}</td>
                      <td>{t.courses.map(c => c.course_name).join('、')}</td>
                      <td className="num-cell">
                        {t.courses.reduce((sum, c) => sum + Number(c.total_hours), 0)} 時
                      </td>
                      <td className="num-cell subtotal-amount">{amt(t.total)}</td>
                    </tr>
                  ))}
                  <tr className="grand-total-row">
                    <td className="grand-total-label" colSpan={3}>合計</td>
                    <td className="num-cell grand-total-amount">{amt(totalExpense)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {tuition && tuition.length === 0 && salary && salary.length === 0 && (
            <div className="empty-hint">此區間沒有任何紀錄</div>
          )}
        </>
      )}
    </div>
  )
}
