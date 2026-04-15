/**
 * 全班共用的預設「每堂」單價（未針對該生該科調整時使用）。
 * 可在側欄調整，僅影響尚未自訂單價的欄位。
 */
export const DEFAULT_UNIT_PRICES = {
  price_ind1: 700,
  price_ind2: 600,
  price_grp34: 500,
  price_ind_special: 500,
  price_ind_other: 900,
}

export const PRICE_FIELD_KEYS = [
  'price_ind1',
  'price_ind2',
  'price_grp34',
  'price_ind_special',
  'price_ind_other',
]

function fixedTeamFee(course) {
  return Object.prototype.hasOwnProperty.call(course, 'team_override')
    ? (Number(course.team_override) || 0)
    : (course.team ?? 0)
}

function fixedBookFee(course) {
  return Object.prototype.hasOwnProperty.call(course, 'book_fee_override')
    ? (Number(course.book_fee_override) || 0)
    : (course.book_fee ?? 0)
}

/** 表單顯示用：未改過團班費時顯示原始 team */
export function teamFieldForInput(course) {
  return Object.prototype.hasOwnProperty.call(course, 'team_override')
    ? (Number(course.team_override) || 0)
    : (course.team ?? 0)
}

export function bookFieldForInput(course) {
  return Object.prototype.hasOwnProperty.call(course, 'book_fee_override')
    ? (Number(course.book_fee_override) || 0)
    : (course.book_fee ?? 0)
}

/** 從歷史小計反推單一參考單價（舊資料無明細單價時） */
export function guessBaseUnitFromCourse(course) {
  const fixed = fixedTeamFee(course) + fixedBookFee(course)
  const hourSubtotal = (course.subtotal ?? 0) - fixed
  if ((course.hours || 0) > 0 && hourSubtotal > 0) {
    return Math.round(hourSubtotal / course.hours)
  }
  return 0
}

export function resolveUnitPrice(course, fieldKey, unitDraft) {
  const raw = course[fieldKey]
  if (raw != null && raw !== '' && !Number.isNaN(Number(raw))) {
    return Number(raw)
  }
  const guessed = guessBaseUnitFromCourse(course)
  if (guessed > 0) return guessed
  const d = unitDraft[fieldKey]
  return d != null && !Number.isNaN(Number(d)) ? Number(d) : 0
}

/** 與畫面／存檔一致的小計（依 effective 單價，四捨五入至整數元） */
export function computeCourseSubtotal(course, unitDraft) {
  return Math.round(
    (course.ind1 || 0) * resolveUnitPrice(course, 'price_ind1', unitDraft) +
    (course.ind2 || 0) * resolveUnitPrice(course, 'price_ind2', unitDraft) +
    (course.grp34 || 0) * resolveUnitPrice(course, 'price_grp34', unitDraft) +
    (course.ind_special || 0) * resolveUnitPrice(course, 'price_ind_special', unitDraft) +
    (course.ind_other || 0) * resolveUnitPrice(course, 'price_ind_other', unitDraft) +
    fixedTeamFee(course) +
    fixedBookFee(course)
  )
}

export function isInvoiceIncluded(course) {
  return course.invoice_include !== false
}

/** 單筆學生「全部課程」加總（側邊列表用） */
export function sumStudentCoursesSubtotal(student, unitDraft) {
  return student.courses.reduce(
    (sum, c) => sum + computeCourseSubtotal(c, unitDraft),
    0
  )
}

/** PDF / 預覽用：已套用預設或自訂後的單價與固定費區塊 */
export function invoicePriceBlock(course, unitDraft) {
  return {
    price_ind1: resolveUnitPrice(course, 'price_ind1', unitDraft),
    price_ind2: resolveUnitPrice(course, 'price_ind2', unitDraft),
    price_grp34: resolveUnitPrice(course, 'price_grp34', unitDraft),
    price_ind_special: resolveUnitPrice(course, 'price_ind_special', unitDraft),
    price_ind_other: resolveUnitPrice(course, 'price_ind_other', unitDraft),
    team_override: fixedTeamFee(course),
    book_fee_override: fixedBookFee(course),
  }
}
