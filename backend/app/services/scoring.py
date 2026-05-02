_TECH_KEYWORDS = [
    "python", "java", "javascript", "typescript", "react",
    "sql", "api", "apis",
]

_QUALITY_STACK_KEYWORDS = [
    "git", "linux", "docker", "aws", "azure", "cloud",
    "agile", "scrum", "rest", "ci/cd", "kubernetes",
]

_IRRELEVANT_KEYWORDS = [
    "marketing", "finance", "accounting", "legal", "sales",
    "human resources", " hr ", "procurement", "actuary",
]


def _lower(text: str | None) -> str:
    return (text or "").lower()


def _count_hits(text: str, keywords: list[str]) -> int:
    return sum(1 for kw in keywords if kw in text)


def _role_score(title: str, role_type: str) -> int:
    combined = f"{title} {role_type}"
    if "placement" in combined or "internship" in combined:
        return 30
    return 0


def _graduate_penalty(title: str, description: str) -> int:
    combined = f"{title} {description}"
    if "graduate scheme" in combined or "graduate only" in combined:
        return -40
    return 0


def _tech_score(title: str, description: str) -> int:
    combined = f"{title} {description}"
    return min(_count_hits(combined, _TECH_KEYWORDS) * 5, 30)


def _location_score(location: str) -> int:
    if "manchester" in location:
        return 20
    if any(kw in location for kw in ["uk", "remote", "hybrid", "united kingdom"]):
        return 10
    return 0


def _quality_score(description: str) -> int:
    score = 0
    if any(kw in description for kw in ["requirements", "skills", "experience"]):
        score += 10
    if _count_hits(description, _QUALITY_STACK_KEYWORDS) > 0:
        score += 10
    return score


def _penalty(title: str, description: str) -> int:
    combined = f"{title} {description}"
    total = 0
    if "unpaid" in combined or "volunteer" in combined:
        total -= 50
    if any(kw in combined for kw in _IRRELEVANT_KEYWORDS):
        total -= 30
    return total


def calculate_fit_score(job: dict) -> int:
    title = _lower(job.get("title"))
    location = _lower(job.get("location"))
    description = _lower(job.get("description"))
    role_type = _lower(job.get("role_type"))

    score = (
        _role_score(title, role_type)
        + _tech_score(title, description)
        + _location_score(location)
        + _quality_score(description)
        + _graduate_penalty(title, description)
        + _penalty(title, description)
    )

    return max(0, min(100, score))
