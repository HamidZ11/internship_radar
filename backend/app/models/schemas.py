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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
