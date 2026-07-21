#!/usr/bin/env bash
set -euo pipefail

# Railway mengisi PORT secara otomatis; fallback 8080 untuk lokal
PORT="${PORT:-8080}"

# Backend FastAPI (internal saja, diakses lewat rewrite /api milik Next.js)
cd /app/backend
./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACK_PID=$!

# Frontend Next.js (publik, port dari Railway)
cd /app/frontend
./node_modules/.bin/next start -p "${PORT}" -H 0.0.0.0 &
FRONT_PID=$!

trap 'kill "${BACK_PID}" "${FRONT_PID}" 2>/dev/null || true' TERM INT

# Kalau salah satu proses mati, hentikan container supaya Railway me-restart
wait -n "${BACK_PID}" "${FRONT_PID}" || true
