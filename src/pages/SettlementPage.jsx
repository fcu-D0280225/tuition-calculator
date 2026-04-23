import { useState } from 'react'
import { apiSettlementTuition, apiSettlementSalary, apiCreateShareToken } from '../data/api.js'
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

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function SettlementPage() {
  const [from, setFrom] = useState(firstDayOfMonth)
  const [to, setTo]     = useState(lastDayOfMonth)
  const [tuition, setTuition] = useState(null)
  const [salary, setSalary]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [pdfLoading, setPdfLoading] = useState('')   // 'tuition' | 'salary' | student_id | teacher_id
  const [shareLoading, setShareLoading] = useState('')
  const [shareUrl, setShareUrl] = useState(null)     // { studentName, url, expiresAt }
  const [copied, setCopied] = useState(false)
  const [showAmounts, setShowAmounts] = useState(false)

  function amt(value, suffix = '') {
    if (!showAmounts) return '••••'
    return value.toLocaleString() + suffix
  }

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

  async function handleShareStudent(student) {
    setShareLoading(student.student_id)
    try {
      const { token, expires_at } = await apiCreateShareToken(student.student_id, { from, to })
      const url = `${window.location.origin}/view/${token}`
      setShareUrl({ studentName: student.student_name, url, expiresAt: expires_at })
      setCopied(false)
    } catch (e) { alert('產生連結失敗：' + e.message) }
    finally { setShareLoading('') }
  }

  async function handleCopyLink(url) {
    // navigator.clipboard 只在 HTTPS / localhost 可用；以 IP HTTP 開時 fallback 用 execCommand
    let ok = false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
        ok = true
      }
    } catch { /* fallthrough */ }
    if (!ok) {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus(); ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      document.body.removeChild(ta)
    }
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else {
      alert('自動複製失敗，請長按或手動選取連結複製')
    }
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
        <button
          className="btn-sm"
          onClick={() => setShowAmounts(v => !v)}
          title={showAmounts ? '隱藏金額' : '顯示金額'}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <EyeIcon open={showAmounts} />
          {showAmounts ? '隱藏金額' : '顯示金額'}
        </button>
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

      {shareUrl && (
        <div className="settlement-section">
          <div className="settlement-section-header">
            <h2>{shareUrl.studentName} 的家長分享連結</h2>
            <button className="btn-sm" onClick={() => setShareUrl(null)}>關閉</button>
          </div>
          <div className="share-link-box">
            <input type="text" readOnly value={shareUrl.url} onFocus={e => e.target.select()} />
            <button className="btn-sm" onClick={() => handleCopyLink(shareUrl.url)}>
              {copied ? '已複製 ✓' : '複製'}
            </button>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
            連結於 {shareUrl.expiresAt?.slice(0, 10)} 失效
          </div>
        </div>
      )}

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
                  const firstKind = student.courses.length > 0 ? 'course'
                                  : grpLen > 0 ? 'group'
                                  : 'material'
                  const nameCell = (
                    <td rowSpan={totalRows} className="student-cell">{student.student_name}</td>
                  )
                  const actionCell = (
                    <td rowSpan={totalRows} style={{ verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn-sm"
                        onClick={() => handleStudentPDF(student)}
                        disabled={!!pdfLoading}
                        title={`下載 ${student.student_name} 學費單 PDF`}
                      >
                        {pdfLoading === student.student_id ? '…' : 'PDF'}
                      </button>
                      <button
                        className="btn-sm"
                        style={{ marginLeft: 4 }}
                        onClick={() => handleShareStudent(student)}
                        disabled={!!shareLoading}
                        title={`產生 ${student.student_name} 的家長分享連結`}
                      >
                        {shareLoading === student.student_id ? '…' : '分享'}
                      </button>
                    </td>
                  )
                  return (
                    <>
                      {student.courses.map((c, i) => (
                        <tr key={`${student.student_id}-c-${c.course_id}-${c.unit_price}`}>
                          {i === 0 && firstKind === 'course' && nameCell}
                          <td>{c.course_name}</td>
                          <td className="num-cell">{c.total_hours} 時</td>
                          <td className="num-cell">{amt(c.unit_price)}</td>
                          <td className="num-cell">{amt(c.amount)}</td>
                          {i === 0 && firstKind === 'course' && actionCell}
                        </tr>
                      ))}
                      {(student.groups || []).map((g, i) => (
                        <tr key={`${student.student_id}-g-${g.group_id}`} style={{ background: '#ecfdf5' }}>
                          {i === 0 && firstKind === 'group' && nameCell}
                          <td style={{ color: '#166534' }}>團課：{g.group_name}</td>
                          <td className="num-cell">{g.billable_months} 月</td>
                          <td className="num-cell">{amt(g.monthly_fee, '/月')}</td>
                          <td className="num-cell">{amt(g.amount)}</td>
                          {i === 0 && firstKind === 'group' && actionCell}
                        </tr>
                      ))}
                      {(student.materials || []).map((m, i) => (
                        <tr key={`${student.student_id}-m-${m.material_id}`} style={{ background: '#fefce8' }}>
                          {i === 0 && firstKind === 'material' && nameCell}
                          <td style={{ color: '#a16207' }}>教材：{m.material_name}</td>
                          <td className="num-cell">{m.total_qty} 本</td>
                          <td className="num-cell">{amt(m.unit_price)}</td>
                          <td className="num-cell">{amt(m.amount)}</td>
                          {i === 0 && firstKind === 'material' && actionCell}
                        </tr>
                      ))}
                      <tr className="subtotal-row" key={`${student.student_id}-total`}>
                        <td colSpan={3}></td>
                        <td className="subtotal-label">小計</td>
                        <td className="num-cell subtotal-amount">{amt(student.total)}</td>
                        <td></td>
                      </tr>
                    </>
                  )
                })}
                <tr className="grand-total-row">
                  <td colSpan={4} className="grand-total-label">合計</td>
                  <td className="num-cell grand-total-amount">
                    {amt(tuition.reduce((sum, s) => sum + s.total, 0))}
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
                        <td className="num-cell">{amt(c.hourly_rate)}</td>
                        <td className="num-cell">{amt(c.amount)}</td>
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
                      <td className="num-cell subtotal-amount">{amt(teacher.total)}</td>
                      <td></td>
                    </tr>
                  </>
                ))}
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
