"""
Read-only check that persisted fit scores match the current scoring logic.

Compares every job's stored fit_score with a fresh calculation, prints a
representative sample with its category and rule contributions, and exits
with status 1 if any persisted score disagrees. Runs in a READ ONLY transaction.

Run from the backend/ directory:
    python scripts/verify_fit_scores.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import text

from app.db.database import engine
from app.services.scoring import explain_fit_score

# (what the sample represents, title prefix). The first job whose title starts with the prefix is shown.
SAMPLE = [
    ("AI internship", "AI Engineering Internship"),
    ("NLP internship", "Natural Language Processing Internship"),
    ("Placement (Deloitte)", "Technology Industrial Placement"),
    ("Cyber placement", "IS Cyber Security Placement"),
    ("Software apprenticeship", "Software Integration Higher Apprenticeship"),
    ("Graduate programme", "Technical Graduate Programme 2026"),
    ("Audit / tax role", "Career Starters"),
    ("Business development", "Business Development Placement"),
    ("Presales", "Enterprise Architect and Presales Placement"),
    ("Technical role, marketing-named employer", "Software Developer Higher Apprenticeship - Chemistry Marketing"),
    ("Data role, marketing domain", "Marketing Data Analysis"),
]


def main() -> int:
    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        rows = [dict(r) for r in conn.execute(text(
            "SELECT id, title, company, location, description, role_type, fit_score FROM jobs ORDER BY id"
        )).mappings().all()]
        conn.rollback()

    explained = {r["id"]: explain_fit_score(r) for r in rows}
    mismatches = [r for r in rows if r["fit_score"] != explained[r["id"]].score]

    print("| Sample | id | Title | Company | Persisted | Calculated | Category | Positive | Penalties | OK |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for label, prefix in SAMPLE:
        row = next((r for r in rows if r["title"].startswith(prefix)), None)
        if row is None:
            print(f"| {label} | — | not found: {prefix!r} | | | | | | | ✗ |")
            continue
        e = explained[row["id"]]
        pos = " ".join(f"{r.key}+{r.points}" for r in e.rules if r.points > 0) or "—"
        neg = " ".join(f"{r.key}{r.points}" for r in e.rules if r.points < 0) or "—"
        ok = "✓" if row["fit_score"] == e.score else "✗"
        print(f"| {label} | {row['id']} | {row['title'][:55]} | {row['company']} | {row['fit_score']} | {e.score} | {e.category} | {pos} | {neg} | {ok} |")

    print(f"\nAll jobs: {len(rows)} checked, {len(mismatches)} persisted scores disagree with the current logic.")
    for r in mismatches[:20]:
        print(f"  {r['id']:>4}  persisted {r['fit_score']:>3}  calculated {explained[r['id']].score:>3}  {r['title'][:60]}")
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
