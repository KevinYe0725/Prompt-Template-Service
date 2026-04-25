#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${FRONTEND_HOST:-0.0.0.0}"
PORT="${FRONTEND_PORT:-5175}"

if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  echo "未找到 frontend/node_modules。请先执行：cd frontend && npm install" >&2
  exit 1
fi

cd "$ROOT_DIR/frontend"
exec npm run dev -- --host "$HOST" --port "$PORT" --strictPort
cd frontend
npm run dev
