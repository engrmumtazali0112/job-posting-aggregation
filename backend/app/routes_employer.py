from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import Job, Company, User, make_hash
from .security import require_role

router = APIRouter(prefix="/api/employer", tags=["employer"])

class JobIn(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    location: str = ""
    description: str = Field(min_length=20)
    apply_url: str | None = None

class MyJobOut(BaseModel):
    id: int
    title: str
    location: str
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}

def get_company(db: Session, user: User) -> Company:
    company = db.scalar(select(Company).where(Company.user_id == user.id))
    if not company:
        raise HTTPException(400, "No company profile found")
    return company

@router.post("/jobs", response_model=MyJobOut, status_code=201)
def create_job(data: JobIn, user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    company = get_company(db, user)
    h = make_hash(data.title, company.name, data.location)
    if db.scalar(select(Job).where(Job.dedupe_hash == h)):
        raise HTTPException(409, "This job has already been posted")
    job = Job(title=data.title, company_name=company.name, company_id=company.id,
              location=data.location, description=data.description, apply_url=data.apply_url,
              source_type="employer", dedupe_hash=h,
              status="pending" if settings.require_approval else "published")
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@router.get("/jobs", response_model=list[MyJobOut])
def my_jobs(user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    company = get_company(db, user)
    return db.scalars(select(Job).where(Job.company_id == company.id).order_by(Job.created_at.desc())).all()