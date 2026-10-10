"""The score explanation in job responses comes from the real scorer and adds up."""
from datetime import date, datetime
from types import SimpleNamespace

import pytest

from app.models.schemas import JobResponse
from app.services import scoring
from app.services.fit_breakdown import RULE_COPY
from app.services.scoring import calculate_fit_score

RULE_ORDER = ["role", "tech", "location", "requirements", "stack", "graduate", "unpaid", "off_target"]

JOBS = {
    "placement": dict(
        title="Software Engineering Placements 2026", company="Acme", location="Manchester",
        role_type="", description="Build RESTful services with FastAPI and Python. Requirements: Git, Docker.",
    ),
    "graduate": dict(
        title="Technical Graduate Programme 2026", company="CGI", location="Leeds, UK",
        role_type="Graduate Scheme", description="Java and SQL on cloud platforms. Skills we need.",
    ),
    "off_target": dict(
        title="Business Development Placement", company="HPE", location="Winnersh",
        role_type="placement", description="Meet the requirements of our customers.",
    ),
    "unpaid": dict(
        title="Volunteer Coding Mentor", company="Charity", location="Remote",
        role_type="internship", description="This is an unpaid role for students.",
    ),
    "empty": dict(title="", company="", location="", role_type="", description=""),
}


def response(job: dict, fit_score: int | None = None) -> dict:
    row = SimpleNamespace(
        id=1, url="https://example.com/1", source="ratemyplacement", posted_date=None,
        deadline=date(2026, 5, 31), status="new", is_saved=False,
        created_at=datetime(2026, 4, 28, 17, 7), updated_at=datetime(2026, 5, 3),
        fit_score=calculate_fit_score(job) if fit_score is None else fit_score, **job,
    )
    return JobResponse.model_validate(row).model_dump(mode="json")


def rules(body: dict) -> dict[str, dict]:
    return {r["key"]: r for r in body["fit_breakdown"]["rules"]}


@pytest.mark.parametrize("name", JOBS)
def test_response_shape(name):
    body = response(JOBS[name])
    fb = body["fit_breakdown"]
    assert set(fb) == {"score", "raw", "category", "rules"}
    assert [r["key"] for r in fb["rules"]] == RULE_ORDER
    for r in fb["rules"]:
        assert set(r) == {"key", "label", "rule", "kind", "state", "points", "max", "evidence"}
        assert r["label"] and r["rule"]
        for ev in r["evidence"]:
            assert set(ev) == {"term", "matched", "word"}


@pytest.mark.parametrize("name", JOBS)
def test_breakdown_adds_up_to_the_persisted_score(name):
    job = JOBS[name]
    body = response(job)
    fb = body["fit_breakdown"]
    assert sum(r["points"] for r in fb["rules"]) == fb["raw"]
    assert fb["score"] == max(0, min(100, fb["raw"]))
    assert fb["score"] == calculate_fit_score(job) == body["fit_score"]


def test_gain_and_penalty_states():
    r = rules(response(JOBS["graduate"]))
    for key in ["role", "tech", "location", "requirements", "stack"]:
        assert r[key]["kind"] == "gain"
        assert r[key]["state"] == ("matched" if r[key]["points"] > 0 else "unmatched")
    assert r["graduate"] == r["graduate"] | {"kind": "penalty", "state": "penalty", "points": scoring.GRADUATE_PENALTY, "max": None}
    assert r["unpaid"]["state"] == "unmatched" and r["unpaid"]["points"] == 0 and r["unpaid"]["evidence"] == []


def test_each_penalty_reports_its_evidence():
    assert rules(response(JOBS["off_target"]))["off_target"]["evidence"] == [
        {"term": "business development", "matched": "Business Development", "word": "Business Development"},
    ]
    unpaid = rules(response(JOBS["unpaid"]))["unpaid"]
    assert unpaid["state"] == "penalty" and unpaid["points"] == scoring.UNPAID_PENALTY
    assert unpaid["evidence"][0]["term"] == "volunteer"


def test_evidence_names_the_word_a_match_sits_in():
    r = rules(response(JOBS["placement"]))
    assert {"term": "api", "matched": "API", "word": "FastAPI"} in r["tech"]["evidence"]
    assert {"term": "rest", "matched": "REST", "word": "RESTful"} in r["stack"]["evidence"]
    assert r["role"]["evidence"] == [{"term": "placement", "matched": "Placements", "word": "Placements"}]


def test_gain_maximums_come_from_the_scorer():
    r = rules(response(JOBS["empty"]))
    assert {k: r[k]["max"] for k in RULE_ORDER} == {
        "role": scoring.ROLE_POINTS, "tech": scoring.TECH_POINTS_MAX, "location": scoring.LOCATION_PRIMARY_POINTS,
        "requirements": scoring.REQUIREMENTS_POINTS, "stack": scoring.STACK_POINTS,
        "graduate": None, "unpaid": None, "off_target": None,
    }
    assert all(r[k]["state"] == "unmatched" and r[k]["points"] == 0 for k in RULE_ORDER)


def test_every_scoring_rule_has_display_copy():
    keys = [r.key for r in scoring.explain_fit_score(JOBS["empty"]).rules]
    assert keys == RULE_ORDER == list(RULE_COPY)


def test_a_stale_stored_score_is_returned_as_stored_not_overwritten():
    body = response(JOBS["placement"], fit_score=99)
    assert body["fit_score"] == 99
    assert body["fit_breakdown"]["score"] == calculate_fit_score(JOBS["placement"]) != 99


def test_openapi_schema_documents_the_breakdown():
    schema = JobResponse.model_json_schema(mode="serialization")
    assert "fit_breakdown" in schema["properties"]
    assert "fit_breakdown" in schema["required"]
