import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models.models import Base, User
from app.routers import auth, master, dashboard, imports
from app.services.auth import seed_users, get_password_hash


logging.basicConfig(level=logging.INFO)


def _migrate_schema():
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(summary_rows)"))
        cols = [row[1] for row in result]
        if "chksum_value" not in cols:
            conn.execute(text("ALTER TABLE summary_rows ADD COLUMN chksum_value FLOAT"))
            conn.commit()
            logging.info("Added column chksum_value to summary_rows")

    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(exception_details)"))
        cols = [row[1] for row in result]
        if "raw_data" not in cols:
            conn.execute(text("ALTER TABLE exception_details ADD COLUMN raw_data TEXT"))
            conn.commit()
            logging.info("Added column raw_data to exception_details")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    db = SessionLocal()
    try:
        seed_users(db)
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
