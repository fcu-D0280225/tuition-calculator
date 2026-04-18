import { createEmptyCourse } from './students'
import { computeCourseSubtotal } from './pricingDefaults'
import { apiGetCatalog, apiPutCatalog } from './api'

export const CYCLE_PRESETS = ['一個月', '兩個月', '三個月', '半年', '每期', '每週', '雙週', '單堂']

const BILLING_KEYS = ['ind1', 'ind2', 'grp34', 'ind_special', 'ind_other', 'team', 'book_fee']
const PRICE_KEYS = ['price_ind1', 'price_ind2', 'price_grp34', 'price_ind_special', 'price_ind_other']

export function createCatalogId() {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** @typedef {{ id: string, name: string, subject?: string, hours: number, cycleLabel: string, defaultAmount: number, billingShape?: object }} CourseCatalogItem */

/** @returns {Promise<CourseCatalogItem[]>} */
export async function loadCourseCatalog() {
  const arr = await apiGetCatalog()
  if (!Array.isArray(arr)) return []
  return arr.map(normalizeCatalogItem).filter(Boolean)
}

/** @param {CourseCatalogItem[]} items */
export async function saveCourseCatalog(items) {
  await apiPutCatalog(Array.isArray(items) ? items : [])
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
