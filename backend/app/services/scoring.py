"""Fit scoring for job listings.

Rules, weights and keyword lists are the scoring model; this module also owns
how a keyword is recognised in listing text (see `find_term`) and which part of
a listing each rule is allowed to read (see "Evidence" below).

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

Evidence (which text each rule reads):

- Rules about what the role IS (role type, graduate, unpaid, off-target) read
  the structured role_type and the role part of the title (`role_title`), not
  the free-text description, which also carries employer blurbs, benefits,
  legal footers and qualification examples. The description is used only for
  statements about this listing: an explicit "graduate only" eligibility
  restriction, "unpaid"/"volunteer" directly describing the role, and, inside
  `role_title`, recognising an employer name that the description introduces.
- The off-target penalty classifies the role's function. A title that names a
  technical role ("Software Engineer - Finance Platform", "Marketing Data
  Analyst") is a technical role working in that domain and is not penalised.
- Rules about what the role INVOLVES (tech, requirements, modern stack) read
  the description, as before.
- Plural aliases inside one keyword list ("api", "apis") are one concept and
  are counted once.
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
    # Non-technical role families seen in real titles (reviewed against the dataset).
    "business development", "presales", "audit", "tax", "actuarial", "key account",
]

# Role names that make a title a technical role, whatever its domain. Only used
# to stop the off-target penalty; they earn no points.
_TECHNICAL_ROLE_TERMS = [
    "software", "developer", "programmer", "engineer", "engineering",
    "data", "ai", "machine learning", "cyber",
]

_LOCATION_PRIMARY_TERMS = ["manchester"]
_LOCATION_SECONDARY_TERMS = ["uk", "remote", "hybrid", "united kingdom"]
_REQUIREMENT_TERMS = ["requirements", "skills", "experience"]
_GRADUATE_ONLY_TERMS = ["graduate only"]
_UNPAID_TERMS = ["unpaid", "volunteer"]

# Role categories, in precedence order. Placements and internships are the
# product's target (undergraduate work experience) and earn the role bonus.
# Graduate roles are penalised. Apprenticeships are recognised deliberately but
# are outside the target: most are alternatives to a degree for school leavers,
# so they earn no bonus and no penalty.
_ROLE_CATEGORIES: list[tuple[str, list[str]]] = [
    ("placement", ["placement"]),
    ("internship", ["internship"]),
    ("graduate", ["graduate"]),
    ("apprenticeship", ["apprenticeship"]),
]
_TARGET_CATEGORIES = {"placement", "internship"}

# Nouns that make "unpaid"/"volunteer" in a description a statement about a role.
_ROLE_NOUNS = [
    "role", "roles", "position", "post", "posts", "job", "jobs",
    "vacancy", "vacancies", "placement", "internship", "apprenticeship",
]
_TITLE_SEPARATOR = re.compile(r"\s+[-–—|]\s+")

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


@lru_cache(maxsize=None)
def _describes_role_pattern(term: str) -> re.Pattern[str]:
    # The term and a role noun within two words of each other, in the same sentence.
    t = _term_patterns(term)[0].pattern
    nouns = "|".join(_term_patterns(n)[0].pattern for n in _ROLE_NOUNS)
    gap = r"(?:[^\w.!?;]+\w+){0,2}[^\w.!?;]+"
    return re.compile(rf"(?:{t}){gap}(?:{nouns})|(?:{nouns}){gap}(?:{t})", re.IGNORECASE)


def find_term_describing_role(text: str | None, term: str) -> str | None:
    """Like find_term, but only where the term describes a role ("an unpaid role",
    "the internship is unpaid"), not a benefit ("volunteer days", "unpaid leave")."""
    if not text:
        return None
    match = _describes_role_pattern(term).search(text)
    return match.group(0) if match else None


# ── Listing structure ────────────────────────────────────────────────────────

_LEGAL_SUFFIXES = {"ltd", "limited", "plc", "llp", "inc", "group", "uk"}
_PARENTHETICAL = re.compile(r"\(([^()]*)\)")
_ORGANISATION_CUES = [
    # How descriptions introduce an organisation by name.
    r"\babout\s+{name}(?![^\W_])",
    r"(?<![^\W_]){name}\s+(?:is|are)\s+(?:a|an|the|one|part|proud|hiring|looking|seeking|recruiting)\b",
    r"(?<![^\W_]){name}\s*[,–—]\s*(?:a|an|the|one)\b",
    r"\bat\s+{name}\s*,?\s+(?:we|you|our)\b",
    r"\bjoin(?:ing)?\s+{name}(?![^\W_])",
]


def _tokens(text: str) -> list[str]:
    return re.findall(r"[^\W_]+", text.lower())


def _is_location(part: str, location: str) -> bool:
    words = [t for t in _tokens(part) if not t.isdigit()]
    return bool(words) and set(words) <= set(_tokens(location))


def _is_company(part: str, company: str) -> bool:
    core = set(_tokens(_PARENTHETICAL.sub(" ", company))) - _LEGAL_SUFFIXES
    return bool(core) and core <= set(_tokens(part))


def _is_named_organisation(part: str, description: str) -> bool:
    if _tokens(part) and _tokens(part)[-1] in _LEGAL_SUFFIXES - {"uk"}:
        return True  # "Ogilvie Fleet Ltd", "Harbour Group"
    if not description:
        return False
    for name in re.split(r"\s*[/&]\s*", part.strip()):
        if len(name) < 2:
            continue
        escaped = re.escape(name)
        if any(re.search(cue.format(name=escaped), description, re.IGNORECASE) for cue in _ORGANISATION_CUES):
            return True
    return False


def _annotation(part: str, location: str, company: str, description: str) -> bool:
    """True when a title part is the location, the company or an employer the description introduces."""
    return _is_location(part, location) or _is_company(part, company) or _is_named_organisation(part, description)


def _names_role_category(text: str) -> bool:
    return any(matches_term(text, t) for _, terms in _ROLE_CATEGORIES for t in terms)


def role_title(title: str | None, *, location: str = "", company: str = "", description: str = "") -> str:
    """The part of a listing title that describes the role.

    Titles append parts after a spaced dash or pipe, and in brackets: a role
    specialism ("Graduate Consulting - Actuarial 2026"), the host employer
    ("Software Developer Apprenticeship - Chemistry Marketing"), a location
    ("- Glasgow"), the provider's programme name ("| Spring into Deloitte") or
    an intake ("(Oct 2026)"). Every part is kept unless there is evidence it is
    not about the role: it matches the listing's location or company, the
    description introduces it as an organisation ("About Chemistry Marketing:",
    "MarketAxess – a leading…"), or (in brackets) it is a date or duration.
    Parts that name a role category are always kept. Hyphens inside names
    ("Spirax-Sarco", "Back-End") are not separators.
    """
    title = title or ""
    kept = []
    for segment in (s.strip() for s in _TITLE_SEPARATOR.split(title)):
        if not segment:
            continue

        def drop_bracket(m: re.Match[str]) -> str:
            inner = m.group(1).strip()
            noise = any(ch.isdigit() for ch in inner) or _annotation(inner, location, company, description)
            return " " if noise else m.group(0)

        segment = re.sub(r"\s+", " ", _PARENTHETICAL.sub(drop_bracket, segment)).strip()
        if segment and (_names_role_category(segment) or not _annotation(segment, location, company, description)):
            kept.append(segment)
    return " · ".join(kept) if kept else title


def classify_role(title: str | None, role_type: str | None, *, role_text: str | None = None) -> tuple[str, str | None]:
    """(category, matched text): from the structured role_type first, then the role part of the title."""
    for source in (role_type or "", role_text if role_text is not None else role_title(title)):
        for category, terms in _ROLE_CATEGORIES:
            for term in terms:
                matched = find_term(source, term)
                if matched is not None:
                    return category, matched
    return "other", None


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
    category: str  # placement | internship | graduate | apprenticeship | other
    rules: tuple[RuleResult, ...]


def _concept(term: str, terms: list[str]) -> str:
    """Plural aliases in one list share a concept: "apis" → "api" when both are configured."""
    t = term.strip()
    listed = {x.strip() for x in terms}
    for suffix in ("es", "s"):
        if t.endswith(suffix) and t[: -len(suffix)] in listed:
            return t[: -len(suffix)]
    return t


def _hits(text: str, terms: list[str], find: Finder) -> tuple[tuple[str, str], ...]:
    """Matched (term, text) pairs, one per concept."""
    found, seen = [], set()
    for term in terms:
        concept = _concept(term, terms)
        if concept in seen:
            continue
        matched = find(text, term)
        if matched is not None:
            seen.add(concept)
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
    role_part = role_title(title, location=location, company=job.get("company") or "", description=description)
    role_text = f"{role_part} · {role_type}"

    category, category_text = classify_role(title, role_type, role_text=role_part)
    role = ((category, category_text),) if category in _TARGET_CATEGORIES and category_text else ()
    tech = _hits(title_desc, _TECH_KEYWORDS, find)
    primary = _hits(location, _LOCATION_PRIMARY_TERMS, find)
    secondary = () if primary else _hits(location, _LOCATION_SECONDARY_TERMS, find)
    requirements = _hits(description, _REQUIREMENT_TERMS, find)
    stack = _hits(description, _QUALITY_STACK_KEYWORDS, find)
    graduate = (
        (("graduate", category_text or "graduate"),) if category == "graduate"
        else _hits(description, _GRADUATE_ONLY_TERMS, find)
    )
    unpaid = _hits(role_text, _UNPAID_TERMS, find) or _hits(description, _UNPAID_TERMS, find_term_describing_role)
    technical = any(find(role_text, t) is not None for t in _TECHNICAL_ROLE_TERMS)
    irrelevant = () if technical else _hits(role_text, _IRRELEVANT_KEYWORDS, find)

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
    return FitExplanation(score=max(0, min(100, raw)), raw=raw, category=category, rules=rules)


def calculate_fit_score(job: dict) -> int:
    return explain_fit_score(job).score
