"""Regression tests for keyword matching in app/services/scoring.py.

Matcher-level tests call `matches_term` directly. Terms such as C#, C++, .NET
and Node.js are not in the configured keyword lists; they are tested here only
to prove the matcher handles punctuation-heavy names correctly if they are
ever added. Scoring-level tests use the real configured keywords.
"""
import pytest

from app.services.scoring import calculate_fit_score, explain_fit_score, find_term, matches_term


def job(**kwargs) -> dict:
    return {"title": "", "location": "", "description": "", "role_type": "", **kwargs}


def rule(explanation, key):
    return next(r for r in explanation.rules if r.key == key)


# ── False positives: a term inside an unrelated longer word ─────────────────

@pytest.mark.parametrize("term,text", [
    ("git", "We lead digital transformation"),
    ("git", "DIGITAL SERVICES TEAM"),
    ("git", "a legitimate concern"),
    ("rest", "If you are interested in"),
    ("rest", "AREAS OF INTEREST"),
    ("rest", "the forest service"),
    ("sales", "Presales consultant"),
    ("sales", "PRESALES"),
    ("java", "Experience with JavaScript"),
    ("react", "A reactive, proactive team"),
    ("legal", "Nothing illegal or paralegal here"),
    ("api", "rapid growth in capital markets"),
    ("aws", "employment laws"),
    ("agile", "fragile systems"),
    ("uk", "Dukinfield, Ukraine"),
    ("hr", "three hrs a day, 24hr cover"),
    ("hr", "HRIS administrator"),
    ("cloud", "SoundCloud"),
    ("sql", "a squeal"),
])
def test_term_does_not_match_inside_unrelated_words(term, text):
    assert not matches_term(text, term)


def test_short_terms_do_not_take_plural_endings():
    # Plural folding is only for words of six or more letters.
    assert not matches_term("37.5 hrs per week", " hr ")
    assert not matches_term("cleaning gits", "git")


def test_other_inflections_are_not_folded():
    assert not matches_term("paid volunteering days", "volunteer")
    assert not matches_term("an experienced engineer", "experience")


# ── True positives ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("term,text", [
    ("git", "Version control with Git."),
    ("git", "git"),
    ("git", "Tools: git/GitHub"),
    ("rest", "Build REST services"),
    ("rest", "rest and GraphQL"),
    ("python", "PYTHON"),
    ("python", "Python"),
    ("python", "python"),
    ("kubernetes", "Docker and Kubernetes."),
    ("docker", "Docker."),
    ("manchester", "Greater Manchester"),
    ("uk", "London, UK"),
    ("uk", "UK-wide"),
    ("hybrid", "Hybrid (2 days in office)"),
])
def test_standalone_terms_match(term, text):
    assert matches_term(text, term)


@pytest.mark.parametrize("term,text,matched", [
    ("rest", "RESTful APIs", "REST"),
    ("sql", "PostgreSQL and MySQL", "SQL"),
    ("sql", "Some NoSQL", "SQL"),
    ("api", "Build APIs", "API"),
    ("api", "FastAPI services", "API"),
])
def test_capitalised_acronyms_inside_mixed_case_words_match(term, text, matched):
    assert find_term(text, term) == matched


def test_lowercase_compound_is_not_treated_as_an_acronym():
    assert not matches_term("postgresql and restful", "sql")
    assert not matches_term("restful", "rest")


@pytest.mark.parametrize("term,text", [
    ("placement", "Industrial Placements 2026"),
    ("internship", "Summer Internships"),
    ("graduate scheme", "Our Graduate Schemes"),
    ("finance", "personal finances"),
    ("volunteer", "Volunteers welcome"),
])
def test_longer_words_match_their_plural(term, text):
    assert matches_term(text, term)


def test_plural_folding_does_not_overrun_into_other_words():
    assert not matches_term("graduate schemer", "graduate scheme")


# ── Punctuation-heavy terms ─────────────────────────────────────────────────

@pytest.mark.parametrize("term,text", [
    ("ci/cd", "CI/CD pipelines"),
    ("ci/cd", "(CI/CD)"),
    ("ci/cd", "automation, ci/cd, testing"),
    ("c#", "C#, Java and Go"),
    ("c#", "Strong c# skills"),
    ("c++", "C++ and Python"),
    ("c++", "Modern C++17"),
    (".net", ".NET Core"),
    (".net", "ASP.NET MVC"),
    ("node.js", "Node.js, Express"),
    ("node.js", "(node.js)"),
])
def test_punctuation_heavy_terms_match(term, text):
    assert matches_term(text, term)


@pytest.mark.parametrize("term,text", [
    ("ci/cd", "ci-cd"),
    ("c#", "ABC#"),
    ("c++", "ABC++"),
    (".net", "the .network team"),
    ("node.js", "Node.jsx files"),
    ("node.js", "nodejs"),
])
def test_punctuation_heavy_terms_keep_their_boundaries(term, text):
    assert not matches_term(text, term)


# ── Phrases ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("term,text", [
    ("graduate scheme", "Technology Graduate Scheme 2026"),
    ("graduate scheme", "graduate\nscheme"),
    ("graduate scheme", "graduate  scheme"),
    ("graduate only", "This role is for graduate only applicants"),
    ("human resources", "Human Resources team"),
    ("united kingdom", "London, United Kingdom"),
])
def test_configured_phrases_match(term, text):
    assert matches_term(text, term)


def test_phrase_words_must_appear_together():
    assert not matches_term("graduate of our scheme", "graduate scheme")
    assert not matches_term("undergraduate scheme", "graduate scheme")


def test_padded_hr_term_matches_the_word_hr_with_punctuation():
    # " hr " was padded to force word boundaries; the matcher now does that itself.
    for text in ["HR department", "(HR)", "Finance and HR.", "HR/Payroll"]:
        assert matches_term(text, " hr "), text


# ── Boundaries ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "python.", "python,", "python;", "python:", "(python)", "[python]",
    "python/django", "“Python”", "Python's", "Python-based", "end of sentence. Python",
])
def test_boundaries_around_a_term(text):
    assert matches_term(text, "python")


def test_letters_or_digits_glued_to_a_term_block_it():
    assert not matches_term("pythonic", "python")
    assert not matches_term("python3", "python")


# ── Scoring-level regressions with the configured rules ─────────────────────

def test_digital_no_longer_earns_modern_stack_points():
    e = explain_fit_score(job(description="Join our digital team."))
    assert rule(e, "stack").points == 0


def test_interest_no_longer_earns_modern_stack_points():
    e = explain_fit_score(job(description="If you are interested, apply."))
    assert rule(e, "stack").points == 0


def test_presales_is_not_matched_through_sales():
    # "presales" is now an off-target term in its own right; "sales" must not match inside it.
    e = explain_fit_score(job(title="Presales Placement"))
    assert rule(e, "off_target").evidence == (("presales", "Presales"),)


def test_javascript_counts_once_not_as_java_too():
    e = explain_fit_score(job(description="JavaScript"))
    assert rule(e, "tech").evidence == (("javascript", "JavaScript"),)
    assert rule(e, "tech").points == 5


def test_restful_still_counts_for_modern_stack():
    e = explain_fit_score(job(description="Design RESTful services"))
    assert rule(e, "stack").evidence == (("rest", "REST"),)


def test_plural_role_type_in_title_still_scores():
    assert calculate_fit_score(job(title="Engineering Placements")) == 30


def test_evidence_records_the_matched_text():
    e = explain_fit_score(job(description="Experience with PostgreSQL and Git."))
    assert rule(e, "tech").evidence == (("sql", "SQL"),)
    assert rule(e, "stack").evidence == (("git", "Git"),)
    assert rule(e, "requirements").evidence == (("experience", "Experience"),)


def test_explanation_total_matches_calculate_fit_score():
    j = job(
        title="Software Engineering Placement",
        location="Manchester",
        description="Python, React and SQL experience required. We use Docker and AWS.",
        role_type="Industrial Placement",
    )
    e = explain_fit_score(j)
    assert e.score == calculate_fit_score(j) == 85
    assert e.raw == sum(r.points for r in e.rules)
