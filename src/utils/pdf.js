import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'

const PDF_WRAPPER_STYLE = `
  position: fixed; left: -9999px; top: 0;
  width: 794px; background: white; padding: 48px;
  font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  font-size: 14px; color: #1e293b; line-height: 1.6;
`

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function todayStr() {
  const now = new Date()
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
}

/** 費單編號：依「學生＋期別」產生，不依系統日期（與當月專案一致） */
function invoiceDocumentId(studentName, period) {
  const name = String(studentName ?? '')
    .replace(/[/\\]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 24)
  const per = String(period ?? '')
    .replace(/[/\\?%*:|"<>.\s]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32)
  return `${name}-${per}`
}

export function buildInvoiceRows(invoiceEntries) {
  return invoiceEntries.flatMap(({ course, prices: p }) => {
    const subj = escapeHtml(course.subject || '')
    const lines = []
    if (course.ind1 > 0) lines.push([subj, `個人課 × ${course.ind1} 堂`, `NT$ ${p.price_ind1}/堂`, `NT$ ${(course.ind1 * p.price_ind1).toLocaleString()}`])
    if (course.ind2 > 0) lines.push([subj, `2人課 × ${course.ind2} 堂`, `NT$ ${p.price_ind2}/堂`, `NT$ ${(course.ind2 * p.price_ind2).toLocaleString()}`])
    if (course.grp34 > 0) lines.push([subj, `3-4人課 × ${course.grp34} 堂`, `NT$ ${p.price_grp34}/堂`, `NT$ ${(course.grp34 * p.price_grp34).toLocaleString()}`])
    if (course.ind_special > 0) lines.push([subj, `特殊個人課 × ${course.ind_special} 堂`, `NT$ ${p.price_ind_special}/堂`, `NT$ ${(course.ind_special * p.price_ind_special).toLocaleString()}`])
    if (course.ind_other > 0) lines.push([subj, `其他個人課 × ${course.ind_other} 堂`, `NT$ ${p.price_ind_other}/堂`, `NT$ ${(course.ind_other * p.price_ind_other).toLocaleString()}`])
    if (p.team_override > 0) lines.push([subj, '團班費', '—', `NT$ ${Number(p.team_override).toLocaleString()}`])
    if (p.book_fee_override > 0) lines.push([subj, '書錢/教材費', '—', `NT$ ${Number(p.book_fee_override).toLocaleString()}`])
    return lines
  })
}

function singleInvoiceInnerHTML(student, period, invoiceEntries, grandTotal, dateStr) {
  const rows = buildInvoiceRows(invoiceEntries)
  const sid = escapeHtml(invoiceDocumentId(student.name, period))
  return `
    <div style="border-bottom: 3px solid #2563eb; padding-bottom: 24px; margin-bottom: 32px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-size:22px; font-weight:700; color:#1e293b; margin-bottom:4px;">📚 學費費單</div>
          <div style="color:#64748b; font-size:13px;">Tuition Invoice</div>
        </div>
        <div style="text-align:right; color:#64748b; font-size:13px;">
          <div>開單日期：${dateStr}</div>
          <div>費單編號：${sid}</div>
        </div>
      </div>
    </div>

    <div style="display:flex; gap:48px; margin-bottom:32px;">
      <div>
        <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:6px;">學生姓名</div>
        <div style="font-size:20px; font-weight:700;">${escapeHtml(student.name)}</div>
      </div>
      <div>
        <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:6px;">收費期別</div>
        <div style="font-size:16px; font-weight:600;">${escapeHtml(period)}</div>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px; text-align:left; font-size:12px; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0;">科目</th>
          <th style="padding:10px 12px; text-align:left; font-size:12px; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0;">項目說明</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0;">單價</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0;">金額</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr style="border-bottom:1px solid #f1f5f9; ${i % 2 === 1 ? 'background:#fafafa;' : ''}">
            <td style="padding:10px 12px; font-weight:600; color:#2563eb;">${r[0]}</td>
            <td style="padding:10px 12px;">${r[1]}</td>
            <td style="padding:10px 12px; text-align:right; color:#64748b;">${r[2]}</td>
            <td style="padding:10px 12px; text-align:right; font-weight:500;">${r[3]}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="background:#1e293b; color:white; border-radius:8px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:15px; font-weight:600;">應繳總金額</div>
      <div style="font-size:24px; font-weight:700;">NT$ ${grandTotal.toLocaleString()}</div>
    </div>

    <div style="margin-top:32px; padding-top:24px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:12px; text-align:center;">
      此為電腦系統產出費單，如有疑問請聯繫補習班。
    </div>
  `
}

function summaryInnerHTML(period, dateStr, summaryRows, grandTotal) {
  const body = summaryRows.map((r, i) => `
    <tr style="border-bottom:1px solid #f1f5f9; ${i % 2 === 1 ? 'background:#fafafa;' : ''}">
      <td style="padding:10px 12px; font-weight:600;">${escapeHtml(r.name)}</td>
      <td style="padding:10px 12px; text-align:right; font-family:monospace;">NT$ ${r.amount.toLocaleString()}</td>
    </tr>
  `).join('')

  return `
    <div style="border-bottom: 3px solid #16a34a; padding-bottom: 24px; margin-bottom: 32px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-size:22px; font-weight:700; color:#1e293b; margin-bottom:4px;">📋 全班學費彙總</div>
          <div style="color:#64748b; font-size:13px;">Monthly tuition summary</div>
        </div>
        <div style="text-align:right; color:#64748b; font-size:13px;">
          <div>開單日期：${dateStr}</div>
          <div>筆數：${summaryRows.length} 位學生</div>
        </div>
      </div>
    </div>

    <div style="margin-bottom:24px;">
      <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:6px;">收費期別</div>
      <div style="font-size:18px; font-weight:700;">${escapeHtml(period)}</div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
      <thead>
        <tr style="background:#ecfdf5;">
          <th style="padding:10px 12px; text-align:left; font-size:12px; color:#166534; font-weight:600; border-bottom:2px solid #bbf7d0;">學生姓名</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#166534; font-weight:600; border-bottom:2px solid #bbf7d0;">本期應繳（已勾選科目）</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>

    <div style="background:#14532d; color:white; border-radius:8px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:15px; font-weight:600;">全班本期合計</div>
      <div style="font-size:24px; font-weight:700;">NT$ ${grandTotal.toLocaleString()}</div>
    </div>

    <div style="margin-top:28px; padding:14px; background:#f8fafc; border-radius:8px; color:#64748b; font-size:13px;">
      以下為各學生學費明細（僅列有收費明細者）。請搭配本頁總表核對。
    </div>
  `
}

/**
 * 將一段 HTML 以截圖方式附加到 PDF（可多頁）。
 * @param {import('jspdf').jsPDF} pdf
 * @param {boolean} startOnNewPage 非第一份內容時設 true，從新一頁開始
 */
async function appendHtmlRasterToPdf(pdf, innerHTML, { startOnNewPage }) {
  if (startOnNewPage) {
    pdf.addPage()
  }

  const el = document.createElement('div')
  el.style.cssText = PDF_WRAPPER_STYLE
  el.innerHTML = innerHTML
  document.body.appendChild(el)

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgRatio = canvas.height / canvas.width
    const imgHeight = pageWidth * imgRatio

    let yOffset = 0
    while (yOffset < imgHeight) {
      if (yOffset > 0) {
        pdf.addPage()
      }
      pdf.addImage(imgData, 'PNG', 0, -yOffset, pageWidth, imgHeight)
      yOffset += pageHeight
    }
  } finally {
    if (el.parentNode) {
      document.body.removeChild(el)
    }
  }
}

/**
 * 單一學生學費單 PDF
 */
export async function generatePDF(student, period, invoiceEntries, grandTotal) {
  const dateStr = todayStr()
  const inner = singleInvoiceInnerHTML(student, period, invoiceEntries, grandTotal, dateStr)
  const rows = buildInvoiceRows(invoiceEntries)

  try {
    const pdf = new jsPDF('p', 'mm', 'a4')
    await appendHtmlRasterToPdf(pdf, inner, { startOnNewPage: false })
    pdf.save(`費單_${student.name}_${period}.pdf`)
  } catch (e) {
    generateTextPDF(student, period, grandTotal, rows, dateStr)
  }
}

/**
 * 整月一包：彙總表 + 各班內有明細之學生逐頁費單
 * @param {string} period
 * @param {Array<{ name: string, amount: number }>} summaryRows
 * @param {number} grandTotalAll
 * @param {Array<{ student: { name: string }, invoiceEntries: Array, grandTotal: number }>} details
 */
export async function generateMonthlyBundlePDF(period, summaryRows, grandTotalAll, details) {
  const dateStr = todayStr()
  const pdf = new jsPDF('p', 'mm', 'a4')

  const summaryHtml = summaryInnerHTML(period, dateStr, summaryRows, grandTotalAll)
  await appendHtmlRasterToPdf(pdf, summaryHtml, { startOnNewPage: false })

  for (const block of details) {
    const inner = singleInvoiceInnerHTML(
      block.student,
      period,
      block.invoiceEntries,
      block.grandTotal,
      dateStr
    )
    await appendHtmlRasterToPdf(pdf, inner, { startOnNewPage: true })
  }

  const safePeriod = String(period).replace(/[/\\?%*:|"<>]/g, '-')
  pdf.save(`全班學費_${safePeriod}.pdf`)
}

function generateTextPDF(student, period, grandTotal, rows, dateStr) {
  const pdf = new jsPDF('p', 'pt', 'a4')
  const margin = 40
  const pageWidth = pdf.internal.pageSize.getWidth()
  let y = margin

  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Tuition Invoice', margin, y)
  y += 30

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 116, 139)
  pdf.text(`Date: ${dateStr}   Period: ${period}`, margin, y)
  y += 20
  pdf.text(`Student: ${student.name}`, margin, y)
  y += 30

  pdf.setDrawColor(37, 99, 235)
  pdf.setLineWidth(2)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 20

  autoTable(pdf, {
    startY: y,
    head: [['Subject', 'Description', 'Unit Price', 'Amount']],
    body: rows.map(r => r.map(cell => cell.replace(/NT\$/g, 'NTD'))),
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
  })

  y = pdf.lastAutoTable.finalY + 20

  pdf.setFillColor(30, 41, 59)
  pdf.rect(margin, y, pageWidth - margin * 2, 40, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Total Amount', margin + 12, y + 25)
  pdf.text(`NTD ${grandTotal.toLocaleString()}`, pageWidth - margin - 12, y + 25, { align: 'right' })

  pdf.save(`invoice_${student.name}_${period}.pdf`)
}
