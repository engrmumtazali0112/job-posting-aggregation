from sqlalchemy import delete
from sqlalchemy.orm import Session
from .config import settings
from .models import AppSetting, Job, Application, SavedJob
from .schemas import JobIn

def get_require_approval(db: Session) -> bool:
    row = db.get(AppSetting, "require_approval")
    if row is None:
        return settings.require_approval
    return row.value == "true"

def set_require_approval(db: Session, value: bool) -> None:
    row = db.get(AppSetting, "require_approval")
    text = "true" if value else "false"
    if row:
        row.value = text
    else:
        db.add(AppSetting(name="require_approval", value=text))
    db.commit()

def resolve_location(data: JobIn) -> str:
    loc = data.location.strip()
    if not loc and data.workplace_type == "remote":
        return "Remote"
    return loc

def apply_job_fields(job: Job, data: JobIn) -> None:
    job.title = data.title.strip()
    job.workplace_type = data.workplace_type
    job.location = resolve_location(data)
    job.job_type = data.job_type
    job.openings = data.openings
    job.hiring_timeline = data.hiring_timeline
    job.salary_min = data.salary_min
    job.salary_max = data.salary_max
    job.salary_period = data.salary_period
    job.description = data.description
    job.apply_url = data.apply_url or None

def delete_jobs(db: Session, ids: list[int]) -> int:
    if not ids:
        return 0
    db.execute(delete(Application).where(Application.job_id.in_(ids)))
    db.execute(delete(SavedJob).where(SavedJob.job_id.in_(ids)))
    res = db.execute(delete(Job).where(Job.id.in_(ids)))
    db.commit()
    return res.rowcount
