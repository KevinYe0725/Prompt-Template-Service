#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${BACKEND_HOST:-0.0.0.0}"
PORT="${BACKEND_PORT:-${PORT:-8000}}"
UVICORN_BIN="${UVICORN_BIN:-$ROOT_DIR/.venv/bin/uvicorn}"

if [[ ! -x "$UVICORN_BIN" ]]; then
  UVICORN_BIN="$(command -v uvicorn || true)"
fi

if [[ -z "$UVICORN_BIN" ]]; then
  echo "未找到 uvicorn。请先执行：python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
  exit 1
fi

exec "$UVICORN_BIN" backend.app.main:app --host "$HOST" --port "$PORT" --reload
