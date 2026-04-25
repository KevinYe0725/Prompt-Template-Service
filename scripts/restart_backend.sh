#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"

source "$ROOT_DIR/scripts/_process_utils.sh"

mkdir -p "$RUN_DIR" "$LOG_DIR"

if is_pid_file_running "$BACKEND_PID_FILE"; then
  stop_pid "$(pid_from_file "$BACKEND_PID_FILE")" "后端"
fi
rm -f "$BACKEND_PID_FILE"

while IFS= read -r pid; do
  [[ -z "$pid" ]] && continue
  stop_pid "$pid" "端口 $BACKEND_PORT 上的本项目后端"
done < <(project_pids_on_port "$BACKEND_PORT" "$ROOT_DIR" "backend.app.main:app")

if [[ -n "$(pids_on_port "$BACKEND_PORT")" ]]; then
  echo "后端端口 $BACKEND_PORT 仍被其他进程占用，无法重启。" >&2
  lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN >&2 || true
  exit 1
fi

echo "重新启动后端，日志：$BACKEND_LOG"
nohup "$ROOT_DIR/scripts/run_backend.sh" > "$BACKEND_LOG" 2>&1 &
backend_pid="$!"
echo "$backend_pid" > "$BACKEND_PID_FILE"
disown "$backend_pid" 2>/dev/null || true

wait_for_url "http://127.0.0.1:$BACKEND_PORT/api/health" "后端" || true
echo "后端已重启：http://127.0.0.1:$BACKEND_PORT"
