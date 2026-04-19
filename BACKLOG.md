# Backlog

## 資料持久化擴充

目前只有 `students` 在 DB；月份專案（收費明細）與課程庫仍在瀏覽器 localStorage。

- [ ] `month_projects` table：把各期學費單從 localStorage 搬到 DB
- [ ] `course_catalog` table：把課程庫搬到 DB
- [ ] 匯出 / 備份端點（JSON dump）

## 其他

- [ ] E2E 測試更新：首次載入不再自動帶入 100+ 位學生，`flow.spec.js` 多數案例需要先從名冊帶人進專案後才能測課程流程
