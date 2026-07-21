import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models.models import Base, User
from app.routers import auth, master, dashboard, imports
from app.services.auth import seed_users, get_password_hash
from app.services.file_monitoring import seed_recon_configuration


logging.basicConfig(level=logging.INFO)


def _migrate_schema():
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(summary_rows)"))
        cols = [row[1] for row in result]
        if "chksum_value" not in cols:
            conn.execute(text("ALTER TABLE summary_rows ADD COLUMN chksum_value FLOAT"))
            conn.commit()
            logging.info("Added column chksum_value to summary_rows")

        if "recon_pair_id" not in cols:
            conn.execute(text("ALTER TABLE summary_rows ADD COLUMN recon_pair_id INTEGER REFERENCES recon_pairs(id)"))
            conn.commit()
            logging.info("Added column recon_pair_id to summary_rows")

    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(exception_details)"))
        cols = [row[1] for row in result]
        if "raw_data" not in cols:
            conn.execute(text("ALTER TABLE exception_details ADD COLUMN raw_data TEXT"))
            conn.commit()
            logging.info("Added column raw_data to exception_details")

    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(import_batches)"))
        cols = [row[1] for row in result]
        if "file_size" not in cols:
            conn.execute(text("ALTER TABLE import_batches ADD COLUMN file_size INTEGER"))
            conn.commit()
            logging.info("Added column file_size to import_batches")
        if "trx_date" not in cols:
            conn.execute(text("ALTER TABLE import_batches ADD COLUMN trx_date DATE"))
            conn.commit()
            logging.info("Added column trx_date to import_batches")
        if "source_settlement_total" not in cols:
            conn.execute(text("ALTER TABLE import_batches ADD COLUMN source_settlement_total INTEGER"))
            conn.commit()
            logging.info("Added column source_settlement_total to import_batches")

    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(recon_pairs)"))
        cols = [row[1] for row in result]
        if "settlement_direction" not in cols:
            conn.execute(text("ALTER TABLE recon_pairs ADD COLUMN settlement_direction TEXT DEFAULT 'RECEIVABLE'"))
            conn.commit()
            logging.info("Added column settlement_direction to recon_pairs")

    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(daily_summaries)"))
        cols = [row[1] for row in result]
        if "recon_pair_id" not in cols:
            conn.execute(text("ALTER TABLE daily_summaries ADD COLUMN recon_pair_id INTEGER REFERENCES recon_pairs(id)"))
            conn.commit()
            logging.info("Added column recon_pair_id to daily_summaries")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    db = SessionLocal()
    try:
        seed_users(db)
        seed_recon_configuration(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Pulsa Reconciliation Dashboard", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(master.router)
app.include_router(dashboard.router)
app.include_router(imports.router)


@app.get("/")
def root():
    return {"message": "Pulsa Reconciliation Dashboard API"}
