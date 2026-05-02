"""
Ingestion script for RateMyPlacement (higherin.com).
Run from the backend/ directory:
    python scripts/run_ratemyplacement.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import time
from app.collectors.ratemyplacement import fetch_jobs, fetch_job_description, DETAIL_DELAY
from app.db.database import SessionLocal
from app.models.job import Job
from app.services.scoring import calculate_fit_score


def main() -> None:
    print("Fetching jobs from RateMyPlacement…")
    jobs = fetch_jobs()
    print(f"Found {len(jobs)} listings.\n")

    if not jobs:
        print("Nothing to insert.")
        return

    db = SessionLocal()
    inserted = skipped = errors = 0

    try:
        for i, job_data in enumerate(jobs, 1):
            try:
                if db.query(Job).filter(Job.url == job_data["url"]).first():
                    skipped += 1
                    continue

                print(f"  [{i}/{len(jobs)}] Fetching description: {job_data['title'][:60]}")
                job_data["description"] = fetch_job_description(job_data["url"])
                time.sleep(DETAIL_DELAY)

                job_data["fit_score"] = calculate_fit_score(job_data)
                db.add(Job(**job_data))
                db.commit()
                inserted += 1
            except Exception as exc:
                db.rollback()
                errors += 1
                print(f"  [error] {job_data.get('url', '?')}: {exc}")
    finally:
        db.close()

    print(f"\nDone.  inserted={inserted}  skipped={skipped}  errors={errors}")


if __name__ == "__main__":
    main()
