#!/usr/bin/env bash

is_pid_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

pid_from_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    tr -d '[:space:]' < "$pid_file"
  fi
}

is_pid_file_running() {
  local pid_file="$1"
  local pid
  pid="$(pid_from_file "$pid_file")"
  is_pid_running "$pid"
}

pid_command() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null || true
}

pids_on_port() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

project_pids_on_port() {
  local port="$1"
  local root_dir="$2"
  local include_text="$3"
  local pid
  local command

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    command="$(pid_command "$pid")"
    if [[ "$command" == *"$root_dir"* || "$command" == *"$include_text"* ]]; then
      echo "$pid"
    fi
  done < <(pids_on_port "$port")
}

pids_matching_command() {
  local text="$1"
  pgrep -f "$text" 2>/dev/null || true
}

stop_pid() {
  local pid="$1"
  local label="$2"

  if ! is_pid_running "$pid"; then
    return 0
  fi

  echo "停止 $label PID $pid"
  kill "$pid" 2>/dev/null || true

  for _ in {1..30}; do
    if ! is_pid_running "$pid"; then
      return 0
    fi
    sleep 0.2
  done

  echo "$label PID $pid 未正常退出，强制停止"
  kill -9 "$pid" 2>/dev/null || true
}

wait_for_url() {
  local url="$1"
  local label="$2"

  for _ in {1..60}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$label 已就绪：$url"
      return 0
    fi
    sleep 0.5
  done

  echo "$label 启动中，但健康检查暂未通过：$url" >&2
  return 1
}
