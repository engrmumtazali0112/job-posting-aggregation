from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_, update
from sqlalchemy.orm import Session
from .database import get_db
from .models import Job, JobSource, User, Company, Application, make_hash
from .schemas import JobIn, JobFull
from .security import require_role
from .services import (get_require_approval, set_require_approval, apply_job_fields,
                       resolve_location, delete_jobs)
from .ingest import run_all, SOURCES, get_source
from .services import notify

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])

def group_counts(db: Session, col) -> dict:
    return {r[0]: r[1] for r in db.execute(select(col, func.count()).group_by(col)).all()}

# ---------- stats ----------
@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    week = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)
    users = group_counts(db, User.role)
    jobs = group_counts(db, Job.status)
    apps = group_counts(db, Application.status)
    return {
        "users": {"total": sum(users.values()), "admins": users.get("admin", 0),
                  "employers": users.get("employer", 0), "job_seekers": users.get("job_seeker", 0),
                  "new_last_7_days": db.scalar(select(func.count()).select_from(User).where(User.created_at >= week))},
        "jobs": {"total": sum(jobs.values()), **{s: jobs.get(s, 0) for s in
                 ("pending", "published", "rejected", "paused", "closed")},
                 "by_source": group_counts(db, Job.source_type)},
        "applications": {"total": sum(apps.values()), **apps},
        "companies": {"total": db.scalar(select(func.count()).select_from(Company)),
                      "verified": db.scalar(select(func.count()).select_from(Company)
                                            .where(Company.domain_verified.is_(True)))},
        "require_approval": get_require_approval(db),
    }

# ---------- jobs ----------
@router.get("/jobs", response_model=list[JobFull])
def list_jobs(response: Response, status: str = "all", source: str = "", q: str = "",
              limit: int = 25, offset: int = 0, db: Session = Depends(get_db)):
    stmt = select(Job)
    if status != "all":
        stmt = stmt.where(Job.status == status)
    if source in ("aggregated", "employer"):
        stmt = stmt.where(Job.source_type == source)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.company_name.ilike(like), Job.location.ilike(like)))
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(stmt.subquery())))
    return db.scalars(stmt.order_by(Job.created_at.desc()).limit(min(limit, 200)).offset(offset)).all()

@router.get("/jobs/{job_id}", response_model=JobFull)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job

@router.put("/jobs/{job_id}", response_model=JobFull)
def edit_job(job_id: int, data: JobIn, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    h = make_hash(data.title, job.company_name, resolve_location(data))
    if db.scalar(select(Job).where(Job.dedupe_hash == h, Job.id != job.id)):
        raise HTTPException(409, "Another job with the same title, company and location exists")
    apply_job_fields(job, data)
    job.dedupe_hash = h
    db.commit()
    db.refresh(job)
    return job

def set_status(job_id: int, status: str, db: Session):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    was = job.status
    job.status = status
    company = db.get(Company, job.company_id) if job.company_id else None
    if company and company.user_id and was != status and status in ("published", "rejected"):
        notify(db, company.user_id, f"Your job {job.title} was {'approved and is now live' if status == 'published' else 'rejected'}.",
               "/employer/dashboard/jobs")
    db.commit()
    if status == "published" and was != "published" and job.source_type == "employer":
        try:
            from .telegram import share_jobs
            share_jobs([job])
        except Exception as exc:
            print("[telegram]", exc)
    return {"id": job.id, "status": job.status}

@router.post("/jobs/{job_id}/approve")
def approve(job_id: int, db: Session = Depends(get_db)):
    return set_status(job_id, "published", db)

@router.post("/jobs/{job_id}/reject")
def reject(job_id: int, db: Session = Depends(get_db)):
    return set_status(job_id, "rejected", db)

@router.delete("/jobs/{job_id}")
def remove_job(job_id: int, db: Session = Depends(get_db)):
    if not db.get(Job, job_id):
        raise HTTPException(404, "Job not found")
    delete_jobs(db, [job_id])
    return {"deleted": job_id}

class BulkIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=200)
    action: Literal["approve", "reject", "delete"]

@router.post("/jobs/bulk")
def bulk(data: BulkIn, db: Session = Depends(get_db)):
    if data.action == "delete":
        return {"affected": delete_jobs(db, data.ids)}
    new_status = "published" if data.action == "approve" else "rejected"
    to_share = []
    if new_status == "published":
        to_share = db.scalars(select(Job).where(Job.id.in_(data.ids), Job.status != "published",
                                                Job.source_type == "employer")).all()
    res = db.execute(update(Job).where(Job.id.in_(data.ids)).values(status=new_status))
    db.commit()
    if to_share:
        try:
            from .telegram import share_jobs
            share_jobs(to_share)
        except Exception as exc:
            print("[telegram]", exc)
    return {"affected": res.rowcount}

# ---------- users ----------
class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    is_active: bool
    is_verified: bool
    company_name: str | None
    created_at: datetime

class UserPatch(BaseModel):
    is_active: bool | None = None
    is_verified: bool | None = None

@router.get("/users", response_model=list[UserOut])
def list_users(response: Response, role: str = "", q: str = "", limit: int = 25, offset: int = 0,
               db: Session = Depends(get_db)):
    stmt = select(User, Company.name).outerjoin(Company, Company.user_id == User.id)
    if role in ("admin", "employer", "job_seeker"):
        stmt = stmt.where(User.role == role)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like), Company.name.ilike(like)))
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(stmt.subquery())))
    rows = db.execute(stmt.order_by(User.created_at.desc()).limit(min(limit, 200)).offset(offset)).all()
    return [UserOut(id=u.id, email=u.email, full_name=u.full_name, role=u.role,
                    is_active=u.is_active is not False, is_verified=bool(u.is_verified),
                    company_name=cname, created_at=u.created_at) for u, cname in rows]

@router.patch("/users/{user_id}")
def patch_user(user_id: int, data: UserPatch, me: User = Depends(require_role("admin")),
               db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if data.is_active is False and user.id == me.id:
        raise HTTPException(400, "You cannot deactivate your own account")
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_verified is not None:
        user.is_verified = data.is_verified
    db.commit()
    return {"id": user.id, "is_active": user.is_active, "is_verified": user.is_verified}

# ---------- companies ----------
class CompanyAdminOut(BaseModel):
    id: int
    user_id: int
    name: str
    website: str | None
    domain_verified: bool
    owner_email: str
    jobs_count: int

class CompanyPatch(BaseModel):
    domain_verified: bool

@router.get("/companies", response_model=list[CompanyAdminOut])
def list_companies(response: Response, q: str = "", limit: int = 25, offset: int = 0,
                   db: Session = Depends(get_db)):
    stmt = select(Company, User.email).join(User, User.id == Company.user_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Company.name.ilike(like), User.email.ilike(like)))
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(stmt.subquery())))
    rows = db.execute(stmt.order_by(Company.id.desc()).limit(min(limit, 200)).offset(offset)).all()
    counts = {r[0]: r[1] for r in db.execute(select(Job.company_id, func.count())
                                             .where(Job.company_id.is_not(None)).group_by(Job.company_id)).all()}
    return [CompanyAdminOut(id=c.id, user_id=c.user_id, name=c.name, website=c.website,
                            domain_verified=bool(c.domain_verified), owner_email=email,
                            jobs_count=counts.get(c.id, 0)) for c, email in rows]

@router.patch("/companies/{company_id}")
def patch_company(company_id: int, data: CompanyPatch, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    company.domain_verified = data.domain_verified
    db.commit()
    return {"id": company.id, "domain_verified": company.domain_verified}

# ---------- sources ----------
class SourceOut(BaseModel):
    id: int
    name: str
    type: str
    endpoint: str | None
    active: bool
    jobs_count: int

class SourcePatch(BaseModel):
    active: bool

@router.get("/sources", response_model=list[SourceOut])
def list_sources(db: Session = Depends(get_db)):
    for cfg in SOURCES:
        get_source(db, cfg)                       # makes sure every source has a row
    counts = {r[0]: r[1] for r in db.execute(select(Job.source_id, func.count())
                                             .where(Job.source_id.is_not(None)).group_by(Job.source_id)).all()}
    return [SourceOut(id=s.id, name=s.name, type=s.type, endpoint=s.endpoint, active=bool(s.active),
                      jobs_count=counts.get(s.id, 0)) for s in db.scalars(select(JobSource).order_by(JobSource.id))]

@router.patch("/sources/{source_id}")
def patch_source(source_id: int, data: SourcePatch, db: Session = Depends(get_db)):
    src = db.get(JobSource, source_id)
    if not src:
        raise HTTPException(404, "Source not found")
    src.active = data.active
    db.commit()
    return {"id": src.id, "active": src.active}

# ---------- settings + ingest ----------
class SettingsIn(BaseModel):
    require_approval: bool

@router.get("/settings")
def read_settings(db: Session = Depends(get_db)):
    return {"require_approval": get_require_approval(db)}

@router.put("/settings")
def write_settings(data: SettingsIn, db: Session = Depends(get_db)):
    set_require_approval(db, data.require_approval)
    return {"require_approval": data.require_approval}

@router.post("/ingest/run")
def ingest_now(db: Session = Depends(get_db)):
    return run_all(db)

class AIParseIn(BaseModel):
    text: str = Field(min_length=20, max_length=20000)       # pasted LinkedIn post / WhatsApp message / flyer text
    publish: bool = True                                    # False = save as "pending" so you can review it first

@router.post("/ingest/ai-parse", response_model=dict)
@router.post("/ingest/grok", response_model=dict, include_in_schema=False)      # old path kept so nothing that still calls it breaks
def ingest_ai_parse(data: AIParseIn, db: Session = Depends(get_db)):
    """Parse raw job text with AI (OpenRouter) and save it as a job."""
    from .openrouter_jobs import parse_job_text, save_parsed_job, AIParseError
    try:
        parsed = parse_job_text(data.text)
    except AIParseError as exc:
        raise HTTPException(exc.status, str(exc))
    job, created = save_parsed_job(db, parsed, publish=data.publish)
    return {"created": created, "duplicate": not created, "parsed": parsed.model_dump(),
            "job": JobFull.model_validate(job).model_dump(mode="json")}
