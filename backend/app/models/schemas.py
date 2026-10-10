from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, HttpUrl, computed_field

from app.services.fit_breakdown import fit_breakdown


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


class FitEvidence(BaseModel):
    term: str     # the configured keyword
    matched: str  # the listing text that matched it
    word: str     # the word or phrase that text sits in, e.g. "RESTful" for "rest"


class FitRule(BaseModel):
    key: str
    label: str
    rule: str  # the rule in plain words
    kind: Literal["gain", "penalty"]
    state: Literal["matched", "unmatched", "penalty"]  # "penalty": a penalty rule that fired
    points: int
    max: int | None  # most a gain can add; None for penalties
    evidence: list[FitEvidence]


class FitBreakdown(BaseModel):
    """explain_fit_score() for this listing. `score` equals the stored fit_score unless it is stale."""
    score: int
    raw: int  # sum of rule points before clamping to 0–100
    category: str
    rules: list[FitRule]


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

    @computed_field
    @property
    def fit_breakdown(self) -> FitBreakdown:
        return FitBreakdown.model_validate(fit_breakdown(
            title=self.title, company=self.company, location=self.location,
            description=self.description, role_type=self.role_type,
        ))
