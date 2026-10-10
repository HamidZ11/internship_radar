"""Fit scoring for job listings.

Rules, weights and keyword lists are the scoring model; this module also owns
how a keyword is recognised in listing text (see `find_term`).

Matching rules (applied to every keyword and phrase, case-insensitive):

1. Whole terms only. A term may not be glued to a letter or digit on either
   side, so "git" does not match "digital" and "rest" does not match
   "interest". Punctuation, whitespace, slashes, brackets and hyphens all count
   as boundaries ("React-based", "(Python)", "CI/CD,").
2. Punctuation inside a term is literal ("ci/cd", "c#", ".net"). Boundaries are
   only enforced on edges that are letters or digits, so ".net" still matches
   "ASP.NET" while not matching ".network".
3. Multi-word phrases match across any run of whitespace ("graduate  scheme").
4. Words of six or more letters also match their plural ("placements",
   "graduate schemes"). Shorter tokens are often acronyms or verbs and must
   match exactly, so "hr" never matches "hrs".
5. A single-token term also matches when written in capitals inside a
   mixed-case word: "RESTful", "PostgreSQL", "APIs". An all-caps run that
   meets lowercase letters is a reliable sign of an embedded acronym, while
   "DIGITAL" or "PRESALES" (capitals on both sides) still do not match.
"""
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Callable

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

# Terms that were previously written inline in the rule functions.
_ROLE_TERMS = ["placement", "internship"]
_LOCATION_PRIMARY_TERMS = ["manchester"]
_LOCATION_SECONDARY_TERMS = ["uk", "remote", "hybrid", "united kingdom"]
_REQUIREMENT_TERMS = ["requirements", "skills", "experience"]
_GRADUATE_TERMS = ["graduate scheme", "graduate only"]
_UNPAID_TERMS = ["unpaid", "volunteer"]

_PLURAL_MIN_LETTERS = 6
_LETTER_OR_DIGIT = r"[^\W_]"

# ── Matching ─────────────────────────────────────────────────────────────────

Finder = Callable[[str, str], "str | None"]


@lru_cache(maxsize=None)
def _term_patterns(term: str) -> tuple[re.Pattern[str], re.Pattern[str] | None]:
    t = term.strip().lower()
    words = t.split()
    body = r"\s+".join(re.escape(w) for w in words)
    if words[-1].isalpha() and len(words[-1]) >= _PLURAL_MIN_LETTERS:
        body += r"(?:e?s)?"
    left = rf"(?<!{_LETTER_OR_DIGIT})" if t[0].isalnum() else ""
    right = rf"(?!{_LETTER_OR_DIGIT})" if t[-1].isalnum() else ""
    whole = re.compile(left + body + right, re.IGNORECASE)

    acronym = None
    if t.isalnum() and any(c.isalpha() for c in t):
        acronym = re.compile(rf"(?<![A-Z0-9]){re.escape(t.upper())}(?![A-Z0-9])")
    return whole, acronym


def find_term(text: str | None, term: str) -> str | None:
    """Return the text that matched `term` in `text`, or None. See module docstring."""
    if not text:
        return None
    whole, acronym = _term_patterns(term)
    match = whole.search(text) or (acronym.search(text) if acronym else None)
    return match.group(0) if match else None


def matches_term(text: str | None, term: str) -> bool:
    return find_term(text, term) is not None


# ── Rules ────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class RuleResult:
    key: str
    points: int
    evidence: tuple[tuple[str, str], ...]  # (configured term, matched text)


@dataclass(frozen=True)
class FitExplanation:
    score: int  # clamped to 0–100; this is the stored fit_score
    raw: int
    rules: tuple[RuleResult, ...]


def _hits(text: str, terms: list[str], find: Finder) -> tuple[tuple[str, str], ...]:
    found = []
    for term in terms:
        matched = find(text, term)
        if matched is not None:
            found.append((term.strip(), matched))
    return tuple(found)


def explain_fit_score(job: dict, *, find: Finder = find_term) -> FitExplanation:
    """Score a job and record which terms each rule matched.

    `find` exists so tooling (e.g. scripts/dry_run_rescore.py) can compare
    matchers on identical rules; production callers use the default.
    """
    title = job.get("title") or ""
    location = job.get("location") or ""
    description = job.get("description") or ""
    role_type = job.get("role_type") or ""
    title_desc = f"{title} {description}"

    role = _hits(f"{title} {role_type}", _ROLE_TERMS, find)
    tech = _hits(title_desc, _TECH_KEYWORDS, find)
    primary = _hits(location, _LOCATION_PRIMARY_TERMS, find)
    secondary = () if primary else _hits(location, _LOCATION_SECONDARY_TERMS, find)
    requirements = _hits(description, _REQUIREMENT_TERMS, find)
    stack = _hits(description, _QUALITY_STACK_KEYWORDS, find)
    graduate = _hits(title_desc, _GRADUATE_TERMS, find)
    unpaid = _hits(title_desc, _UNPAID_TERMS, find)
    irrelevant = _hits(title_desc, _IRRELEVANT_KEYWORDS, find)

    rules = (
        RuleResult("role", 30 if role else 0, role),
        RuleResult("tech", min(len(tech) * 5, 30), tech),
        RuleResult("location", 20 if primary else 10 if secondary else 0, primary or secondary),
        RuleResult("requirements", 10 if requirements else 0, requirements),
        RuleResult("stack", 10 if stack else 0, stack),
        RuleResult("graduate", -40 if graduate else 0, graduate),
        RuleResult("unpaid", -50 if unpaid else 0, unpaid),
        RuleResult("off_target", -30 if irrelevant else 0, irrelevant),
    )
    raw = sum(r.points for r in rules)
    return FitExplanation(score=max(0, min(100, raw)), raw=raw, rules=rules)


def calculate_fit_score(job: dict) -> int:
    return explain_fit_score(job).score
