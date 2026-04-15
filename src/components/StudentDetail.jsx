import { useState } from 'react'
import {
  computeCourseSubtotal,
  resolveUnitPrice,
  isInvoiceIncluded,
  invoicePriceBlock,
  teamFieldForInput,
  bookFieldForInput,
} from '../data/pricingDefaults'
import { generatePDF } from '../utils/pdf'

const SUBJECT_COLOR = {
  '英文': '#2563eb',
  '數學': '#16a34a',
  '理化': '#9333ea',
  '生物': '#0891b2',
}

const SUBJECT_OPTIONS = Object.keys(SUBJECT_COLOR)

const STRUCT_FIELDS = [
  { key: 'ind1', label: '1人' },
  { key: 'ind2', label: '2人' },
  { key: 'grp34', label: '3–4人' },
  { key: 'ind_special', label: '特殊個人' },
  { key: 'ind_other', label: '其他個人' },
]

const PRICE_FIELDS = [
  { key: 'price_ind1', label: '個人課', hourKey: 'ind1' },
  { key: 'price_ind2', label: '2人課', hourKey: 'ind2' },
  { key: 'price_grp34', label: '3-4人課', hourKey: 'grp34' },
  { key: 'price_ind_special', label: '特殊個人課', hourKey: 'ind_special' },
  { key: 'price_ind_other', label: '其他個人課', hourKey: 'ind_other' },
]

function hasCustomPrice(course, fieldKey) {
  return Object.prototype.hasOwnProperty.call(course, fieldKey)
}

export default function StudentDetail({
  student,
  period,
  unitDraft,
  onUpdateCourse,
  onPatchCourse,
  onAddCourse,
  onRemoveCourse,
  onSetAllInvoiceInclude,
  courseCatalogItems = [],
  onAddFromCatalog,
}) {
  const [generating, setGenerating] = useState(false)
  const [pickCatalogId, setPickCatalogId] = useState('')

  const courseSubtotals = student.courses.map(c => computeCourseSubtotal(c, unitDraft))
  const grandAll = courseSubtotals.reduce((a, b) => a + b, 0)

  const invoiceMask = student.courses.map(isInvoiceIncluded)
  const nInvoice = invoiceMask.filter(Boolean).length
  const grandInvoice = student.courses.reduce(
    (sum, c, i) => sum + (invoiceMask[i] ? courseSubtotals[i] : 0),
    0
  )

  function updatePrice(courseIdx, field, rawValue) {
    const value = parseFloat(rawValue)
    onUpdateCourse(student.rosterId, courseIdx, field, Number.isFinite(value) ? value : 0)
  }

  function clearCustomPrice(courseIdx, fieldKey) {
    onUpdateCourse(student.rosterId, courseIdx, fieldKey, null)
  }

  function patchStructure(courseIdx, patch) {
    onPatchCourse(student.rosterId, courseIdx, patch)
  }

  async function handlePDF() {
    const invoiceEntries = student.courses
      .filter(isInvoiceIncluded)
      .map(c => ({ course: c, prices: invoicePriceBlock(c, unitDraft) }))

    const rowsCount = invoiceEntries.reduce((n, { course, prices: p }) => {
      let r = 0
      if (course.ind1 > 0) r++
      if (course.ind2 > 0) r++
      if (course.grp34 > 0) r++
      if (course.ind_special > 0) r++
      if (course.ind_other > 0) r++
      if (p.team_override > 0) r++
      if (p.book_fee_override > 0) r++
      return n + r
    }, 0)

    if (rowsCount === 0) {
      window.alert('請至少勾選一門課程，且該課程需有堂數或固定費用，才能重新產生學費單。')
      return
    }

    setGenerating(true)
    try {
      await generatePDF(student, period, invoiceEntries, grandInvoice)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="detail">
      <div className="detail-header">
        <div>
          <h1 className="student-title">{student.name}</h1>
          <p className="student-period">{period} · 全部課程小計 NT$ {grandAll.toLocaleString()}</p>
        </div>
        <details className="detail-actions-collapse" open>
          <summary className="detail-actions-summary">
            操作：課程庫、新增課程、PDF…
          </summary>
          <div className="header-actions header-actions--wrap">
            {courseCatalogItems.length > 0 && onAddFromCatalog && (
              <div className="catalog-quick-add">
                <select
                  className="catalog-quick-select"
                  value={pickCatalogId}
                  onChange={e => setPickCatalogId(e.target.value)}
                >
                  <option value="">從課程庫加入…</option>
                  {courseCatalogItems.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.cycleLabel} · NT${c.defaultAmount.toLocaleString()}
                      {c.hours ? ` · ${c.hours}堂` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary btn-catalog-apply"
                  onClick={() => {
                    const item = courseCatalogItems.find(x => x.id === pickCatalogId)
                    if (!item) {
                      window.alert('請先選擇課程庫項目')
                      return
                    }
                    onAddFromCatalog(item)
                    setPickCatalogId('')
                  }}
                >
                  套用
                </button>
              </div>
            )}
            <button type="button" className="btn-secondary" onClick={onAddCourse}>
              ＋ 空白課程列
            </button>
            <div className="grand-total-badge grand-total-badge--invoice">
              本期學費單
              <span className="grand-amount">NT$ {grandInvoice.toLocaleString()}</span>
              <span className="grand-amount-note">已選 {nInvoice} 門課程</span>
            </div>
            <button
              className={`pdf-btn ${generating ? 'loading' : ''}`}
              onClick={handlePDF}
              disabled={generating}
            >
              {generating ? '⏳ 產生中…' : '📄 產出本期學費單 PDF'}
            </button>
          </div>
        </details>
      </div>

      <details className="detail-toolbar-collapse" open>
        <summary className="detail-toolbar-summary">本期學費單 · 科目勾選</summary>
        <div className="invoice-toolbar">
          <span className="invoice-toolbar-label">本期學費單要列出的科目：</span>
          <button type="button" className="btn-link" onClick={() => onSetAllInvoiceInclude(true)}>全選</button>
          <span className="invoice-toolbar-sep">·</span>
          <button type="button" className="btn-link" onClick={() => onSetAllInvoiceInclude(false)}>全不選</button>
        </div>
      </details>

      <div className="courses-grid">
        {student.courses.map((course, cIdx) => {
          const sub = courseSubtotals[cIdx]
          const color = SUBJECT_COLOR[course.subject] || '#64748b'
          const hasHours = (course.ind1 + course.ind2 + course.grp34 + course.ind_special + course.ind_other) > 0
          const included = isInvoiceIncluded(course)

          return (
            <div
              key={cIdx}
              className={`course-card ${included ? '' : 'course-card--excluded'}`}
              style={{ '--accent': color }}
            >
              <div className="course-header">
                <label className="invoice-check">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={e => patchStructure(cIdx, { invoice_include: e.target.checked })}
                  />
                  <span className="invoice-check-label">列入本期學費單</span>
                </label>
                <div className="course-header-row">
                  <span className="subject-badge" style={{ background: color }}>{course.subject || '（科目）'}</span>
                  <div className="course-header-actions">
                    <span className="course-subtotal">小計 NT$ {sub.toLocaleString()}</span>
                    {student.courses.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-course"
                        onClick={() => onRemoveCourse(cIdx)}
                        title="移除此課程"
                      >
                        刪除
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <details className="course-detail-collapse" open>
                <summary className="course-detail-summary">
                  科目堂數與計價
                  <span className="course-detail-summary-hint">（可收合）</span>
                </summary>
                <div className="course-detail-inner">
              <div className="course-structure">
                <div className="price-section-title">科目與堂數</div>
                {course.catalog_cycle ? (
                  <p className="catalog-cycle-hint">課程庫 · 週期：{course.catalog_cycle}</p>
                ) : null}
                <div className="structure-grid">
                  <label className="structure-field structure-field--subject">
                    <span className="structure-label">科目</span>
                    <input
                      className="structure-input"
                      list="subject-suggestions"
                      value={course.subject}
                      onChange={e => patchStructure(cIdx, { subject: e.target.value })}
                      placeholder="例如：英文"
                    />
                  </label>
                  {STRUCT_FIELDS.map(({ key, label }) => (
                    <label key={key} className="structure-field">
                      <span className="structure-label">{label}</span>
                      <input
                        type="number"
                        className="structure-input structure-input--num"
                        min="0"
                        step="0.5"
                        value={course[key] === 0 ? '' : course[key]}
                        onChange={e => {
                          const v = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          patchStructure(cIdx, { [key]: v })
                        }}
                        placeholder="0"
                      />
                    </label>
                  ))}
                </div>
                <datalist id="subject-suggestions">
                  {SUBJECT_OPTIONS.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div className="price-editor">
                {hasHours && (
                  <div className="price-section">
                    <div className="price-section-title">課程費用（每堂）</div>
                    <div className="price-rows">
                      {PRICE_FIELDS.map(({ key, label, hourKey }) => {
                        const hrs = course[hourKey] || 0
                        if (hrs <= 0) return null
                        const effective = resolveUnitPrice(course, key, unitDraft)
                        const custom = hasCustomPrice(course, key)
                        return (
                          <div key={key} className="price-row price-row--with-meta">
                            <span className="price-label">
                              {label} × {hrs} 堂
                              {!custom && (
                                <span className="price-source-badge">預設</span>
                              )}
                            </span>
                            <div className="price-input-wrap">
                              <span className="currency">NT$</span>
                              <input
                                type="number"
                                className="price-input"
                                value={effective}
                                min="0"
                                onChange={e => updatePrice(cIdx, key, e.target.value)}
                              />
                              <span className="per-unit">/ 堂</span>
                            </div>
                            <div className="price-row-actions">
                              <span className="price-result">= {Math.round(hrs * effective).toLocaleString()}</span>
                              {custom && (
                                <button
                                  type="button"
                                  className="btn-reset-price"
                                  onClick={() => clearCustomPrice(cIdx, key)}
                                >
                                  還原預設
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="price-section">
                  <div className="price-section-title">固定費用</div>
                  <div className="price-rows">
                    <FixedRow
                      label="團班費"
                      value={teamFieldForInput(course)}
                      onChange={v => updatePrice(cIdx, 'team_override', v)}
                    />
                    <FixedRow
                      label="書錢 / 教材費"
                      value={bookFieldForInput(course)}
                      onChange={v => updatePrice(cIdx, 'book_fee_override', v)}
                    />
                  </div>
                </div>
              </div>
                </div>
              </details>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FixedRow({ label, value, onChange }) {
  return (
    <div className="price-row">
      <span className="price-label">{label}</span>
      <div className="price-input-wrap">
        <span className="currency">NT$</span>
        <input
          type="number"
          className="price-input"
          value={value}
          min="0"
          onChange={e => onChange(e.target.value)}
        />
      </div>
      <span className="price-result">{value > 0 ? `= ${Number(value).toLocaleString()}` : '—'}</span>
    </div>
  )
}
