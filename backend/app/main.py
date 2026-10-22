from contextlib import asynccontextmanager
from xml.sax.saxutils import escape
from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session
from .config import settings
from .database import Base, engine, get_db
from .models import Job, Company
from .schemas import JobPublic
from . import (routes_auth, routes_google_auth, routes_employer, routes_admin, routes_seeker, routes_company,
               routes_notifications, routes_messages, scheduler)

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app):
    sched = scheduler.start()
    yield
    sched.shutdown(wait=False)

app = FastAPI(title="Job Platform API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
                   allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Total-Count"])

app.include_router(routes_auth.router)
app.include_router(routes_google_auth.router)
app.include_router(routes_notifications.router)
app.include_router(routes_messages.router)
app.include_router(routes_employer.router)
app.include_router(routes_admin.router)
app.include_router(routes_seeker.router)
app.include_router(routes_company.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

# ---------- sitemap (served on the frontend domain through a Vercel rewrite) ----------
STATIC_PATHS = ["/", "/jobs", "/companies", "/employer", "/about", "/contact", "/privacy", "/terms"]
MAX_JOB_URLS = 40000          # a sitemap file may hold at most 50,000 URLs
MAX_COMPANY_URLS = 4000

@app.get("/api/sitemap.xml", include_in_schema=False)
def sitemap(db: Session = Depends(get_db)):
    base = settings.site_url.rstrip("/")

    def entry(path: str, lastmod=None) -> str:
        parts = [f"<loc>{escape(base + path)}</loc>"]
        if lastmod:
            parts.append(f"<lastmod>{lastmod.date().isoformat()}</lastmod>")
        return "<url>" + "".join(parts) + "</url>"

    items = [entry(p) for p in STATIC_PATHS]
    jobs = db.execute(select(Job.id, Job.created_at, Job.updated_at).where(Job.status == "published")
                      .order_by(Job.created_at.desc()).limit(MAX_JOB_URLS)).all()
    items += [entry(f"/jobs/{jid}", updated or created) for jid, created, updated in jobs]
    companies = db.scalars(select(Company.id).order_by(Company.id.desc()).limit(MAX_COMPANY_URLS)).all()
    items += [entry(f"/companies/{cid}") for cid in companies]

    xml = ('<?xml version="1.0" encoding="UTF-8"?>'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(items) + "</urlset>")
    return Response(content=xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})

# ---------- public jobs ----------
@app.get("/api/jobs", response_model=list[JobPublic])
def list_jobs(response: Response, q: str = "", location: str = "", source: str = "", job_type: str = "", workplace: str = "", category: str = "",
              limit: int = 12, offset: int = 0, db: Session = Depends(get_db)):
    stmt = select(Job).where(Job.status == "published").order_by(Job.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.company_name.ilike(like), Job.description.ilike(like)))
    if location:
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