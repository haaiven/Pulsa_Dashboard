# Agent Notes

## Project Shape
- This is a two-app repo: `backend/` is FastAPI + SQLite via `uv`; `frontend/` is Next.js 15 + React 19 + Tailwind.
- There is no useful root `package.json`; use `backend/pyproject.toml` and `frontend/package.json` as the real manifests. The root `package-lock.json` is effectively empty.
- Requirements live in `docs/requirement.md`, but trust the current code when it differs from the original requirement prose.

## Run And Verify
- Start both apps from repo root with `./start.sh`. It runs backend on `http://localhost:8000` and frontend on `http://localhost:5000`.
- `./start.sh` loads repo-root `.env` if present; keep real secrets out of git.
- Backend only: `cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- Frontend only: `cd frontend && npm run dev` (runs on port 5000 per `package.json`).
- Backend syntax check: `cd backend && uv run python -m py_compile app/models/models.py app/services/excel_import.py app/services/dashboard.py app/routers/dashboard.py`.
- Frontend build check: `cd frontend && npm run build`.
- Install deps separately: `cd backend && uv sync`; `cd frontend && npm install`.

## Backend Gotchas
- SQLite URL is `sqlite:///./pulsa.db`; because it is relative, run backend commands from `backend/` or you will create/use the wrong database file.
- Tables are created at FastAPI startup with `Base.metadata.create_all(bind=engine)` in `app/main.py`; Alembic is listed as a dependency but no migration flow is configured.
- Default users are seeded only if there are no users: `admin/admin123`, `operator/operator123`, `viewer/viewer123`.
- `POST /import/excel` accepts Excel and image files. Images go through OpenAI Vision in `app/services/excel_import.py`.
- Image import requires `OPENAI_API_KEY` in the environment; never commit or print real API keys. Use `.env.example` only as a placeholder.
- Importing a `summary` sheet in report format stores exact overview rows in `SummaryRow` and replaces existing rows for the same `trx_date`; it should not append duplicates for repeated uploads.
- `GET /dashboard/overview` returns the latest `summary_rows` table for a given recon pair (optional `?pair_id=X`). Without `pair_id`, it returns all rows (unscoped). The response includes `source_a`, `source_b`, `pair_code`, `pair_name` for dynamic column labeling. Daily/weekly/monthly/trend still use `DailySummary` aggregates.
- Importing a file with a filename matching an `ExpectedFile` pattern auto-associates imported `SummaryRow` data with that pair's `recon_pair_id`. The router detects the pair via `match_expected_file` / `detect_recon_pair_from_name` before calling `process_excel_file`.

## Frontend Gotchas
- Frontend API calls use Axios base URL `/api`; `frontend/next.config.js` rewrites `/api/:path*` to `http://localhost:8000/:path*`.
- Auth is client-side: JWT is stored in `localStorage` and decoded in `src/app/(dashboard)/layout.tsx`; no SSR auth guard exists.
- Overview page `src/app/(dashboard)/page.tsx` renders KPI cards + summary rows dynamically per pair. A pair selector at the top lets users switch between active `ReconPair`s; column labels use `source_a` / `source_b` from the selected pair.
- Local UI primitives are in `src/components/ui/`; this is not a full shadcn installation.
