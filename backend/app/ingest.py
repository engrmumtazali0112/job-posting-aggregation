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

JOOBLE_QUERIES = [("", "Pakistan"), ("", "Islamabad"), ("", "Rawalpindi"),
                  ("", "Lahore"), ("", "Karachi"), ("developer", "Pakistan")]

def fetch_jooble(_endpoint):
    if not settings.jooble_api_key:
        raise RuntimeError("JOOBLE_API_KEY is not set in .env")
    for kw, loc in JOOBLE_QUERIES:
        r = httpx.post(f"https://jooble.org/api/{settings.jooble_api_key}",
                       json={"keywords": kw, "location": loc, "page": 1}, timeout=30)
        r.raise_for_status()
        for j in r.json().get("jobs", []):
            yield {
                "title": clean(j.get("title")),
                "company": clean(j.get("company")) or "Unknown",
                "location": j.get("location") or loc,
                "description": clean_desc(j.get("snippet"))[:5000],
                "apply_url": j.get("link"),
            }

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
