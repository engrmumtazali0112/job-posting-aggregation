from datetime import datetime
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from .database import get_db
from .models import Job, Company, User, Application, SeekerProfile, make_hash
from .matching import match_score
from .schemas import JobIn, EmployerJobOut
from .security import require_role
from .services import get_require_approval, apply_job_fields, resolve_location, delete_jobs, notify, notify_admins
from .resume_parser import read_resume
from .real_match import real_match as compute_real_match, prefetch as prefetch_proofs

router = APIRouter(prefix="/api/employer", tags=["employer"])

CANDIDATE_STATUSES = ("new", "reviewing", "shortlisted", "contacting", "interviewing", "rejected", "hired")
JOB_STATUSES = ("pending", "published", "paused", "closed", "rejected")

def profile_text(p) -> str:
    """Text built from the applicant's profile (skills, summary, titles, experience). Used only when the resume cannot be read."""
    if not p:
        return ""
    parts = [" ".join(p.skills or []), p.summary or "", " ".join(p.job_titles or [])]
    for e in (p.experience or []):
        if isinstance(e, dict):
            parts += [str(e.get("title") or ""), str(e.get("description") or "")]
    for pr in (p.projects or []):
        if isinstance(pr, dict):
            parts += [str(pr.get("name") or ""), str(pr.get("description") or ""), " ".join(pr.get("tech_stack") or [])]
    return "\n".join(x for x in parts if x).strip()

def share(job: Job) -> None:
    try:
        from .telegram import share_jobs
        share_jobs([job])
    except Exception as exc:
        print("[telegram]", exc)

# ---------- helpers ----------
def get_company(db: Session, user: User) -> Company:
    company = db.scalar(select(Company).where(Company.user_id == user.id))
    if not company:
        raise HTTPException(400, "No company profile found")
    return company

def owned_job(db: Session, company: Company, job_id: int) -> Job:
    job = db.get(Job, job_id)
    if not job or job.company_id != company.id:
        raise HTTPException(404, "Job not found")
    return job

def app_counts(db: Session, ids: list[int]) -> dict[int, int]:
    if not ids:
        return {}
    rows = db.execute(select(Application.job_id, func.count()).where(Application.job_id.in_(ids))
                      .group_by(Application.job_id)).all()
    return {r[0]: r[1] for r in rows}

def to_out(job: Job, counts: dict[int, int]) -> EmployerJobOut:
    out = EmployerJobOut.model_validate(job)
    out.applications_count = counts.get(job.id, 0)
    return out

# ---------- dashboard ----------
@router.get("/dashboard")
def dashboard(user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    company = get_company(db, user)
    jobs = {r[0]: r[1] for r in db.execute(select(Job.status, func.count()).where(Job.company_id == company.id)
                                           .group_by(Job.status)).all()}
    apps = {r[0]: r[1] for r in db.execute(
        select(Application.status, func.count()).select_from(Application)
        .join(Job, Job.id == Application.job_id).where(Job.company_id == company.id, Application.skipped.is_not(True))
        .group_by(Application.status)).all()}
    return {
        "company": {"name": company.name, "domain_verified": company.domain_verified},
        "jobs": {**{s: jobs.get(s, 0) for s in JOB_STATUSES}, "total": sum(jobs.values())},
        "applications": {**{s: apps.get(s, 0) for s in CANDIDATE_STATUSES}, "total": sum(apps.values())},
    }

# ---------- jobs ----------
@router.post("/jobs", response_model=EmployerJobOut, status_code=201)
def create_job(data: JobIn, user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    company = get_company(db, user)
    h = make_hash(data.title, company.name, resolve_location(data))
    if db.scalar(select(Job).where(Job.dedupe_hash == h)):
        raise HTTPException(409, "This job has already been posted")
    job = Job(company_name=company.name, company_id=company.id, source_type="employer",
              dedupe_hash=h, status="pending" if get_require_approval(db) else "published")
    apply_job_fields(job, data)
    db.add(job)
    if job.status == "pending":
        notify_admins(db, f"New job pending approval: {job.title} ({company.name}).", "/admin/jobs?status=pending")
    db.commit()
    db.refresh(job)
    if job.status == "published":
        share(job)
    return to_out(job, {})

@router.get("/jobs", response_model=list[EmployerJobOut])
def my_jobs(q: str = "", status: str = "", limit: int = 100, offset: int = 0,
            user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    company = get_company(db, user)
    stmt = select(Job).where(Job.company_id == company.id)
    if status:
        stmt = stmt.where(Job.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.location.ilike(like)))
    jobs = db.scalars(stmt.order_by(Job.created_at.desc()).limit(min(limit, 200)).offset(offset)).all()
    counts = app_counts(db, [j.id for j in jobs])
    return [to_out(j, counts) for j in jobs]

@router.get("/jobs/{job_id}", response_model=EmployerJobOut)
def get_my_job(job_id: int, user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    job = owned_job(db, get_company(db, user), job_id)
    return to_out(job, app_counts(db, [job.id]))

@router.put("/jobs/{job_id}", response_model=EmployerJobOut)
def update_job(job_id: int, data: JobIn, user: User = Depends(require_role("employer")),
               db: Session = Depends(get_db)):
    company = get_company(db, user)
    job = owned_job(db, company, job_id)
    if job.status == "closed":
        raise HTTPException(400, "A closed job cannot be edited. Reopen it first.")
    h = make_hash(data.title, company.name, resolve_location(data))
    clash = db.scalar(select(Job).where(Job.dedupe_hash == h, Job.id != job.id))
    if clash:
        raise HTTPException(409, "Another job with the same title and location already exists")
    apply_job_fields(job, data)
    job.dedupe_hash = h
    was_pending = job.status == "pending"
    if get_require_approval(db):
        if job.status in ("published", "paused", "rejected"):
            job.status = "pending"          # edits need a new approval
    elif job.status == "rejected":
        job.status = "pending"              # admin rejected it, so it must be re-checked
    if job.status == "pending" and not was_pending:
        notify_admins(db, f"Job pending approval again: {job.title} ({company.name}).", "/admin/jobs?status=pending")
    db.commit()
    db.refresh(job)
    return to_out(job, app_counts(db, [job.id]))

class StatusIn(BaseModel):
    action: Literal["pause", "resume", "close", "reopen"]

@router.post("/jobs/{job_id}/status", response_model=EmployerJobOut)
def change_status(job_id: int, data: StatusIn, user: User = Depends(require_role("employer")),
                  db: Session = Depends(get_db)):
    job = owned_job(db, get_company(db, user), job_id)
    a = data.action
    if a == "pause":
        if job.status != "published":
            raise HTTPException(400, "Only live jobs can be paused")
        job.status = "paused"
    elif a == "resume":
        if job.status != "paused":
            raise HTTPException(400, "Only paused jobs can be resumed")
        job.status = "published"
    elif a == "close":
        if job.status == "closed":
            raise HTTPException(400, "Job is already closed")
        job.status = "closed"
    else:  # reopen
        if job.status != "closed":
            raise HTTPException(400, "Only closed jobs can be reopened")
        job.status = "pending" if get_require_approval(db) else "published"
        if job.status == "pending":
            notify_admins(db, f"Job pending approval (reopened): {job.title}.", "/admin/jobs?status=pending")
    db.commit()
    db.refresh(job)
    return to_out(job, app_counts(db, [job.id]))

@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    job = owned_job(db, get_company(db, user), job_id)
    delete_jobs(db, [job.id])
    return {"deleted": job_id}

# ---------- candidates ----------
class CandidateOut(BaseModel):
    id: int
    job_id: int
    job_title: str
    applicant_name: str | None
    applicant_email: str
    applicant_title: str | None = None
    applicant_location: str | None = None
    applicant_skills: list[str] = []
    cover_letter: str | None
    resume_url: str | None
    status: str
    skipped: bool = False
    created_at: datetime
    # skill match against the job post (see matching.py)
    match_scored: bool = False
    match: int = 0
    match_level: str = "none"          # top | good | low | none
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    match_score: int = 0               # same value as `match` (0-100)
    match_source: str = "resume"       # resume | profile (profile = resume unreadable, scored from profile skills)
    # Real Match (see real_match.py): 30% resume + 40% GitHub + 30% LinkedIn/portfolio
    real_match_score: int = 0
    real_match_level: str = "low"      # top | good | low
    github_verified: list[str] = []    # job skills found in the candidate's own public GitHub repos
    portfolio_verified: list[str] = [] # job skills found on the candidate's portfolio site
    real_match: dict = {}              # breakdown + link status for the details panel
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    resume_state: str = "none"         # ok | none | link | image | scanned | missing | unreadable
    answers: list[dict] = []           # answers to the job's screening questions

class CandidatesOut(BaseModel):
    counts: dict[str, int]
    items: list[CandidateOut]

@router.get("/candidates", response_model=CandidatesOut)
def candidates(job_id: int | None = None, status: str = "", q: str = "", skipped: bool = False,
               min_match: int = 0, sort: Literal["real", "match", "newest"] = "real", limit: int = 200, offset: int = 0,
               user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    company = get_company(db, user)
    stmt = (select(Application, Job, User, SeekerProfile).join(Job, Job.id == Application.job_id)
            .join(User, User.id == Application.user_id)
            .outerjoin(SeekerProfile, SeekerProfile.user_id == User.id).where(Job.company_id == company.id))
    if job_id:
        stmt = stmt.where(Job.id == job_id)
    rows = db.execute(stmt.order_by(Application.created_at.desc()).limit(1000)).all()

    # warm the GitHub / portfolio caches for all applicants in parallel (cached for hours, so repeat loads are instant)
    prefetch_proofs([(p.github_url if p else None, p.portfolio_url if p else None) for _, _, _, p in rows])
    scored = []
    dirty = False
    for a, j, u, p in rows:
        # match_score() needs the resume TEXT (a string), not the SeekerProfile object
        url = a.resume_url or (p.resume_url if p else None)       # fall back to the profile resume
        text, state = a.resume_text or "", "ok"
        if not text:                                               # not read yet (or nothing readable last time)
            if p and p.resume_text and url == p.resume_url:
                text = p.resume_text
            else:
                text, state = read_resume(url)                      # file on disk, or a downloaded PDF link
            if text:
                a.resume_text = text                                # remember it on the application
                dirty = True
        rs = "ok" if text else (state if state != "ok" else "none")   # why the resume cannot be matched: none | link | image | scanned | missing | unreadable
        source = "resume"
        if not text:                                               # resume unreadable: fall back to the profile so a score still shows
            ptxt = profile_text(p)
            if ptxt:
                text, source = ptxt, "profile"
            print(f"[candidates] app {a.id}: resume {rs} (url={url!r}), scoring from {source}")
        m = match_score(j.title, j.description or "", text)
        m["source"] = source
        written = "\n".join(x for x in (text, profile_text(p)) if x)       # everything the candidate WROTE (resume + profile + projects)
        m["real"] = compute_real_match(j.title, j.description or "", written, p.github_url if p else None,
                                       p.linkedin_url if p else None, p.portfolio_url if p else None)
        scored.append((a, j, u, p, m, rs))

    # tab counts ignore the status filter but respect job / skipped
    live = [r for r in scored if not r[0].skipped]
    by_status: dict[str, int] = {}
    for a, *_ in live:
        by_status[a.status] = by_status.get(a.status, 0) + 1
    counts = {"all": len(live), "skipped": sum(1 for r in scored if r[0].skipped),
              **{s: by_status.get(s, 0) for s in CANDIDATE_STATUSES},
              "top": sum(1 for a, j, u, p, m, rs in live if m["level"] == "top" and a.status in ("new", "reviewing"))}

    like = q.lower().strip()
    out = []
    for a, j, u, p, m, rs in scored:
        if bool(a.skipped) != skipped:
            continue
        if status and a.status != status:
            continue
        if min_match and m["real"]["score"] < min_match:
            continue
        if like and like not in " ".join([u.email, u.full_name or "", j.title]).lower():
            continue
        titles = (p.job_titles if p else None) or []
        out.append((a, CandidateOut(
            id=a.id, job_id=j.id, job_title=j.title, applicant_name=u.full_name, applicant_email=u.email,
            applicant_title=titles[0] if titles else None, applicant_location=p.location if p else None,
            applicant_skills=((p.skills if p else None) or [])[:12], cover_letter=a.cover_letter, resume_url=a.resume_url,
            status=a.status, skipped=bool(a.skipped), created_at=a.created_at, match_scored=m["scored"], match=m["score"],
            match_level=m["level"], matched_skills=m["matched"], missing_skills=m["missing"],
            match_score=m["score"], match_source=m.get("source", "resume"), resume_state=rs, answers=a.answers or [],
            real_match_score=m["real"]["score"], real_match_level=m["real"]["level"],
            github_verified=m["real"]["github_verified"], portfolio_verified=m["real"]["portfolio_verified"], real_match=m["real"],
            github_url=p.github_url if p else None, linkedin_url=p.linkedin_url if p else None,
            portfolio_url=p.portfolio_url if p else None)))
    if sort == "real":
        out.sort(key=lambda r: (r[1].real_match_score, r[1].match, r[0].created_at), reverse=True)   # most proof first
    elif sort == "match":
        out.sort(key=lambda r: (r[1].match, r[0].created_at), reverse=True)     # best match first, newest as tie-break
    items = [o for _, o in out][offset:offset + min(limit, 500)]
    if dirty:
        db.commit()                 # save the resume text we just read (done last so rows are not reloaded)
    return {"counts": counts, "items": items}

TEXTS = {"reviewing": "viewed your application.", "shortlisted": "shortlisted you for", "contacting": "wants to contact you about",
         "interviewing": "invited you to interview for", "hired": "marked you as hired for", "rejected": "did not select you for"}

def apply_status(db: Session, company: Company, app: Application, job: Job, status: str) -> None:
    changed = app.status != status
    app.status = status
    if changed and status in TEXTS:
        t = TEXTS[status]
        notify(db, app.user_id, f"{company.name} {t}" + ("" if t.endswith(".") else f" {job.title}."), "/my/applications")

class CandidatePatch(BaseModel):
    status: Literal["new", "reviewing", "shortlisted", "contacting", "interviewing", "rejected", "hired"] | None = None
    skipped: bool | None = None          # True = hide this application (no notification); False = bring it back

@router.patch("/candidates/{app_id}")
def set_candidate_status(app_id: int, data: CandidatePatch,
                         user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    company = get_company(db, user)
    app = db.get(Application, app_id)
    job = db.get(Job, app.job_id) if app else None
    if not app or not job or job.company_id != company.id:
        raise HTTPException(404, "Application not found")
    if data.status is None and data.skipped is None:
        raise HTTPException(422, "Nothing to change")
    if data.status is not None:
        apply_status(db, company, app, job, data.status)
    if data.skipped is not None:
        app.skipped = data.skipped
    db.commit()
    return {"id": app.id, "status": app.status, "skipped": bool(app.skipped)}

class CandidateBulkIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=200)
    action: Literal["shortlist", "reject", "skip", "restore"]

@router.post("/candidates/bulk")
def candidates_bulk(data: CandidateBulkIn, user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    """Act on many applications at once. Only the employer's own applications are touched."""
    company = get_company(db, user)
    rows = db.execute(select(Application, Job).join(Job, Job.id == Application.job_id)
                      .where(Application.id.in_(data.ids), Job.company_id == company.id)).all()
    n = 0
    for app, job in rows:
        if data.action == "shortlist":
            if app.status in ("new", "reviewing"):        # never move someone backwards (interviewing, hired...)
                apply_status(db, company, app, job, "shortlisted"); n += 1
        elif data.action == "reject":
            if app.status not in ("rejected", "hired"):
                apply_status(db, company, app, job, "rejected"); n += 1
        elif data.action == "skip":
            app.skipped = True; n += 1
        else:
            app.skipped = False; n += 1
    db.commit()
    return {"affected": n}

# ---------- company profile ----------
class CompanyIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    website: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    logo_url: str | None = Field(default=None, max_length=500)

class CompanyOut(CompanyIn):
    domain_verified: bool
    model_config = {"from_attributes": True}

@router.get("/company", response_model=CompanyOut)
def get_company_profile(user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    return get_company(db, user)

@router.put("/company", response_model=CompanyOut)
def update_company_profile(data: CompanyIn, user: User = Depends(require_role("employer")),
                           db: Session = Depends(get_db)):
    company = get_company(db, user)
    if (data.website or None) != company.website:
        company.domain_verified = False
    company.name = data.name.strip()
    company.website = data.website or None
    company.description = data.description or None
    company.logo_url = data.logo_url or None
    for job in db.scalars(select(Job).where(Job.company_id == company.id)):
        job.company_name = company.name
    db.commit()
    db.refresh(company)
    return company