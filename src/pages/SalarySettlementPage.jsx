import { Fragment, useState } from 'react'
import { apiSettlementSalary } from '../data/api.js'
import { generateSalaryPDF, generateTeacherSalaryPDF } from '../utils/pdf.js'
import PeriodLocksPanel from '../components/PeriodLocksPanel.jsx'

function firstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function lastDayOfMonth() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

export default function SalarySettlementPage() {
  const [from, setFrom] = useState(firstDayOfMonth)
  const [to, setTo]     = useState(lastDayOfMonth)
  const [salary, setSalary]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [pdfLoading, setPdfLoading] = useState('')

  function amt(value) { return Math.round(Number(value) || 0).toLocaleString() }

  async function handleGenerate(e) {
    e.preventDefault()
    if (!from || !to) { setError('請選擇日期區間'); return }
    setLoading(true); setError('')
    try {
      const s = await apiSettlementSalary(from, to)
      setSalary(s)
    } catch { setError('載入結算資料失敗') }
    finally { setLoading(false) }
  }

  async function handleDownloadSalary() {
    setPdfLoading('salary')
    try { await generateSalaryPDF(salary, from, to) }
    catch (e) { alert('PDF 產生失敗：' + e.message) }
    finally { setPdfLoading('') }
  }

  async function handleTeacherPDF(teacher) {
    setPdfLoading(teacher.teacher_id)
    try { await generateTeacherSalaryPDF(teacher, from, to) }
    catch (e) { alert('PDF 產生失敗：' + e.message) }
    finally { setPdfLoading('') }
  }

  const periodLabel = from && to ? `${from} ~ ${to}` : ''

  return (
    <div className="page">
      <div className="page-header">
        <h1>薪資結算</h1>
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

      <PeriodLocksPanel from={from} to={to} />

      {salary && (
        <div className="settlement-section">
          <div className="settlement-section-header">
            <h2>薪資報表</h2>
            <span className="period-badge">{periodLabel}</span>
            <button className="btn-primary" onClick={handleDownloadSalary} disabled={pdfLoading === 'salary'}>
              {pdfLoading === 'salary' ? '產生中⋯' : '下載薪資單 PDF'}
            </button>
          </div>
          {salary.length === 0 ? (
            <div className="empty-hint">此區間沒有任何上課紀錄</div>
          ) : (
            <table className="settlement-table">
              <thead>
                <tr><th>老師</th><th>課程</th><th>總時數</th><th>時薪</th><th>金額</th><th></th></tr>
              </thead>
              <tbody>
                {salary.map(teacher => {
                  const cs = teacher.courses || []
                  const gs = teacher.groups  || []
                  const totalRows = cs.length + gs.length
                  const firstKind = cs.length > 0 ? 'course' : 'group'
                  const nameCell = (
                    <td rowSpan={totalRows} className="student-cell">{teacher.teacher_name}</td>
                  )
                  const actionCell = (
                    <td rowSpan={totalRows} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                      <button
                        className="btn-sm"
                        onClick={() => handleTeacherPDF(teacher)}
                        disabled={!!pdfLoading}
                        title={`下載 ${teacher.teacher_name} 薪資單 PDF`}
                      >
                        {pdfLoading === teacher.teacher_id ? '…' : 'PDF'}
                      </button>
                    </td>
                  )
                  return (
                    <Fragment key={teacher.teacher_id}>
                      {cs.map((c, i) => (
                        <tr key={`c-${c.course_id}`}>
                          {i === 0 && firstKind === 'course' && nameCell}
                          <td>{c.course_name}</td>
                          <td className="num-cell">{c.total_hours}</td>
                          <td className="num-cell">{amt(c.hourly_rate)}</td>
                          <td className="num-cell">{amt(c.amount)}</td>
                          {i === 0 && firstKind === 'course' && actionCell}
                        </tr>
                      ))}
                      {gs.map((g, i) => (
                        <tr key={`g-${g.group_id}`} style={{ background: '#ecfdf5' }}>
                          {i === 0 && firstKind === 'group' && nameCell}
                          <td style={{ color: '#166534' }}>團課：{g.group_name}（{g.session_count} 堂 × {g.duration_hours} 小時）</td>
                          <td className="num-cell">{g.total_hours}</td>
                          <td className="num-cell">{amt(g.hourly_rate)}</td>
                          <td className="num-cell">{amt(g.amount)}</td>
                          {i === 0 && firstKind === 'group' && actionCell}
                        </tr>
                      ))}
                      <tr className="subtotal-row">
                        <td colSpan={3}></td>
                        <td className="subtotal-label">小計</td>
                        <td className="num-cell subtotal-amount">{amt(teacher.total)}</td>
                        <td></td>
                      </tr>
                    </Fragment>
                  )
                })}
                <tr className="grand-total-row">
                  <td colSpan={4} className="grand-total-label">合計</td>
                  <td className="num-cell grand-total-amount">
                    {amt(salary.reduce((sum, t) => sum + t.total, 0))}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
