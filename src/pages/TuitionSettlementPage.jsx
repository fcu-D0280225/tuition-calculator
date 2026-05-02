import { Fragment, useState } from 'react'
import { apiSettlementTuition, apiCreateShareToken, apiListPaymentRecords, apiCreatePaymentRecord, apiDeletePaymentRecord } from '../data/api.js'
import { generateTuitionPDF, generateStudentTuitionPDF } from '../utils/pdf.js'
import { genId } from '../utils/ids.js'

function firstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function lastDayOfMonth() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

export default function TuitionSettlementPage() {
  const [from, setFrom] = useState(firstDayOfMonth)
  const [to, setTo]     = useState(lastDayOfMonth)
  const [tuition, setTuition] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [pdfLoading, setPdfLoading] = useState('')
  const [shareLoading, setShareLoading] = useState('')
  const [shareUrl, setShareUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const [paymentMap, setPaymentMap] = useState({})
  const [payLoading, setPayLoading] = useState('')

  function amt(value, suffix = '') { return value.toLocaleString() + suffix }

  async function handleGenerate(e) {
    e.preventDefault()
    if (!from || !to) { setError('請選擇日期區間'); return }
    setLoading(true); setError('')
    try {
      const [t, payments] = await Promise.all([
        apiSettlementTuition(from, to),
        apiListPaymentRecords({ from, to }),
      ])
      setTuition(t)
      const map = {}
      for (const p of payments) map[p.student_id] = { id: p.id, paid_at: p.paid_at }
      setPaymentMap(map)
    } catch { setError('載入結算資料失敗') }
    finally { setLoading(false) }
  }

  async function handleDownloadTuition() {
    setPdfLoading('tuition')
    try { await generateTuitionPDF(tuition, from, to) }
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
    let ok = false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url); ok = true
      }
    } catch { /* ignore */ }
    if (!ok) {
      const ta = document.createElement('textarea')
      ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.focus(); ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      document.body.removeChild(ta)
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
    else alert('自動複製失敗，請長按或手動選取連結複製')
  }

  async function handleTogglePaid(student) {
    const existing = paymentMap[student.student_id]
    setPayLoading(student.student_id)
    try {
      if (existing) {
        await apiDeletePaymentRecord(existing.id)
        setPaymentMap(prev => { const next = { ...prev }; delete next[student.student_id]; return next })
      } else {
        const rec = await apiCreatePaymentRecord({
          id: genId('pay'),
          student_id: student.student_id,
          period_from: from,
          period_to: to,
        })
        setPaymentMap(prev => ({ ...prev, [student.student_id]: { id: rec.id, paid_at: rec.paid_at } }))
      }
    } catch { alert('操作失敗，請再試一次') }
    finally { setPayLoading('') }
  }

  const periodLabel = from && to ? `${from} ~ ${to}` : ''

  return (
    <div className="page">
      <div className="page-header">
        <h1>學費結算</h1>
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
            {tuition.length > 0 && (
              <span className="payment-summary">
                已繳 <strong>{Object.keys(paymentMap).length}</strong> / {tuition.length} 人
              </span>
            )}
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
                  const isPaid = !!paymentMap[student.student_id]
                  const paidAt = paymentMap[student.student_id]?.paid_at
                  const actionCell = (
                    <td rowSpan={totalRows} style={{ verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <button
                          className={isPaid ? 'btn-sm btn-paid' : 'btn-sm btn-unpaid'}
                          onClick={() => handleTogglePaid(student)}
                          disabled={payLoading === student.student_id}
                          title={isPaid ? `${paidAt?.slice(0, 10)} 已標記繳費，點擊取消` : '標記為已繳費'}
                        >
                          {payLoading === student.student_id ? '…' : isPaid ? '✓ 已繳費' : '未繳費'}
                        </button>
                        {isPaid && paidAt && (
                          <span className="paid-date">{paidAt.slice(0, 10)}</span>
                        )}
                        <div style={{ display: 'flex', gap: 4 }}>
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
                            onClick={() => handleShareStudent(student)}
                            disabled={!!shareLoading}
                            title={`產生 ${student.student_name} 的家長分享連結`}
                          >
                            {shareLoading === student.student_id ? '…' : '分享'}
                          </button>
                        </div>
                      </div>
                    </td>
                  )
                  return (
                    <Fragment key={student.student_id}>
                      {student.courses.map((c, i) => (
                        <tr key={`c-${c.course_id}-${c.unit_price}`}>
                          {i === 0 && firstKind === 'course' && nameCell}
                          <td>{c.course_name}</td>
                          <td className="num-cell">{c.total_hours} 時</td>
                          <td className="num-cell">{amt(c.unit_price)}</td>
                          <td className="num-cell">{amt(c.amount)}</td>
                          {i === 0 && firstKind === 'course' && actionCell}
                        </tr>
                      ))}
                      {(student.groups || []).map((g, i) => (
                        <tr key={`g-${g.group_id}`} style={{ background: '#ecfdf5' }}>
                          {i === 0 && firstKind === 'group' && nameCell}
                          <td style={{ color: '#166534' }}>團課：{g.group_name}</td>
                          <td className="num-cell">{g.billable_months} 月</td>
                          <td className="num-cell">{amt(g.monthly_fee, '/月')}</td>
                          <td className="num-cell">{amt(g.amount)}</td>
                          {i === 0 && firstKind === 'group' && actionCell}
                        </tr>
                      ))}
                      {(student.materials || []).map((m, i) => (
                        <tr key={`m-${m.material_id}`} style={{ background: '#fefce8' }}>
                          {i === 0 && firstKind === 'material' && nameCell}
                          <td style={{ color: '#a16207' }}>教材：{m.material_name}</td>
                          <td className="num-cell">{m.total_qty} 本</td>
                          <td className="num-cell">{amt(m.unit_price)}</td>
                          <td className="num-cell">{amt(m.amount)}</td>
                          {i === 0 && firstKind === 'material' && actionCell}
                        </tr>
                      ))}
                      <tr className="subtotal-row">
                        <td colSpan={3}></td>
                        <td className="subtotal-label">小計</td>
                        <td className="num-cell subtotal-amount">{amt(student.total)}</td>
                        <td></td>
                      </tr>
                    </Fragment>
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
    </div>
  )
}
