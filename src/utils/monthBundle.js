import {
  isInvoiceIncluded,
  invoicePriceBlock,
  computeCourseSubtotal,
} from '../data/pricingDefaults'
import { buildInvoiceRows } from './pdf'

/**
 * 整月一包：每位學生的本期應繳 + 全班合計，以及可列印明細的學生清單。
 */
export function buildMonthlyBundleData(students, unitDraft) {
  const summaryRows = []
  const details = []
  let grandTotal = 0

  for (const student of students) {
    const invoiceEntries = student.courses
      .filter(isInvoiceIncluded)
      .map(c => ({ course: c, prices: invoicePriceBlock(c, unitDraft) }))

    const invoiceMask = student.courses.map(isInvoiceIncluded)
    const grandInvoice = student.courses.reduce(
      (sum, c, i) => sum + (invoiceMask[i] ? computeCourseSubtotal(c, unitDraft) : 0),
      0
    )

    const rows = buildInvoiceRows(invoiceEntries)
    summaryRows.push({ name: student.name, amount: grandInvoice })
    grandTotal += grandInvoice
    if (rows.length > 0) {
      details.push({ student, invoiceEntries, grandTotal: grandInvoice })
    }
  }

  return { summaryRows, grandTotal, details }
}
