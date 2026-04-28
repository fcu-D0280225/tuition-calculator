# 補習班管理系統

以上課紀錄為核心的補習班管理工具，支援學費 / 薪資結算與 PDF 匯出。

---

## 功能總覽

| 模組 | 說明 |
|------|------|
| **學生管理** | 新增、編輯、刪除學生 |
| **老師管理** | 新增、編輯、刪除老師 |
| **課程管理** | 新增課程並設定每小時單價（鐘點費） |
| **上課紀錄** | 登打每堂課（學生 / 老師 / 課程 / 時數 / 日期），支援單堂覆寫單價 |
| **教材管理** | 建立教材品項並設定單價 |
| **教材紀錄** | 記錄學生領取教材的筆數與日期 |
| **團課管理** | 建立團課（上課星期 / 持續時間 / 月費），登打出席紀錄 |
| **結算** | 依日期區間計算學費（課程 + 團課 + 教材）與老師薪資，支援 PDF 匯出 |

---

## 計費邏輯

### 學費（學生帳單）

收費單顯示三色行：

| 顏色 | 項目 | 計算方式 |
|------|------|----------|
| 白底 | 家教課 | 總時數 × 課程單價（可單堂覆寫） |
| 綠底 | 團課 | 出席月份數 × 月費 |
| 黃底 | 教材 | 數量 × 單價 |

> 範例：結算區間跨 2 個月、月費 3,000，則收 6,000。只上團課沒有家教課的學生也會出現在帳單。

### 薪資（老師帳單）

總時數 × 鐘點費，依課程分行顯示。

---

## 技術棧

- **前端**：React 19 + Vite 8
- **後端**：Express 5 + Node.js
- **資料庫**：MySQL 8（`mysql2/promise`）
- **PDF**：html2canvas + jsPDF 4 + jspdf-autotable
- **測試**：Playwright（E2E）+ Vitest + Testing Library

---

## 快速開始

### 環境需求

- Node.js 18+
- MySQL 8.x

### 安裝

```bash
npm install
```

### 資料庫設定

預設連線設定（可用環境變數覆蓋）：

```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=user
MYSQL_PASSWORD=!Sqluser2026
MYSQL_DATABASE=tuition_calculator
PORT=3100
```

建立資料庫與使用者（執行一次）：

```sql
CREATE DATABASE tuition_calculator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'user'@'localhost' IDENTIFIED BY '!Sqluser2026';
GRANT ALL PRIVILEGES ON tuition_calculator.* TO 'user'@'localhost';
FLUSH PRIVILEGES;
```

Schema 會在第一次啟動 server 時自動建立（`initSchema()`），無需手動執行 SQL。

### 啟動開發環境

**一鍵啟動（推薦）：**

```bash
./start-dev.sh
```

此腳本會依序：
1. 檢查 Node / npm / node_modules
2. 啟動後端（port 3100），等待 `/api/health` 就緒
3. 啟動前端 Vite（port 5173）

**個別啟動：**

```bash
# 後端（watch 模式，檔案變更自動重啟）
npm run server:dev

# 前端
npm run dev
```

開啟瀏覽器：`http://localhost:5173`

### 種子資料（選填）

```bash
npm run seed
# 寫入初始學生名冊，已有資料則跳過
```

---

## 操作流程

### 基本設定（第一次使用）

1. **人員** → 新增老師
2. **人員** → 新增學生
3. **課程** → 新增課程並填入每小時費用
4. （選填）**教材** → 新增教材品項並填入單價
5. （選填）**團課** → 新增團課並填入月費

### 日常記錄

- **課程 → 上課紀錄**：選擇學生 / 老師 / 課程，填入時數與日期
- **教材 → 教材紀錄**：選擇學生、教材品項與數量
- **團課 → 上課紀錄**：選擇團課與出席學生（可複選），填入日期

### 每期結算

1. 前往 **結算** 頁面
2. 選擇起始與結束日期
3. 點「產生報表」
4. 學費報表：可下載整份 PDF，或點單一學生的「PDF」按鈕下載個人費單
5. 薪資報表：可下載整份 PDF，或點單一老師的「PDF」按鈕

---

## 資料庫 Schema

| Table | 用途 |
|-------|------|
| `students` | 學生基本資料 |
| `teachers` | 老師基本資料 |
| `courses` | 課程（含時薪 `hourly_rate`） |
| `lesson_records` | 每堂上課紀錄（可覆寫單價 `unit_price`） |
| `materials` | 教材品項（含單價 `unit_price`） |
| `material_records` | 學生領取教材紀錄 |
| `groups` | 團課（含月費 `monthly_fee`、上課星期、持續時間） |
| `group_records` | 團課出席紀錄 |

Schema 定義與 migration 邏輯位於 `server/db.js`，使用 `information_schema.COLUMNS` 做欄位檢查，安全支援舊資料庫升級。

---

## 關鍵檔案

```
tuition-calculator/
├── server/
│   ├── db.js          # MySQL 連線、Schema、所有 CRUD + settlementTuition/Salary
│   ├── index.js       # Express 路由
│   └── seed.js        # 種子資料
├── src/
│   ├── data/api.js    # 前端 API client
│   ├── contexts/      # React Context（Students / Teachers / Groups / Materials）
│   ├── pages/
│   │   ├── StudentsPage.jsx
│   │   ├── TeachersPage.jsx
│   │   ├── CoursesPage.jsx
│   │   ├── LessonRecordsPage.jsx
│   │   ├── MaterialsPage.jsx
│   │   ├── GroupsPage.jsx
│   │   └── SettlementPage.jsx
│   └── utils/pdf.js   # PDF 產生（html2canvas + jsPDF）
├── e2e/               # Playwright E2E 測試
├── start-dev.sh       # 一鍵開發啟動腳本
├── check-env.sh       # 環境檢查腳本
└── vite.config.js     # Vite 設定（含 /api proxy）
```

---

## Port 一覽

| 服務 | Port |
|------|------|
| 前端 Vite dev | 5173 |
| 前端 Vite preview | 4173 |
| 後端 Express | 3100 |
| MySQL | 3306 |

---

## 測試

```bash
# Unit / Integration（Vitest）
npm run test
npm run test:watch

# E2E（Playwright，需先啟動開發環境）
./start-dev.sh &
npx playwright test
```
