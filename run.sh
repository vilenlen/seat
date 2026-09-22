#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Seat · 一席 —— 一键运行脚本
#
# 用法：
#   ./run.sh               演示 / 本地模式：node bridge.mjs（地址 http://127.0.0.1:5174/）
#   ./run.sh -p 8080       指定端口
#   ./run.sh server        完整服务模式：node server.mjs（含 /api，需 .env 与依赖）
#   ./run.sh --open        启动后自动用浏览器打开页面
#
# 说明：
#   - 默认「演示模式」零配置开箱即用，本地 Agent 引擎调用本机 claude / codex CLI，
#     云端 LLM / 托管 AI 亦可经桥接转发，无需任何账号或 Key。
#   - 「完整服务模式」供本机跑整套前后端（登录 / 托管推理 / 订阅），需先 npm install 并填 .env。
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 解析参数 ────────────────────────────────────────────────────────────────
MODE=dev
PORT=""
OPEN=0

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)  usage; exit 0 ;;
    dev|demo|local)          MODE=dev ;;
    server|start|prod|vps)   MODE=server ;;
    -p|--port)
      PORT="${2:-}"
      [[ -n "$PORT" ]] || { echo "❌ --port 缺少端口号"; exit 1; }
      shift ;;
    --open|-o)  OPEN=1 ;;
    *)  echo "❌ 未知参数：$1（-h 查看用法）"; exit 1 ;;
  esac
  shift
done

# ── 依赖自检 ────────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未检测到 Node.js，请先安装（Node 18+，本地会话库推荐 22.5+）：https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"

if [[ "$MODE" == dev ]]; then
  # bridge.mjs 零第三方依赖，但本地会话库用内置 node:sqlite（需 Node 22.5+）
  if [[ "$NODE_MAJOR" -lt 22 ]]; then
    echo "⚠️  当前 Node 主版本 $NODE_MAJOR。本地会话库（node:sqlite）需要 Node 22.5+，"
    echo "   否则启动会报 node:sqlite 错误；可改用云端 LLM / 托管引擎。"
  fi
  # 本机 Agent CLI 可选：缺了不影响云端 LLM / 托管，只是「本地 Agent」引擎不可用
  command -v claude >/dev/null 2>&1 || echo "⚠️  未找到 claude CLI，「本地 Agent」引擎将不可用（云端 LLM / 托管不受影响）"
  command -v codex  >/dev/null 2>&1 || echo "⚠️  未找到 codex CLI，「本地 Agent」引擎的 codex 选项将不可用"

  CMD=(node bridge.mjs ${PORT:+"$PORT"})
  DEFAULT_PORT="${PORT:-5174}"
else
  # 完整服务模式：额外依赖 @supabase/supabase-js 与 .env
  [[ -f .env ]] || {
    echo "⚠️  未找到 .env（server 模式需要 Supabase / OpenAI / Lemon Squeezy 配置）。"
    echo "   可先 cp .env.example .env 再填写；只跑本地演示请直接用 ./run.sh"
  }
  [[ -d node_modules ]] || { echo "📦 首次运行，安装依赖（@supabase/supabase-js）……"; npm install; }

  CMD=(node server.mjs)
  DEFAULT_PORT="${PORT:-3000}"
  [[ -n "$PORT" ]] && export PORT="$PORT"
fi

# ── 启动 ────────────────────────────────────────────────────────────────────
URL="http://127.0.0.1:${DEFAULT_PORT}/"
MODE_LABEL=$([ "$MODE" = dev ] && echo "演示 / 本地模式" || echo "完整服务模式")
echo "🚀 启动 Seat · 一席（${MODE_LABEL}）"
echo "   页面地址：${URL}"
echo "   按 Ctrl+C 停止。"
echo

"${CMD[@]}" &
PID=$!
trap 'kill "$PID" 2>/dev/null; exit 0' INT TERM

# 等端口就绪后再决定是否开浏览器
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${DEFAULT_PORT}/health" >/dev/null 2>&1 \
     || curl -fsS "http://127.0.0.1:${DEFAULT_PORT}/" >/dev/null 2>&1; then
    [[ "$OPEN" == 1 ]] && { open "${URL}" 2>/dev/null || xdg-open "${URL}" 2>/dev/null || true; }
    break
  fi
  sleep 0.3
done

wait "$PID"