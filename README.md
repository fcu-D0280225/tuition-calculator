# Tuition Calculator

補習班管理系統：以上課紀錄為核心，結算學費與老師薪資，並支援 PDF 匯出。

## 功能

- **上課紀錄**：登打每一堂課（學生 / 老師 / 課程 / 時數 / 日期）
- **學生 / 老師 / 課程**：各自的 CRUD 與每堂單價 / 鐘點費管理
- **結算**：依日期區間產生學費與薪資彙總
- **PDF 匯出**：學費／薪資彙總與明細（jsPDF + jspdf-autotable）

## 技術棧

- **前端**：React + Vite
- **PDF**：html2canvas + jsPDF
- **測試**：Playwright（E2E）+ Vitest + Testing Library

## 本機啟動

```bash
npm install
npm run dev
# 開啟 http://localhost:5173
```

## 建置

```bash
npm run build
# 輸出至 dist/
```

## 待辦

- `AUTH-001` 新增 Express 後端 + JWT 登入系統（保護學生資料）

詳見 [backlog](https://github.com/fcu-D0280225/claude-cron/blob/main/backlog/autonomous-tasks.md)。
