"""Home page data: top companies, trending, and success stories."""
import re
import time
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .database import get_db
from .models import Job, Company, SuccessStory
from .security import require_role

router = APIRouter(prefix="/api/home", tags=["home"])
admin_router = APIRouter(prefix="/api/admin/success-stories", tags=["admin"],
                         dependencies=[Depends(require_role("admin"))])

# Small in-memory cache: the home page is hit constantly and Render's free tier is slow.
_cache: dict = {}
TTL = 300


def cached(key: str, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]
    val = fn()
    _cache[key] = (time.time(), val)
    return val


STOP = {"and", "the", "for", "with", "from", "job", "jobs", "remote", "senior", "junior", "lead",
        "executive", "officer", "manager", "assistant", "full", "time", "part", "required", "urgent",
        "hiring", "wanted", "pakistan", "male", "female", "new", "our", "you", "your"}


# ---------- top companies ----------
@router.get("/top-companies")
def top_companies(limit: int = 12, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 24))

    def build():
        n = func.count(Job.id)
        rows = db.execute(
            select(Company, n.label("n")).join(Job, Job.company_id == Company.id)
            .where(Job.status == "published", Company.name != "Unknown")
            .group_by(Company.id).order_by(n.desc(), Company.name).limit(limit)).all()
        ids = [c.id for c, _ in rows]
        best: dict = {}
        if ids:
            locs = db.execute(
                select(Job.company_id, Job.location, func.count())
                .where(Job.company_id.in_(ids), Job.status == "published", Job.location != "")
                .group_by(Job.company_id, Job.location)).all()
            for cid, loc, cnt in locs:
                if cid not in best or cnt > best[cid][1]:
                    best[cid] = (loc, cnt)
        return [{"id": c.id, "name": c.name, "logo_url": c.logo_url, "domain_verified": bool(c.domain_verified),
                 "location": best.get(c.id, ("", 0))[0], "open_jobs": cnt} for c, cnt in rows]

    return cached(f"top-companies:{limit}", build)


# ---------- trending (computed from real, recent jobs) ----------
@router.get("/trending")
def trending(db: Session = Depends(get_db)):
    def build():
        since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
        live = (Job.status == "published", Job.created_at >= since)

        n = func.count()
        jobs = db.execute(select(func.min(Job.title), n).where(*live).group_by(func.lower(Job.title))
                          .order_by(n.desc()).limit(8)).all()
        locs = db.execute(select(Job.location, n).where(*live, Job.location != "").group_by(Job.location)
                          .order_by(n.desc()).limit(8)).all()
        comps = db.execute(select(Company.id, Company.name, n).join(Job, Job.company_id == Company.id)
                           .where(*live, Company.name != "Unknown").group_by(Company.id, Company.name)
                           .order_by(n.desc()).limit(8)).all()

        titles = db.scalars(select(Job.title).where(*live).order_by(Job.created_at.desc()).limit(1500)).all()
        words = Counter(w for t in titles for w in set(re.findall(r"[a-zA-Z]{3,}", t.lower())) if w not in STOP)
        return {
            "searches": [w.title() for w, _ in words.most_common(8)],
            "jobs": [t for t, _ in jobs],
            "locations": [l for l, _ in locs],
            "companies": [{"id": i, "name": nm} for i, nm, _ in comps],
        }

    return cached("trending", build)


# ---------- success stories ----------
class StoryOut(BaseModel):
    id: int
    name: str
    role_title: str
    quote: str
    hired_in: str | None
    photo_url: str | None
    model_config = {"from_attributes": True}


class StoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    role_title: str = Field(min_length=2, max_length=150)
    quote: str = Field(min_length=20, max_length=1000)
    hired_in: str | None = Field(default=None, max_length=50)
    photo_url: str | None = Field(default=None, max_length=500)
    is_published: bool = True


@router.get("/success-stories", response_model=list[StoryOut])
def success_stories(db: Session = Depends(get_db)):
    def build():
        rows = db.scalars(select(SuccessStory).where(SuccessStory.is_published.is_(True))
                          .order_by(SuccessStory.created_at.desc()).limit(12)).all()
        return [StoryOut.model_validate(r) for r in rows]

    return cached("stories", build)


@admin_router.get("")
def admin_list(db: Session = Depends(get_db)):
    return db.scalars(select(SuccessStory).order_by(SuccessStory.created_at.desc())).all()


@admin_router.post("", status_code=201)
def admin_create(data: StoryIn, db: Session = Depends(get_db)):
    story = SuccessStory(**data.model_dump())
    db.add(story)
    db.commit()
    _cache.pop("stories", None)
    return {"id": story.id}


@admin_router.put("/{story_id}")
def admin_update(story_id: int, data: StoryIn, db: Session = Depends(get_db)):
    story = db.get(SuccessStory, story_id)
    if not story:
        raise HTTPException(404, "Story not found")
    for k, v in data.model_dump().items():
        setattr(story, k, v)
    db.commit()
    _cache.pop("stories", None)
    return {"id": story.id}


@admin_router.delete("/{story_id}")
def admin_delete(story_id: int, db: Session = Depends(get_db)):
    story = db.get(SuccessStory, story_id)
    if not story:
        raise HTTPException(404, "Story not found")
    db.delete(story)
    db.commit()
    _cache.pop("stories", None)
    return {"deleted": story_id}
