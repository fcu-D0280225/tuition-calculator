# TODOS — 安親班模組（care-module）

計劃檔案：`care-module.plan.md`（已完成 /autoplan 四階段審查，已核准）

---

## P1 實作待辦（依順序）

### Step 0 — 前置基礎建設

- [ ] 安裝 `express-rate-limit`
  ```bash
  npm install express-rate-limit
  ```
- [ ] 在 `server/index.js` 掛載 `/api/care/parent/*` rate limiter（10 req/min per IP）
- [ ] 建立 `server/routes/care.js`（express.Router 骨架）
- [ ] 在 `server/index.js` 掛載：`app.use('/api/care', requireAuth(), careRouter)`
  - 注意：`/api/care/parent/*` 在 router 內部繞過 requireAuth
- [ ] 建立 `server/__tests__/care.test.js`（空白骨架）

### Step 1 — DB Schema（P1 的 3 張表 + 欄位）

- [ ] `tenants` 補 `type ENUM('tuition','care','both') DEFAULT 'both'`
- [ ] `students` 補 `care_class VARCHAR(64) DEFAULT ''`
- [ ] `students` 補 `care_enrolled TINYINT(1) NOT NULL DEFAULT 0`
- [ ] 新建 `care_share_tokens` 表（**不重用** share_tokens，獨立 token namespace）
  - 欄位：id, tenant_id, token, student_id, expires_at, created_at
- [ ] 新建 `care_attendance` 表
  - UNIQUE KEY(tenant_id, student_id, attend_date)
  - POST 路由必須用 UPSERT（ON DUPLICATE KEY UPDATE）
- [ ] 新建 `care_logs` 表（每日聯絡簿）
- [ ] 新建 `care_leave_requests` 表
  - UNIQUE KEY(tenant_id, student_id, leave_date)
  - 補 `reject_reason VARCHAR(255) DEFAULT ''` 欄位
- [ ] 把 P2 表的 DDL 寫進 `schema-care-p2.sql`（不執行，僅存檔備用）

### Step 2 — 後端 API（全在 server/routes/care.js）

老師端（需 auth）：
- [ ] `GET  /api/care/attendance` — 某日出席清單（filter by care_enrolled=1）
- [ ] `POST /api/care/attendance` — 簽到/簽退 UPSERT
- [ ] `GET  /api/care/logs` — 聯絡簿列表
- [ ] `POST /api/care/logs` — 新增聯絡簿
- [ ] `PUT  /api/care/logs/:id` — 更新聯絡簿
- [ ] `GET  /api/care/leave-requests` — 請假申請列表（pending 優先）
- [ ] `POST /api/care/leave-requests/:id/approve` — 審核通過
- [ ] `POST /api/care/leave-requests/:id/reject` — 拒絕（需帶 reject_reason）
- [ ] `GET  /api/care/tokens/:studentId` — 產生/取得家長 QR token

家長端（不需 auth，rate-limited）：
- [ ] `GET  /api/care/parent/:token` — 學生資料 + 今日聯絡簿 + 近期請假記錄
  - token lookup 永遠回 404（不區分 not-found vs expired，防列舉）
  - 所有 query 必須同時過濾 tenant_id 和 student_id（從 token row 取，不信任 body）
- [ ] `POST /api/care/parent/:token/leave` — 提交請假
  - 重複申請 → ER_DUP_ENTRY → 409 `{ error: "leave_already_requested" }`

補測試（`server/__tests__/care.test.js`）：
- [ ] TC-001：雙重請假 → 409
- [ ] TC-002：出席 UPSERT 同日兩次都成功
- [ ] TC-003：過期 token → 404
- [ ] TC-004：tenant 隔離（token 屬於 tenant 1 不能取 tenant 2 資料）
- [ ] TC-005：家長正常提交請假 → 201

### Step 3 — 前端安親班 module

- [ ] `src/App.jsx` 加頂層 `[補習班] [安親班]` tab，點安親班進 `/care`
- [ ] 新建 `src/pages/care/` 目錄
- [ ] `CareDashboard.jsx` — 今日總覽
  - 今日未到學生名單（紅色警示）
  - 待審核請假數量 badge
  - 聯絡簿未填學生數量 progress
- [ ] `CareAttendancePage.jsx` — 兩個 tab
  - Tab 1「點名」：日期 picker + 學生列表（只顯示 care_enrolled=1），每人三態按鈕
  - Tab 2「請假管理」：pending 列表，approve/reject（需填 reject_reason）
- [ ] `CareLogsPage.jsx` — 聯絡簿每日每生填寫
- [ ] `ParentPortalPage.jsx` — `/care/parent/:token`
  - **獨立 layout**，不繼承主 nav / sidebar
  - Mobile-first
  - 區塊：學生姓名/班級 → 今日聯絡簿（empty state：「老師今天還沒填寫」）→ 請假申請表（預設明天）→ 近期請假紀錄
  - Error state：token 無效 → 「連結已失效，請聯絡老師取得新 QR code」

---

## P2 延後項目（P1 驗證後再做）

- [ ] 通知單（care_notices）
- [ ] 成長記錄（care_growth）
- [ ] 體溫紀錄（care_temperature）
- [ ] 託藥單（care_medications）
- [ ] 評估 Line 推送整合（取代無後台訊息功能）
- [ ] 家長帳號系統（目前 share token 無需帳號）

---

## 重要技術提醒

1. **`share_tokens` ≠ `care_share_tokens`** — 兩個表完全獨立，token 不共用 namespace
2. **`groups` 是 MySQL 保留字** — 所有 query 要加反引號
3. **SSH tunnel** — 連 DB 前確認 port 3306 tunnel 已開
4. **UPSERT 語法** — `INSERT INTO care_attendance (...) VALUES (...) ON DUPLICATE KEY UPDATE checkout_at = VALUES(checkout_at), status = VALUES(status)`
5. **家長端 tenant 隔離** — 所有 `/api/care/parent/:token` 的 query 必須用從 `care_share_tokens` 取出的 `tenant_id` 和 `student_id`，不能信任 request body 的值

---

## 參考文件

- 計劃：`care-module.plan.md`（含完整 Decision Audit Trail 14 筆）
- 測試計劃：`~/.gstack/projects/fcu-D0280225-tuition-calculator/jacksonlin-main-test-plan-*.md`
- DB Schema：`schema.sql`（現有）、`schema-care-p2.sql`（待建立，P2 用）
