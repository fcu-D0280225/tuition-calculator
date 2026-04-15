#!/usr/bin/env bash
# tuition-calculator：檢查本機是否具備啟動服務所需環境。
# 在未經使用者確認前，不會執行任何下載或安裝指令。

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
MIN_NODE_MAJOR=18

read_confirm() {
  local prompt=$1
  local ans
  read -r -p "$prompt [y/N] " ans || return 1
  case "$(printf '%s' "$ans" | tr '[:upper:]' '[:lower:]')" in
    y | yes) return 0 ;;
    *) return 1 ;;
  esac
}

say() { printf '%s\n' "$*"; }

say "=========================================="
say " 學費管理（tuition-calculator）環境檢查"
say "=========================================="
say ""
say "專案目錄: $PROJECT_ROOT"
say "建議：Node.js ${MIN_NODE_MAJOR}.x 以上（Vite 5）"
say ""

# --- Node.js ---
if ! command -v node >/dev/null 2>&1; then
  say "[缺失] 未找到 node（Node.js）"
  say "  說明：執行 npm run dev / npm start 需要安裝 Node.js。"
  say ""
  if read_confirm "是否依序嘗試用套件管理器安裝？（否則僅顯示手動說明）"; then
    if command -v brew >/dev/null 2>&1; then
      say "即將執行: brew install node"
      if read_confirm "確認執行 brew install node？"; then
        brew install node
      else
        say "已略過 brew 安裝。"
      fi
    elif command -v apt-get >/dev/null 2>&1; then
      say "偵測到 apt。官方建議使用 NodeSource 或 nvm 取得較新版本。"
      say "  範例（需自行評估版本）：sudo apt-get update && sudo apt-get install -y nodejs npm"
      if read_confirm "確認執行上述 apt 指令？（可能需要 sudo）"; then
        sudo apt-get update && sudo apt-get install -y nodejs npm
      else
        say "已略過 apt 安裝。"
      fi
    else
      say "未偵測到 brew / apt-get。請至 https://nodejs.org/ 下載安裝，或使用 nvm："
      say "  https://github.com/nvm-sh/nvm"
    fi
  else
    say "請自行安裝 Node.js 後再執行本腳本。"
  fi
  say ""
else
  NODE_VER="$(node -v 2>/dev/null || true)"
  NODE_MAJOR="$(printf '%s' "$NODE_VER" | sed -E 's/^v([0-9]+).*/\1/')"
  if ! [[ "${NODE_MAJOR:-}" =~ ^[0-9]+$ ]]; then
    NODE_MAJOR=0
  fi
  if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
    say "[警告] Node 版本 $NODE_VER 可能過舊（建議 >= v${MIN_NODE_MAJOR}）"
    if read_confirm "是否仍要嘗試用 brew 升級 node？（僅 macOS + 已安裝 Homebrew）"; then
      if command -v brew >/dev/null 2>&1; then
        if read_confirm "確認執行 brew upgrade node？"; then
          brew upgrade node
        fi
      else
        say "未找到 brew，請手動升級 Node.js。"
      fi
    fi
    say ""
  else
    say "[通過] Node.js $NODE_VER"
    say ""
  fi
fi

# 若仍無 node，後續跳過
if ! command -v node >/dev/null 2>&1; then
  say "[結束] 請先安裝 Node.js 後再執行: cd \"$PROJECT_ROOT\" && npm install && npm run dev"
  exit 1
fi

# --- npm ---
if ! command -v npm >/dev/null 2>&1; then
  say "[缺失] 未找到 npm（通常隨 Node.js 一併安裝）"
  if read_confirm "是否嘗試用 apt 安裝 npm？（Debian/Ubuntu，可能需要 sudo）"; then
    sudo apt-get update && sudo apt-get install -y npm
  else
    say "請重新安裝 Node.js 官方安裝包，或參考發行版文件安裝 npm。"
    exit 1
  fi
  say ""
else
  say "[通過] npm $(npm -v 2>/dev/null || echo '?')"
  say ""
fi

# --- 專案依賴 node_modules ---
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  say "[錯誤] 在 $PROJECT_ROOT 找不到 package.json"
  exit 1
fi

if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  say "[缺失] 尚未執行 npm install（無 node_modules）"
  if read_confirm "是否在專案目錄執行 npm install？（會下載套件，需網路）"; then
    (cd "$PROJECT_ROOT" && npm install)
  else
    say "已略過。可自行執行: cd \"$PROJECT_ROOT\" && npm install"
    exit 1
  fi
  say ""
else
  say "[通過] 已存在 node_modules"
  if read_confirm "是否要再執行一次 npm install 以同步依賴？（可選）"; then
    (cd "$PROJECT_ROOT" && npm install)
  fi
  say ""
fi

say "=========================================="
say " 檢查完成。啟動開發伺服器可執行："
say "   cd \"$PROJECT_ROOT\""
say "   npm run dev"
say "   （或 npm start：會先 build 再 dev）"
say "=========================================="
exit 0
