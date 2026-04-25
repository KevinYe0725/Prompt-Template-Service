#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5175}"
DETACH="${DETACH:-0}"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

source "$ROOT_DIR/scripts/_process_utils.sh"

mkdir -p "$RUN_DIR" "$LOG_DIR"
touch "$BACKEND_LOG" "$FRONTEND_LOG"

adopt_or_start_backend() {
  if is_pid_file_running "$BACKEND_PID_FILE"; then
    echo "后端已运行：PID $(pid_from_file "$BACKEND_PID_FILE")，端口 $BACKEND_PORT"
    return 0
  fi

  local existing_pids
  existing_pids="$(project_pids_on_port "$BACKEND_PORT" "$ROOT_DIR" "backend.app.main:app" | tr '\n' ' ')"
  if [[ -n "${existing_pids// /}" ]]; then
    local first_pid
    first_pid="$(awk '{print $1}' <<< "$existing_pids")"
    echo "$first_pid" > "$BACKEND_PID_FILE"
    echo "检测到本项目后端已在端口 $BACKEND_PORT 运行，已接管 PID：$existing_pids"
    return 0
  fi

  if [[ -n "$(pids_on_port "$BACKEND_PORT")" ]]; then
    echo "后端端口 $BACKEND_PORT 已被其他进程占用，请更换 BACKEND_PORT 或释放端口。" >&2
    lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN >&2 || true
    exit 1
  fi

  echo "启动后端，日志：$BACKEND_LOG"
  nohup "$ROOT_DIR/scripts/run_backend.sh" > "$BACKEND_LOG" 2>&1 &
  local backend_pid="$!"
  echo "$backend_pid" > "$BACKEND_PID_FILE"
  disown "$backend_pid" 2>/dev/null || true
}

adopt_or_start_frontend() {
  if is_pid_file_running "$FRONTEND_PID_FILE"; then
    echo "前端已运行：PID $(pid_from_file "$FRONTEND_PID_FILE")，端口 $FRONTEND_PORT"
    return 0
  fi

  local existing_pids
  existing_pids="$(project_pids_on_port "$FRONTEND_PORT" "$ROOT_DIR" "vite" | tr '\n' ' ')"
  if [[ -n "${existing_pids// /}" ]]; then
    local first_pid
    first_pid="$(awk '{print $1}' <<< "$existing_pids")"
    echo "$first_pid" > "$FRONTEND_PID_FILE"
    echo "检测到本项目前端已在端口 $FRONTEND_PORT 运行，已接管 PID：$existing_pids"
    return 0
  fi

  if [[ -n "$(pids_on_port "$FRONTEND_PORT")" ]]; then
    echo "前端端口 $FRONTEND_PORT 已被其他进程占用，请更换 FRONTEND_PORT 或释放端口。" >&2
    lsof -nP -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN >&2 || true
    exit 1
  fi

  echo "启动前端，日志：$FRONTEND_LOG"
  nohup "$ROOT_DIR/scripts/run_frontend.sh" > "$FRONTEND_LOG" 2>&1 &
  local frontend_pid="$!"
  echo "$frontend_pid" > "$FRONTEND_PID_FILE"
  disown "$frontend_pid" 2>/dev/null || true
}

adopt_or_start_backend
adopt_or_start_frontend

wait_for_url "http://127.0.0.1:$BACKEND_PORT/api/health" "后端" || true
wait_for_url "http://127.0.0.1:$FRONTEND_PORT/" "前端" || true

echo
echo "启动完成："
echo "后端：http://127.0.0.1:$BACKEND_PORT"
echo "前端：http://127.0.0.1:$FRONTEND_PORT/admin/prompts"
echo "日志：$LOG_DIR"

if [[ "$DETACH" == "1" || "$DETACH" == "true" ]]; then
  exit 0
fi

cleanup() {
  echo
  echo "收到停止信号，正在关闭本项目开发服务..."
  "$ROOT_DIR/scripts/stop_all.sh" || true
}

trap cleanup INT TERM

echo
echo "正在前台运行。按 Ctrl+C 停止前后端。"
tail -n 80 -f "$BACKEND_LOG" "$FRONTEND_LOG"
