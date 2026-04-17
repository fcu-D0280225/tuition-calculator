# Tuition Calculator

補習班學費計算與學籍管理工具。支援學生名冊、課程目錄、月費試算與 PDF 匯出。

## 功能

- **學生名冊**：管理學生資料，查看個別學生詳情
- **課程目錄**：建立課程項目與費率設定
- **月費試算**：依課程組合計算每月應繳金額（MonthProjectBar 視覺化）
- **PDF 匯出**：產生繳費單（jsPDF + jspdf-autotable）

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
