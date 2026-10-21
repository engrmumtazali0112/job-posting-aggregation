from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Job, Application, SavedJob
from .security import require_role
from .schemas import ApplicationIn

router = APIRouter(prefix="/api/seeker", tags=["seeker"], dependencies=[Depends(require_role("job_seeker"))])

# --- Profile ---
class ProfileUpdate(BaseModel):
    full_name: str | None = None

@router.get("/profile")
def get_profile(user: User = Depends(require_role("job_seeker"))):
    return {"id": user.id, "email": user.email, "full_name": user.full_name}

@router.put("/profile")
def update_profile(data: ProfileUpdate, user: User = Depends(require_role("job_seeker")), db: Session = Depends(get_db)):
    user.full_name = data.full_name
    db.commit()
    return {"ok": True}

# --- Applications ---
@router.get("/applications")
def my_applications(user: User = Depends(require_role("job_seeker")), db: Session = Depends(get_db)):
    apps = db.scalars(select(Application).where(Application.user_id == user.id)).all()
    # We manually join to get job details for the frontend
    res = []
    for a in apps:
        job = db.get(Job, a.job_id)
        if job:
            res.append({
                "id": a.id, "job_id": a.job_id, "job_title": job.title,
                "company_name": job.company_name, "job_status": job.status,
                "status": a.status, "created_at": a.created_at
            })
    return res

@router.delete("/applications/{app_id}")
def withdraw_application(app_id: int, user: User = Depends(require_role("job_seeker")), db: Session = Depends(get_db)):
    app = db.scalar(select(Application).where(Application.id == app_id, Application.user_id == user.id))
    if not app:
        raise HTTPException(404, "Application not found")
    db.delete(app)
    db.commit()
    return {"ok": True}

@router.post("/jobs/{job_id}/apply")
def apply_to_job(job_id: int, data: ApplicationIn, user: User = Depends(require_role("job_seeker")), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(404, "Job not found or no longer active")
        
    existing = db.scalar(select(Application).where(Application.job_id == job_id, Application.user_id == user.id))
    if existing:
        raise HTTPException(409, "You have already applied to this job")

    app = Application(job_id=job_id, user_id=user.id, cover_letter=data.cover_letter, resume_url=data.resume_url)
    db.add(app)
    db.commit()
    return {"ok": True}

# --- Saved Jobs ---
@router.get("/saved")
def my_saved_jobs(user: User = Depends(require_role("job_seeker")), db: Session = Depends(get_db)):
    saved = db.scalars(select(SavedJob).where(SavedJob.user_id == user.id)).all()
    jobs = []
    for s in saved:
        job = db.get(Job, s.job_id)
        if job:
            jobs.append(job)
    return jobs

@router.get("/saved/ids")
def my_saved_ids(user: User = Depends(require_role("job_seeker")), db: Session = Depends(get_db)):
    return [s.job_id for s in db.scalars(select(SavedJob).where(SavedJob.user_id == user.id)).all()]

@router.post("/saved/{job_id}")
def save_job(job_id: int, user: User = Depends(require_role("job_seeker")), db: Session = Depends(get_db)):
    if not db.get(Job, job_id):
        raise HTTPException(404, "Job not found")
    existing = db.scalar(select(SavedJob).where(SavedJob.job_id == job_id, SavedJob.user_id == user.id))
    if existing:
        return {"ok": True}
    db.add(SavedJob(job_id=job_id, user_id=user.id))
    db.commit()
    return {"ok": True}

@router.delete("/saved/{job_id}")
def unsave_job(job_id: int, user: User = Depends(require_role("job_seeker")), db: Session = Depends(get_db)):
    saved = db.scalar(select(SavedJob).where(SavedJob.job_id == job_id, SavedJob.user_id == user.id))
    if saved:
        db.delete(saved)
        db.commit()
    return {"ok": True}