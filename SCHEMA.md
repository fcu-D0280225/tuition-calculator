# Tuition Calculator — 資料庫 Schema 與建置指南

家教學費 / 教師薪資試算系統，Vite + React 前端 + Express + MySQL 後端。

---

## 一、資料庫 Schema

- **資料庫**：MySQL 8.x（透過 `mysql2/promise`）
- **字元集**：`utf8mb4` / `utf8mb4_unicode_ci`（支援繁體中文）
- **PK 規則**：`VARCHAR(64)`，前端 / 後端產生的 UUID / nanoid
- **預設 database 名稱**：`tuition_calculator`
- **初始化兩種方式**（擇一即可）：
  - 直接灌 SQL：`mysql -u root -p tuition_calculator < schema.sql`
  - 啟動後端時自動建表：`server/db.js` 的 `initSchema()` 在 `npm run server` 啟動時執行（含遷移）

> 完整 DDL 請見專案根目錄的 [`schema.sql`](./schema.sql)。

### 多租戶（FEAT-012）

- `tenants` 為主表（INT UNSIGNED AUTO_INCREMENT），新環境預設建立 `id=1`「預設補習班」
- 所有領域表（students / teachers / courses / ...）與 `auth_users` / `auth_groups` 均帶 `tenant_id INT UNSIGNED NOT NULL DEFAULT 1` 欄位、`idx_<table>_tenant` 索引與 `fk_<table>_tenant` FK（ON DELETE RESTRICT）
- `auth_users.username` / `auth_groups.name` 的 UNIQUE 已改為 `(tenant_id, username)` / `(tenant_id, name)` 複合 UNIQUE
- `tenant_invites` 表存放邀請 token（後續 step 啟用邏輯）
- **Step 1 階段**：schema 已就緒、所有既有資料 backfill `tenant_id=1`，但 query 層尚未加 tenant filter，行為與單租戶等價

### Table 總覽

| # | Table | 用途 |
|---|-------|------|
| 0 | `tenants` | 租戶主表 |
| 1 | `students` | 學生（含聯絡人 / 軟停用） |
| 2 | `teachers` | 教師（含電話 / 軟停用） |
| 3 | `courses` | 家教課程（含時薪 / 老師時薪 / 折扣） |
| 4 | `lesson_records` | 上課紀錄（含點名狀態 / 改課） |
| 5 | `materials` | 教材主檔 |
| 6 | `material_records` | 教材銷售紀錄（價格 snapshot） |
| 7 | `groups` | 團體課（月費制） |
| 8 | `group_members` | 學生 ↔ 團課報名表 |
| 9 | `group_records` | 團課點名紀錄 |
| 10 | `misc_expenses` | 雜項支出（房租／水電／行銷／其他） |
| 11 | `student_courses` | 學生 ↔ 家教課報名表 |
| 12 | `period_locks` | 結算期間鎖（鎖定後不可動帳） |
| 13 | `share_tokens` | 家長分享連結 token |
| 14 | `payment_records` | 收款紀錄（每位學生每段期間最多一筆） |
| 15 | `leave_requests` | 請假紀錄（可綁定具體 lesson） |
| 16 | `tenant_invites` | 租戶邀請 token（FEAT-012 step 3 啟用） |

### 1. students
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | VARCHAR(64) PK | |
| name | VARCHAR(128) NOT NULL | |
| school | VARCHAR(128) DEFAULT '' | 就讀學校 |
| grade | VARCHAR(32) DEFAULT '' | 年級（自由文字，例：國一、高三、小六） |
| contact_name | VARCHAR(128) DEFAULT '' | 家長 / 聯絡人姓名 |
| contact_phone | VARCHAR(64) DEFAULT '' | 聯絡電話 |
| sort_order | INT DEFAULT 0 | 拖曳排序 |
| active | TINYINT(1) DEFAULT 1 | 軟停用旗標 |
| created_at / updated_at | DATETIME | |

索引：`idx_students_name`、`idx_students_active`

### 2. teachers
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | VARCHAR(64) PK | |
| name | VARCHAR(128) NOT NULL | |
| contact_phone | VARCHAR(64) DEFAULT '' | |
| sort_order | INT DEFAULT 0 | |
| active | TINYINT(1) DEFAULT 1 | 軟停用旗標 |
| created_at / updated_at | DATETIME | |

索引：`idx_teachers_name`、`idx_teachers_active`

### 3. courses（家教課程）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | VARCHAR(64) PK | |
| name | VARCHAR(128) NOT NULL | |
| hourly_rate | DECIMAL(10,2) DEFAULT 0 | 學費時薪 |
| teacher_hourly_rate | DECIMAL(10,2) DEFAULT 0 | 老師時薪（薪資結算用） |
| discount_per_student | DECIMAL(10,2) DEFAULT 0 | 多人折扣：每多一人 -X 元 |
| default_teacher_id | VARCHAR(64) FK SET NULL → teachers | 新增上課紀錄時自動帶入 |
| duration_hours | DECIMAL(4,2) DEFAULT 1 | 每堂課預設時數 |
| note | VARCHAR(256) DEFAULT '' | |
| sort_order | INT DEFAULT 0 | |
| created_at / updated_at | DATETIME | |

索引：`idx_courses_name`

### 4. lesson_records（上課紀錄）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | VARCHAR(64) PK | |
| student_id | VARCHAR(64) FK CASCADE → students | |
| course_id | VARCHAR(64) FK CASCADE → courses | |
| teacher_id | VARCHAR(64) FK SET NULL → teachers | 可為 NULL（未指派） |
| hours | DECIMAL(5,2) NOT NULL | |
| lesson_date | DATE NOT NULL | |
| start_time | TIME NULL | 課表顯示用 |
| unit_price | DECIMAL(10,2) NULL | 學費時薪 snapshot；NULL 表示沿用 courses.hourly_rate |
| teacher_unit_price | DECIMAL(10,2) NULL | 老師時薪 snapshot；NULL 表示沿用 courses.teacher_hourly_rate |
| note | VARCHAR(256) DEFAULT '' | |
| status | VARCHAR(16) DEFAULT 'attended' | `pending` / `attended` / `pre_enroll` |
| from_enroll_batch | TINYINT(1) DEFAULT 0 | 是否為「學生選課」批次建立；取消選課時只刪這類 |
| created_at / updated_at | DATETIME | |

索引：`idx_lesson_date`、`idx_lesson_student (student_id, lesson_date)`、`idx_lesson_teacher (teacher_id, lesson_date)`

### 5. materials
| 欄位 | 型別 |
|------|------|
| id | VARCHAR(64) PK |
| name | VARCHAR(128) NOT NULL |
| unit_price | DECIMAL(10,2) DEFAULT 0 |
| created_at / updated_at | DATETIME |

索引：`idx_materials_name`

### 6. material_records（教材銷售）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | VARCHAR(64) PK | |
| student_id | VARCHAR(64) FK CASCADE → students | |
| material_id | VARCHAR(64) FK CASCADE → materials | |
| quantity | DECIMAL(8,2) DEFAULT 1 | |
| unit_price | DECIMAL(10,2) NULL | 售出當下單價 snapshot |
| record_date | DATE NOT NULL | |
| note | VARCHAR(256) DEFAULT '' | |
| created_at / updated_at | DATETIME | |

索引：`idx_mr_date`、`idx_mr_student (student_id, record_date)`

### 7. groups（團體課）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | VARCHAR(64) PK | |
| name | VARCHAR(128) NOT NULL | |
| weekdays | VARCHAR(15) DEFAULT '' | 上課星期（例：`1,3,5`） |
| duration_months | TINYINT DEFAULT 0 | 課程長度（月） |
| monthly_fee | DECIMAL(10,2) DEFAULT 0 | 學生月費 |
| start_time | TIME NULL | 課表顯示用 |
| duration_hours | DECIMAL(4,2) DEFAULT 0 | 每堂時數 |
| teacher_hourly_rate | DECIMAL(10,2) DEFAULT 0 | 老師時薪（時薪型 + 月薪型代課用） |
| salary_type | ENUM('hourly','monthly') DEFAULT 'hourly' | 計薪方式：時薪／月薪 |
| monthly_salary | DECIMAL(10,2) DEFAULT 0 | 月薪（僅 salary_type='monthly' 時使用） |
| default_teacher_id | VARCHAR(64) FK SET NULL → teachers | |
| sort_order | INT DEFAULT 0 | |
| note | VARCHAR(256) DEFAULT '' | |
| created_at / updated_at | DATETIME | |

索引：`idx_groups_name`

> 注意：`groups` 是 MySQL 保留字，DDL / 查詢需以反引號 `` `groups` `` 包起。

### 8. group_members（團課報名）
| 欄位 | 型別 |
|------|------|
| group_id | VARCHAR(64) FK CASCADE → groups |
| student_id | VARCHAR(64) FK CASCADE → students |
| created_at | DATETIME |

PK：`(group_id, student_id)`；索引：`idx_gm_student`

### 9. group_records（團課點名）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | VARCHAR(64) PK | |
| group_id | VARCHAR(64) FK CASCADE → groups | |
| student_id | VARCHAR(64) FK CASCADE → students | |
| teacher_id | VARCHAR(64) FK SET NULL → teachers | |
| record_date | DATE NOT NULL | |
| note | VARCHAR(256) DEFAULT '' | |
| status | VARCHAR(16) DEFAULT 'attended' | 同 lesson_records.status |
| created_at / updated_at | DATETIME | |

索引：`idx_gr_date`、`idx_gr_group (group_id, record_date)`、`idx_gr_student (student_id, record_date)`、`idx_gr_teacher (teacher_id, record_date)`

### 10. misc_expenses（雜項支出）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | VARCHAR(64) PK | |
| name | VARCHAR(128) NOT NULL | |
| category | VARCHAR(32) DEFAULT '其他' | 房租／水電／行銷／其他 |
| amount | DECIMAL(10,2) DEFAULT 0 | |
| expense_date | DATE NOT NULL | |
| note | VARCHAR(256) DEFAULT '' | |
| created_at | DATETIME | |

索引：`idx_misc_date`、`idx_misc_category`

### 11. student_courses（學生 ↔ 家教課報名）
| 欄位 | 型別 |
|------|------|
| student_id | VARCHAR(64) FK CASCADE → students |
| course_id | VARCHAR(64) FK CASCADE → courses |
| created_at | DATETIME |

PK：`(student_id, course_id)`；索引：`idx_sc_course`

### 12. period_locks（結算期間鎖）
| 欄位 | 型別 |
|------|------|
| id | VARCHAR(64) PK |
| period_from / period_to | DATE NOT NULL |
| note | VARCHAR(256) DEFAULT '' |
| locked_at | DATETIME |

索引：`idx_lock_period (period_from, period_to)`

### 13. share_tokens（家長分享連結）
| 欄位 | 型別 |
|------|------|
| id | VARCHAR(64) PK |
| token | VARCHAR(64) UNIQUE |
| student_id | VARCHAR(64) FK CASCADE → students |
| period_from / period_to | DATE NOT NULL |
| expires_at | DATETIME NOT NULL |
| created_at | DATETIME |

索引：`idx_share_tokens_token`

### 14. payment_records（收款紀錄）
| 欄位 | 型別 |
|------|------|
| id | VARCHAR(64) PK |
| student_id | VARCHAR(64) FK CASCADE → students |
| period_from / period_to | DATE NOT NULL |
| paid_at | DATETIME DEFAULT CURRENT_TIMESTAMP |
| note | VARCHAR(256) DEFAULT '' |
| created_at / updated_at | DATETIME |

UNIQUE：`uk_payment (student_id, period_from, period_to)`；索引：`idx_payment_period`

### 15. leave_requests（請假）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | VARCHAR(64) PK | |
| student_id | VARCHAR(64) FK CASCADE → students | |
| course_id | VARCHAR(64) FK CASCADE → courses | |
| lesson_record_id | VARCHAR(64) FK CASCADE → lesson_records | 可 NULL；綁到具體 lesson |
| leave_date | DATE NOT NULL | |
| reason | VARCHAR(512) NOT NULL | |
| created_at | DATETIME | |

索引：`idx_leave_student (student_id, leave_date)`、`idx_leave_date`、`idx_leave_lesson`

### Seed
`server/seed.js` 會寫入初始學生名冊（約 100+ 位），若表已有資料則跳過：
```bash
npm run seed
```

---

## 二、建置與啟動

### 環境需求
- **Node.js**：18+ LTS
- **MySQL**：8.x
- **套件管理**：npm

### Port 一覽

| 服務 | Port | 說明 |
|------|------|------|
| 前端 Vite dev | 5173 | `npm run dev` |
| 前端 Vite preview | 4173 | `npm run preview` |
| 後端 Express | **3100** | `npm run server` |
| MySQL | 3306 | |

### 環境變數

```bash
# 後端連線 MySQL（server/db.js）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=user
MYSQL_PASSWORD=********
MYSQL_DATABASE=tuition_calculator

# 後端 Port
PORT=3100

# AI 助理（選填）
ANTHROPIC_API_KEY=sk-ant-...

# 前端 Vite proxy（vite.config.js）
VITE_API_TARGET=http://localhost:3100
```

> `MYSQL_USER` / `MYSQL_PASSWORD` 未設定時 server/db.js 會直接拋錯。其他變數有預設值。

前端所有 `/api/*` 呼叫會被 Vite 代理到 `VITE_API_TARGET`。

### 環境檢查

```bash
./check-env.sh
# 檢查 Node >= 18、npm、node_modules，可互動執行 npm install
```

### 安裝依賴

```bash
npm install
```

### 新環境部屬資料庫

```bash
# 1. 建 DB
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS tuition_calculator \
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

# 2. 套用 schema（兩種方式擇一）
mysql -u root -p tuition_calculator < schema.sql   # 方式 A：直接灌 SQL
npm run server                                      # 方式 B：啟動後端，initSchema() 自動建表

# 3. （選）灌種子學生名冊
npm run seed
```

### 開發模式

#### 一鍵啟動（推薦）
```bash
./start-dev.sh
# 1. 檢查 npm / node_modules
# 2. 啟動後端（port 3100）並等待 /api/health ready（timeout ~15s）
# 3. 啟動前端 Vite（port 5173）
```

#### 個別啟動
```bash
# 後端
npm run server         # 單次執行
npm run server:dev     # watch 模式（檔案變更自動重啟）

# 前端
npm run dev
```

### 正式建置

```bash
npm run build           # 輸出到 dist/
npm run preview         # 以 port 4173 預覽
npm start               # 後端 watch + 前端 dev 並行
```

### 測試

#### Unit / Integration（Vitest，jsdom）
```bash
npm run test
npm run test:watch
```
- Setup：`src/__tests__/setup.js`
- 排除：`**/node_modules/**`、`**/e2e/**`

#### E2E（Playwright）
```bash
# 先啟動開發環境
./start-dev.sh &

# 跑測試
npx playwright test
```
- Base URL：`http://localhost:5173`
- Config：`playwright.config.js`（headless、失敗截圖、15s timeout）
- 測試檔：`e2e/flow.spec.js`

---

## 三、前端 API Client

`src/data/api.js` 封裝（皆以 `/api` 為 prefix）：

| 模組 | 函式 |
|------|------|
| 學生 | `apiListStudents` / `apiCreateStudent` / `apiRenameStudent` / `apiDeleteStudent` |
| 教師 | `apiListTeachers` / `apiCreateTeacher` / `apiRenameTeacher` / `apiDeleteTeacher` |
| 課程 | `apiListCourses` / `apiCreateCourse` / `apiUpdateCourse` / `apiDeleteCourse` |
| 上課紀錄 | `apiListLessons` / `apiCreateLesson` / `apiUpdateLesson` / `apiDeleteLesson` |
| 結算 | `apiSettlementTuition` / `apiSettlementSalary` |

> 詳細端點以 `src/data/api.js` 與 `server/index.js` 為準。

---

## 四、關鍵檔案

| 用途 | 路徑 |
|------|------|
| 完整 Schema SQL（部屬用） | `schema.sql` |
| DB 連線 + initSchema + 全部 query | `server/db.js` |
| Express Server | `server/index.js` |
| Seed | `server/seed.js` |
| 前端 API Client | `src/data/api.js` |
| Vite Config | `vite.config.js` |
| Playwright Config | `playwright.config.js` |
| 一鍵開發腳本 | `start-dev.sh` |
| 環境檢查 | `check-env.sh` |
| E2E 測試 | `e2e/flow.spec.js` |
