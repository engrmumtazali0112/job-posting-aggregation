from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .database import Base, engine, get_db
from .models import Job
from . import routes_auth, routes_employer, routes_admin, scheduler

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app):
    sched = scheduler.start()
    yield
    sched.shutdown(wait=False)

app = FastAPI(title="Job Platform API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(routes_auth.router)
app.include_router(routes_employer.router)
app.include_router(routes_admin.router)

class JobOut(BaseModel):
    id: int
    title: str
    company_name: str
    location: str
    description: str
    apply_url: str | None
    source_type: str
    created_at: datetime
    model_config = {"from_attributes": True}

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/jobs", response_model=list[JobOut])
def list_jobs(q: str = "", location: str = "", source: str = "",
              limit: int = 12, offset: int = 0, db: Session = Depends(get_db)):
    stmt = select(Job).where(Job.status == "published").order_by(Job.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.company_name.ilike(like), Job.description.ilike(like)))
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{location}%"))
    if source in ("aggregated", "employer"):
        stmt = stmt.where(Job.source_type == source)
    return db.scalars(stmt.limit(min(limit, 50)).offset(offset)).all()

@app.get("/api/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(404, "Job not found")
    return job
