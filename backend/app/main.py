from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .database import Base, engine, get_db
from .models import Job, make_hash
from . import routes_auth, routes_employer, routes_admin

Base.metadata.create_all(bind=engine)
app = FastAPI(title="Job Platform API")
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
    model_config = {"from_attributes": True}

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/jobs", response_model=list[JobOut])
def list_jobs(q: str = "", source: str = "", db: Session = Depends(get_db)):
    stmt = select(Job).where(Job.status == "published").order_by(Job.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.company_name.ilike(like), Job.location.ilike(like)))
    if source in ("aggregated", "employer"):
        stmt = stmt.where(Job.source_type == source)
    return db.scalars(stmt).all()

@app.post("/api/dev/seed")
def seed(db: Session = Depends(get_db)):
    """Temporary: adds sample jobs and proves deduplication works."""
    samples = [
        ("Python Developer", "Acme Tech", "Islamabad", "aggregated"),
        ("React Frontend Engineer", "Nova Labs", "Remote", "aggregated"),
        ("Marketing Manager", "Bright Co", "Rawalpindi", "employer"),
        ("Python Developer", "Acme Tech", "Islamabad", "employer"),
    ]
    added = 0
    for title, company, loc, src in samples:
        h = make_hash(title, company, loc)
        if db.scalar(select(Job).where(Job.dedupe_hash == h)):
            continue
        db.add(Job(title=title, company_name=company, location=loc, source_type=src,
                   description=f"Sample {title} role at {company}.", dedupe_hash=h))
        added += 1
    db.commit()
    return {"added": added}
