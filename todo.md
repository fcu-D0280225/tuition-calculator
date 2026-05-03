# 三階段開發進度與待辦

> 圖例：✅ 已完成　☑️ 部分完成 / 待強化　⬜ 尚未開始

對照「系統邏輯架構：三階段開發計畫」逐項盤點目前的實作狀況，後面再列出仍要做的待辦。

---

## 第一階段：核心營運模組（基礎搭建）

### 1. 課程與老師關聯表 ✅
- 家教課（`courses`）/ 團課（`groups`）皆有 `default_teacher_id`，FK 指向 `teachers`
- 沒設預設老師也可建立紀錄（`teacher_id` 已 nullable）

### 2. 學生基礎資料（預設課程／老師） ✅
- `students` + `student_enrollment_courses` / `student_enrollment_groups`
- `StudentEnrollPage`：第 1 步家教課／團課分區、可加入／取消選課，第 2 步月曆排日期
- 至少一筆紀錄成功時自動把家教課加入「已選課程」

### 3. 上課紀錄登記（自動帶老師） ✅
- `lesson_records`、`group_records`
- 建立時自動帶 `default_teacher_id`，可在第 2 步手動覆寫
- 同學生 + 同課程 + 同日重複建立會跳警告
- 逐日可設定 `start_time`，每筆時數依課程預設

### 4. 教材費用統計 ✅
- `materials` / `material_records` 表 + `MaterialsPage`
- 紀錄時 snapshot 當下的 `unit_price` 到 `material_records.unit_price`，避免日後改價回溯
- 已併入損益報表的「教材成本」

### 5. 匯總報表（課時與收費） ✅
- `SettlementPage` / `TuitionSettlementPage` / `SalarySettlementPage`
- `settlementTuition` / `settlementSalary` / `getStudentBill`

### 6. 學費收費單 ✅
- `utils/pdf.js` 產生 PDF；`SharePage` + `share_tokens` 提供家長端臨時連結

### 7. 點名表 ✅
- `AttendancePage`：依日期 + 課程展開家教 sessions / 團課，勾選即建立 / 更新紀錄
- 支援請假（`leave_requests`）與「已預約 / 已上課」狀態

---

## 第二階段：行政管理與成本模組（深度分析）

### 1. 老師時薪建檔 ✅
- 設計上「老師時薪 = 該課程的 `teacher_hourly_rate`」（不另設老師層級的預設）
- 單筆紀錄可覆寫 `teacher_unit_price`

### 2. 上課時數匯總表 → 應付薪資 ✅
- `SalarySettlementPage` 已能依老師 + 課程列出時數、單價、合計、PDF

### 3. 使用者權限設定 ✅
- `auth_users` / `auth_groups` / `auth_group_permissions` / `auth_user_permissions`
- `UsersPage`：管理員可改群組、個別 nav 權限、綁老師帳號

### 4. 介面顯示設定（角色化 UX） ☑️
- 已有 nav-level 權限控制
- 新增 `view_rates` 功能權限：預設老師群組看不到時薪／金額（CoursesPage 的學費／老師時薪／每多一人折扣 columns 都會自動隱藏）
- **未做**：其他金額欄位（雜項、教材單價／小計）目前未隱藏；視之後需求再延伸

---

## 第三階段：行動化與全面財務模組（數位轉型）

### 1. 手機點名系統（老師端即時輸入） ☑️
- `AttendancePage` 已有 RWD，老師帳號可登入點名
- **缺**：老師端「進入即看到今天該點的課」捷徑、離線暫存、推播 / LINE 提醒

### 2. 營收與費用模組（房租／水電／行銷） ✅
- `misc_expenses.category` 欄位已加（房租／水電／行銷／其他），`MiscPage` 可選擇類別、依類別篩選 / 分類小計
- 後端 `GET /api/misc-expenses/summary?from&to` 依類別彙總

### 3. 全面損益報表 ✅
- 新增 `ProfitLossPage`：學費收入 − 老師薪資 − 教材成本 − 營業費用（依類別分項）− 淨利
- 後端 `GET /api/settlement/profit-loss?from&to`
- 教材成本以「紀錄當下」的單價 snapshot 計算（`material_records.unit_price`）

---

## 待辦清單（新增項目集中區）

### 高優先（補完三階段缺口）

- [x] **雜支分類**：`misc_expenses.category` + UI ✅（2026-05-03 完成）
- [x] **損益報表頁面**：`ProfitLossPage` ✅（2026-05-03 完成，待教材成本）
- [x] **教材成本進入損益** ✅（2026-05-03 完成）
  - `material_records.unit_price` snapshot 欄位 + migration 回填既有資料
  - `insertMaterialRecord` 預設 snapshot 當下的 `materials.unit_price`；`updateMaterialRecord` 換教材時自動 re-snapshot
  - `listMaterialRecords` 用 `COALESCE(mr.unit_price, m.unit_price)`，舊資料無 snapshot 時 fallback 用當前單價
  - P&L 端點新增 `cost.materials`，UI 加列「教材成本」
- [x] **角色化欄位顯示（金額）** ✅（2026-05-03 完成）
  - 新增 `view_rates` 功能權限（VALID_NAV_IDS 內，UsersPage 顯示為「【功能】顯示時薪／金額」）
  - 預設老師群組不含此權限；既有非老師群組由 migration 自動補上 `view_rates`，不影響現有可見性
  - 新增 `AuthContext` / `useAuth()` 暴露 `canViewRates`
  - CoursesPage 列表與新增表單依 `canViewRates` 隱藏「學費／老師時薪／每多一人」欄位
  - 後續若要藏更多欄位（教材單價、雜支金額），讀同一個 flag 即可

### 中優先（體驗強化）

- [x] **老師端首頁** ✅（2026-05-03 完成）
  - 老師帳號（`teacher_id` 已綁定且非管理員）登入後，若 `attendance` 在權限內，預設導向點名頁
  - 沒綁老師 / 是管理員 / 沒有 attendance 權限 → 維持原本的第一個 nav 為預設
- [ ] **AttendancePage 行動體驗**：手指操作的 hit area、離線暫存（IndexedDB）、上線後同步
- [ ] **損益報表 PDF / 匯出**：可下載當月 P&L
- [ ] **學費收費單**：除既有 PDF 外，加 LINE 分享文字模板（可直接貼訊息）
- [ ] **教材成本對家長**：學費收費單可加上教材費明細區塊

### 低優先（之後再說）

- [ ] **雜支自動化**：固定支出（房租）排程每月自動產生一筆
- [ ] **預算 / 目標**：每月預算對比實績的儀表板
- [ ] **多分校 / 多教室**：若未來擴大，需要 `branch_id` 維度
- [ ] **稽核紀錄**：誰改了哪筆紀錄、何時改的（audit log）

---

## 已完成（這次 session 的小改動，僅供回顧）

- 上課紀錄允許未指派老師（DB nullable + 全前端 fallback 顯示「—」/「未指派老師」）
- 任何入口建立同學生 + 課程 + 日期重複時跳警告（confirm 後可強制建立）
- 學生選課第 2 步可逐日設定開始時間
- 學生選課第 1 步點已選課程跳警告，可取消選課（保留歷史紀錄）
- 學生名冊「移除選課」警告同步詳細說明
- 家教課新增表單樣式對齊團課（`lesson-form` + `<label>`）
- 夜間模式 + 右上角主題切換圖示
