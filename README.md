# 補習班管理系統

以上課紀錄與點名為核心的補習班管理工具，支援學費 / 薪資結算、PDF 匯出，並可安裝為 PWA 在手機主畫面快速點名。

---

## 功能總覽

| 模組 | 說明 |
|------|------|
| **老師管理** | 新增、編輯、刪除老師，設定聯絡電話 |
| **家教課管理** | 建立課程，設定學費（元/小時）、老師時薪、共學折扣、預設老師 |
| **團課管理** | 建立固定班級，設定月費、上課星期、持續時間、老師時薪 |
| **學生管理** | 新增學生後可設定「選課」，綁定該學生修習的家教課 |
| **家教課上課紀錄** | **上課前建立**課堂紀錄（學生 / 老師 / 課程 / 時數 / 日期），支援單堂覆寫費率 |
| **團課上課紀錄** | 以班級＋月份為單位查看、補登出席紀錄 |
| **點名** | 家教課點名 / 團課點名，支援請假標記；**學費與薪資均依點名結果計算** |
| **教材管理** | 建立教材品項（名稱 / 單價）並記錄學生領取紀錄 |
| **雜項支出** | 記錄房租、水電、行銷等營業費用，計入財務總覽 |
| **課表** | 以週為單位查看學生或老師的課表，可點課程申請請假 |
| **結算** | 依日期區間計算學費與老師薪資，支援 PDF 匯出與家長分享連結 |
| **財務總覽** | 損益報表：總收入 − 總支出 = 淨利，含各項柱狀圖 |
| **AI 助理** | 用自然語言詢問財務狀況、分析課堂備註、提出經營建議 |

---

## 計費邏輯

### 學費（學生帳單）

| 顏色 | 項目 | 計算依據 |
|------|------|----------|
| 白底 | 家教課 | 點名出席的堂數 × 時數 × 課程時薪（可單堂覆寫） |
| 綠底 | 團課 | 點名出席的月份數 × 月費 |
| 黃底 | 教材 | 領取數量 × 教材單價 |

> 學費計算以**點名記錄**為準。若未建立上課紀錄，點名頁面便無法顯示該課程，結算時也不會計入。

### 薪資（老師帳單）

各課程**有出席點名**的堂數 × 時數 × 老師時薪，依課程分行顯示。

### 多人共學折扣

若課程設定了「每多一人折扣 N 元」，系統依當天實際出席人數自動計算：
- 2 人共學：每人各減 N 元
- 3 人共學：每人各減 N×2 元（依此類推）

---

## 操作流程

### 初次設定（依序執行，順序不可顛倒）

1. **人員 → 老師**：新增所有授課老師
2. **課程 → 家教課**：新增課程並設定時薪（需先有老師才能設定預設老師）
3. **課程 → 團課**（選填）：新增班級並設定月費
4. **人員 → 學生**：新增學生
5. **人員 → 學生 → 選課**：為每位學生設定修習的家教課（需先有課程才有選項）
6. **紀錄 → 教材 → 教材品項**（選填）：新增教材種類與單價

### 每次上課前

- **上課紀錄 → 家教課上課紀錄 → 新增紀錄**
  填入：學生、老師、課程、時數、日期（可加備註）
  → 這筆紀錄會出現在課表與點名頁面

### 上課後（點名）

- **紀錄 → 點名 → 家教課點名**：確認出席狀態，可標記請假
- **紀錄 → 點名 → 團課點名**：選擇班級與日期，勾選出席學生後儲存

> ⚠️ **重要**：學費與薪資均以點名記錄為計算依據。未點名的課堂不計入帳單。

### 月底結算

1. 前往 **結算 → 學費結算** 或 **老師薪資結算**
2. 選擇起訖日期，點「產生報表」
3. 學費：可下載全班 PDF、單一學生 PDF，或產生家長唯讀分享連結（30 天有效）
4. 薪資：可下載全部或單一老師 PDF

---

## 技術棧

- **前端**：React 19 + Vite 8
- **後端**：Express 5 + Node.js
- **資料庫**：MySQL 8（`mysql2/promise`）
- **PWA**：vite-plugin-pwa（Workbox）
- **PDF**：html2canvas + jsPDF 4 + jspdf-autotable
- **AI 助理**：@anthropic-ai/sdk（claude-sonnet-4-6，function calling）

---

## 快速開始

### 環境需求

- Node.js 18+
- MySQL 8.x（本機或遠端皆可，見 [SSH Tunnel](#ssh-tunnel)）

### 安裝

```bash
npm install
```

### 資料庫設定

複製範本並填入實際值：

```bash
cp .env.example .env
```

`.env` 主要設定項：

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=user
MYSQL_PASSWORD=!Sqluser2026
MYSQL_DATABASE=tuition_calculator
PORT=3100
# AI 助理（選填，未設定時自動讀取 Claude Code 的 OAuth token）
# ANTHROPIC_API_KEY=sk-ant-...
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

```bash
npm start
```

同時啟動後端（port 3100，watch 模式）與前端 Vite（port 5173）。

**個別啟動：**

```bash
npm run server:dev   # 後端
npm run dev          # 前端
```

開啟瀏覽器：`http://localhost:5173`

### 種子資料（選填）

```bash
npm run seed
# 寫入初始學生名冊，已有資料則跳過
```

---

## SSH Tunnel

若 MySQL 架在遠端 VPS，可用 SSH Tunnel 將遠端 3306 映射到本機，`.env` 無需改動：

```bash
# 前景執行（Ctrl+C 關閉）
ssh -N -L 3306:127.0.0.1:3306 <user>@<vps-ip>

# 背景執行
ssh -fN -L 3306:127.0.0.1:3306 <user>@<vps-ip>
```

Tunnel 建好後直接 `npm start` 即可。

---

## PWA 安裝

此系統可安裝為 PWA（Progressive Web App），在手機主畫面開啟後以全螢幕獨立 App 方式運行，方便老師快速點名。

### Android（Chrome）

1. 用 **Chrome** 開啟網站
2. 點右上角三點選單 `⋮`
3. 選「**新增至主畫面**」或「**安裝應用程式**」
4. 確認後桌面出現「補習班管理系統」圖示
5. 點圖示開啟，直接進入點名頁面

> 部分 Android 版本 Chrome 網址列右側會直接出現安裝圖示（⊕），點一下即可。

### iOS（Safari）

1. 用 **Safari** 開啟網站（iOS PWA 僅支援 Safari 安裝）
2. 點下方工具列的**分享按鈕**（方框加箭頭 ⬆）
3. 向下捲動，選「**加入主畫面**」
4. 名稱可自行修改，點「新增」
5. 回到主畫面，點圖示以全螢幕模式開啟

> iOS 16.4+ 支援 PWA 推播通知；iOS 不支援 Chrome 安裝 PWA，請務必使用 Safari。

---

## 資料庫 Schema

| Table | 用途 |
|-------|------|
| `students` | 學生基本資料 |
| `teachers` | 老師基本資料 |
| `courses` | 課程（學費時薪 `hourly_rate`、老師時薪 `teacher_hourly_rate`） |
| `lesson_records` | 家教課上課紀錄（每堂課的安排，點名依此顯示） |
| `materials` | 教材品項（含單價） |
| `material_records` | 學生領取教材紀錄 |
| `groups` | 團課班級（月費、上課星期、持續時間） |
| `group_records` | 團課點名出席紀錄（計費依據） |
| `leave_requests` | 請假紀錄 |
| `misc_expenses` | 雜項支出（房租 / 水電 / 行銷 / 其他） |
| `share_tokens` | 學費單家長分享連結（含效期） |
| `payment_records` | 繳費狀態紀錄 |

Schema 定義與 migration 邏輯位於 `server/db.js`，使用 `information_schema.COLUMNS` 做欄位檢查，安全支援舊資料庫升級。

---

## 關鍵檔案

```
tuition-calculator/
├── server/
│   ├── db.js          # MySQL 連線、Schema、所有 CRUD + settlement
│   ├── index.js       # Express 路由
│   ├── ai.js          # AI 助理（Claude function calling + agentic loop）
│   └── seed.js        # 種子資料
├── src/
│   ├── data/api.js    # 前端 API client
│   ├── contexts/      # React Context
│   ├── pages/
│   │   ├── AttendancePage.jsx        # 點名（PWA 主要使用頁）
│   │   ├── TutoringLessonsPage.jsx   # 家教課上課紀錄
│   │   ├── GroupLessonsPage.jsx      # 團課上課紀錄
│   │   ├── SchedulePage.jsx          # 課表
│   │   ├── TuitionSettlementPage.jsx # 學費結算
│   │   ├── SalarySettlementPage.jsx  # 老師薪資結算
│   │   ├── DashboardPage.jsx         # 財務總覽
│   │   ├── AiAssistantPage.jsx       # AI 助理
│   │   └── ...
│   └── index.css
├── public/
│   └── icon.svg       # PWA 圖示
└── vite.config.js     # Vite 設定（含 /api proxy 與 PWA 設定）
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
npm start &
npx playwright test
```
