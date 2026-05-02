"""
Manual job ingestion script.
Run from the backend/ directory:
    python scripts/add_job.py
"""
import sys
from datetime import date
from pathlib import Path

# Allow imports from backend/app without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.db.database import SessionLocal
from app.models.job import Job
from app.services.scoring import calculate_fit_score


def prompt(label: str, required: bool = True) -> str:
    while True:
        value = input(f"{label}: ").strip()
        if value or not required:
            return value
        print(f"  {label} is required.")


def prompt_date(label: str) -> date | None:
    while True:
        raw = input(f"{label} (YYYY-MM-DD, blank to skip): ").strip()
        if not raw:
            return None
        try:
            return date.fromisoformat(raw)
        except ValueError:
            print("  Invalid date. Use YYYY-MM-DD format.")


def collect_job() -> dict:
    print("\n── Add New Job ──────────────────────────")
    return {
        "title":       prompt("Title"),
        "company":     prompt("Company"),
        "location":    prompt("Location"),
        "url":         prompt("URL"),
        "source":      prompt("Source"),
        "description": prompt("Description"),
        "role_type":   prompt("Role type"),
        "posted_date": prompt_date("Posted date"),
        "deadline":    prompt_date("Deadline"),
    }


def main() -> None:
    data = collect_job()
    data["fit_score"] = calculate_fit_score(data)

    db = SessionLocal()
    try:
        if db.query(Job).filter(Job.url == data["url"]).first():
            print(f"\nSkipped: a job with this URL already exists.")
            return

        job = Job(**data)
        db.add(job)
        db.commit()
        db.refresh(job)
        print(f"\nAdded: [{job.id}] {job.title} @ {job.company}  (fit score: {job.fit_score})")
    except Exception as e:
        db.rollback()
        print(f"\nError: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
