"""
Recalculates fit_score for all jobs using the current scoring logic.
Run from the backend/ directory:
    python scripts/recalculate_scores.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.db.database import SessionLocal
from app.models.job import Job
from app.services.scoring import calculate_fit_score


def main() -> None:
    db = SessionLocal()
    updated = errors = 0

    try:
        jobs = db.query(Job).all()
        total = len(jobs)
        print(f"Recalculating scores for {total} jobs…\n")

        for job in jobs:
            try:
                new_score = calculate_fit_score({
                    "title": job.title,
                    "company": job.company,
                    "location": job.location,
                    "description": job.description,
                    "role_type": job.role_type,
                })
                job.fit_score = new_score
                updated += 1
            except Exception as exc:
                errors += 1
                print(f"  [error] job {job.id}: {exc}")

        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"Fatal error: {exc}")
        sys.exit(1)
    finally:
        db.close()

    print(f"Done.  total={total}  updated={updated}  errors={errors}")


if __name__ == "__main__":
    main()
