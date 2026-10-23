from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from .database import get_db
from .models import Company, Job, User, CompanyReview, SalaryReport
from .schemas import ReviewIn, ReviewOut, JobPublic
from .security import current_user

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("")
def search_companies(response: Response, q: str = "", limit: int = 12, offset: int = 0, db: Session = Depends(get_db)):
    """Company search: name, average rating, review count, open jobs."""
    base = select(Company)
    if q:
        base = base.where(Company.name.ilike(f"%{q}%"))
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(base.subquery())))
    rating = (select(CompanyReview.company_id.label("cid"), func.avg(CompanyReview.rating).label("avg"),
                     func.count().label("n")).group_by(CompanyReview.company_id).subquery())
    jobs = (select(Job.company_id.label("cid"), func.count().label("n")).where(Job.status == "published")
            .group_by(Job.company_id).subquery())
    stmt = (select(Company, rating.c.avg, rating.c.n, jobs.c.n)
            .outerjoin(rating, rating.c.cid == Company.id).outerjoin(jobs, jobs.c.cid == Company.id)
            .where(Company.id.in_(base.with_only_columns(Company.id).subquery().select())))
    # reviewed and hiring companies first, then alphabetical
    stmt = stmt.order_by(func.coalesce(rating.c.n, 0).desc(), func.coalesce(jobs.c.n, 0).desc(), Company.name)
    rows = db.execute(stmt.limit(min(limit, 50)).offset(offset)).all()
    return [{"id": c.id, "name": c.name, "logo_url": c.logo_url, "domain_verified": c.domain_verified,
             "average_rating": round(float(avg), 1) if avg else 0, "review_count": rn or 0,
             "open_jobs": jn or 0} for c, avg, rn, jn in rows]


@router.get("/{company_id}")
def get_company_profile(company_id: int, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    jobs = db.scalars(select(Job).where(Job.company_id == company_id, Job.status == "published")
                      .order_by(Job.created_at.desc()).limit(50)).all()
    avg, n = db.execute(select(func.avg(CompanyReview.rating), func.count())
                        .where(CompanyReview.company_id == company_id)).one()
    return {
        "id": company.id, "name": company.name, "website": company.website, "description": company.description,
        "logo_url": company.logo_url, "domain_verified": company.domain_verified,
        "claimed": company.user_id is not None,
        "average_rating": round(float(avg), 1) if avg else 0, "review_count": n,
        "active_jobs": [JobPublic.model_validate(j) for j in jobs],
    }


@router.get("/{company_id}/reviews", response_model=list[ReviewOut])
def get_reviews(company_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(CompanyReview).where(CompanyReview.company_id == company_id)
                      .order_by(CompanyReview.created_at.desc())).all()


@router.post("/{company_id}/reviews", response_model=ReviewOut, status_code=201)
def add_review(company_id: int, data: ReviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role not in ("job_seeker", "employer"):
        raise HTTPException(403, "Only members can leave reviews")
    if not db.get(Company, company_id):
        raise HTTPException(404, "Company not found")
    if db.scalar(select(CompanyReview).where(CompanyReview.company_id == company_id, CompanyReview.user_id == user.id)):
        raise HTTPException(409, "You have already reviewed this company")
    review = CompanyReview(company_id=company_id, user_id=user.id, **data.model_dump())
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.get("/{company_id}/salaries")
def get_salaries(company_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(SalaryReport).where(SalaryReport.company_id == company_id)).all()
