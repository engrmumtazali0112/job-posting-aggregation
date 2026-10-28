import re, html, ipaddress
from urllib.parse import urlparse
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

# Only Pakistani jobs and remote jobs are kept. Jooble returns bare city names ("Lahore"), so the check also accepts the main cities.
# ("Hyderabad" and "Punjab" are left out on purpose: they are just as common in India.)
PK_PLACES = ("pakistan", "islamabad", "rawalpindi", "lahore", "karachi", "peshawar", "quetta",
             "faisalabad", "multan", "sialkot", "gujranwala")

def is_pk_or_remote(location) -> bool:
    loc = (location or "").lower()
    return "remote" in loc or any(p in loc for p in PK_PLACES)

# ---------- authenticity check ----------
# This is a heuristic, not proof: it removes obviously dodgy listings (no link, link shorteners, junk domains, a company name that has
# nothing to do with the site it links to). It cannot know whether a company really exists or really is hiring.
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "v.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at",
              "tiny.cc", "lnkd.in", "rb.gy", "t.ly", "s.id", "bl.ink", "short.io", "soo.gd", "clck.ru", "adf.ly", "shorte.st", "fb.me", "wa.me"}
# Official job platforms / applicant-tracking systems / the aggregators this project pulls from. A link on one of these is accepted
# without a company-name match, because the job lives on the platform, not on the employer's own site.
TRUSTED_APPLY_HOSTS = {"jooble.org", "himalayas.app", "weworkremotely.com", "arbeitnow.com", "linkedin.com", "indeed.com", "glassdoor.com",
                       "rozee.pk", "mustakbil.com", "greenhouse.io", "lever.co", "workable.com", "ashbyhq.com", "smartrecruiters.com",
                       "myworkdayjobs.com", "bamboohr.com", "recruitee.com", "breezy.hr", "teamtailor.com", "jobvite.com"}
LEGAL_WORDS = {"pvt", "private", "ltd", "limited", "inc", "incorporated", "llc", "llp", "co", "corp", "corporation", "company", "plc",
               "gmbh", "the", "and", "of", "group", "holdings", "smc"}
SECOND_LEVEL = {"co", "com", "org", "net", "gov", "edu", "ac"}      # company.com.pk, company.co.uk
TLD_RE = re.compile(r"^[a-z]{2,24}$")

def _host(url):
    """Lower-case host of an http(s) URL without a leading www., or None if the URL is not a usable web link."""
    try:
        p = urlparse((url or "").strip())
        host = p.hostname
    except ValueError:
        return None
    if p.scheme not in ("http", "https") or not host:
        return None
    host = host.lower().rstrip(".")
    return host[4:] if host.startswith("www.") else host

def _host_in(host, domains) -> bool:
    return any(host == d or host.endswith("." + d) for d in domains)

def _site_label(host) -> str:
    """The name part of a domain: 'careers.axonforge.com' -> 'axonforge', 'systemsltd.com.pk' -> 'systemsltd'."""
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in SECOND_LEVEL and len(parts[-1]) == 2:
        return parts[-3]
    return parts[-2] if len(parts) >= 2 else ""

def company_matches_domain(company, host) -> bool:
    words = [w for w in re.findall(r"[a-z0-9]+", (company or "").lower()) if w not in LEGAL_WORDS]
    label = re.sub(r"[^a-z0-9]", "", _site_label(host))
    if not words or not label:
        return False
    joined = "".join(words)
    if len(label) < 3:                                  # short domains are usually acronyms: ke.com.pk for K-Electric
        return joined.startswith(label)
    return label in joined or any(len(w) >= 3 and w in label for w in words)

def verify_job_authenticity(job_data: dict) -> tuple[bool, str]:
    """Returns (True, "ok") or (False, reason). job_data needs: title, company, apply_url (location is not used yet).
    Rejects a job when: it has no title; it has no apply link; the link is not a real web address (bad scheme, IP address, localhost, no
    valid domain ending); the link goes through a URL shortener; or the link is on an unknown site whose name does not match the company."""
    if not (job_data.get("title") or "").strip():
        return False, "no title"
    url = (job_data.get("apply_url") or "").strip()
    if not url:
        return False, "no apply link"
    host = _host(url)
    if not host:
        return False, "apply link is not a valid http(s) address"
    try:
        ipaddress.ip_address(host)
        return False, "apply link is a raw IP address"
    except ValueError:
        pass
    if "." not in host or not TLD_RE.match(host.rsplit(".", 1)[1]):
        return False, "apply link has no real domain"
    if _host_in(host, SHORTENERS):
        return False, "apply link is a link shortener"
    if _host_in(host, TRUSTED_APPLY_HOSTS):
        return True, "ok"
    company = (job_data.get("company") or "").strip()
    if not company or company.lower() == "unknown":
        return False, "company is unknown and the link is not on a recognised job platform"
    if not company_matches_domain(company, host):
        return False, f"company name does not match the apply domain ({host})"
    return True, "ok"

def fetch_api(url):
    r = httpx.get(url, timeout=30, headers={"User-Agent": "JobBoardBot/1.0"})
    r.raise_for_status()
    for j in r.json().get("data", []):
        yield {
            "title": j.get("title") or "",
            "company": j.get("company_name") or "Unknown",
            "location": "Remote" if j.get("remote") else (j.get("location") or "Remote"),   # Arbeitnow lists German cities; only its remote jobs survive the filter
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

# Pakistani cities only (remote jobs come from the RSS/API sources). Always pass a Pakistani location: when Jooble cannot place a
# location it can fall back to the server's own region (the Render server is in the USA), which is how US jobs got in.
JOOBLE_QUERIES = [("developer", "Pakistan"), ("developer", "Islamabad"), ("developer", "Lahore"), ("developer", "Karachi"), ("", "Pakistan")]

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
    fetched = len(items)
    items = [it for it in items if is_pk_or_remote(it.get("location"))]   # drop US / other-country jobs before they reach the database
    filtered = fetched - len(items)
    existing = set(db.scalars(select(Job.dedupe_hash)))
    new, skipped = [], 0
    rejected: dict = {}                      # reason -> count, for the run report
    companies: dict = {}
    for it in items:
        ok, why = verify_job_authenticity(it)      # no apply link, shortened link, or company/domain mismatch -> never saved
        if not ok:
            rejected[why.split(" (")[0]] = rejected.get(why.split(" (")[0], 0) + 1
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
    return {"added": len(new), "duplicates": skipped, "filtered_out": filtered, "rejected_unverified": rejected}

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
