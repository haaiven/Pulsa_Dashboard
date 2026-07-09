import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, SessionLocal
from app.models.models import Base, User
from app.routers import auth, master, dashboard, imports
from app.services.auth import seed_users, get_password_hash


logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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
