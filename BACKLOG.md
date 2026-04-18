# Backlog

## Auth / 登入

目前後端 `/api/*` 無任何認證，任何能打到 VPS 3100 或經由 Vite proxy 的人都能改名冊。

- [ ] 後端加簡易登入（帳密 / session cookie，參考 surf-forecast `src/auth.js`）
- [ ] `/api/students` 加 `requireAuth` 中介層
- [ ] 前端加登入頁與登出按鈕
- [ ] `students` table 視需要加 `owner_id`（若未來多老師共用同一台 VPS 才需要）

## 資料持久化擴充

目前只有 `students` 在 DB；月份專案（收費明細）與課程庫仍在瀏覽器 localStorage。

- [ ] `month_projects` table：把各期學費單從 localStorage 搬到 DB
- [ ] `course_catalog` table：把課程庫搬到 DB
- [ ] 匯出 / 備份端點（JSON dump）

## 其他

- [ ] E2E 測試更新：首次載入不再自動帶入 100+ 位學生，`flow.spec.js` 多數案例需要先從名冊帶人進專案後才能測課程流程
