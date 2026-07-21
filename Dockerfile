# ---------- 1. Build frontend (Next.js) ----------
FROM node:20-slim AS frontend-build
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN mkdir -p public && npm run build

# ---------- 2. Install dependencies backend (FastAPI via uv) ----------
FROM python:3.12-slim AS backend-deps
RUN pip install --no-cache-dir uv
WORKDIR /be
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

# ---------- 3. Runtime (Node + Python dalam satu image) ----------
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 NODE_ENV=production

# Runtime Node.js dicopy dari image resmi node
COPY --from=node:20-slim /usr/local /usr/local

WORKDIR /app

# Backend + virtualenv siap pakai
COPY backend/ ./backend/
COPY --from=backend-deps /be/.venv ./backend/.venv

# Frontend hasil build + dependencies
COPY --from=frontend-build /fe/package.json ./frontend/package.json
COPY --from=frontend-build /fe/next.config.js ./frontend/next.config.js
COPY --from=frontend-build /fe/node_modules ./frontend/node_modules
COPY --from=frontend-build /fe/.next ./frontend/.next
COPY --from=frontend-build /fe/public ./frontend/public

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080
CMD ["./docker-entrypoint.sh"]
