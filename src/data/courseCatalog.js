import { createEmptyCourse } from './students'
import { computeCourseSubtotal } from './pricingDefaults'

export const CATALOG_STORAGE_KEY = 'tuition-calculator-course-catalog-v1'

export const CYCLE_PRESETS = ['一個月', '兩個月', '三個月', '半年', '每期', '每週', '雙週', '單堂']

const BILLING_KEYS = ['ind1', 'ind2', 'grp34', 'ind_special', 'ind_other', 'team', 'book_fee']
const PRICE_KEYS = ['price_ind1', 'price_ind2', 'price_grp34', 'price_ind_special', 'price_ind_other']

export function createCatalogId() {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** @typedef {{ id: string, name: string, subject?: string, hours: number, cycleLabel: string, defaultAmount: number, billingShape?: object }} CourseCatalogItem */

/** @returns {CourseCatalogItem[]} */
export function loadCourseCatalog() {
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.map(normalizeCatalogItem).filter(Boolean)
  } catch {
    return []
  }
}

/** @param {CourseCatalogItem[]} items */
export function saveCourseCatalog(items) {
  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(items))
  } catch (e) {
    console.error('saveCourseCatalog', e)
  }
}

function normalizeCatalogItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' ? raw.id : createCatalogId()
  const name = typeof raw.name === 'string' ? raw.name : ''
  const subject = typeof raw.subject === 'string' ? raw.subject : ''
  const h = Number(raw.hours)
  const hours = Number.isFinite(h) && h >= 0 ? h : 0
  let cycleLabel = typeof raw.cycleLabel === 'string' ? raw.cycleLabel : '一個月'
  if (cycleLabel === '每月') cycleLabel = '一個月'
  const a = Number(raw.defaultAmount)
  const defaultAmount = Number.isFinite(a) && a >= 0 ? a : 0
  const billingShape =
    raw.billingShape && typeof raw.billingShape === 'object'
      ? normalizeBillingShape(raw.billingShape)
      : null
  return { id, name, subject, hours, cycleLabel, defaultAmount, billingShape }
}

function normalizeBillingShape(b) {
  const o = {}
  for (const k of BILLING_KEYS) {
    const n = Number(b[k])
    o[k] = Number.isFinite(n) ? n : 0
  }
  return o
}

export function emptyCatalogForm() {
  return {
    name: '',
    hours: '1',
    cycleLabel: '一個月',
    defaultAmount: '',
  }
}

function sumHourFields(c) {
  return (
    (Number(c.ind1) || 0) +
    (Number(c.ind2) || 0) +
    (Number(c.grp34) || 0) +
    (Number(c.ind_special) || 0) +
    (Number(c.ind_other) || 0)
  )
}

function billingShapeLabel(b) {
  const parts = []
  if (b.ind1) parts.push(`1人${b.ind1}堂`)
  if (b.ind2) parts.push(`2人${b.ind2}堂`)
  if (b.grp34) parts.push(`3-4人${b.grp34}堂`)
  if (b.ind_special) parts.push(`特殊${b.ind_special}堂`)
  if (b.ind_other) parts.push(`其他個人${b.ind_other}堂`)
  if (b.team) parts.push(`團班${b.team}`)
  if (b.book_fee) parts.push(`書籍${b.book_fee}`)
  return parts.join(' ')
}

function catalogDedupeKey(course) {
  const sub = course.subject || ''
  const b = normalizeBillingShape({
    ind1: course.ind1,
    ind2: course.ind2,
    grp34: course.grp34,
    ind_special: course.ind_special,
    ind_other: course.ind_other,
    team: course.team,
    book_fee: course.book_fee,
  })
  return `${sub}\t${JSON.stringify(b)}`
}

function courseRowToCatalogItem(course) {
  const subject = (course.subject && String(course.subject).trim()) || '未命名'
  const b = normalizeBillingShape({
    ind1: course.ind1,
    ind2: course.ind2,
    grp34: course.grp34,
    ind_special: course.ind_special,
    ind_other: course.ind_other,
    team: course.team,
    book_fee: course.book_fee,
  })
  const label = billingShapeLabel(b)
  const subtotal = Number(course.subtotal) || 0
  const h = Number(course.hours)
  const hours = Number.isFinite(h) && h >= 0 ? h : sumHourFields(b)

  return {
    id: createCatalogId(),
    subject,
    name: label ? `${subject} · ${label}` : subject,
    hours,
    cycleLabel: '一個月',
    defaultAmount: subtotal,
    billingShape: b,
  }
}

/** 從內建學生資料萃取「不重複」的課程列，供首次建立課程庫 */
export function buildCatalogFromStudents(students) {
  const seen = new Set()
  const items = []
  for (const s of students) {
    for (const course of s.courses || []) {
      const key = catalogDedupeKey(course)
      if (seen.has(key)) continue
      const subtotal = Number(course.subtotal) || 0
      const b = normalizeBillingShape({
        ind1: course.ind1,
        ind2: course.ind2,
        grp34: course.grp34,
        ind_special: course.ind_special,
        ind_other: course.ind_other,
        team: course.team,
        book_fee: course.book_fee,
      })
      const hasBilling = Object.values(b).some(v => v > 0)
      if (!hasBilling && subtotal === 0) continue
      seen.add(key)
      items.push(courseRowToCatalogItem(course))
    }
  }
  return items
}

/** 依「教材小計」反推各堂單價（多類型並存時假設同一隱含單價） */
function hydratePricesFromTargetSubtotal(c, targetSubtotal) {
  for (const k of PRICE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(c, k)) delete c[k]
  }
  const fixed = (Number(c.team) || 0) + (Number(c.book_fee) || 0)
  const pool = Math.max(0, Number(targetSubtotal) - fixed)
  const parts = [
    ['price_ind1', c.ind1],
    ['price_ind2', c.ind2],
    ['price_grp34', c.grp34],
    ['price_ind_special', c.ind_special],
    ['price_ind_other', c.ind_other],
  ].filter(([, h]) => Number(h) > 0)
  const totalH = parts.reduce((s, [, h]) => s + Number(h), 0)
  if (totalH <= 0) return
  const rate = pool / totalH
  for (const [key] of parts) {
    c[key] = Math.max(0, Math.round(rate))
  }
}

/**
 * 將課程庫項目轉成學生名下的「課程列」（與現有計費模型相容）。
 * 若有 billingShape（來自內建匯入），會複製 ind1/grp34/團班等並反推單價以贴近原 subtotal。
 */
export function studentCourseFromCatalogItem(item, unitDraft) {
  const subjectRaw =
    (item.subject && String(item.subject).trim()) ||
    String(item.name || '')
      .split(' · ')[0]
      .trim()
  const subject = subjectRaw || '未命名課程'

  if (item.billingShape && typeof item.billingShape === 'object') {
    const c = createEmptyCourse(subject)
    c.catalog_id = item.id
    c.catalog_cycle = item.cycleLabel || ''
    const b = normalizeBillingShape(item.billingShape)
    for (const k of BILLING_KEYS) {
      c[k] = b[k]
    }
    c.hours = sumHourFields(c)
    hydratePricesFromTargetSubtotal(c, item.defaultAmount)
    c.subtotal = computeCourseSubtotal(c, unitDraft)
    return c
  }

  const c = createEmptyCourse(subject)
  c.catalog_id = item.id
  c.catalog_cycle = item.cycleLabel || ''

  const hours = Number(item.hours)
  const h = Number.isFinite(hours) && hours >= 0 ? hours : 0
  const amount = Number(item.defaultAmount)
  const amt = Number.isFinite(amount) && amount >= 0 ? amount : 0

  if (h > 0) {
    c.ind1 = h
    if (amt > 0) {
      c.price_ind1 = Math.max(0, Math.round(amt / h))
    }
  } else if (amt > 0) {
    c.team = amt
  }

  c.hours = sumHourFields(c)
  c.subtotal = computeCourseSubtotal(c, unitDraft)
  return c
}
