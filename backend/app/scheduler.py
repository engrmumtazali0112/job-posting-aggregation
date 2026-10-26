import os
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select
from .config import settings
from .database import SessionLocal
from .emailer import send_email
from .ingest import run_all
from .models import Job, JobAlert, User

MAX_BACKLOG = timedelta(hours=24)       # if the scheduler was down for a long time, never look back further than this
MAX_JOBS_PER_EMAIL = 10


def ingest_job():
    with SessionLocal() as db:
        print("[ingest]", run_all(db))


# ---------- job alerts ----------
def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)          # DateTime columns hold naive UTC


def _naive(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _matches(job: Job, keywords: list[str]) -> bool:
    """A job matches when ANY keyword appears in its title, company, location or description."""
    text = " ".join([job.title or "", job.company_name or "", job.location or "", job.description or ""]).lower()
    return any(k.lower() in text for k in keywords if k.strip())


def _location_ok(job: Job, location: str | None) -> bool:
    """No location on the alert = anywhere. Otherwise the job's location must contain it; "remote" also matches remote-flagged jobs."""
    loc = (location or "").strip().lower()
    if not loc:
        return True
    if loc in (job.location or "").lower():
        return True
    return loc == "remote" and job.workplace_type == "remote"


def _alert_email(user: User, keywords: list[str], jobs: list[Job]) -> tuple[str, str]:
    site = settings.site_url.rstrip("/")
    shown = jobs[:MAX_JOBS_PER_EMAIL]
    lines = [f"- {j.title} at {j.company_name}" + (f" ({j.location})" if j.location else "") + f"\n  {site}/jobs/{j.id}" for j in shown]
    more = f"\n...and {len(jobs) - len(shown)} more. See them all at {site}/jobs" if len(jobs) > len(shown) else ""
    n = len(jobs)
    subject = f"{n} new job{'s' if n != 1 else ''} matching your alert"
    body = (f"Hi {user.full_name or 'there'},\n\n{n} new job{'s' if n != 1 else ''} matched your job alert ({', '.join(keywords)}):\n\n"
            + "\n".join(lines) + more
            + f"\n\nYou get this email because Job Alerts are switched on in your profile. Change the keywords or turn alerts off any time: {site}/my/profile")
    return subject, body


def alerts_job():
    """Runs every hour: emails each subscribed seeker the NEW published jobs that match any of their alerts (up to 7, each = keywords
    + optional location). A user with several alerts gets ONE combined email, and a job that matches two alerts is listed once.
    Each alert remembers last_checked_at, so a job is never emailed twice and a restart does not lose or repeat anything."""
    started = _utcnow()
    try:
        with SessionLocal() as db:
            alerts = db.scalars(select(JobAlert).where(JobAlert.is_active.is_(True))).all()
            if not alerts:
                print("[alerts] no active alerts")
                return
            since = {a.id: max(_naive(a.last_checked_at) or started - timedelta(hours=1), started - MAX_BACKLOG) for a in alerts}
            jobs = db.scalars(select(Job).where(Job.status == "published", Job.created_at > min(since.values()))
                              .order_by(Job.created_at.desc()).limit(1000)).all()
            by_user: dict[int, list[JobAlert]] = {}
            for a in alerts:
                by_user.setdefault(a.user_id, []).append(a)
            sent = 0
            for uid, user_alerts in by_user.items():
                user = db.get(User, uid)
                can_mail = bool(user) and user.is_active is not False and not (not user.is_verified and user.verification_token)
                hits: dict[int, Job] = {}
                shown_keywords: list[str] = []
                if can_mail:
                    for a in user_alerts:
                        keywords = [k for k in (a.keywords or []) if k and k.strip()]
                        if not keywords:
                            continue
                        found = [j for j in jobs if _naive(j.created_at) > since[a.id] and _matches(j, keywords) and _location_ok(j, a.location)]
                        if found:
                            hits.update({j.id: j for j in found})
                            shown_keywords += [k for k in keywords if k.lower() not in {s.lower() for s in shown_keywords}]
                if hits:
                    try:
                        ordered = sorted(hits.values(), key=lambda j: _naive(j.created_at), reverse=True)
                        subject, body = _alert_email(user, shown_keywords, ordered)
                        if send_email(user.email, subject, body):
                            sent += 1
                        else:                                              # SMTP not configured: keep last_checked_at so a later run can still send
                            print("[alerts] SMTP is not configured, so nothing was sent to", user.email)
                            continue
                    except Exception as exc:                               # keep last_checked_at, so the next run tries again
                        print("[alerts] could not email", user.email, repr(exc))
                        continue
                for a in user_alerts:
                    a.last_checked_at = started
                db.commit()                                                # nothing to send to this user: do not re-scan the same jobs
            print(f"[alerts] checked {len(alerts)} alert(s) for {len(by_user)} user(s), sent {sent} email(s)")
    except Exception as exc:                                         # never let a failed run stop the scheduler
        print("[alerts] failed:", repr(exc))


def start():
    sched = BackgroundScheduler()
    # Set RUN_SCHEDULER=false on extra workers so ingestion only runs once.
    if os.getenv("RUN_SCHEDULER", "true").lower() != "false":
        sched.add_job(ingest_job, "interval", minutes=30, next_run_time=datetime.now())
        sched.add_job(alerts_job, "cron", minute=5, id="job_alerts", max_instances=1, coalesce=True)   # every hour, at :05
    sched.start()
    return sched
