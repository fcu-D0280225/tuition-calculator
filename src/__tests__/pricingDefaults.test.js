import { describe, it, expect } from 'vitest'
import {
  computeCourseSubtotal,
  resolveUnitPrice,
  isInvoiceIncluded,
  guessBaseUnitFromCourse,
  DEFAULT_UNIT_PRICES,
} from '../data/pricingDefaults'

const UNIT = DEFAULT_UNIT_PRICES // { price_ind1:700, price_ind2:600, price_grp34:500, ... }

describe('computeCourseSubtotal', () => {
  it('calculates ind1 hours × unit price', () => {
    const course = { ind1: 3 }
    expect(computeCourseSubtotal(course, UNIT)).toBe(3 * 700)
  })

  it('adds team and book fees on top of hours', () => {
    const course = { ind1: 2, team: 200, book_fee: 100 }
    expect(computeCourseSubtotal(course, UNIT)).toBe(2 * 700 + 200 + 100)
  })

  it('uses team_override when present (even if 0)', () => {
    const course = { ind1: 1, team: 500, team_override: 0 }
    // team_override=0 should override team=500
    expect(computeCourseSubtotal(course, UNIT)).toBe(700 + 0)
  })

  it('uses per-course price_ind1 override over unitDraft', () => {
    const course = { ind1: 2, price_ind1: 800 }
    expect(computeCourseSubtotal(course, UNIT)).toBe(2 * 800)
  })

  it('returns 0 for empty course', () => {
    expect(computeCourseSubtotal({}, UNIT)).toBe(0)
  })

  it('rounds fractional-hour result to integer (no NT$ 0.5 cents)', () => {
    // 4.5 hrs × 700 = 3150 (exact), but non-integer prices could produce floats
    // Ensure the return is always a whole number
    const course = { ind1: 4.5 }
    expect(Number.isInteger(computeCourseSubtotal(course, UNIT))).toBe(true)
    expect(computeCourseSubtotal(course, UNIT)).toBe(3150)
  })
})

describe('resolveUnitPrice', () => {
  it('uses course-level price when set', () => {
    const course = { price_ind1: 999 }
    expect(resolveUnitPrice(course, 'price_ind1', UNIT)).toBe(999)
  })

  it('falls back to unitDraft when course field is null', () => {
    const course = { price_ind1: null }
    expect(resolveUnitPrice(course, 'price_ind1', UNIT)).toBe(700)
  })

  it('falls back to unitDraft when course field is empty string', () => {
    const course = { price_ind1: '' }
    expect(resolveUnitPrice(course, 'price_ind1', UNIT)).toBe(700)
  })

  it('uses guessed base unit from subtotal when no explicit price', () => {
    // subtotal=1400, hours=2 → guessed=700, ignores unitDraft
    const course = { subtotal: 1400, hours: 2 }
    expect(resolveUnitPrice(course, 'price_ind1', {})).toBe(700)
  })
})

describe('isInvoiceIncluded', () => {
  it('includes course by default', () => {
    expect(isInvoiceIncluded({})).toBe(true)
  })

  it('includes course when invoice_include is true', () => {
    expect(isInvoiceIncluded({ invoice_include: true })).toBe(true)
  })

  it('excludes course when invoice_include is false', () => {
    expect(isInvoiceIncluded({ invoice_include: false })).toBe(false)
  })
})

describe('guessBaseUnitFromCourse', () => {
  it('returns 0 when no hours', () => {
    expect(guessBaseUnitFromCourse({ subtotal: 1400, hours: 0 })).toBe(0)
  })

  it('returns 0 when subtotal minus fees is not positive', () => {
    // subtotal=100, team=200 → hourSubtotal=-100
    expect(guessBaseUnitFromCourse({ subtotal: 100, hours: 2, team: 200 })).toBe(0)
  })

  it('computes correctly: (subtotal - fixed) / hours', () => {
    // subtotal=2100, team=300, hours=3 → (2100-300)/3 = 600
    const course = { subtotal: 2100, hours: 3, team: 300 }
    expect(guessBaseUnitFromCourse(course)).toBe(600)
  })
})
