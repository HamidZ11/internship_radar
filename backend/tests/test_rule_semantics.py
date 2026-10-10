"""Rule-intent tests: each rule reads evidence about the role itself.

Listing text below is modelled on patterns seen in real scraped listings
(qualification examples, legal footers, benefits, employer names in titles).
"""
from app.services.scoring import (
    calculate_fit_score, classify_role, explain_fit_score, find_term_describing_role, role_title,
)


def job(**kwargs) -> dict:
    return {"title": "", "location": "", "description": "", "role_type": "", **kwargs}


def points(j: dict, key: str) -> int:
    return next(r.points for r in explain_fit_score(j).rules if r.key == key)


# ── Title structure ─────────────────────────────────────────────────────────

def test_meaningful_specialism_after_a_dash_is_kept():
    assert role_title("Graduate Consulting - Actuarial 2026 - Manchester", location="Manchester") == "Graduate Consulting · Actuarial 2026"
    assert role_title(
        "BrightStart Level 7 Apprenticeship - Audit and Assurance",
        description="Why this programme. In Audit and Assurance you will learn how companies work.",
    ) == "BrightStart Level 7 Apprenticeship · Audit and Assurance"
    assert role_title("Technical Solutions Level 4 Apprenticeship - Solutions Specialist",
                      description="leading to a Solutions Specialist role at our company") \
        == "Technical Solutions Level 4 Apprenticeship · Solutions Specialist"


def test_employer_suffix_introduced_by_the_description_is_dropped():
    assert role_title("Software Developer Higher Apprenticeship - Chemistry Marketing",
                      description="About Chemistry Marketing: We're a creative agency.") == "Software Developer Higher Apprenticeship"
    assert role_title("Software Engineer Higher Apprenticeship - MarketAxess",
                      description="MarketAxess – a leading electronic trading platform – is hiring.") == "Software Engineer Higher Apprenticeship"
    assert role_title("AI & Automation Higher Apprenticeship - IT Desk",
                      description="About IT Desk UK: At IT Desk we believe in support.") == "AI & Automation Higher Apprenticeship"
    assert role_title("Digital Support Level 3 Apprenticeship - KG Business Services",
                      description="Based in Clydebank, KG Business Services is a growing firm.") == "Digital Support Level 3 Apprenticeship"


def test_one_of_several_employers_being_introduced_is_enough():
    assert role_title("Software Developer Support Level 3 Apprenticeship - Inspire ATA / Detego Global",
                      description="About Inspire ATA & Detego Global: flexi-job provider.") == "Software Developer Support Level 3 Apprenticeship"


def test_employer_with_a_legal_suffix_is_dropped_without_description():
    assert role_title("Digital Office Level 3 Apprenticeship - Safelift Offshore Ltd") == "Digital Office Level 3 Apprenticeship"


def test_location_suffix_is_dropped():
    assert role_title("Information Management Higher Apprenticeship 2026 - Oxford", location="Oxford") \
        == "Information Management Higher Apprenticeship 2026"
    assert role_title("ICT Telecoms Field Engineer Level 3 Apprenticeship - Bridgwater, Taunton",
                      location="Bridgwater, Taunton") == "ICT Telecoms Field Engineer Level 3 Apprenticeship"


def test_provider_annotation_naming_the_company_is_dropped():
    assert role_title("Strategy, Risk & Technology Insight Programme 2026 | Spring into Deloitte", company="Deloitte") \
        == "Strategy, Risk & Technology Insight Programme 2026"
    assert role_title("IT Support Level 3 Apprenticeship - QA", company="QA Limited") == "IT Support Level 3 Apprenticeship"


def test_parenthetical_employer_location_and_intake_are_dropped():
    assert role_title("Systems Development Industrial Placement 2026 (Toyota Motor Europe)",
                      company="Toyota Motor Europe") == "Systems Development Industrial Placement 2026"
    assert role_title("ICT Level 3 Apprenticeship (Risley)", location="Risley, Derby") == "ICT Level 3 Apprenticeship"
    assert role_title("Sales Level 3 Apprenticeship (Oct 2026)") == "Sales Level 3 Apprenticeship"
    assert role_title("Placement 2026 (13 months)") == "Placement 2026"


def test_unexplained_parenthetical_is_kept():
    assert role_title("Technology Consulting (SOC) School Leaver Apprenticeship") == "Technology Consulting (SOC) School Leaver Apprenticeship"


def test_genuinely_hyphenated_names_are_not_split():
    assert role_title("Back-End Developer Internship - Leeds", location="Leeds") == "Back-End Developer Internship"
    assert role_title("Software Integration Higher Apprenticeship - Spirax-Sarco Engineering") \
        == "Software Integration Higher Apprenticeship · Spirax-Sarco Engineering"
    assert role_title("Software Integration Higher Apprenticeship - Spirax-Sarco Engineering",
                      description="Spirax-Sarco Engineering is a world leader in steam systems.") \
        == "Software Integration Higher Apprenticeship"


def test_title_without_annotations_is_kept_whole():
    assert role_title("Software Engineer - Payments") == "Software Engineer · Payments"


# ── Off-target penalty ──────────────────────────────────────────────────────

def test_technical_role_mentioning_finance_as_a_qualification_example_is_not_penalised():
    j = job(title="Level 5 Data Engineer Apprenticeship", role_type="apprenticeship",
            description="You will need an A-Level subject e.g. Maths, Economics or Finance.")
    assert points(j, "off_target") == 0


def test_legal_footer_does_not_penalise_an_internship():
    j = job(title="Digital Summer Internships", role_type="internship",
            description="Build software with our teams. Legal Disclaimer: we are an equal opportunity employer.")
    assert points(j, "off_target") == 0


def test_company_service_list_does_not_penalise_a_technical_role():
    j = job(title="Technology Consulting Apprenticeship", role_type="apprenticeship",
            description="Our services include Consulting, Infrastructure Finance and Forensics.")
    assert points(j, "off_target") == 0


def test_off_target_word_in_the_employer_part_of_the_title_is_not_penalised():
    j = job(title="Software Developer Higher Apprenticeship - Chemistry Marketing", role_type="apprenticeship")
    assert points(j, "off_target") == 0


def test_ai_internship_at_a_finance_firm_is_not_penalised():
    j = job(title="AI Engineering Internship 2026", role_type="internship",
            description="We apply machine learning to financial markets and quantitative finance.")
    assert points(j, "off_target") == 0


def test_genuinely_off_target_roles_are_penalised():
    for title in [
        "Sales Level 3 Apprenticeship",
        "Finance Placement 2026",
        "Accounting Graduate Scheme",
        "Legal Internship",
        "HR Business Partner Placement",
        "Graduate Sales Executive - Corporate",
    ]:
        assert points(job(title=title), "off_target") == -30, title


def test_reviewed_non_technical_role_families_are_penalised():
    for title in [
        "Business Development Placement 2026",
        "Enterprise Architect and Presales Placement 2026 (13 months)",
        "Audit Apprenticeship",
        "Graduate Technology - Technology Audit 2026",
        "Career Starters – Audit and Tax, and Women in Business",
        "Graduate Consulting - Actuarial 2026",
        "Key Accounts Level 3 Apprenticeship",
    ]:
        assert points(job(title=title), "off_target") == -30, title


def test_specialism_after_a_dash_can_make_a_role_off_target():
    j = job(title="BrightStart Level 7 Apprenticeship - Audit and Assurance", role_type="apprenticeship",
            description="In Audit and Assurance you will learn how companies work.")
    assert points(j, "off_target") == -30


def test_technical_roles_in_an_off_target_domain_are_not_penalised():
    for title in [
        "Software Engineer - Finance Platform",
        "Finance Software Engineer Placement",
        "Legal Tech Developer Internship",
        "Audit Data Analyst Apprenticeship",
        "Machine Learning Engineer - Tax Technology",
        "Marketing Data Higher Apprenticeship (Nissan) - Level 4",
    ]:
        assert points(job(title=title), "off_target") == 0, title


def test_employer_suffix_does_not_make_a_non_technical_title_off_target():
    # "IT Support" is not in the technical-role list, so only the parser protects it.
    j = job(title="IT Support Level 3 Apprenticeship - Harbour Marketing Ltd", role_type="apprenticeship")
    assert points(j, "off_target") == 0
    j = job(title="IT Support Level 3 Apprenticeship - Slater and Gordon Legal", role_type="apprenticeship",
            description="About Slater and Gordon Legal: a consumer law firm.")
    assert points(j, "off_target") == 0


def test_without_employer_evidence_a_suffix_is_treated_as_part_of_the_role():
    # Conservative by design: an unexplained suffix is kept, so it can count.
    j = job(title="IT Support Level 3 Apprenticeship - Harbour Marketing", role_type="apprenticeship")
    assert points(j, "off_target") == -30


# ── Graduate penalty ────────────────────────────────────────────────────────

def test_graduate_programme_by_role_type_is_penalised():
    j = job(title="Technical Graduate Programme 2026", role_type="graduate scheme")
    assert points(j, "graduate") == -40


def test_graduate_programme_by_title_is_penalised_when_type_is_unstructured():
    j = job(title="Technology Graduate Programme", role_type="other")
    assert points(j, "graduate") == -40


def test_placement_mentioning_later_graduate_progression_is_not_penalised():
    j = job(title="Technology Industrial Placement", role_type="placement",
            description="Impress us and you could be offered a place on our graduate scheme.")
    assert points(j, "graduate") == 0
    assert points(j, "role") == 30


def test_explicit_graduate_only_eligibility_is_penalised():
    j = job(title="Software Internship", description="This role is for graduate only applicants.")
    assert points(j, "graduate") == -40


def test_undergraduate_is_not_graduate():
    assert classify_role("Undergraduate Placement", "")[0] == "placement"
    assert classify_role("Undergraduate Research Assistant", "")[0] == "other"


# ── Unpaid / volunteer penalty ──────────────────────────────────────────────

def test_unpaid_role_in_title_is_penalised():
    assert points(job(title="Unpaid Marketing Internship"), "unpaid") == -50
    assert points(job(title="Volunteer Software Placement"), "unpaid") == -50


def test_unpaid_role_stated_in_description_is_penalised():
    for text in ["This is an unpaid role.", "The internship is unpaid.", "We offer a volunteer position in our team."]:
        assert points(job(title="Software Placement", description=text), "unpaid") == -50, text


def test_volunteering_benefits_do_not_trigger_the_unpaid_penalty():
    for text in [
        "Benefits: life assurance, 3 Volunteer days per year, free parking.",
        "Cycle to work scheme. Volunteer days. Referral bonuses.",
        "Work alongside dedicated staff and international volunteers. Through meaningful activities you grow.",
        "We support paid volunteering days and community projects.",
        "Options for unpaid leave and sabbaticals.",
    ]:
        assert points(job(title="IT Support Apprenticeship", description=text), "unpaid") == 0, text


def test_role_statement_must_be_in_the_same_sentence():
    assert find_term_describing_role("Volunteer days are offered. The role is hybrid.", "volunteer") is None


# ── Role type ───────────────────────────────────────────────────────────────

def test_placement_and_internship_earn_the_role_bonus():
    assert points(job(role_type="placement"), "role") == 30
    assert points(job(role_type="internship"), "role") == 30
    assert points(job(title="Year in Industry Placements"), "role") == 30


def test_apprenticeships_are_recognised_but_earn_no_bonus_or_penalty():
    j = job(title="Software Developer Higher Apprenticeship", role_type="apprenticeship")
    e = explain_fit_score(j)
    assert e.category == "apprenticeship"
    assert all(r.points == 0 for r in e.rules if r.key in ("role", "graduate", "unpaid", "off_target"))


def test_school_leaver_apprenticeship_is_an_apprenticeship():
    assert classify_role("Technology School Leaver Apprenticeship - Manchester", "school leaver")[0] == "apprenticeship"


def test_graduate_roles_stay_distinct_from_placements():
    e = explain_fit_score(job(title="Cyber Security Graduate Scheme 2026", role_type="graduate scheme"))
    assert e.category == "graduate"
    assert next(r.points for r in e.rules if r.key == "role") == 0


def test_structured_role_type_takes_precedence_over_title_words():
    assert classify_role("Graduate-style Rotational Programme", "placement")[0] == "placement"


def test_unclassified_roles_are_other():
    assert classify_role("Intellectual Property Workshop for 1st Years", "Insight / Vacation Scheme (< 4 Weeks)")[0] == "other"


# ── Duplicate concepts ──────────────────────────────────────────────────────

def test_plural_alias_counts_once():
    assert points(job(description="Build APIs"), "tech") == 5
    assert points(job(description="An API and several APIs"), "tech") == 5
    assert points(job(description="apis"), "tech") == 5


def test_distinct_concepts_still_count_separately():
    assert points(job(description="Python, SQL and APIs"), "tech") == 15
    assert points(job(description="Java and JavaScript"), "tech") == 10


def test_full_score_example_is_unchanged():
    j = job(
        title="Software Engineering Placement", location="Manchester", role_type="Industrial Placement",
        description="Python, React and SQL experience required. We use Docker and AWS.",
    )
    assert calculate_fit_score(j) == 85
