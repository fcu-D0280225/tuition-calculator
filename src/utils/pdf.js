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

function periodLabel(from, to) {
  return `${from} ~ ${to}`
}

/**
 * 將 HTML 以截圖方式附加到 PDF（自動分頁）
 */
async function appendHtmlRasterToPdf(pdf, innerHTML, { startOnNewPage }) {
  if (startOnNewPage) pdf.addPage()

  const el = document.createElement('div')
  el.style.cssText = PDF_WRAPPER_STYLE
  el.innerHTML = innerHTML
  document.body.appendChild(el)

  try {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pageWidth  = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgHeight  = pageWidth * (canvas.height / canvas.width)

    let yOffset = 0
    while (yOffset < imgHeight) {
      if (yOffset > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, -yOffset, pageWidth, imgHeight)
      yOffset += pageHeight
    }
  } finally {
    if (el.parentNode) document.body.removeChild(el)
  }
}

// ── 學費單 HTML 模板 ───────────────────────────────────────────────────────────

function tuitionSummaryHtml(tuition, period, dateStr) {
  const rows = tuition.map((s, i) => `
    <tr style="border-bottom:1px solid #f1f5f9; ${i % 2 === 1 ? 'background:#fafafa;' : ''}">
      <td style="padding:10px 12px; font-weight:600;">${escapeHtml(s.student_name)}</td>
      <td style="padding:10px 12px; text-align:right; font-family:monospace;">NT$ ${s.total.toLocaleString()}</td>
    </tr>
  `).join('')

  const grandTotal = tuition.reduce((sum, s) => sum + s.total, 0)

  return `
    <div style="border-bottom:3px solid #16a34a; padding-bottom:24px; margin-bottom:32px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-size:22px; font-weight:700; color:#1e293b; margin-bottom:4px;">學費彙總表</div>
          <div style="color:#64748b; font-size:13px;">Tuition Summary</div>
        </div>
        <div style="text-align:right; color:#64748b; font-size:13px;">
          <div>產出日期：${dateStr}</div>
          <div>學生人數：${tuition.length} 位</div>
        </div>
      </div>
    </div>
    <div style="margin-bottom:24px;">
      <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:6px;">結算區間</div>
      <div style="font-size:18px; font-weight:700;">${escapeHtml(period)}</div>
    </div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
      <thead>
        <tr style="background:#ecfdf5;">
          <th style="padding:10px 12px; text-align:left; font-size:12px; color:#166534; font-weight:600; border-bottom:2px solid #bbf7d0;">學生姓名</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#166534; font-weight:600; border-bottom:2px solid #bbf7d0;">應繳金額</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="background:#14532d; color:white; border-radius:8px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:15px; font-weight:600;">合計</div>
      <div style="font-size:24px; font-weight:700;">NT$ ${grandTotal.toLocaleString()}</div>
    </div>
    <div style="margin-top:28px; padding:14px; background:#f8fafc; border-radius:8px; color:#64748b; font-size:13px;">
      以下為各學生學費明細。
    </div>
  `
}

function singleTuitionHtml(student, period, dateStr) {
  const courseRows = student.courses.map((c, i) => `
    <tr style="border-bottom:1px solid #f1f5f9; ${i % 2 === 1 ? 'background:#fafafa;' : ''}">
      <td style="padding:10px 12px; font-weight:600; color:#2563eb;">${escapeHtml(c.course_name)}</td>
      <td style="padding:10px 12px; text-align:right;">${c.total_hours} 時</td>
      <td style="padding:10px 12px; text-align:right; color:#64748b;">NT$ ${c.unit_price.toLocaleString()}</td>
      <td style="padding:10px 12px; text-align:right; font-weight:500;">NT$ ${c.amount.toLocaleString()}</td>
    </tr>
  `).join('')

  const materials = student.materials || []
  const matRows = materials.map((m, i) => `
    <tr style="border-bottom:1px solid #f1f5f9; background:#fefce8;">
      <td style="padding:10px 12px; font-weight:600; color:#a16207;">教材：${escapeHtml(m.material_name)}</td>
      <td style="padding:10px 12px; text-align:right;">${m.total_qty} 本</td>
      <td style="padding:10px 12px; text-align:right; color:#64748b;">NT$ ${m.unit_price.toLocaleString()}</td>
      <td style="padding:10px 12px; text-align:right; font-weight:500;">NT$ ${m.amount.toLocaleString()}</td>
    </tr>
  `).join('')

  const rows = courseRows + matRows

  return `
    <div style="border-bottom:3px solid #2563eb; padding-bottom:24px; margin-bottom:32px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-size:22px; font-weight:700; color:#1e293b; margin-bottom:4px;">學費費單</div>
          <div style="color:#64748b; font-size:13px;">Tuition Invoice</div>
        </div>
        <div style="text-align:right; color:#64748b; font-size:13px;">
          <div>開單日期：${dateStr}</div>
        </div>
      </div>
    </div>
    <div style="display:flex; gap:48px; margin-bottom:32px;">
      <div>
        <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:6px;">學生姓名</div>
        <div style="font-size:20px; font-weight:700;">${escapeHtml(student.student_name)}</div>
      </div>
      <div>
        <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:6px;">結算區間</div>
        <div style="font-size:16px; font-weight:600;">${escapeHtml(period)}</div>
      </div>
    </div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px; text-align:left; font-size:12px; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0;">課程／教材</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0;">時數／數量</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0;">單價</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0;">金額</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="background:#1e293b; color:white; border-radius:8px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:15px; font-weight:600;">應繳總金額</div>
      <div style="font-size:24px; font-weight:700;">NT$ ${student.total.toLocaleString()}</div>
    </div>
    <div style="margin-top:32px; padding-top:24px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:12px; text-align:center;">
      此為電腦系統產出費單，如有疑問請聯繫補習班。
    </div>
  `
}

// ── 薪資單 HTML 模板 ───────────────────────────────────────────────────────────

function salarySummaryHtml(salary, period, dateStr) {
  const rows = salary.map((t, i) => `
    <tr style="border-bottom:1px solid #f1f5f9; ${i % 2 === 1 ? 'background:#fafafa;' : ''}">
      <td style="padding:10px 12px; font-weight:600;">${escapeHtml(t.teacher_name)}</td>
      <td style="padding:10px 12px; text-align:right; font-family:monospace;">NT$ ${t.total.toLocaleString()}</td>
    </tr>
  `).join('')

  const grandTotal = salary.reduce((sum, t) => sum + t.total, 0)

  return `
    <div style="border-bottom:3px solid #7c3aed; padding-bottom:24px; margin-bottom:32px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-size:22px; font-weight:700; color:#1e293b; margin-bottom:4px;">薪資彙總表</div>
          <div style="color:#64748b; font-size:13px;">Salary Summary</div>
        </div>
        <div style="text-align:right; color:#64748b; font-size:13px;">
          <div>產出日期：${dateStr}</div>
          <div>老師人數：${salary.length} 位</div>
        </div>
      </div>
    </div>
    <div style="margin-bottom:24px;">
      <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:6px;">結算區間</div>
      <div style="font-size:18px; font-weight:700;">${escapeHtml(period)}</div>
    </div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
      <thead>
        <tr style="background:#f3e8ff;">
          <th style="padding:10px 12px; text-align:left; font-size:12px; color:#6b21a8; font-weight:600; border-bottom:2px solid #ddd6fe;">老師姓名</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#6b21a8; font-weight:600; border-bottom:2px solid #ddd6fe;">應領薪資</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="background:#4c1d95; color:white; border-radius:8px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:15px; font-weight:600;">合計</div>
      <div style="font-size:24px; font-weight:700;">NT$ ${grandTotal.toLocaleString()}</div>
    </div>
    <div style="margin-top:28px; padding:14px; background:#f8fafc; border-radius:8px; color:#64748b; font-size:13px;">
      以下為各老師薪資明細。
    </div>
  `
}

function singleSalaryHtml(teacher, period, dateStr) {
  const rows = teacher.courses.map((c, i) => `
    <tr style="border-bottom:1px solid #f1f5f9; ${i % 2 === 1 ? 'background:#fafafa;' : ''}">
      <td style="padding:10px 12px; font-weight:600; color:#7c3aed;">${escapeHtml(c.course_name)}</td>
      <td style="padding:10px 12px; text-align:right;">${c.total_hours}</td>
      <td style="padding:10px 12px; text-align:right; color:#64748b;">NT$ ${c.hourly_rate.toLocaleString()}</td>
      <td style="padding:10px 12px; text-align:right; font-weight:500;">NT$ ${c.amount.toLocaleString()}</td>
    </tr>
  `).join('')

  return `
    <div style="border-bottom:3px solid #7c3aed; padding-bottom:24px; margin-bottom:32px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-size:22px; font-weight:700; color:#1e293b; margin-bottom:4px;">薪資單</div>
          <div style="color:#64748b; font-size:13px;">Salary Statement</div>
        </div>
        <div style="text-align:right; color:#64748b; font-size:13px;">
          <div>開單日期：${dateStr}</div>
        </div>
      </div>
    </div>
    <div style="display:flex; gap:48px; margin-bottom:32px;">
      <div>
        <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:6px;">老師姓名</div>
        <div style="font-size:20px; font-weight:700;">${escapeHtml(teacher.teacher_name)}</div>
      </div>
      <div>
        <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:6px;">結算區間</div>
        <div style="font-size:16px; font-weight:600;">${escapeHtml(period)}</div>
      </div>
    </div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
      <thead>
        <tr style="background:#f3e8ff;">
          <th style="padding:10px 12px; text-align:left; font-size:12px; color:#6b21a8; font-weight:600; border-bottom:2px solid #ddd6fe;">課程</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#6b21a8; font-weight:600; border-bottom:2px solid #ddd6fe;">時數</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#6b21a8; font-weight:600; border-bottom:2px solid #ddd6fe;">時薪(元/時)</th>
          <th style="padding:10px 12px; text-align:right; font-size:12px; color:#6b21a8; font-weight:600; border-bottom:2px solid #ddd6fe;">金額</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="background:#4c1d95; color:white; border-radius:8px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:15px; font-weight:600;">應領薪資</div>
      <div style="font-size:24px; font-weight:700;">NT$ ${teacher.total.toLocaleString()}</div>
    </div>
    <div style="margin-top:32px; padding-top:24px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:12px; text-align:center;">
      此為電腦系統產出薪資單，如有疑問請聯繫補習班。
    </div>
  `
}

// ── 公開 API ──────────────────────────────────────────────────────────────────

/**
 * 下載學費 PDF（彙總 + 各學生明細，合併一份）
 */
export async function generateTuitionPDF(tuition, from, to) {
  const dateStr = todayStr()
  const period  = periodLabel(from, to)
  const pdf     = new jsPDF('p', 'mm', 'a4')

  await appendHtmlRasterToPdf(pdf, tuitionSummaryHtml(tuition, period, dateStr), { startOnNewPage: false })

  for (const student of tuition) {
    await appendHtmlRasterToPdf(pdf, singleTuitionHtml(student, period, dateStr), { startOnNewPage: true })
  }

  pdf.save(`學費單_${from}_${to}.pdf`)
}

/**
 * 下載單一學生學費 PDF
 */
export async function generateStudentTuitionPDF(student, from, to) {
  const dateStr = todayStr()
  const period  = periodLabel(from, to)
  const pdf     = new jsPDF('p', 'mm', 'a4')

  await appendHtmlRasterToPdf(pdf, singleTuitionHtml(student, period, dateStr), { startOnNewPage: false })

  const safeName = student.student_name.replace(/[\\/:*?"<>|]/g, '_')
  pdf.save(`學費單_${safeName}_${from}_${to}.pdf`)
}

/**
 * 下載薪資 PDF（彙總 + 各老師明細，合併一份）
 */
export async function generateSalaryPDF(salary, from, to) {
  const dateStr = todayStr()
  const period  = periodLabel(from, to)
  const pdf     = new jsPDF('p', 'mm', 'a4')

  await appendHtmlRasterToPdf(pdf, salarySummaryHtml(salary, period, dateStr), { startOnNewPage: false })

  for (const teacher of salary) {
    await appendHtmlRasterToPdf(pdf, singleSalaryHtml(teacher, period, dateStr), { startOnNewPage: true })
  }

  pdf.save(`薪資單_${from}_${to}.pdf`)
}

/**
 * 下載單一老師薪資 PDF
 */
export async function generateTeacherSalaryPDF(teacher, from, to) {
  const dateStr = todayStr()
  const period  = periodLabel(from, to)
  const pdf     = new jsPDF('p', 'mm', 'a4')

  await appendHtmlRasterToPdf(pdf, singleSalaryHtml(teacher, period, dateStr), { startOnNewPage: false })

  const safeName = teacher.teacher_name.replace(/[\\/:*?"<>|]/g, '_')
  pdf.save(`薪資單_${safeName}_${from}_${to}.pdf`)
}
