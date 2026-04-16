import { test, expect } from '@playwright/test'

const URL = 'http://localhost:5173'

test.describe('全流程測試', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await page.goto(URL)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('FLOW-01 首次載入：顯示專案設定頁（預設專案）', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByText('進入本專案：管理學生與收費')).toBeVisible()
    await expect(page.locator('.billing-setup')).toBeVisible()
  })

  test('FLOW-02 進入工作區：顯示學生名單與 sidebar', async ({ page }) => {
    await page.getByText('進入本專案：管理學生與收費').click()
    await expect(page.locator('.app-split')).toBeVisible()
    await expect(page.locator('.sidebar')).toBeVisible()
    const items = page.locator('.student-item')
    await expect(items.first()).toBeVisible()
  })

  test('FLOW-03 新增學生：空名稱觸發 alert，數量不變', async ({ page }) => {
    await page.getByText('進入本專案：管理學生與收費').click()
    const before = await page.locator('.student-item').count()
    let alerted = false
    page.on('dialog', d => { alerted = true; d.accept() })
    await page.locator('.add-student-input').fill('')
    await page.locator('.btn-add-student').click()
    await page.waitForTimeout(300)
    expect(alerted).toBe(true)
    expect(await page.locator('.student-item').count()).toBe(before)
  })

  test('FLOW-04 新增學生：正常流程，自動選取新生', async ({ page }) => {
    await page.getByText('進入本專案：管理學生與收費').click()
    const before = await page.locator('.student-item').count()
    await page.locator('.add-student-input').fill('測試學生Playwright')
    await page.locator('.btn-add-student').click()
    await expect(page.locator('.student-title')).toContainText('測試學生Playwright')
    expect(await page.locator('.student-item').count()).toBe(before + 1)
  })

  test('FLOW-05 課程編輯：新增空白課程', async ({ page }) => {
    await page.getByText('進入本專案：管理學生與收費').click()
    await page.locator('.student-item').first().click()
    await expect(page.locator('.course-card').first()).toBeVisible()
    const before = await page.locator('.course-card').count()
    await page.getByText('＋ 空白課程列').click()
    await expect(page.locator('.course-card')).toHaveCount(before + 1)
  })

  test('FLOW-06 課程編輯：只剩 1 門課不顯示刪除按鈕', async ({ page }) => {
    await page.getByText('進入本專案：管理學生與收費').click()
    await page.locator('.student-item').first().click()
    const count = await page.locator('.course-card').count()
    if (count === 1) {
      await expect(page.locator('.btn-remove-course')).toHaveCount(0)
    }
  })

  test('FLOW-07 金額顯示為整數（無小數點）', async ({ page }) => {
    await page.getByText('進入本專案：管理學生與收費').click()
    const totalText = await page.locator('.month-bundle-total').textContent()
    expect(totalText).not.toMatch(/\.\d/)
    const first = await page.locator('.student-total').first().textContent()
    expect(first).not.toMatch(/\.\d/)
  })

  test('FLOW-08 搜尋：即時過濾，清空後恢復', async ({ page }) => {
    await page.getByText('進入本專案：管理學生與收費').click()
    const all = await page.locator('.student-item').count()
    await page.locator('.search').fill('毛')
    await page.waitForTimeout(200)
    const filtered = await page.locator('.student-item').count()
    expect(filtered).toBeLessThanOrEqual(all)
    await page.locator('.search').fill('')
    await page.waitForTimeout(200)
    expect(await page.locator('.student-item').count()).toBe(all)
  })

  test('FLOW-09 返回專案設定按鈕', async ({ page }) => {
    await page.getByText('進入本專案：管理學生與收費').click()
    await expect(page.locator('.app-split')).toBeVisible()
    await page.getByText('← 返回專案設定').click()
    await expect(page.locator('.billing-setup')).toBeVisible()
    await expect(page.locator('.app-split')).not.toBeVisible()
  })

  test('FLOW-10 複製專案：數量 +1（inline form）', async ({ page }) => {
    const before = await page.locator('#month-project-select option').count()
    await page.getByText('複製目前專案').click()
    // 現在是 inline form，不再是 window.prompt
    await expect(page.locator('[aria-label="新複本的期別名稱"]')).toBeVisible()
    await page.locator('[aria-label="新複本的期別名稱"]').fill('複製測試專案')
    await page.getByText('建立複本').click()
    await page.waitForTimeout(300)
    const after = await page.locator('#month-project-select option').count()
    expect(after).toBe(before + 1)
  })

  test('FLOW-11 學生名冊：切換分頁', async ({ page }) => {
    await page.locator('.app-nav-btn', { hasText: '學生名冊' }).click()
    await expect(page.locator('.roster-page')).toBeVisible()
    await expect(page.locator('.roster-table')).toBeVisible()
  })

  test('FLOW-12 課程庫：切換分頁', async ({ page }) => {
    await page.locator('.app-nav-btn', { hasText: '課程庫' }).click()
    await expect(page.locator('h1')).toBeVisible()
  })

  test('FLOW-13 PDF 阻擋：空課程學生點 PDF 應彈 alert', async ({ page }) => {
    await page.getByText('進入本專案：管理學生與收費').click()
    await page.locator('.add-student-input').fill('空課學生')
    await page.locator('.btn-add-student').click()
    await expect(page.locator('.student-title')).toContainText('空課學生')
    let alerted = false
    page.on('dialog', d => { alerted = true; d.accept() })
    await page.locator('.pdf-btn').click()
    await page.waitForTimeout(300)
    expect(alerted).toBe(true)
  })

  test('FLOW-14 名冊：新增學生到名冊', async ({ page }) => {
    await page.locator('.app-nav-btn', { hasText: '學生名冊' }).click()
    const before = await page.locator('.roster-table tbody tr').count()
    await page.locator('.roster-add-input').fill('名冊測試生')
    await page.locator('.btn-roster-add').click()
    expect(await page.locator('.roster-table tbody tr').count()).toBe(before + 1)
  })

})
