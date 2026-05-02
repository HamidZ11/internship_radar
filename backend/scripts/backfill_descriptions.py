"""
One-time backfill script: fetches descriptions for existing RateMyPlacement
jobs that were stored without one.
Run from the backend/ directory:
    python scripts/backfill_descriptions.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.collectors.ratemyplacement import fetch_job_description
from app.db.database import SessionLocal
from app.models.job import Job
from app.services.scoring import calculate_fit_score


def main() -> None:
    db = SessionLocal()
    updated = skipped = errors = 0

    try:
        candidates = (
            db.query(Job)
            .filter(Job.source == "ratemyplacement")
            .filter((Job.description == None) | (Job.description == ""))
            .all()
        )

        total = len(candidates)
        print(f"Found {total} jobs with missing descriptions.\n")

        if not total:
            print("Nothing to backfill.")
            return

        for i, job in enumerate(candidates, 1):
            print(f"  [{i}/{total}] {job.title[:60]}")
            try:
                description = fetch_job_description(job.url)
                if not description:
                    skipped += 1
                    continue

                job.description = description
                job.fit_score = calculate_fit_score({
                    "title": job.title,
                    "company": job.company,
                    "location": job.location,
                    "description": description,
                    "role_type": job.role_type,
                })
                db.commit()
                updated += 1
            except Exception as exc:
                db.rollback()
                errors += 1
                print(f"    [error] {exc}")

            time.sleep(0.5)

    finally:
        db.close()

    print(f"\nDone.  updated={updated}  skipped={skipped}  errors={errors}")


if __name__ == "__main__":
    main()
