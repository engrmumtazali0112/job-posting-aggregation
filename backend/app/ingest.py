import re, html
import httpx, feedparser
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import settings
from .models import Job, JobSource, make_hash
from .services import unclaimed_company

SOURCES = [
    {"name": "Arbeitnow", "type": "api", "endpoint": "https://www.arbeitnow.com/api/job-board-api"},
    {"name": "We Work Remotely", "type": "rss",
     "endpoint": "https://weworkremotely.com/categories/remote-programming-jobs.rss"},
    {"name": "Jooble", "type": "jooble", "endpoint": "https://jooble.org"},
]

TAG = re.compile(r"<[^>]+>")
REPEAT = re.compile(r"(?i)(job description\s*)+")

def clean(text):
    return html.unescape(TAG.sub(" ", text or "")).strip()

def clean_desc(text):
    return REPEAT.sub("", clean(text)).strip()

def fetch_api(url):
    r = httpx.get(url, timeout=30, headers={"User-Agent": "JobBoardBot/1.0"})
    r.raise_for_status()
    for j in r.json().get("data", []):
        yield {
            "title": j.get("title") or "",
            "company": j.get("company_name") or "Unknown",
            "location": j.get("location") or "Remote",
            "description": clean_desc(j.get("description"))[:5000],
            "apply_url": j.get("url"),
        }

def fetch_rss(url):
    feed = feedparser.parse(url, agent="JobBoardBot/1.0")
    for e in feed.entries:
        title, company = e.get("title", ""), "Unknown"
        if ": " in title:
            company, title = title.split(": ", 1)
        yield {
            "title": title.strip(),
            "company": company.strip(),
            "location": "Remote",
            "description": clean_desc(e.get("summary"))[:5000],
            "apply_url": e.get("link"),
        }

# Local focus: Islamabad and Rawalpindi get the deepest search, other big cities and Pakistan-wide get a lighter one.
PRIORITY_CITIES = ["Islamabad", "Rawalpindi"]
OTHER_PLACES = ["Pakistan", "Lahore", "Karachi"]
JOOBLE_KEYWORDS = ["developer", "software engineer", "python", "react", "data", "marketing", "accountant", "sales"]
PRIORITY_PAGES = 3          # pages of ALL jobs (no keyword) for each priority city
OTHER_PAGES = 1
JOOBLE_PAUSE = 0.3          # seconds between requests, to be polite to the API
JOOBLE_RETRIES = 3

def _jooble_queries():
    """(keywords, location, pages) tuples, priority cities first."""
    for city in PRIORITY_CITIES:
        yield "", city, PRIORITY_PAGES
        for kw in JOOBLE_KEYWORDS:
            yield kw, city, 1
    for place in OTHER_PLACES:
        yield "", place, OTHER_PAGES
    yield "developer", "Pakistan", OTHER_PAGES

def _jooble_post(url, payload):
    """POST with retries: 429 and 5xx wait and try again; other errors are raised straight away."""
    import time
    for attempt in range(1, JOOBLE_RETRIES + 1):
        try:
            r = httpx.post(url, json=payload, timeout=30)
            if r.status_code == 429 or r.status_code >= 500:
                raise httpx.HTTPStatusError(f"HTTP {r.status_code}", request=r.request, response=r)
            r.raise_for_status()
            return r.json()
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            retryable = isinstance(exc, httpx.TransportError) or exc.response.status_code in (429,) or exc.response.status_code >= 500
            if not retryable or attempt == JOOBLE_RETRIES:
                raise
            time.sleep(2 ** attempt)

def fetch_jooble(_endpoint):
    """One failing query (timeout, 429, bad city) is logged and skipped; the source only fails when EVERY query failed."""
    import time
    if not settings.jooble_api_key:
        raise RuntimeError("JOOBLE_API_KEY is not set in .env")
    url = f"https://jooble.org/api/{settings.jooble_api_key}"
    ok = failed = 0
    last_error = None
    for kw, loc, pages in _jooble_queries():
        for page in range(1, pages + 1):
            try:
                data = _jooble_post(url, {"keywords": kw, "location": loc, "page": page})
            except Exception as exc:
                failed += 1
                last_error = exc
                print(f"[jooble] '{kw}' in {loc} page {page} failed: {exc!r}")
                break                                   # skip the remaining pages of this query
            ok += 1
            jobs = data.get("jobs", [])
            for j in jobs:
                yield {
                    "title": clean(j.get("title")),
                    "company": clean(j.get("company")) or "Unknown",
                    "location": clean(j.get("location")) or loc,
                    "description": clean_desc(j.get("snippet"))[:5000],
                    "apply_url": j.get("link"),
                }
            if len(jobs) < 20:                          # a short page means there is no next page
                break
            time.sleep(JOOBLE_PAUSE)
    if ok == 0 and failed:
        raise RuntimeError(f"all {failed} Jooble queries failed, last error: {last_error!r}")

FETCHERS = {"api": fetch_api, "rss": fetch_rss, "jooble": fetch_jooble}

def get_source(db: Session, cfg: dict) -> JobSource:
    src = db.scalar(select(JobSource).where(JobSource.name == cfg["name"]))
    if not src:
        src = JobSource(name=cfg["name"], type=cfg["type"], endpoint=cfg["endpoint"])
        db.add(src)
        db.commit()
    return src

def save_jobs(db: Session, src: JobSource, items) -> dict:
    items = list(items)                      # fetch first, so no DB connection sits idle
    existing = set(db.scalars(select(Job.dedupe_hash)))
    new, skipped = [], 0
    companies: dict = {}
    for it in items:
        if not it["title"] or not it["apply_url"]:
            continue
        h = make_hash(it["title"], it["company"], it["location"])
        if h in existing:
            skipped += 1
            continue
        existing.add(h)                      # also catches duplicates inside this batch
        comp = unclaimed_company(db, it["company"][:200], companies) if it["company"] != "Unknown" else None
        new.append(Job(title=it["title"][:255], company_name=it["company"][:200], company_id=comp.id if comp else None,
                       location=it["location"][:200], description=it["description"],
                       apply_url=it["apply_url"][:500], source_type="aggregated", workplace_type=("remote" if it["location"].lower().startswith("remote") else "in_person"),
                       source_id=src.id, status="published", dedupe_hash=h))
    db.add_all(new)
    db.commit()
    try:
        from .telegram import share_jobs
        if settings.telegram_share_aggregated:
            share_jobs(new[:5])        # cap per source so the channel is not flooded
    except Exception as exc:           # sharing must never break ingestion
        print("[telegram]", exc)
    return {"added": len(new), "duplicates": skipped}

def expire_stale(db: Session) -> int:
    """Close aggregated jobs older than settings.stale_job_days."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import update
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=settings.stale_job_days)
    res = db.execute(update(Job).where(Job.source_type == "aggregated", Job.status == "published",
                                        Job.created_at < cutoff).values(status="closed"))
    db.commit()
    return res.rowcount

def run_all(db: Session) -> dict:
    report = {}
    for cfg in SOURCES:
        src = get_source(db, cfg)
        if not src.active:
            continue
        try:
            report[cfg["name"]] = save_jobs(db, src, FETCHERS[cfg["type"]](cfg["endpoint"]))
        except Exception as exc:
            db.rollback()
            report[cfg["name"]] = {"error": str(exc)}
    try:
        report["expired"] = expire_stale(db)
    except Exception as exc:
        db.rollback()
        report["expired"] = {"error": str(exc)}
    return report

if __name__ == "__main__":
    from .database import SessionLocal, Base, engine
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        print(run_all(db))
