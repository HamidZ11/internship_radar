from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.job import Job
from app.models.schemas import JobCreate, JobResponse
from app.services.scoring import calculate_fit_score

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/", response_model=List[JobResponse])
def list_jobs(db: Session = Depends(get_db)) -> List[Job]:
    return db.query(Job).order_by(Job.created_at.desc()).all()


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(payload: JobCreate, db: Session = Depends(get_db)) -> Job:
    url_str = str(payload.url)

    existing = db.query(Job).filter(Job.url == url_str).first()
    if existing:
        raise HTTPException(status_code=409, detail="Job with this URL already exists.")

    job_data = payload.model_dump()
    job_data["url"] = url_str
    job_data["fit_score"] = calculate_fit_score(job_data)

    job = Job(**job_data)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job
