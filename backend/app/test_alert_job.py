"""Tests the Job Alerts email system for one seeker.

What it does
  1. Checks that TARGET_EMAIL exists and has an ACTIVE job alert (and prints the keywords).
  2. Creates (or reuses) a test employer + company.
  3. Creates a PUBLISHED job "Senior Full Stack Developer" whose description contains
     React, Python, FastAPI, PostgreSQL. Running the script again replaces the previous test job,
     so it always counts as "new" for the alert scheduler.
  4. Optionally (--run-alerts) runs the alert scheduler right now instead of waiting for the hourly run (:05).

Run from the backend folder:
    python -m app.test_alert_job
    python -m app.test_alert_job --run-alerts
"""
import secrets
import sys

from sqlalchemy import select

from .database import SessionLocal
from .models import Company, Job, JobAlert, User, make_hash
from .security import hash_password
from .services import delete_jobs

TARGET_EMAIL = "mumtazalidev01@gmail.com"
EMPLOYER_EMAIL = "test.employer@jobboard.local"
COMPANY_NAME = "Alert Test Company"
JOB_TITLE = "Senior Full Stack Developer"
JOB_LOCATION = "Remote"
JOB_DESCRIPTION = (
    "We are looking for a Senior Full Stack Developer to build and scale our platform.\n\n"
    "Required skills: React, Python, FastAPI, PostgreSQL.\n"
    "You will design REST APIs, build React interfaces and tune PostgreSQL queries.\n\n"
    "This is a TEST job created by app/test_alert_job.py to check the job alert emails."
)


def check_alert(db) -> list[JobAlert]:
    """Step 1: does the target account have at least one active job alert? Returns the active ones."""
    user = db.scalar(select(User).where(User.email == TARGET_EMAIL))
    if not user:
        print(f"[!] No user with email {TARGET_EMAIL}. Register / log in with that account first.")
        return []
    all_alerts = db.scalars(select(JobAlert).where(JobAlert.user_id == user.id).order_by(JobAlert.id)).all()
    if not all_alerts:
        print(f"[!] {TARGET_EMAIL} has NO job alerts. Profile > Job Alerts > Add alert.")
        return []
    active = [a for a in all_alerts if a.is_active]
    if not active:
        print(f"[!] {TARGET_EMAIL} has {len(all_alerts)} alert(s) but all are switched OFF. Turn one on in the profile.")
        return []
    print(f"[OK] {len(active)} active job alert(s) found for {TARGET_EMAIL} (of {len(all_alerts)}):")
    for a in active:
        print(f"     - #{a.id} keywords={a.keywords} location={a.location or 'anywhere'} last_checked_at={a.last_checked_at}")
    if not user.is_verified and user.verification_token:
        print("[!] This account's email is not verified yet, so the scheduler will SKIP it. Verify the email first.")
    return active


def get_or_create_company(db) -> Company:
    """Step 2: a test employer (user with role 'employer') that owns a company."""
    employer = db.scalar(select(User).where(User.email == EMPLOYER_EMAIL))
    if not employer:
        employer = User(email=EMPLOYER_EMAIL, password_hash=hash_password(secrets.token_urlsafe(16) + "a1"),
                        full_name="Alert Test Employer", role="employer", is_verified=True, is_active=True)
        db.add(employer)
        db.flush()
        print(f"[+] Created test employer {EMPLOYER_EMAIL} (id={employer.id}; random password, you cannot log in with it)")
    else:
        print(f"[=] Using existing test employer {EMPLOYER_EMAIL} (id={employer.id})")

    company = db.scalar(select(Company).where(Company.user_id == employer.id))
    if not company:
        company = Company(user_id=employer.id, name=COMPANY_NAME, description="Created by test_alert_job.py")
        db.add(company)
        db.flush()
        print(f"[+] Created company '{COMPANY_NAME}' (id={company.id})")
    return company


def create_job(db, company: Company) -> Job:
    """Step 3: a PUBLISHED job. Any earlier test job is removed first (dedupe_hash must be unique)."""
    h = make_hash(JOB_TITLE, company.name, JOB_LOCATION)
    old = db.scalar(select(Job).where(Job.dedupe_hash == h))
    if old:
        delete_jobs(db, [old.id])
        print(f"[=] Removed the previous test job (id={old.id}) so the new one counts as new")
    job = Job(title=JOB_TITLE, company_name=company.name, company_id=company.id, location=JOB_LOCATION,
              workplace_type="remote", job_type="full_time", job_category="private", description=JOB_DESCRIPTION,
              source_type="employer", status="published", dedupe_hash=h)
    db.add(job)
    db.commit()
    db.refresh(job)
    print(f"[+] Created job id={job.id} '{job.title}' status={job.status} created_at={job.created_at}")
    return job


def main() -> int:
    run_now = "--run-alerts" in sys.argv
    from .migrate import add_missing_columns       # the alert table gained a `location` column; make sure the DB has it
    added = add_missing_columns()
    if added:
        print("[migrate] applied:", added)
    with SessionLocal() as db:
        alerts = check_alert(db)                     # BEFORE creating the job, as requested
        company = get_or_create_company(db)
        db.commit()
        job = create_job(db, company)

        if alerts:
            from .scheduler import _matches, _location_ok          # the same rules the scheduler uses
            matching = [a for a in alerts if _matches(job, [k for k in (a.keywords or []) if k and k.strip()]) and _location_ok(job, a.location)]
            if matching:
                print(f"[OK] The test job matches {len(matching)} of your alert(s): {[a.id for a in matching]}")
            else:
                print("[!] The test job does NOT match any of your alerts. Add an alert with one of: React, Python, FastAPI, PostgreSQL, Full Stack Developer (location empty or Remote)")

    if run_now:
        print("\n--run-alerts: running the alert check now (this emails EVERY subscribed user with a matching new job)...")
        from .scheduler import alerts_job
        alerts_job()
        print("Done. Check the inbox (and Spam) of", TARGET_EMAIL, "and the '[alerts]' lines above.")
    else:
        print("\nNext: wait for the hourly alert run (at :05 past the hour) while the backend is running,")
        print("or re-run this script with --run-alerts to send immediately.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
