"""
The fit-score explanation sent to the frontend.

Built only from explain_fit_score(), so the browser never re-implements
scoring. This module adds display copy (label, plain-words rule) and shapes
the result; point values come from scoring.py.
"""
from functools import lru_cache

from app.services import scoring
from app.services.scoring import FitExplanation, explain_fit_score

# key: (label, rule in plain words, most points a gain can add or None for a penalty)
RULE_COPY: dict[str, tuple[str, str, int | None]] = {
    "role": ("Role type", "Role type or title is a placement or internship", scoring.ROLE_POINTS),
    "tech": (
        "Tech keywords",
        f"+{scoring.TECH_POINTS_EACH} per keyword in title or description, up to {scoring.TECH_POINTS_MAX}",
        scoring.TECH_POINTS_MAX,
    ),
    "location": (
        "Location",
        f"Manchester +{scoring.LOCATION_PRIMARY_POINTS} · UK, remote or hybrid +{scoring.LOCATION_SECONDARY_POINTS}",
        scoring.LOCATION_PRIMARY_POINTS,
    ),
    "requirements": ("States requirements", "Mentions requirements, skills or experience", scoring.REQUIREMENTS_POINTS),
    "stack": ("Modern stack", "Mentions git, linux, docker, cloud, agile and similar", scoring.STACK_POINTS),
    "graduate": ("Graduate role", "Role type or title is graduate, or the listing says “graduate only”", None),
    "unpaid": ("Unpaid or volunteer", "Title or type says unpaid or volunteer, or the description calls the role unpaid", None),
    "off_target": ("Off-target department", "Role title names marketing, finance, sales, legal and similar", None),
}
PENALTIES = {"graduate", "unpaid", "off_target"}


@lru_cache(maxsize=4096)
def _explain(title: str, company: str, location: str, description: str, role_type: str) -> FitExplanation:
    # Scoring reads long descriptions with many patterns (~5 ms a listing), so the
    # explanation is cached by listing content. Rules only change on restart.
    return explain_fit_score({
        "title": title, "company": company, "location": location,
        "description": description, "role_type": role_type,
    })


def fit_breakdown(*, title: str, company: str, location: str, description: str, role_type: str) -> dict:
    e = _explain(title or "", company or "", location or "", description or "", role_type or "")
    rules = []
    for r in e.rules:
        label, rule, max_points = RULE_COPY[r.key]
        penalty = r.key in PENALTIES
        rules.append({
            "key": r.key,
            "label": label,
            "rule": rule,
            "kind": "penalty" if penalty else "gain",
            "state": ("penalty" if penalty else "matched") if r.points else "unmatched",
            "points": r.points,
            "max": max_points,
            "evidence": [
                {"term": term, "matched": matched, "word": word}
                for (term, matched), word in zip(r.evidence, r.words)
            ],
        })
    return {"score": e.score, "raw": e.raw, "category": e.category, "rules": rules}
