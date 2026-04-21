import { useState } from 'react'
import { apiSettlementTuition, apiSettlementSalary } from '../data/api.js'
import { generateTuitionPDF, generateSalaryPDF, generateStudentTuitionPDF, generateTeacherSalaryPDF } from '../utils/pdf.js'

function firstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function lastDayOfMonth() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

export default function SettlementPage() {
  const [from, setFrom] = useState(firstDayOfMonth)
  const [to, setTo]     = useState(lastDayOfMonth)
  const [tuition, setTuition] = useState(null)
  const [salary, setSalary]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [pdfLoading, setPdfLoading] = useState('')   // 'tuition' | 'salary' | student_id | teacher_id

  async function handleGenerate(e) {
    e.preventDefault()
    if (!from || !to) { setError('請選擇日期區間'); return }
    setLoading(true); setError('')
    try {
      const [t, s] = await Promise.all([apiSettlementTuition(from, to), apiSettlementSalary(from, to)])
      setTuition(t); setSalary(s)
    } catch { setError('載入結算資料失敗') }
    finally { setLoading(false) }
  }

  async function handleDownloadTuition() {
    setPdfLoading('tuition')
    try { await generateTuitionPDF(tuition, from, to) }
    catch (e) { alert('PDF 產生失敗：' + e.message) }
    finally { setPdfLoading('') }
  }

  async function handleDownloadSalary() {
    setPdfLoading('salary')
    try { await generateSalaryPDF(salary, from, to) }
    catch (e) { alert('PDF 產生失敗：' + e.message) }
    finally { setPdfLoading('') }
  }

  async function handleStudentPDF(student) {
    setPdfLoading(student.student_id)
    try { await generateStudentTuitionPDF(student, from, to) }
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
        <h1>結算</h1>
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

      {tuition && (
        <div className="settlement-section">
          <div className="settlement-section-header">
            <h2>學費報表</h2>
            <span className="period-badge">{periodLabel}</span>
            <button className="btn-primary" onClick={handleDownloadTuition} disabled={pdfLoading === 'tuition'}>
              {pdfLoading === 'tuition' ? '產生中⋯' : '下載學費單 PDF'}
            </button>
          </div>
          {tuition.length === 0 ? (
            <div className="empty-hint">此區間沒有任何上課紀錄</div>
          ) : (
            <table className="settlement-table">
              <thead>
                <tr><th>學生</th><th>項目</th><th>時數／月數／數量</th><th>單價</th><th>金額</th><th></th></tr>
              </thead>
              <tbody>
                {tuition.map(student => {
                  const grpLen = (student.groups || []).length
                  const matLen = (student.materials || []).length
                  const totalRows = student.courses.length + grpLen + matLen
                  return (
                    <>
                      {student.courses.map((c, i) => (
                        <tr key={`${student.student_id}-c-${c.course_id}-${c.unit_price}`}>
                          {i === 0 && <td rowSpan={totalRows} className="student-cell">{student.student_name}</td>}
                          <td>{c.course_name}</td>
                          <td className="num-cell">{c.total_hours} 時</td>
                          <td className="num-cell">{c.unit_price.toLocaleString()}</td>
                          <td className="num-cell">{c.amount.toLocaleString()}</td>
                          {i === 0 && (
                            <td rowSpan={totalRows} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                              <button
                                className="btn-sm"
                                onClick={() => handleStudentPDF(student)}
                                disabled={!!pdfLoading}
                                title={`下載 ${student.student_name} 學費單 PDF`}
                              >
                                {pdfLoading === student.student_id ? '…' : 'PDF'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {(student.groups || []).map(g => (
                        <tr key={`${student.student_id}-g-${g.group_id}`} style={{ background: '#ecfdf5' }}>
                          <td style={{ color: '#166534' }}>團課：{g.group_name}</td>
                          <td className="num-cell">{g.billable_months} 月</td>
                          <td className="num-cell">{g.monthly_fee.toLocaleString()}/月</td>
                          <td className="num-cell">{g.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      {(student.materials || []).map(m => (
                        <tr key={`${student.student_id}-m-${m.material_id}`} style={{ background: '#fefce8' }}>
                          <td style={{ color: '#a16207' }}>教材：{m.material_name}</td>
                          <td className="num-cell">{m.total_qty} 本</td>
                          <td className="num-cell">{m.unit_price.toLocaleString()}</td>
                          <td className="num-cell">{m.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="subtotal-row" key={`${student.student_id}-total`}>
                        <td colSpan={3}></td>
                        <td className="subtotal-label">小計</td>
                        <td className="num-cell subtotal-amount">{student.total.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </>
                  )
                })}
                <tr className="grand-total-row">
                  <td colSpan={4} className="grand-total-label">合計</td>
                  <td className="num-cell grand-total-amount">
                    {tuition.reduce((sum, s) => sum + s.total, 0).toLocaleString()}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

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
                {salary.map(teacher => (
                  <>
                    {teacher.courses.map((c, i) => (
                      <tr key={`${teacher.teacher_id}-${c.course_id}`}>
                        {i === 0 && <td rowSpan={teacher.courses.length} className="student-cell">{teacher.teacher_name}</td>}
                        <td>{c.course_name}</td>
                        <td className="num-cell">{c.total_hours}</td>
                        <td className="num-cell">{c.hourly_rate.toLocaleString()}</td>
                        <td className="num-cell">{c.amount.toLocaleString()}</td>
                        {i === 0 && (
                          <td rowSpan={teacher.courses.length} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                            <button
                              className="btn-sm"
                              onClick={() => handleTeacherPDF(teacher)}
                              disabled={!!pdfLoading}
                              title={`下載 ${teacher.teacher_name} 薪資單 PDF`}
                            >
                              {pdfLoading === teacher.teacher_id ? '…' : 'PDF'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="subtotal-row" key={`${teacher.teacher_id}-total`}>
                      <td colSpan={3}></td>
                      <td className="subtotal-label">小計</td>
                      <td className="num-cell subtotal-amount">{teacher.total.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </>
                ))}
                <tr className="grand-total-row">
                  <td colSpan={4} className="grand-total-label">合計</td>
                  <td className="num-cell grand-total-amount">
                    {salary.reduce((sum, t) => sum + t.total, 0).toLocaleString()}
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
