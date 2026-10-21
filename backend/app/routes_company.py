from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .database import get_db
from .models import Company, Job, User, CompanyReview, SalaryReport
from .schemas import ReviewIn, ReviewOut
from .security import current_user

router = APIRouter(prefix="/api/companies", tags=["companies"])

@router.get("/{company_id}")
def get_company_profile(company_id: int, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    
    jobs = db.scalars(select(Job).where(Job.company_id == company_id, Job.status == "published")).all()
    avg_rating = db.scalar(select(func.avg(CompanyReview.rating)).where(CompanyReview.company_id == company_id))
    
    return {
        "id": company.id,
        "name": company.name,
        "website": company.website,
        "description": company.description,
        "logo_url": company.logo_url,
        "domain_verified": company.domain_verified,
        "average_rating": round(float(avg_rating), 1) if avg_rating else 0,
        "active_jobs": jobs
    }

@router.get("/{company_id}/reviews", response_model=list[ReviewOut])
def get_reviews(company_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(CompanyReview).where(CompanyReview.company_id == company_id).order_by(CompanyReview.created_at.desc())).all()

@router.post("/{company_id}/reviews", response_model=ReviewOut, status_code=201)
def add_review(company_id: int, data: ReviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != "job_seeker":
        raise HTTPException(403, "Only job seekers can leave reviews")
    if not db.get(Company, company_id):
        raise HTTPException(404, "Company not found")
        
    existing = db.scalar(select(CompanyReview).where(CompanyReview.company_id == company_id, CompanyReview.user_id == user.id))
    if existing:
        raise HTTPException(409, "You have already reviewed this company")

    review = CompanyReview(company_id=company_id, user_id=user.id, **data.model_dump())
    db.add(review)
    db.commit()
    db.refresh(review)
    return review

@router.get("/{company_id}/salaries")
def get_salaries(company_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(SalaryReport).where(SalaryReport.company_id == company_id)).all()