from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Job, Application, SavedJob, SeekerProfile, Company
from .security import require_role
from .schemas import ApplicationIn, ProfileIn, JobPublic
from .services import notify

router = APIRouter(prefix="/api/seeker", tags=["seeker"], dependencies=[Depends(require_role("job_seeker"))])
seeker = require_role("job_seeker")


# --- Profile ---
def profile_row(db: Session, user: User) -> SeekerProfile:
    p = db.scalar(select(SeekerProfile).where(SeekerProfile.user_id == user.id))
    if not p:
        p = SeekerProfile(user_id=user.id, visible=True)
        db.add(p)
        db.flush()
    return p


def profile_out(user: User, p: SeekerProfile) -> dict:
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "phone": p.phone, "location": p.location,
            "visible": bool(p.visible), "resume_url": p.resume_url, "resume_name": p.resume_name,
            "job_titles": p.job_titles or [], "job_types": p.job_types or [], "min_pay": p.min_pay,
            "min_pay_period": p.min_pay_period or "month", "relocation": p.relocation,
            "available_now": bool(p.available_now), "summary": p.summary, "skills": p.skills or [],
            "experience": p.experience or [], "education": p.education or [],
            "languages": p.languages or [], "certifications": p.certifications or []}


@router.get("/profile")
def get_profile(user: User = Depends(seeker), db: Session = Depends(get_db)):
    p = profile_row(db, user)
    db.commit()
    return profile_out(user, p)


@router.put("/profile")
def update_profile(data: ProfileIn, user: User = Depends(seeker), db: Session = Depends(get_db)):
    p = profile_row(db, user)
    user.full_name = (data.full_name or "").strip() or None
    for k in ("phone", "location", "visible", "resume_url", "resume_name", "min_pay", "min_pay_period",
              "relocation", "available_now"):
        setattr(p, k, getattr(data, k))
    p.job_titles = [t.strip() for t in data.job_titles if t.strip()]
    p.job_types = list(data.job_types)
    p.summary = (data.summary or "").strip() or None
    seen, skills = set(), []
    for t in data.skills:                       # trim, drop blanks and case-insensitive duplicates
        t = t.strip()[:50]
        if t and t.lower() not in seen:
            seen.add(t.lower())
            skills.append(t)
    p.skills = skills
    p.experience = [i.model_dump() for i in data.experience]
    p.education = [i.model_dump() for i in data.education]
    p.languages = [i.model_dump() for i in data.languages]
    p.certifications = [i.model_dump() for i in data.certifications]
    db.commit()
    return profile_out(user, p)


# --- Dashboard ---
GROUPS = {"new": "applied", "reviewing": "review", "contacting": "review",
          "interviewing": "interview", "hired": "accepted", "rejected": "rejected"}


def completion(p: SeekerProfile) -> dict:
    checks = [("Add your phone number and location", bool(p.phone and p.location)),
              ("Write a short summary", bool(p.summary)),
              ("Add your skills", bool(p.skills)),
              ("Add your work experience", bool(p.experience)),
              ("Add your education", bool(p.education)),
              ("Add languages you speak", bool(p.languages)),
              ("Add a resume link", bool(p.resume_url)),
              ("Add the job titles you want", bool(p.job_titles))]
    done = [c for c, ok in checks if ok]
    return {"percent": round(100 * len(done) / len(checks)), "done": done,
            "next": [c for c, ok in checks if not ok]}


@router.get("/dashboard")
def dashboard(user: User = Depends(seeker), db: Session = Depends(get_db)):
    p = profile_row(db, user)
    db.commit()
    live = (Application.user_id == user.id, Application.archived.is_not(True))
    stats = {"total": 0, "applied": 0, "review": 0, "interview": 0, "accepted": 0, "rejected": 0}
    for status, n in db.execute(select(Application.status, func.count()).where(*live).group_by(Application.status)).all():
        stats[GROUPS.get(status, "applied")] += n
        stats["total"] += n
    recent = db.execute(select(Application, Job).join(Job, Job.id == Application.job_id).where(*live)
                        .order_by(Application.created_at.desc()).limit(5)).all()
    saved = db.scalar(select(func.count()).select_from(SavedJob).where(SavedJob.user_id == user.id)) or 0
    return {"name": user.full_name or user.email.split("@")[0], "stats": stats, "saved": saved,
            "completion": completion(p),
            "recent": [{"id": a.id, "job_id": a.job_id, "job_title": j.title, "company_name": j.company_name,
                        "status": a.status, "created_at": a.created_at} for a, j in recent]}


# --- Applications ---
@router.get("/applications")
def my_applications(user: User = Depends(seeker), db: Session = Depends(get_db)):
    rows = db.execute(select(Application, Job).join(Job, Job.id == Application.job_id)
                      .where(Application.user_id == user.id).order_by(Application.created_at.desc())).all()
    return [{"id": a.id, "job_id": a.job_id, "job_title": j.title, "company_name": j.company_name,
             "company_id": j.company_id, "source_type": j.source_type, "location": j.location, "job_status": j.status, "status": a.status,
             "archived": bool(a.archived), "created_at": a.created_at} for a, j in rows]


@router.get("/summary")
def summary(user: User = Depends(seeker), db: Session = Depends(get_db)):
    """Counts for the My jobs tabs."""
    saved = db.scalar(select(func.count()).select_from(SavedJob).where(SavedJob.user_id == user.id)) or 0
    rows = db.execute(select(Application.status, Application.archived, func.count())
                      .where(Application.user_id == user.id).group_by(Application.status, Application.archived)).all()
    applied = sum(n for s, ar, n in rows if not ar)
    interviews = sum(n for s, ar, n in rows if not ar and s in ("interviewing", "hired"))
    archived = sum(n for s, ar, n in rows if ar)
    return {"saved": saved, "applied": applied, "interviews": interviews, "archived": archived}


@router.post("/applications/{app_id}/archive")
def archive_application(app_id: int, archived: bool = True, user: User = Depends(seeker), db: Session = Depends(get_db)):
    app = db.scalar(select(Application).where(Application.id == app_id, Application.user_id == user.id))
    if not app:
        raise HTTPException(404, "Application not found")
    app.archived = archived
    db.commit()
    return {"ok": True}


@router.delete("/applications/{app_id}")
def withdraw_application(app_id: int, user: User = Depends(seeker), db: Session = Depends(get_db)):
    from .models import Message
    app = db.scalar(select(Application).where(Application.id == app_id, Application.user_id == user.id))
    if not app:
        raise HTTPException(404, "Application not found")
    from sqlalchemy import delete
    db.execute(delete(Message).where(Message.application_id == app.id))
    db.delete(app)
    db.commit()
    return {"ok": True}


@router.post("/jobs/{job_id}/apply")
def apply_to_job(job_id: int, data: ApplicationIn, user: User = Depends(seeker), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(404, "Job not found or no longer active")
    if job.source_type != "employer":
        raise HTTPException(400, "This job is hosted on another website. Use the Apply now link.")
    if db.scalar(select(Application).where(Application.job_id == job_id, Application.user_id == user.id)):
        raise HTTPException(409, "You have already applied to this job")
    db.add(Application(job_id=job_id, user_id=user.id, cover_letter=data.cover_letter, resume_url=data.resume_url))
    company = db.get(Company, job.company_id) if job.company_id else None
    if company and company.user_id:
        notify(db, company.user_id, f"{user.full_name or user.email} applied to {job.title}.",
               "/employer/dashboard/candidates")
    db.commit()
    return {"ok": True}


# --- Saved Jobs ---
@router.get("/saved", response_model=list[JobPublic])
def my_saved_jobs(user: User = Depends(seeker), db: Session = Depends(get_db)):
    return db.scalars(select(Job).join(SavedJob, SavedJob.job_id == Job.id)
                      .where(SavedJob.user_id == user.id).order_by(SavedJob.created_at.desc())).all()


@router.get("/saved/ids")
def my_saved_ids(user: User = Depends(seeker), db: Session = Depends(get_db)):
    return list(db.scalars(select(SavedJob.job_id).where(SavedJob.user_id == user.id)))


@router.post("/saved/{job_id}")
def save_job(job_id: int, user: User = Depends(seeker), db: Session = Depends(get_db)):
    if not db.get(Job, job_id):
        raise HTTPException(404, "Job not found")
    if not db.scalar(select(SavedJob).where(SavedJob.job_id == job_id, SavedJob.user_id == user.id)):
        db.add(SavedJob(job_id=job_id, user_id=user.id))
        db.commit()
    return {"ok": True}


@router.delete("/saved/{job_id}")
def unsave_job(job_id: int, user: User = Depends(seeker), db: Session = Depends(get_db)):
    saved = db.scalar(select(SavedJob).where(SavedJob.job_id == job_id, SavedJob.user_id == user.id))
    if saved:
        db.delete(saved)
        db.commit()
    return {"ok": True}