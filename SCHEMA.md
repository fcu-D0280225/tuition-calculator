# Tuition Calculator — 資料庫 Schema 與建置指南

家教學費 / 教師薪資試算系統，Vite + React 前端 + Express + MySQL 後端。

---

## 一、資料庫 Schema

- **資料庫**：MySQL（透過 `mysql2/promise`）
- **字元集**：`utf8mb4`（支援繁體中文）
- **初始化**：`server/db.js` 內 `initSchema()`，啟動時執行
- **預設 database 名稱**：`tuition_calculator`

### Table 總覽

| # | Table | 用途 |
|---|-------|------|
| 1 | `students` | 學生 |
| 2 | `teachers` | 教師 |
| 3 | `courses` | 課程 |
| 4 | `student_course_prices` | 學生-課程單價 |
| 5 | `teacher_course_rates` | 教師-課程時薪 |
| 6 | `lesson_records` | 上課紀錄 |

所有 PK 採用 `VARCHAR(64)`（前端產生的 UUID / nanoid）。

### 1. students / teachers / courses（同結構）
| 欄位 | 型別 |
|------|------|
| id | VARCHAR(64) PK |
| name | VARCHAR(128) NOT NULL |
| created_at | DATETIME default CURRENT_TIMESTAMP |
| updated_at | DATETIME ON UPDATE CURRENT_TIMESTAMP |

索引：`idx_students_name` / `idx_teachers_name` / `idx_courses_name`（各表對應 `name`）

### 2. student_course_prices
| 欄位 | 型別 |
|------|------|
| id | VARCHAR(64) PK |
| student_id | VARCHAR(64) FK CASCADE → students |
| course_id | VARCHAR(64) FK CASCADE → courses |
| unit_price | DECIMAL(10,2) NOT NULL |
| created_at / updated_at | DATETIME |

UNIQUE `uq_student_course (student_id, course_id)`

### 3. teacher_course_rates
| 欄位 | 型別 |
|------|------|
| id | VARCHAR(64) PK |
| teacher_id | VARCHAR(64) FK CASCADE → teachers |
| course_id | VARCHAR(64) FK CASCADE → courses |
| hourly_rate | DECIMAL(10,2) NOT NULL |

UNIQUE `uq_teacher_course (teacher_id, course_id)`

### 4. lesson_records
| 欄位 | 型別 |
|------|------|
| id | VARCHAR(64) PK |
| student_id | VARCHAR(64) FK CASCADE |
| course_id | VARCHAR(64) FK CASCADE |
| teacher_id | VARCHAR(64) FK CASCADE |
| hours | DECIMAL(5,2) |
| lesson_date | DATE |
| note | VARCHAR(256) default '' |
| created_at / updated_at | DATETIME |

索引：
- `idx_lesson_date (lesson_date)`
- `idx_lesson_student (student_id, lesson_date)`
- `idx_lesson_teacher (teacher_id, lesson_date)`

### Seed
`server/seed.js` 會寫入初始學生名冊（約 100+ 位），若表已有資料則跳過。執行：
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
MYSQL_USER=app_user
MYSQL_PASSWORD=AppUser@2026!
MYSQL_DATABASE=tuition_calculator

# 後端 Port
PORT=3100

# 前端 Vite proxy（vite.config.js）
VITE_API_TARGET=http://localhost:3100
```

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

### 種子資料

```bash
npm run seed
```

### 正式建置

```bash
npm run build           # 輸出到 dist/
npm run preview         # 以 port 4173 預覽
npm start               # build 完接著跑 dev
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
- 測試檔：`e2e/flow.spec.js`（涵蓋 FLOW-01~14）

---

## 三、前端 API Client

`src/data/api.js` 封裝（皆以 `/api` 為 prefix）：

| 模組 | 函式 |
|------|------|
| 學生 | `apiListStudents` / `apiCreateStudent` / `apiRenameStudent` / `apiDeleteStudent` |
| 學生單價 | `apiListStudentPrices` / `apiSetStudentPrice` / `apiDeleteStudentPrice` |
| 教師 | `apiListTeachers` / `apiCreateTeacher` / `apiRenameTeacher` / `apiDeleteTeacher` |
| 教師時薪 | `apiListTeacherRates` / `apiSetTeacherRate` / `apiDeleteTeacherRate` |
| 課程 | `apiListCourses` / `apiCreateCourse` / `apiRenameCourse` / `apiDeleteCourse` |
| 上課紀錄 | `apiListLessons` / `apiCreateLesson` / `apiUpdateLesson` / `apiDeleteLesson` |
| 結算 | `apiSettlementTuition` / `apiSettlementSalary` |

---

## 四、關鍵檔案

| 用途 | 路徑 |
|------|------|
| DB 連線 + Schema | `server/db.js` |
| Express Server | `server/index.js` |
| Seed | `server/seed.js` |
| 前端 API Client | `src/data/api.js` |
| Vite Config | `vite.config.js` |
| Playwright Config | `playwright.config.js` |
| 一鍵開發腳本 | `start-dev.sh` |
| 環境檢查 | `check-env.sh` |
| E2E 測試 | `e2e/flow.spec.js` |
