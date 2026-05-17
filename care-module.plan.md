<!-- /autoplan restore point: /Users/jacksonlin/.gstack/projects/fcu-D0280225-tuition-calculator/main-autoplan-restore-20260517-194746.md -->
# 安親班功能模組計劃

---

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|---------|
| 1 | CEO | 家長 Portal 移至 P1（share_token QR code，唯讀+請假） | Taste→confirmed | P1 completeness | 老師填聯絡簿但家長看不到 → 老師不持續使用 → 整個模組失敗 | P2 deferral |
| 2 | CEO | P1 範疇縮減為 3 個功能 MVP（點名+聯絡簿+家長請假） | Taste→confirmed | P3 pragmatic | 3 功能打通閉環可在 2-3 週驗證，8 功能同步開發需 4 個月 | 8 功能全做 |
| 3 | CEO | 相簿功能不做 | User decision | User says skip | 使用者明確決定不實作相簿 | VPS 本地/S3 |
| 4 | Design | 安親班用獨立 `/care/*` 路由 + 頂層 tab 切換 | User decision | Explicit choice | 補習班和安親班完全分開，不混用 sidebar | 併入現有 sidebar |
| 5 | Design | 家長 QR 頁為獨立路由 `/care/parent/:token`，mobile-first，不繼承主 nav | Auto | P5 explicit | 家長用手機掃 QR code，需獨立 shell，不帶 sidebar | 沿用桌面 layout |
| 6 | Design | care_leave_requests 補 reject_reason 欄位 | Auto | P1 completeness | reject 時家長需要知道原因，否則是黑盒 | 不加 |
| 7 | Design | `/care` 預設頁為今日總覽（點名狀態 + 待審請假 badge + 聯絡簿進度）| Auto | P5 explicit | 老師每天進來要立即看到今日需要做什麼 | 直接進點名頁 |
| 8 | Eng | 建立獨立 `care_share_tokens` 表（不重用 `share_tokens`） | Auto | P1 completeness | 現有 share_tokens 有強制 period_from/period_to 欄位，語意不符；且 token namespace 混用會有跨域資料洩漏風險 | 重用 share_tokens |
| 9 | Eng | 家長 Portal API 加 express-rate-limit（10 req/min per IP） | Auto | P1 completeness | `/api/care/parent/*` 為未驗證端點，無 rate limit 可被濫用 | 不加 |
| 10 | Eng | care_leave_requests 加 UNIQUE KEY(tenant_id, student_id, leave_date) | Auto | P1 completeness | 防止家長雙重提交產生幽靈 pending 行 | 不加 |
| 11 | Eng | care_attendance POST 用 UPSERT（ON DUPLICATE KEY UPDATE） | Auto | P5 explicit | 同日簽到後再更新簽退時間，plain INSERT 會 ER_DUP_ENTRY → 500 | plain INSERT |
| 12 | Eng | care routes 抽成 server/routes/care.js (express.Router) | Auto | P5 explicit | index.js 已 1025 行，繼續 inline 會不可維護 | inline routes |
| 13 | Eng | P1 只建 3 張 care_* 表；P2 表寫入 schema-care-p2.sql 但不執行 | Auto | P3 pragmatic | 相簿表的 storage_path 設計在 P2 範疇未確定，現在建可能需要 migration 修改 | 8 表全建 |
| 14 | Eng | Phase 3.5 DX Review 跳過 | Auto | — | 此系統為補習班內部 SaaS，非 developer-facing 產品；DX 關鍵詞為誤判 | run DX review |

---

## 目標

在現有的 `tuition-calculator` 補習班管理系統上，新增「安親班」（課後照顧）功能模組，功能對標 GuGu 顧顧平台。透過 URL 路由的方式，在同一套服務同時支援「補習班」和「安親班」，並保留各自的介面與資料範疇。

---

## 背景

- **現有系統**：補習班管理系統（家教課、團課、點名、薪資結算、財務）
- **技術棧**：React + Vite（前端）、Node.js + Express（後端）、MySQL（multi-tenant）
- **多租戶架構**：所有表都有 `tenant_id`，目前只有一個 tenant

---

## 安親班核心功能

### 功能清單（調整後）

**P1 MVP（本次實作）：**
1. **出席管理** — 每日到離校記錄（簽到/簽退）
2. **聯絡簿** — 每日老師填寫；家長透過 share QR code 唯讀查看
3. **家長請假** — 家長透過 share QR code 提交請假申請，老師端審核

**家長入口（P1 同步）：**
- 每位安親班學生產生一個 QR code（延伸現有 share_tokens 機制）
- 掃描後不需登入，可查看：本週聯絡簿、請假記錄
- 可提交：請假申請

**P2 後續（驗證後再做）：**
- 通知單、成長管理、體溫紀錄、託藥單
- 親師溝通（評估 Line 推送 vs 系統內訊息）

**不做：**
- 相簿（使用者決定跳過）

---

## 技術方案

### 方案一：同服務 URL 路由（推薦）

前端路由：
- `/tuition/*` → 現有補習班功能（或維持現狀路徑）
- `/care/*` → 安親班功能

後端 API：
- `/api/tuition/*` → 現有 API
- `/api/care/*` → 新增 API（聯絡簿、出席、通知等）

租戶類型：
- `tenants.type` 新增 `ENUM('tuition', 'care', 'both')`（預設 `both`）
- 前端依 `tenant.type` 決定顯示哪些功能

### 方案二：分開部署

- 安親班作為獨立 Vite app（monorepo）
- 共用 DB 但獨立 server
- 維護成本較高，暫不考慮

---

## DB Schema（新增表）

```sql
-- 安親班學生擴充（補充現有 students 表）
ALTER TABLE students ADD COLUMN care_class VARCHAR(64) DEFAULT '' AFTER grade;
ALTER TABLE students ADD COLUMN care_enrolled TINYINT(1) NOT NULL DEFAULT 0 AFTER care_class;

-- 聯絡簿
CREATE TABLE care_logs (
  id           VARCHAR(64) NOT NULL,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  student_id   VARCHAR(64) NOT NULL,
  log_date     DATE NOT NULL,
  teacher_note TEXT,
  parent_note  TEXT,
  teacher_confirmed_at DATETIME,
  parent_confirmed_at  DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_logs_student_date (student_id, log_date),
  INDEX idx_care_logs_tenant (tenant_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 出席紀錄（安親班）
CREATE TABLE care_attendance (
  id           VARCHAR(64) NOT NULL,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  student_id   VARCHAR(64) NOT NULL,
  attend_date  DATE NOT NULL,
  checkin_at   DATETIME,
  checkout_at  DATETIME,
  status       ENUM('present','absent','leave_approved') NOT NULL DEFAULT 'present',
  note         VARCHAR(255) DEFAULT '',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_care_attend (tenant_id, student_id, attend_date),
  INDEX idx_care_attendance_tenant_date (tenant_id, attend_date)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 家長請假申請
CREATE TABLE care_leave_requests (
  id           VARCHAR(64) NOT NULL,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  student_id   VARCHAR(64) NOT NULL,
  leave_date   DATE NOT NULL,
  reason       VARCHAR(255) DEFAULT '',
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_leave_tenant_date (tenant_id, leave_date)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 通知單
CREATE TABLE care_notices (
  id           VARCHAR(64) NOT NULL,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  title        VARCHAR(255) NOT NULL,
  content      TEXT NOT NULL,
  target       ENUM('all','class') NOT NULL DEFAULT 'all',
  target_class VARCHAR(64) DEFAULT '',
  published_at DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_notices_tenant (tenant_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 成長記錄
CREATE TABLE care_growth (
  id           VARCHAR(64) NOT NULL,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  student_id   VARCHAR(64) NOT NULL,
  record_date  DATE NOT NULL,
  category     VARCHAR(64) NOT NULL DEFAULT 'general',  -- learning / behavior / social / general
  content      TEXT NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_growth_student (student_id, record_date)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 體溫紀錄
CREATE TABLE care_temperature (
  id           VARCHAR(64) NOT NULL,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  student_id   VARCHAR(64) NOT NULL,
  measured_at  DATETIME NOT NULL,
  temperature  DECIMAL(4,1) NOT NULL,
  session      ENUM('morning','noon','afternoon') NOT NULL DEFAULT 'morning',
  note         VARCHAR(255) DEFAULT '',
  PRIMARY KEY (id),
  INDEX idx_care_temp_student (student_id, measured_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 託藥單
CREATE TABLE care_medications (
  id            VARCHAR(64) NOT NULL,
  tenant_id     INT UNSIGNED NOT NULL DEFAULT 1,
  student_id    VARCHAR(64) NOT NULL,
  med_date      DATE NOT NULL,
  drug_name     VARCHAR(255) NOT NULL,
  dosage        VARCHAR(128) NOT NULL,
  times_per_day INT NOT NULL DEFAULT 1,
  note          VARCHAR(255) DEFAULT '',
  given_at      DATETIME,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_med_student_date (student_id, med_date)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 相簿
CREATE TABLE care_albums (
  id           VARCHAR(64) NOT NULL,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  title        VARCHAR(255) NOT NULL,
  album_date   DATE,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_albums_tenant (tenant_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE care_photos (
  id           VARCHAR(64) NOT NULL,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  album_id     VARCHAR(64) NOT NULL,
  filename     VARCHAR(255) NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  caption      VARCHAR(255) DEFAULT '',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_photos_album (album_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 前端頁面規劃

### 新增安親班 pages

- `src/pages/care/CareAttendancePage.jsx` — 出席管理（含請假管理）
- `src/pages/care/CareLogsPage.jsx` — 聯絡簿（每日、每生）
- `src/pages/care/CareNoticesPage.jsx` — 通知單
- `src/pages/care/CareGrowthPage.jsx` — 成長記錄
- `src/pages/care/CareTemperaturePage.jsx` — 體溫紀錄
- `src/pages/care/CareMedicationsPage.jsx` — 託藥單
- `src/pages/care/CareAlbumsPage.jsx` — 相簿

### 路由方式（確認）

**老師端：** 頂層 tab 切換，完全獨立 URL
- `[補習班]` → 現有功能（不動）
- `[安親班]` → `/care/*`，獨立 sidebar（今日總覽 / 出席管理 / 聯絡簿 / 請假管理）

**家長端（P1 同步）：**
- `/care/parent/:token` — 獨立 shell，mobile-first，無主 nav
- 顯示：學生姓名 + 今日聯絡簿 + 請假申請表 + 近期請假記錄

### 老師端安親班頁面（P1）

- [P1] `src/pages/care/CareDashboard.jsx` — 今日總覽（點名狀態 + 待審請假 + 聯絡簿進度）
- [P1] `src/pages/care/CareAttendancePage.jsx` — 出席管理（點名 tab）+ 請假審核 tab
- [P1] `src/pages/care/CareLogsPage.jsx` — 聯絡簿（每日、每生填寫）

### 家長端（P1 同步）

- [P1] `src/pages/care/ParentPortalPage.jsx` — `/care/parent/:token`，mobile-first

### P2 頁面（驗證後再做）

- [P2] `src/pages/care/CareNoticesPage.jsx` — 通知單
- [P2] `src/pages/care/CareGrowthPage.jsx` — 成長記錄
- [P2] `src/pages/care/CareTemperaturePage.jsx` — 體溫紀錄
- [P2] `src/pages/care/CareMedicationsPage.jsx` — 託藥單

---

## 後端 API 規劃

新增路由群組 `server/routes/care.js`：

```
GET/POST   /api/care/attendance           出席清單、新增出席
POST       /api/care/attendance/leave     家長請假申請
GET/POST   /api/care/logs                 聯絡簿
GET/POST   /api/care/notices              通知單
GET/POST   /api/care/growth               成長記錄
GET/POST   /api/care/temperature          體溫紀錄
GET/POST   /api/care/medications          託藥單
GET/POST   /api/care/albums               相簿（含上傳）
```

---

## 家長 Portal（未來）

目前系統無家長登入。安親班首要場景需要家長：
- 提交請假
- 查看聯絡簿、通知單
- 確認聯絡簿

建議分兩階段：
1. **P1（本次）**：老師端完整功能
2. **P2（下一步）**：家長端（透過 share token 或獨立登入）

---

## 分段實作計劃（更新後）

### Step 0 — 前置基礎建設（不含業務邏輯）
- 安裝 `express-rate-limit` 並在 `server/index.js` 掛載 `/api/care/parent/*` limiter
- 建立 `server/routes/care.js`（express.Router），在 `index.js` 用 `app.use('/api/care', requireAuth(), careRouter)` 掛載
- 建立 `server/__tests__/care.test.js`（空白骨架，後續補內容）

### Step 1 — P1 Schema（3 張表）
- `tenants` 補 `type ENUM('tuition','care','both') DEFAULT 'both'`
- `students` 補 `care_class VARCHAR(64)`、`care_enrolled TINYINT(1) DEFAULT 0`
- 新增 `care_share_tokens`（獨立 token 表，不重用 share_tokens）
- 新增 `care_attendance`（含 UNIQUE KEY + UPSERT 語意記錄）
- 新增 `care_logs`
- 新增 `care_leave_requests`（含 UNIQUE KEY on tenant_id+student_id+leave_date + reject_reason 欄位）
- P2 表寫入 `schema-care-p2.sql`（不執行）

### Step 2 — 後端 API（care routes，全在 server/routes/care.js）
- `GET /api/care/attendance` — 某日出席清單
- `POST /api/care/attendance` — 簽到/簽退（UPSERT）
- `GET /api/care/logs` — 聯絡簿列表
- `POST/PUT /api/care/logs` — 填寫/更新聯絡簿
- `GET /api/care/leave-requests` — 請假申請列表
- `POST /api/care/leave-requests/:id/approve|reject` — 審核
- `GET /api/care/tokens/:studentId` — 產生家長 QR token（care_share_tokens）
- 家長 Portal（不需 auth）：`GET /api/care/parent/:token` — 學生資料+今日聯絡簿
- 家長 Portal：`POST /api/care/parent/:token/leave` — 提交請假

補測試：`server/__tests__/care.test.js` 5 個案例（雙重請假409、出席 upsert、token 過期404、tenant 隔離、家長 POST 正常流程）

### Step 3 — 前端安親班 module
- `src/App.jsx` 加頂層 `[補習班] [安親班]` tab 切換，點安親班進 `/care`
- `CareDashboard.jsx` — 今日總覽
- `CareAttendancePage.jsx` — 點名 tab + 請假審核 tab
- `CareLogsPage.jsx` — 聯絡簿（每生每日）
- `ParentPortalPage.jsx` — `/care/parent/:token`，mobile-first，獨立 layout

### Step 4 — P2（驗證後再做）
- 通知單、成長記錄、體溫、託藥（需先確認 Step 3 使用率後才做）

---

## 架構圖（Phase 3 Eng 輸出）

```
現有系統                        新增（P1）
────────────────────────────    ──────────────────────────────────────────
  React (Vite)                    React (Vite) — 新增
  ├── /[現有補習班路由]              ├── /care/* (獨立 sidebar)
  │   ├── DashboardPage               │   ├── CareDashboard
  │   ├── StudentsPage                │   ├── CareAttendancePage
  │   └── ...                         │   ├── CareLogsPage
  │                                   │   └── /care/parent/:token [mobile-first]
  Express (index.js 1025行)       Express
  ├── /api/students               ├── server/routes/care.js (Express Router) ← 新
  ├── /api/teachers               │   ├── GET  /api/care/attendance
  ├── /api/courses                │   ├── POST /api/care/attendance (UPSERT)
  ├── /api/share/:token           │   ├── GET/POST /api/care/logs
  └── ...                         │   ├── GET/POST /api/care/leave-requests
                                  │   ├── POST /api/care/leave-requests/:id/approve|reject
  MySQL                           │   ├── GET /api/care/tokens/:studentId
  ├── tenants (+type)             │   └── /api/care/parent/:token (rate-limited, no auth)
  ├── students (+care_enrolled)   │
  ├── share_tokens (現有)         MySQL — 新增
  └── ...                         ├── care_share_tokens (獨立，≠ share_tokens)
                                  ├── care_attendance (UNIQUE: tenant+student+date)
  Auth middleware                 ├── care_logs
  └── requireAuth()               └── care_leave_requests (UNIQUE: tenant+student+date)
                                       + reject_reason
  Rate limiting                   Rate limiting — 新增
  └── (無)                        └── careParentLimiter → /api/care/parent/*
```

**Coupling 分析：**
- `care_share_tokens` 完全獨立於 `share_tokens`，不共用 token namespace ✓
- `/care/*` 前端不繼承補習班 sidebar，獨立 nav ✓
- `server/routes/care.js` 用 Router 掛載，不污染 index.js ✓
- `requireAuth()` middleware 套用到 `/api/care/*`，但 `/api/care/parent/*` 在 router 內部繞過 ✓

## 開放問題

1. 安親班和補習班共用學生資料，還是分開？（目前計劃：共用 students 表，加 care_enrolled flag）
2. 照片存哪？本地磁碟 or S3？（目前：本地 `uploads/` 目錄，VPS 儲存）
3. 家長 Portal 用 share token（現有機制）還是獨立帳號？
