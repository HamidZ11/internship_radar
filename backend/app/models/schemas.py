from datetime import date, datetime
from pydantic import BaseModel, HttpUrl


class JobCreate(BaseModel):
    title: str
    company: str
    location: str
    url: HttpUrl
    source: str
    description: str
    role_type: str
    posted_date: date | None = None
    deadline: date | None = None


ALLOWED_STATUSES = {"new", "applied", "interview", "rejected", "offer"}


class SavedUpdate(BaseModel):
    is_saved: bool


class StatusUpdate(BaseModel):
    status: str


class JobResponse(BaseModel):
    id: int
    title: str
    company: str
    location: str
    url: str
    source: str
    description: str
    role_type: str
    posted_date: date | None
    deadline: date | None
    fit_score: int
    status: str
    is_saved: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
