from datetime import datetime
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from .database import get_db
from .models import Job, Company, User, Application, make_hash
from .schemas import JobIn, EmployerJobOut
from .security import require_role
from .services import get_require_approval, apply_job_fields, resolve_location, delete_jobs

router = APIRouter(prefix="/api/employer", tags=["employer"])

CANDIDATE_STATUSES = ("new", "reviewing", "contacting", "interviewing", "rejected", "hired")
JOB_STATUSES = ("pending", "published", "paused", "closed", "rejected")

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
        .join(Job, Job.id == Application.job_id).where(Job.company_id == company.id)
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
    db.commit()
    db.refresh(job)
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
    if get_require_approval(db):
        if job.status in ("published", "paused", "rejected"):
            job.status = "pending"          # edits need a new approval
    elif job.status == "rejected":
        job.status = "pending"              # admin rejected it, so it must be re-checked
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
    cover_letter: str | None
    resume_url: str | None
    status: str
    created_at: datetime

class CandidatesOut(BaseModel):
    counts: dict[str, int]
    items: list[CandidateOut]

@router.get("/candidates", response_model=CandidatesOut)
def candidates(job_id: int | None = None, status: str = "", q: str = "", limit: int = 100, offset: int = 0,
               user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    company = get_company(db, user)

    cstmt = (select(Application.status, func.count()).select_from(Application)
             .join(Job, Job.id == Application.job_id).where(Job.company_id == company.id))
    if job_id:
        cstmt = cstmt.where(Job.id == job_id)
    by_status = {r[0]: r[1] for r in db.execute(cstmt.group_by(Application.status)).all()}
    counts = {"all": sum(by_status.values()), **{s: by_status.get(s, 0) for s in CANDIDATE_STATUSES}}

    stmt = (select(Application, Job, User).join(Job, Job.id == Application.job_id)
            .join(User, User.id == Application.user_id).where(Job.company_id == company.id))
    if job_id:
        stmt = stmt.where(Job.id == job_id)
    if status:
        stmt = stmt.where(Application.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like), Job.title.ilike(like)))
    rows = db.execute(stmt.order_by(Application.created_at.desc()).limit(min(limit, 200)).offset(offset)).all()
    items = [CandidateOut(id=a.id, job_id=j.id, job_title=j.title, applicant_name=u.full_name,
                          applicant_email=u.email, cover_letter=a.cover_letter, resume_url=a.resume_url,
                          status=a.status, created_at=a.created_at) for a, j, u in rows]
    return {"counts": counts, "items": items}

class CandidateStatusIn(BaseModel):
    status: Literal["new", "reviewing", "contacting", "interviewing", "rejected", "hired"]

@router.patch("/candidates/{app_id}")
def set_candidate_status(app_id: int, data: CandidateStatusIn,
                         user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    company = get_company(db, user)
    app = db.get(Application, app_id)
    job = db.get(Job, app.job_id) if app else None
    if not app or not job or job.company_id != company.id:
        raise HTTPException(404, "Application not found")
    app.status = data.status
    db.commit()
    return {"id": app.id, "status": app.status}

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
