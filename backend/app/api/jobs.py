from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Annotated, List

from app.db.database import get_db
from app.models.job import Job
from app.models.schemas import ALLOWED_STATUSES, JobCreate, JobResponse, SavedUpdate, StatusUpdate
from app.services.scoring import calculate_fit_score

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/", response_model=List[JobResponse])
def list_jobs(
    db: Session = Depends(get_db),
    status: Annotated[str | None, Query(description="Exact match on status")] = None,
    min_score: Annotated[int | None, Query(ge=0, le=100, description="Minimum fit_score (inclusive)")] = None,
    location: Annotated[str | None, Query(description="Partial match on location")] = None,
    role_type: Annotated[str | None, Query(description="Partial match on role_type")] = None,
    source: Annotated[str | None, Query(description="Partial match on source")] = None,
    search: Annotated[str | None, Query(description="Full-text search across title, company, description, location")] = None,
    is_saved: Annotated[bool | None, Query(description="Filter by saved status")] = None,
    limit: Annotated[int, Query(ge=1, le=200, description="Max results (default 50)")] = 50,
    offset: Annotated[int, Query(ge=0, description="Pagination offset")] = 0,
) -> List[Job]:
    q = db.query(Job)

    if status is not None:
        q = q.filter(Job.status == status)
    if min_score is not None:
        q = q.filter(Job.fit_score >= min_score)
    if location is not None:
        q = q.filter(Job.location.ilike(f"%{location}%"))
    if role_type is not None:
        q = q.filter(Job.role_type.ilike(f"%{role_type}%"))
    if source is not None:
        q = q.filter(Job.source.ilike(f"%{source}%"))
    if search is not None:
        term = f"%{search}%"
        q = q.filter(or_(
            Job.title.ilike(term),
            Job.company.ilike(term),
            Job.description.ilike(term),
            Job.location.ilike(term),
        ))
    if is_saved is not None:
        q = q.filter(Job.is_saved == is_saved)

    return (
        q.order_by(Job.fit_score.desc(), Job.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


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


@router.patch("/{job_id}/status", response_model=JobResponse)
def update_status(job_id: int, payload: StatusUpdate, db: Session = Depends(get_db)) -> Job:
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{payload.status}'. Allowed: {sorted(ALLOWED_STATUSES)}",
        )
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.status = payload.status
    db.commit()
    db.refresh(job)
    return job


@router.patch("/{job_id}/saved", response_model=JobResponse)
def update_saved(job_id: int, payload: SavedUpdate, db: Session = Depends(get_db)) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.is_saved = payload.is_saved
    db.commit()
    db.refresh(job)
    return job
