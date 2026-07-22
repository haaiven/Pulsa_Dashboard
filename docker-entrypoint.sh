#!/usr/bin/env bash

# Start backend (internal port 8000)
cd /app/backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start frontend (port from $PORT env var, defaults to 3000)
cd /app/frontend
npm start &

# Exit when either process stops (Railway will restart the container)
wait -n
