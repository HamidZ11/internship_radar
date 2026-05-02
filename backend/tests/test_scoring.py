from app.services.scoring import calculate_fit_score


def job(**kwargs) -> dict:
    return {"title": "", "location": "", "description": "", "role_type": "", **kwargs}


# ── role match ────────────────────────────────────────────────────────────────

def test_placement_in_title_adds_30():
    assert calculate_fit_score(job(title="Software Placement")) == 30

def test_internship_in_title_adds_30():
    assert calculate_fit_score(job(title="Summer Internship")) == 30

def test_placement_in_role_type_adds_30():
    assert calculate_fit_score(job(role_type="Industrial Placement")) == 30

def test_internship_in_role_type_adds_30():
    assert calculate_fit_score(job(role_type="Internship")) == 30

def test_no_role_signal_scores_zero():
    assert calculate_fit_score(job(title="Software Developer")) == 0


# ── tech match ────────────────────────────────────────────────────────────────

def test_one_tech_keyword_adds_5():
    assert calculate_fit_score(job(description="Proficiency in Python.")) == 5

def test_two_tech_keywords_add_10():
    assert calculate_fit_score(job(description="Python and React required.")) == 10

def test_tech_score_capped_at_30():
    desc = "python javascript typescript react sql api apis java"
    score = calculate_fit_score(job(description=desc))
    # tech capped at 30, nothing else
    assert score == 30

def test_tech_keyword_in_title_counts():
    assert calculate_fit_score(job(title="Python Placement")) == 30 + 5


# ── location ─────────────────────────────────────────────────────────────────

def test_manchester_adds_20():
    assert calculate_fit_score(job(location="Manchester")) == 20

def test_remote_adds_10():
    assert calculate_fit_score(job(location="Remote")) == 10

def test_uk_adds_10():
    assert calculate_fit_score(job(location="London, UK")) == 10

def test_hybrid_adds_10():
    assert calculate_fit_score(job(location="Hybrid")) == 10

def test_unknown_location_adds_0():
    assert calculate_fit_score(job(location="Paris")) == 0


# ── quality signals ───────────────────────────────────────────────────────────

def test_quality_signal_word_adds_10():
    assert calculate_fit_score(job(description="Good communication skills required.")) == 10

def test_tech_stack_keyword_adds_10():
    assert calculate_fit_score(job(description="We use Docker and AWS.")) == 10

def test_both_quality_signals_add_20():
    assert calculate_fit_score(job(description="Strong Python skills required. We use Docker.")) == 5 + 10 + 10


# ── penalties ─────────────────────────────────────────────────────────────────

def test_graduate_scheme_in_title_subtracts_40():
    score = calculate_fit_score(job(title="Graduate Scheme Software"))
    assert score == 0  # -40, clamped

def test_graduate_only_in_description_subtracts_40():
    score = calculate_fit_score(job(
        title="Software Internship",
        description="This role is for graduate only candidates.",
    ))
    # +30 (internship) -40 (graduate only) → clamped to 0
    assert score == 0

def test_unpaid_subtracts_50():
    score = calculate_fit_score(job(
        title="Software Placement",
        description="This is an unpaid role.",
    ))
    # +30 - 50 → clamped to 0
    assert score == 0

def test_volunteer_subtracts_50():
    score = calculate_fit_score(job(title="Volunteer Software Placement"))
    # +30 - 50 → clamped to 0
    assert score == 0

def test_irrelevant_role_subtracts_30():
    score = calculate_fit_score(job(title="Marketing Placement"))
    # +30 (placement) - 30 (marketing) = 0
    assert score == 0

def test_finance_role_subtracts_30():
    score = calculate_fit_score(job(title="Finance Internship"))
    # +30 - 30 = 0
    assert score == 0


# ── clamping ──────────────────────────────────────────────────────────────────

def test_score_never_exceeds_100():
    score = calculate_fit_score(job(
        title="Python React SQL Placement",
        location="Manchester",
        description="python javascript typescript react sql api experience with docker aws skills",
        role_type="Internship",
    ))
    assert score <= 100

def test_score_never_below_zero():
    score = calculate_fit_score(job(
        title="Graduate Scheme Volunteer",
        description="unpaid, graduate only, marketing finance",
    ))
    assert score == 0


# ── case insensitivity ────────────────────────────────────────────────────────

def test_case_insensitive_title():
    assert calculate_fit_score(job(title="SUMMER INTERNSHIP")) == 30

def test_case_insensitive_location():
    assert calculate_fit_score(job(location="MANCHESTER")) == 20

def test_case_insensitive_description():
    assert calculate_fit_score(job(description="PYTHON AND SQL")) == 10


# ── None / missing safety ─────────────────────────────────────────────────────

def test_none_fields_do_not_raise():
    score = calculate_fit_score({"title": None, "location": None, "description": None, "role_type": None})
    assert score == 0

def test_missing_fields_do_not_raise():
    assert calculate_fit_score({}) == 0


# ── realistic combined cases ──────────────────────────────────────────────────

def test_strong_tech_placement():
    score = calculate_fit_score(job(
        title="Software Engineering Placement",
        location="Manchester",
        description="Python, React and SQL experience required. We use Docker and AWS.",
        role_type="Industrial Placement",
    ))
    # role=30, tech=python(5)+react(5)+sql(5)=15, location=20, quality=10+10=20 → 85
    assert score == 85

def test_weak_unpaid_grad_scheme():
    score = calculate_fit_score(job(
        title="Graduate Scheme",
        location="London",
        description="Graduate only. Unpaid position in marketing.",
    ))
    assert score == 0
