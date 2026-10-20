from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from .database import get_db
from .models import Job
from .routes_employer import MyJobOut
from .security import require_role
from .ingest import run_all

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])

@router.get("/jobs", response_model=list[MyJobOut])
def list_by_status(status: str = "pending", db: Session = Depends(get_db)):
    return db.scalars(select(Job).where(Job.status == status).order_by(Job.created_at)).all()

def set_status(job_id: int, status: str, db: Session):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    job.status = status
    db.commit()
    return {"id": job.id, "status": job.status}

@router.post("/jobs/{job_id}/approve")
def approve(job_id: int, db: Session = Depends(get_db)):
    return set_status(job_id, "published", db)

@router.post("/jobs/{job_id}/reject")
def reject(job_id: int, db: Session = Depends(get_db)):
    return set_status(job_id, "rejected", db)



@router.post("/ingest/run")
def ingest_now(db: Session = Depends(get_db)):
    return run_all(db)