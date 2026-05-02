from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.db.database import Base, engine
from app.api.jobs import router as jobs_router

app = FastAPI(title="Internship Radar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# Safe migration: add is_saved if it doesn't exist yet (idempotent)
with engine.connect() as conn:
    conn.execute(text(
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_saved BOOLEAN NOT NULL DEFAULT FALSE"
    ))
    conn.commit()

app.include_router(jobs_router)
