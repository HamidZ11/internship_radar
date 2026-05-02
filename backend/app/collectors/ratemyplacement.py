"""
Collector for RateMyPlacement (now higherin.com).

Listing pages embed job data as JSON; detail pages expose the description
in a <div class="prose"> element.
"""
import json
import re
import time
from datetime import date

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://higherin.com/search-jobs/technology"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}
SOURCE = "ratemyplacement"
REQUEST_DELAY = 1.0   # seconds between listing pages
DETAIL_DELAY = 0.5    # seconds between detail page requests


_ORDINAL_RE = re.compile(r"(\d+)(st|nd|rd|th)\s+(\w+)\s+(\d{4})", re.IGNORECASE)
_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def _parse_deadline(raw: str | None) -> date | None:
    if not raw:
        return None
    m = _ORDINAL_RE.search(raw)
    if not m:
        return None
    day, _, month_str, year = m.group(1), m.group(2), m.group(3), m.group(4)
    month = _MONTHS.get(month_str.lower())
    if not month:
        return None
    try:
        return date(int(year), month, int(day))
    except ValueError:
        return None


def _map_role_type(job_type_name: str) -> str:
    lower = job_type_name.lower()
    if "placement" in lower:
        return "placement"
    if "internship" in lower:
        return "internship"
    if "graduate" in lower:
        return "graduate scheme"
    if "apprenticeship" in lower:
        return "apprenticeship"
    if "work experience" in lower:
        return "work experience"
    if "school leaver" in lower:
        return "school leaver"
    return job_type_name


def _extract_jobs_from_page(html: str) -> tuple[list[dict], int]:
    """Returns (jobs_on_page, total_results)."""
    soup = BeautifulSoup(html, "html.parser")

    script_tag = soup.find("script", string=re.compile(r"__RMP_SEARCH_RESULTS_INITIAL_STATE__"))
    if not script_tag or not script_tag.string:
        return [], 0

    m = re.search(r"__RMP_SEARCH_RESULTS_INITIAL_STATE__\s*=\s*(\{.+)", script_tag.string)
    if not m:
        return [], 0

    raw = m.group(1)
    depth = end = 0
    for i, ch in enumerate(raw):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    try:
        payload = json.loads(raw[:end])
    except json.JSONDecodeError:
        return [], 0

    total = payload.get("meta", {}).get("totalResults", 0)
    jobs = []

    for item in payload.get("data", []):
        try:
            jobs.append({
                "title": item["jobTitle"],
                "company": item.get("companyName") or "",
                "location": item.get("jobLocationNames") or "",
                "url": item["url"],
                "source": SOURCE,
                "description": "",
                "role_type": _map_role_type(item.get("jobTypeNames") or ""),
                "posted_date": None,
                "deadline": _parse_deadline(item.get("deadline")),
            })
        except (KeyError, TypeError):
            continue

    return jobs, total


def fetch_job_description(url: str, session: requests.Session | None = None) -> str:
    _session = session or requests.Session()
    if session is None:
        _session.headers.update(HEADERS)
    try:
        response = _session.get(url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        prose = soup.find("div", class_="prose")
        if not prose:
            return ""
        return prose.get_text(separator=" ", strip=True)
    except Exception:
        return ""


def fetch_jobs(max_pages: int = 10) -> list[dict]:
    all_jobs: list[dict] = []
    seen_urls: set[str] = set()

    session = requests.Session()
    session.headers.update(HEADERS)

    for page in range(1, max_pages + 1):
        url = f"{BASE_URL}?page={page}"
        try:
            response = session.get(url, timeout=15)
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"  [warn] page {page} failed: {exc}")
            break

        jobs, total = _extract_jobs_from_page(response.text)

        if not jobs:
            break

        for job in jobs:
            if job["url"] not in seen_urls:
                seen_urls.add(job["url"])
                all_jobs.append(job)

        total_pages = -(-total // 20)  # ceiling division
        if page >= min(total_pages, max_pages):
            break

        time.sleep(REQUEST_DELAY)

    return all_jobs
