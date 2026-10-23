from fastapi import APIRouter, Depends
from sqlalchemy import select, func, update, or_
from sqlalchemy.orm import Session
from .database import get_db
from .models import Notification, Message, Application, Job, Company, User
from .security import current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(unread: bool = False, limit: int = 50, user: User = Depends(current_user),
                       db: Session = Depends(get_db)):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread:
        stmt = stmt.where(Notification.is_read.is_(False))
    rows = db.scalars(stmt.order_by(Notification.created_at.desc()).limit(min(limit, 100))).all()
    return [{"id": n.id, "text": n.text, "link": n.link, "is_read": n.is_read, "created_at": n.created_at} for n in rows]


@router.get("/counts")
def counts(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Badge numbers for the navbar."""
    notes = db.scalar(select(func.count()).select_from(Notification)
                      .where(Notification.user_id == user.id, Notification.is_read.is_(False)))
    owned = (select(Application.id).join(Job, Job.id == Application.job_id)
             .join(Company, Company.id == Job.company_id).where(Company.user_id == user.id))
    mine = select(Application.id).where(or_(Application.user_id == user.id, Application.id.in_(owned)))
    msgs = db.scalar(select(func.count()).select_from(Message).where(
        Message.application_id.in_(mine), Message.sender_id != user.id, Message.is_read.is_(False)))
    return {"notifications": notes or 0, "messages": msgs or 0}


@router.post("/read")
def mark_all_read(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(is_read=True))
    db.commit()
    return {"ok": True}


@router.post("/{nid}/read")
def mark_read(nid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.id == nid, Notification.user_id == user.id).values(is_read=True))
    db.commit()
    return {"ok": True}
