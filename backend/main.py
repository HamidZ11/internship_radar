from fastapi import FastAPI
from app.db.database import Base, engine
from app.api.jobs import router as jobs_router

app = FastAPI(title="Internship Radar", version="0.1.0")

Base.metadata.create_all(bind=engine)

app.include_router(jobs_router)
