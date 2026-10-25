import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Job, Application, SavedJob, SeekerProfile, Company, JobAlert
from .security import require_role
from .schemas import ApplicationIn, ProfileIn, JobPublic, JobAlertIn, JobAlertOut
from .services import notify
from . import storage, ats, resume_builder

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
            "resume_state": storage.resume_state(p.resume_url, p.resume_text),
            "job_titles": p.job_titles or [], "job_types": p.job_types or [], "min_pay": p.min_pay,
            "min_pay_period": p.min_pay_period or "month", "relocation": p.relocation,
            "available_now": bool(p.available_now), "summary": p.summary, "skills": p.skills or [],
            "experience": p.experience or [], "education": p.education or [],
            "languages": p.languages or [], "certifications": p.certifications or [],
            "linkedin_url": p.linkedin_url, "github_url": p.github_url, "portfolio_url": p.portfolio_url,
            "projects": p.projects or []}


@router.get("/profile")
def get_profile(user: User = Depends(seeker), db: Session = Depends(get_db)):
    p = profile_row(db, user)
    db.commit()
    return profile_out(user, p)


@router.put("/profile")
def update_profile(data: ProfileIn, user: User = Depends(seeker), db: Session = Depends(get_db)):
    p = profile_row(db, user)
    if p.resume_url and p.resume_url != data.resume_url:
        storage.delete_file(p.resume_url)           # replaced or removed: delete our old file
        p.resume_text = None
    user.full_name = (data.full_name or "").strip() or None
    for k in ("phone", "location", "visible", "resume_url", "resume_name", "min_pay", "min_pay_period",
              "relocation", "available_now", "linkedin_url", "github_url", "portfolio_url"):
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
    p.projects = [i.model_dump() for i in data.projects if (i.name or "").strip()]
    db.commit()
    return profile_out(user, p)


# --- Resume upload (PDF / PNG / JPG, max settings.max_upload_mb) ---
@router.post("/resume")
def upload_resume(file: UploadFile = File(...), user: User = Depends(seeker), db: Session = Depends(get_db)):
    p = profile_row(db, user)
    url, name = storage.save_resume(file)            # raises 400/413 for bad files
    storage.delete_file(p.resume_url)                # drop the previous upload, if any
    p.resume_url, p.resume_name = url, name
    p.resume_text = storage.extract_text(url)        # the text employers' job matching is based on
    db.commit()
    return {"resume_url": url, "resume_name": name, "readable": bool(p.resume_text),
            "words": len(p.resume_text.split()), "state": storage.resume_state(url, p.resume_text)}


@router.delete("/resume")
def remove_resume(user: User = Depends(seeker), db: Session = Depends(get_db)):
    p = profile_row(db, user)
    storage.delete_file(p.resume_url)
    p.resume_url = p.resume_name = p.resume_text = None
    db.commit()
    return {"ok": True}


# --- Resume builder + ATS score (both work from the saved profile) ---
@router.get("/resume/generate")
def generate_resume(user: User = Depends(seeker), db: Session = Depends(get_db)):
    """Download an ATS-friendly Word resume built from the saved profile."""
    p = profile_row(db, user)
    db.commit()
    out = profile_out(user, p)
    try:
        data = resume_builder.build_docx(out)
    except ImportError:
        raise HTTPException(503, "Resume builder is not installed on the server (pip install python-docx)")
    name = re.sub(r"[^A-Za-z0-9]+", "_", out["full_name"] or user.email.split("@")[0]).strip("_") or "Candidate"
    return Response(content=data, headers={"Content-Disposition": f'attachment; filename="{name}_Resume.docx"'},
                    media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@router.get("/resume/ats-score")
def resume_ats_score(user: User = Depends(seeker), db: Session = Depends(get_db)):
    p = profile_row(db, user)
    db.commit()
    return ats.ats_score(profile_out(user, p))


# --- Job alerts (the scheduler emails matching new jobs, see scheduler.py) ---
@router.get("/alerts", response_model=JobAlertOut)
def get_alerts(user: User = Depends(seeker), db: Session = Depends(get_db)):
    a = db.scalar(select(JobAlert).where(JobAlert.user_id == user.id))
    return JobAlertOut(keywords=list(a.keywords or []) if a else [], is_active=bool(a and a.is_active))


@router.put("/alerts", response_model=JobAlertOut)
def save_alerts(data: JobAlertIn, user: User = Depends(seeker), db: Session = Depends(get_db)):
    started = datetime.now(timezone.utc).replace(tzinfo=None)         # DateTime columns hold naive UTC
    a = db.scalar(select(JobAlert).where(JobAlert.user_id == user.id))
    if not a:
        a = JobAlert(user_id=user.id, last_checked_at=started)
        db.add(a)
    elif data.is_active and not a.is_active:
        a.last_checked_at = started                                    # turned back on: only jobs from now on, never a flood of old ones
    a.keywords = data.keywords
    a.is_active = data.is_active
    db.commit()
    return JobAlertOut(keywords=list(a.keywords or []), is_active=bool(a.is_active))


# --- Dashboard ---
GROUPS = {"new": "applied", "reviewing": "review", "contacting": "review",
          "shortlisted": "review", "interviewing": "interview", "hired": "accepted", "rejected": "rejected"}


def completion(p: SeekerProfile) -> dict:
    # key = which part of the profile page the step opens (see Seeker.jsx, Profile)
    checks = [("basics", "Add your phone number and location", bool(p.phone and p.location)),
              ("summary", "Write a short summary", bool(p.summary)),
              ("skills", "Add your skills", bool(p.skills)),
              ("experience", "Add your work experience", bool(p.experience)),
              ("education", "Add your education", bool(p.education)),
              ("languages", "Add languages you speak", bool(p.languages)),
              ("resume", "Add your resume (PDF, PNG or JPG)", bool(p.resume_url)),
              ("titles", "Add the job titles you want", bool(p.job_titles))]
    done = [c for _, c, ok in checks if ok]
    return {"percent": round(100 * len(done) / len(checks)), "done": done,
            "next": [c for _, c, ok in checks if not ok],
            "steps": [{"key": k, "label": c, "done": ok} for k, c, ok in checks]}


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


def check_answers(job: Job, given) -> list[dict]:
    """Validate the answers to the job's screening questions and return the snapshot stored on the application."""
    questions = job.questions or []
    if not questions:
        return []
    by_id = {a.id: (a.answer or "").strip() for a in given}
    required = [q for q in questions if q.get("required", True)]
    if required and not by_id:
        raise HTTPException(422, "This employer asks screening questions. Open the job page and use the \"Answer questions & apply\" button.")
    out = []
    for q in questions:
        ans = by_id.get(q["id"], "")
        if not ans:
            if q.get("required", True):
                raise HTTPException(422, f'Please answer: {q["text"]}')
            continue
        t = q["type"]
        if t == "yes_no":
            if ans.lower() not in ("yes", "no"):
                raise HTTPException(422, f'Answer Yes or No: {q["text"]}')
            ans = ans.title()
        elif t == "number":
            try:
                float(ans.replace(",", ""))
            except ValueError:
                raise HTTPException(422, f'Please enter a number: {q["text"]}')
        elif t == "choice" and ans not in q.get("options", []):
            raise HTTPException(422, f'Please choose one of the options: {q["text"]}')
        item = {"id": q["id"], "question": q["text"], "type": t, "answer": ans[:500]}
        if t == "yes_no" and q.get("ideal"):
            item["ok"] = ans.lower() == q["ideal"]
        out.append(item)
    return out


@router.post("/jobs/{job_id}/apply")
def apply_to_job(job_id: int, data: ApplicationIn, user: User = Depends(seeker), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(404, "Job not found or no longer active")
    if job.source_type != "employer":
        raise HTTPException(400, "This job is hosted on another website. Use the Apply now link.")
    if db.scalar(select(Application).where(Application.job_id == job_id, Application.user_id == user.id)):
        raise HTTPException(409, "You have already applied to this job")
    answers = check_answers(job, data.answers)
    prof = db.scalar(select(SeekerProfile).where(SeekerProfile.user_id == user.id))
    resume = data.resume_url or (prof.resume_url if prof else None)       # fall back to the profile resume
    resume_text = prof.resume_text if (prof and resume and resume == prof.resume_url) else None
    db.add(Application(job_id=job_id, user_id=user.id, cover_letter=data.cover_letter, resume_url=resume,
                       resume_text=resume_text, answers=answers or None))
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