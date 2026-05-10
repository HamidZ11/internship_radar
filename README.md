# Internship Radar

A personal tool for tracking, scoring, and managing software engineering internship and placement applications — built to cut through the noise of job boards.

![Python](https://img.shields.io/badge/Python-3.11+-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green) ![React](https://img.shields.io/badge/React-18-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791)

---

## Features

- **Fit scoring** — keyword-based algorithm scores each role by tech stack, location, role type, and description quality
- **Job scraping** — automated collector for RateMyPlacement (higherin.com) fetches listings and descriptions
- **3-panel UI** — filter sidebar, scrollable job list sorted by fit score, and full job detail pane
- **Application tracking** — mark jobs as applied / interviewing / offer / rejected; dashboard with stats
- **Saved jobs** — bookmark roles to a dedicated Saved tab
- **Manual entry** — "+ Add Job" modal to paste in any listing from any source
- **Filters** — role type, source, location, deadline window, minimum score, status

---

---

## Screenshots

### Main Dashboard

![Dashboard](./screenshots/dashboard.png)

### Application Tracking

![Application Tracking](./screenshots/applied.png)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI + Uvicorn |
| Database | PostgreSQL + SQLAlchemy 2.0 |
| Data validation | Pydantic v2 |
| Scraping | Requests + BeautifulSoup4 |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Font | Manrope (Google Fonts) |

---

## Project Structure

```
internship_radar/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI route handlers
│   │   ├── collectors/    # Job scrapers (ratemyplacement)
│   │   ├── db/            # SQLAlchemy engine + session
│   │   ├── models/        # Job ORM model + Pydantic schemas
│   │   └── services/      # Fit scoring engine
│   ├── scripts/           # CLI utilities
│   │   ├── run_ratemyplacement.py   # Scrape & ingest RateMyPlacement
│   │   ├── add_job.py               # Manually add a job via CLI
│   │   ├── backfill_descriptions.py # Fetch missing descriptions
│   │   └── recalculate_scores.py   # Re-score all jobs
│   ├── tests/
│   │   └── test_scoring.py          # 30 scoring unit tests
│   ├── main.py
│   └── requirements.txt
└── frontend/
    └── src/
        ├── components/    # FilterBar, JobList, JobDetail, AppliedDashboard, AddJobModal
        ├── App.tsx
        └── types.ts
```

---

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL running locally

### 1. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL=postgresql://user:password@localhost:5432/internship_radar

# Create the database
createdb internship_radar

# Start the API server
uvicorn main:app --reload
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# UI available at http://localhost:5173
```

### 3. Populate with jobs

```bash
cd backend
source .venv/bin/activate

# Scrape RateMyPlacement (fetches listings + descriptions)
python scripts/run_ratemyplacement.py

# Or add a job manually
python scripts/add_job.py
```

---

## Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/internship_radar
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/jobs` | List jobs (supports filters: status, min_score, location, role_type, source, search, is_saved) |
| `POST` | `/jobs` | Create a job |
| `GET` | `/jobs/{id}` | Get a single job |
| `PATCH` | `/jobs/{id}/status` | Update application status |
| `PATCH` | `/jobs/{id}/saved` | Toggle saved flag |

Interactive docs: `http://localhost:8000/docs`

---

## Scoring Algorithm

Each job is scored 0–100 at ingestion time based on:

| Signal | Points |
|---|---|
| Placement / internship role type | +30 |
| Tech keyword matches (Python, React, SQL, etc.) | up to +30 |
| Manchester location | +20 |
| UK / Remote / Hybrid | +10 |
| Structured description with requirements | +10 |
| Modern tech stack keywords (Docker, AWS, etc.) | +10 |
| Graduate-scheme-only role | −40 |
| Unpaid / volunteer | −50 |
| Irrelevant department (marketing, finance, etc.) | −30 |

Scores are clamped to [0, 100]. Run `scripts/recalculate_scores.py` after updating the scoring logic.

---

## Future Improvements

- Additional job collectors (company career pages, Gradcracker)
- Deadline proximity boosting in the scoring algorithm
- Notes / comments per application
- Export to CSV
- Automated daily scraping via cron
- Dark mode

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
pip install pytest
pytest tests/
```
