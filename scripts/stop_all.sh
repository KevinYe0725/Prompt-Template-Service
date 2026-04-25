#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5175}"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

source "$ROOT_DIR/scripts/_process_utils.sh"

if is_pid_file_running "$FRONTEND_PID_FILE"; then
  stop_pid "$(pid_from_file "$FRONTEND_PID_FILE")" "前端"
fi
rm -f "$FRONTEND_PID_FILE"

if is_pid_file_running "$BACKEND_PID_FILE"; then
  stop_pid "$(pid_from_file "$BACKEND_PID_FILE")" "后端"
fi
rm -f "$BACKEND_PID_FILE"

while IFS= read -r pid; do
  [[ -z "$pid" ]] && continue
  stop_pid "$pid" "端口 $FRONTEND_PORT 上的本项目前端"
done < <(project_pids_on_port "$FRONTEND_PORT" "$ROOT_DIR" "vite")

while IFS= read -r pid; do
  [[ -z "$pid" ]] && continue
  stop_pid "$pid" "本项目残留前端"
done < <(pids_matching_command "$ROOT_DIR/frontend/node_modules/.bin/vite")

while IFS= read -r pid; do
  [[ -z "$pid" ]] && continue
  stop_pid "$pid" "端口 $BACKEND_PORT 上的本项目后端"
done < <(project_pids_on_port "$BACKEND_PORT" "$ROOT_DIR" "backend.app.main:app")

while IFS= read -r pid; do
  [[ -z "$pid" ]] && continue
  stop_pid "$pid" "本项目残留后端"
done < <(pids_matching_command "$ROOT_DIR/.venv/bin/uvicorn backend.app.main:app")

echo "已停止本项目受脚本管理的前后端进程。"
