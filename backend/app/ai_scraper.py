"""AI scraper: fetches raw job postings from a free public source (Himalayas) and lets the OpenRouter parser
(openrouter_jobs.parse_job_text) turn each one into structured data, including contact_phone.

Saved jobs get source_type = "aggregated" (done by openrouter_jobs.save_parsed_job).

Run by hand (from the backend/ folder):   python -m app.ai_scraper
Run automatically:                        scheduler.py calls run() every 2 hours.

Free OpenRouter models are rate limited, so each run only parses a few NEW jobs (MAX_NEW_PER_RUN), waits a little
between calls, and stops early when OpenRouter says "rate limit / no credits / no key".
Jobs already in the database (same apply link) are skipped BEFORE calling the AI, so they cost no AI requests.
Himalayas API terms: free, no key, please credit Himalayas (the job's apply link points back to Himalayas).
"""
import time

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .ingest import clean_desc, verify_job_authenticity
from .models import Job
from .openrouter_jobs import AIParseError, parse_job_text, save_parsed_job

HIMALAYAS_URL = "https://himalayas.app/jobs/api"
SOURCE = {"name": "Himalayas (AI)", "type": "ai_scrape", "endpoint": HIMALAYAS_URL}

PAGE_SIZE = 20            # Himalayas returns at most 20 jobs per request
MAX_PAGES = 3             # look at the newest 60 jobs at most per run
MAX_NEW_PER_RUN = 10      # AI calls per run (free models are rate limited)
PAUSE_SECONDS = 4         # pause between AI calls
MAX_DESC_CHARS = 6000


# ---------- 1. fetch ----------
def fetch_himalayas(offset: int = 0, limit: int = PAGE_SIZE) -> list[dict]:
    """One page of the newest remote jobs. Raises httpx.HTTPError on network / 4xx / 5xx (429 = we are going too fast)."""
    r = httpx.get(HIMALAYAS_URL, params={"limit": limit, "offset": offset}, timeout=30,
                  headers={"User-Agent": "JobBoardBot/1.0", "Accept": "application/json"})
    r.raise_for_status()
    jobs = r.json().get("jobs", [])
    return jobs if isinstance(jobs, list) else []


def _apply_link(j: dict) -> str | None:
    link = j.get("applicationLink") or j.get("guid") or j.get("url")
    return link.strip()[:500] if isinstance(link, str) and link.strip().lower().startswith(("http://", "https://")) else None



def _location_ok(j: dict) -> bool:
    """Strict: keep a Himalayas job only if it is open worldwide (no restriction list, or a 'Worldwide'/'Anywhere' entry) or its
    restriction list includes Pakistan. US-only, EU-only, UK-only etc. return False."""
    allowed = j.get("locationRestrictions") or []
    if not allowed:
        return True                                   # Himalayas leaves the list empty for worldwide jobs
    names = [str(x).strip().lower() for x in allowed]
    return any(n in ("worldwide", "anywhere", "global", "remote") or "pakistan" in n for n in names)

def to_raw_text(j: dict) -> str:
    """Flatten one Himalayas record into plain text, the same kind of text an admin would paste into the AI parser."""
    locations = j.get("locationRestrictions") or []
    where = ", ".join(str(x) for x in locations) if isinstance(locations, list) and locations else "Worldwide"
    lines = [f"Job title: {j.get('title') or ''}",
             f"Company: {j.get('companyName') or ''}",
             f"Workplace: Remote ({where})",
             f"Employment type: {j.get('employmentType') or ''}"]
    if j.get("minSalary") or j.get("maxSalary"):
        lines.append(f"Salary: {j.get('minSalary') or ''} - {j.get('maxSalary') or ''} {j.get('currency') or 'USD'} per year")
    body = clean_desc(j.get("description") or j.get("excerpt") or "")[:MAX_DESC_CHARS]
    lines += ["", "Description:", body]
    return "\n".join(lines)


# ---------- 2. parse + save ----------
def _as_int(v) -> int | None:
    try:
        return max(0, int(float(v))) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def run(db: Session, max_new: int = MAX_NEW_PER_RUN) -> dict:
    """Fetch -> skip jobs we already have -> AI-parse the new ones -> save. Returns a small report dict."""
    if not settings.openrouter_api_key:
        return {"error": "OPENROUTER_API_KEY is not set"}
    report = {"fetched": 0, "added": 0, "duplicates": 0, "failed": 0, "filtered_out": 0, "rejected_unverified": 0, "stopped": None}
    handled = 0
    for page in range(MAX_PAGES):
        try:
            items = fetch_himalayas(offset=page * PAGE_SIZE)
        except httpx.HTTPError as exc:
            report["stopped"] = f"fetch failed: {type(exc).__name__}"
            break
        if not items:
            break
        report["fetched"] += len(items)
        links = [_apply_link(j) for j in items]
        known = set(db.scalars(select(Job.apply_url).where(Job.apply_url.in_([x for x in links if x]))).all())
        for j, link in zip(items, links):
            if handled >= max_new:
                report["stopped"] = report["stopped"] or "reached the per-run limit"
                return report
            if not link or not j.get("title"):
                continue
            if not _location_ok(j):
                report["filtered_out"] += 1
                continue
            ok, _why = verify_job_authenticity({"title": j.get("title"), "company": j.get("companyName"), "apply_url": link})
            if not ok:                                              # checked BEFORE the AI call, so rejected jobs cost no OpenRouter quota
                report["rejected_unverified"] += 1
                continue
            if link in known:
                report["duplicates"] += 1
                continue
            handled += 1
            try:
                parsed = parse_job_text(to_raw_text(j))
                parsed.apply_url = link                                   # trust the source's link, not the AI's copy of it
                if j.get("minSalary") or j.get("maxSalary"):               # structured salary from the API beats the AI's reading of it
                    parsed.salary_min, parsed.salary_max = _as_int(j.get("minSalary")), _as_int(j.get("maxSalary"))
                    parsed.salary_period = "year"
                    parsed.currency = (j.get("currency") or "USD").upper()[:5]
                elif parsed.currency == "PKR":                            # parser defaults to PKR; Himalayas jobs are international
                    parsed.currency = "USD"
                _, created = save_parsed_job(db, parsed, publish=True, source=SOURCE)
                report["added" if created else "duplicates"] += 1
            except AIParseError as exc:
                db.rollback()
                report["failed"] += 1
                if exc.status in (503, 401, 403) or "rate limit" in str(exc).lower() or "API key" in str(exc):
                    report["stopped"] = str(exc)                          # key missing / no credits / rate limited: more calls would fail too
                    return report
                print("[ai-scraper] skipped one job:", exc)
            except Exception as exc:                                     # one bad job must not stop the rest
                db.rollback()
                report["failed"] += 1
                print("[ai-scraper] unexpected error on one job:", repr(exc))
            time.sleep(PAUSE_SECONDS)
    return report


if __name__ == "__main__":
    from .database import SessionLocal, Base, engine
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        print(run(db))
