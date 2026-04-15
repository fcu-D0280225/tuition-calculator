#!/usr/bin/env bash
# 在本專案目錄執行: ./start-dev.sh
#
# 離線使用：請先在有網路時完成一次 npm install（或使用已含 node_modules 的備份），
# 之後可關閉網路執行本腳本；不依賴 CDN 字型與 html2canvas 遠端載入。
#
# 正式離線部署可改用: npm run build && npm run preview

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "錯誤: 找不到 npm。請先安裝 Node.js（建議 LTS）：https://nodejs.org/" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "尚未安裝依賴，執行 npm install …"
  npm install
fi

echo "啟動開發伺服器（Ctrl+C 結束）…"
exec npm run dev
