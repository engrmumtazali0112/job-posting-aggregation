import re, html
import httpx, feedparser
from sqlalchemy import select
from .config import settings
from sqlalchemy.orm import Session
from .models import Job, JobSource, make_hash

SOURCES = [
    {"name": "Arbeitnow", "type": "api", "endpoint": "https://www.arbeitnow.com/api/job-board-api"},
    {"name": "We Work Remotely", "type": "rss",
     "endpoint": "https://weworkremotely.com/categories/remote-programming-jobs.rss"},
]

TAG = re.compile(r"<[^>]+>")
def clean(text):
    return html.unescape(TAG.sub(" ", text or "")).strip()

def fetch_api(url):
    r = httpx.get(url, timeout=30, headers={"User-Agent": "JobBoardBot/1.0"})
    r.raise_for_status()
    for j in r.json().get("data", []):
        yield {
            "title": j.get("title") or "",
            "company": j.get("company_name") or "Unknown",
            "location": j.get("location") or "Remote",
            "description": clean(j.get("description"))[:5000],
            "apply_url": j.get("url"),
        }

def fetch_rss(url):
    feed = feedparser.parse(url, agent="JobBoardBot/1.0")
    for e in feed.entries:
        title, company = e.get("title", ""), "Unknown"
        if ": " in title:                      # this feed uses "Company: Job title"
            company, title = title.split(": ", 1)
        yield {
            "title": title.strip(),
            "company": company.strip(),
            "location": "Remote",
            "description": clean(e.get("summary"))[:5000],
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
                "description": clean(j.get("snippet"))[:5000],
                "apply_url": j.get("link"),
            }
FETCHERS = {"api": fetch_api, "rss": fetch_rss, "jooble": fetch_jooble}
SOURCES.append({"name": "Jooble", "type": "jooble", "endpoint": "https://jooble.org"})

def get_source(db: Session, cfg: dict) -> JobSource:
    src = db.scalar(select(JobSource).where(JobSource.name == cfg["name"]))
    if not src:
        src = JobSource(name=cfg["name"], type=cfg["type"], endpoint=cfg["endpoint"])
        db.add(src)
        db.commit()
    return src

def save_jobs(db: Session, src: JobSource, items) -> dict:
    added = skipped = 0
    for it in items:
        if not it["title"] or not it["apply_url"]:
            continue
        h = make_hash(it["title"], it["company"], it["location"])
        if db.scalar(select(Job.id).where(Job.dedupe_hash == h)):
            skipped += 1
            continue
        db.add(Job(title=it["title"][:255], company_name=it["company"][:200],
                   location=it["location"][:200], description=it["description"],
                   apply_url=it["apply_url"][:500], source_type="aggregated",
                   source_id=src.id, status="published", dedupe_hash=h))
        db.flush()          # so duplicates inside the same batch are caught too
        added += 1
    db.commit()
    return {"added": added, "duplicates": skipped}

def run_all(db: Session) -> dict:
    report = {}
    for cfg in SOURCES:
        src = get_source(db, cfg)
        if not src.active:
            continue
        try:
            report[cfg["name"]] = save_jobs(db, src, FETCHERS[cfg["type"]](cfg["endpoint"]))
        except Exception as exc:          # one broken source must not stop the others
            db.rollback()
            report[cfg["name"]] = {"error": str(exc)}
    return report

if __name__ == "__main__":
    from .database import SessionLocal, Base, engine
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        print(run_all(db))