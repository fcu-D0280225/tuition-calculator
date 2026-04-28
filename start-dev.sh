#!/usr/bin/env bash
# 在本專案目錄執行: ./start-dev.sh
#
# 會同時啟動：
#   - 後端 Express API（預設 http://localhost:3100，需連 MySQL tuition_calculator DB）
#   - 前端 Vite dev server（預設 http://localhost:5173，/api 會 proxy 到後端）
#
# 依賴：
#   - Node.js（建議 LTS）
#   - MySQL，且已建立 tuition_calculator DB，授權給 user
#     （可用環境變數覆寫：MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE）
#
# Ctrl+C 會同時關閉後端與前端。

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

# 後端連線設定（未設定時使用 server/db.js 內預設值）
: "${PORT:=3100}"
export PORT

cleaned=0
cleanup() {
  [ "$cleaned" -eq 1 ] && return
  cleaned=1
  echo
  echo "[start-dev] 關閉中…"
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[start-dev] 啟動後端（port $PORT）…"
npm run server &
BACKEND_PID=$!

# 等後端 /api/health 回應（最多約 15 秒）
ready=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  # 後端若已掛掉就不要再等
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

if [ "$ready" -ne 1 ]; then
  echo "[start-dev] 後端未就緒。常見原因：" >&2
  echo "  - MySQL 未啟動，或 tuition_calculator DB / user 未建立" >&2
  echo "  - 連線參數需覆寫：MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE" >&2
  exit 1
fi
echo "[start-dev] 後端就緒 ✓"

echo "[start-dev] 啟動前端 dev server（vite）…"
npm run dev &
FRONTEND_PID=$!

wait
