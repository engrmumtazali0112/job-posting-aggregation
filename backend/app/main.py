from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Response, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session
from .config import settings
from .database import Base, engine, get_db
from .models import Job
from .schemas import JobPublic
from . import storage
from . import (routes_auth, routes_google_auth, routes_employer, routes_admin, routes_seeker, routes_company,
               routes_notifications, routes_messages, routes_home, scheduler)

Base.metadata.create_all(bind=engine)
try:                                    # add columns that new code needs but an older database lacks
    from .migrate import add_missing_columns
    _added = add_missing_columns()
    if _added:
        print("[migrate] added:", _added)
except Exception as exc:                # never stop the API from starting
    print("[migrate] skipped:", exc)

@asynccontextmanager
async def lifespan(app):
    sched = scheduler.start()
    yield
    sched.shutdown(wait=False)

app = FastAPI(title="Job Platform API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
                   allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Total-Count"])

@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    print("[error]", request.method, request.url.path, repr(exc))
    return JSONResponse({"detail": "Something went wrong on the server. Please try again."}, status_code=500)

# uploaded resumes (temporary local storage, see storage.py)
app.mount("/api/files", StaticFiles(directory=storage.UPLOAD_ROOT), name="files")

app.include_router(routes_auth.router)
app.include_router(routes_google_auth.router)
app.include_router(routes_notifications.router)
app.include_router(routes_messages.router)
app.include_router(routes_employer.router)
app.include_router(routes_admin.router)
app.include_router(routes_seeker.router)
app.include_router(routes_company.router)
app.include_router(routes_home.router)
app.include_router(routes_home.admin_router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/jobs", response_model=list[JobPublic])
def list_jobs(response: Response, q: str = "", location: str = "", source: str = "", job_type: str = "", workplace: str = "", category: str = "",
              limit: int = 12, offset: int = 0, db: Session = Depends(get_db)):
    stmt = select(Job).where(Job.status == "published").order_by(Job.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.company_name.ilike(like), Job.description.ilike(like)))
    if location:
        if location.strip().lower() == "remote":      # "Remote" also matches jobs flagged remote with a city set
            stmt = stmt.where(or_(Job.location.ilike("%remote%"), Job.workplace_type == "remote"))
        else:
            stmt = stmt.where(Job.location.ilike(f"%{location}%"))
    if source in ("aggregated", "employer"):
        stmt = stmt.where(Job.source_type == source)
    if job_type:
        stmt = stmt.where(Job.job_type == job_type)
    if workplace:
        stmt = stmt.where(Job.workplace_type == workplace)
    if category:
        stmt = stmt.where(Job.job_category == category)
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())))
    return db.scalars(stmt.limit(min(limit, 50)).offset(offset)).all()

@app.get("/api/jobs/{job_id}", response_model=JobPublic)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(404, "Job not found")
    return job