from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update, func
from sqlalchemy.orm import Session
from .database import get_db
from .models import Message, Application, Job, Company, User, CompanyReview
from .schemas import MessageIn
from .security import current_user
from .services import notify

router = APIRouter(prefix="/api/messages", tags=["messages"])


def thread_access(db: Session, user: User, app_id: int):
    """Returns (application, job, company, other_user_id) if this user is part of the conversation."""
    app = db.get(Application, app_id)
    job = db.get(Job, app.job_id) if app else None
    company = db.get(Company, job.company_id) if job and job.company_id else None
    if not app or not job or not company or company.user_id is None:
        raise HTTPException(404, "Conversation not found")
    if user.id == app.user_id:
        return app, job, company, company.user_id
    if user.id == company.user_id:
        return app, job, company, app.user_id
    raise HTTPException(404, "Conversation not found")


@router.get("/threads")
def threads(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role == "employer":
        apps = (select(Application.id, Application.user_id).join(Job, Job.id == Application.job_id)
                .join(Company, Company.id == Job.company_id).where(Company.user_id == user.id))
    else:
        apps = select(Application.id, Application.user_id).where(Application.user_id == user.id)
    app_ids = [r[0] for r in db.execute(apps).all()]
    if not app_ids:
        return []
    last = (select(Message.application_id.label("aid"), func.max(Message.id).label("mid"))
            .where(Message.application_id.in_(app_ids)).group_by(Message.application_id).subquery())
    rows = db.execute(select(Message, Application, Job, User)
                      .join(last, last.c.mid == Message.id).join(Application, Application.id == Message.application_id)
                      .join(Job, Job.id == Application.job_id).join(User, User.id == Application.user_id)
                      .order_by(Message.created_at.desc())).all()
    unread = {r[0]: r[1] for r in db.execute(
        select(Message.application_id, func.count()).where(Message.application_id.in_(app_ids),
              Message.sender_id != user.id, Message.is_read.is_(False)).group_by(Message.application_id)).all()}
    out = []
    for m, a, j, u in rows:
        out.append({"application_id": a.id, "title": (u.full_name or u.email) if user.role == "employer" else j.company_name,
                    "job_title": j.title, "last": m.body[:80], "last_from_me": m.sender_id == user.id,
                    "last_at": m.created_at, "unread": unread.get(a.id, 0)})
    return out


@router.get("/{app_id}")
def get_thread(app_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app, job, company, other = thread_access(db, user, app_id)
    db.execute(update(Message).where(Message.application_id == app_id, Message.sender_id != user.id)
               .values(is_read=True))
    db.commit()
    msgs = db.scalars(select(Message).where(Message.application_id == app_id).order_by(Message.id)).all()
    applicant = db.get(User, app.user_id)
    rating = db.scalar(select(func.avg(CompanyReview.rating)).where(CompanyReview.company_id == company.id))
    reviews = db.scalar(select(func.count()).select_from(CompanyReview).where(CompanyReview.company_id == company.id)) or 0
    return {"application_id": app.id, "job_title": job.title,
            "title": (applicant.full_name or applicant.email) if user.role == "employer" else company.name,
            "job": {"id": job.id, "title": job.title, "company_id": company.id, "company_name": company.name,
                    "company_rating": round(float(rating), 1) if rating else 0, "company_reviews": reviews,
                    "location": job.location, "workplace_type": job.workplace_type, "job_type": job.job_type,
                    "salary_min": job.salary_min, "salary_max": job.salary_max, "salary_period": job.salary_period,
                    "status": job.status},
            "applicant": {"name": applicant.full_name or applicant.email, "email": applicant.email,
                          "status": app.status} if user.role == "employer" else None,
            "messages": [{"id": m.id, "body": m.body, "mine": m.sender_id == user.id, "created_at": m.created_at}
                         for m in msgs]}


@router.post("/{app_id}", status_code=201)
def send(app_id: int, data: MessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app, job, company, other = thread_access(db, user, app_id)
    db.add(Message(application_id=app_id, sender_id=user.id, body=data.body.strip()))
    who = company.name if user.role == "employer" else (user.full_name or user.email)
    notify(db, other, f"New message from {who} about {job.title}.",
           "/messages?app=%d" % app_id)
    db.commit()
    return {"ok": True}
