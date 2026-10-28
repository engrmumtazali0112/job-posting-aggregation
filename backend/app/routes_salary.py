"""Blind Salary Insights: anonymous salary submissions and aggregated insights.

Privacy: no user id, no IP address and no token is ever written to the database. The only abuse protection is a small
in-memory per-IP counter (see _rate_limit) that is lost on restart and never persisted.
Amounts are monthly, in PKR.
"""
import re
import time
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .database import get_db
from .models import BlindSalaryReport

router = APIRouter(prefix="/api/salary", tags=["salary"])

MAX_MONTHLY = 10_000_000      # sanity ceiling (Rs 10 million a month) to reject typos and junk
MIN_MONTHLY = 1_000
# labels of 1-63 chars (letters, digits, inner hyphens), at least one dot, alphabetic TLD of 2-24 chars
DOMAIN_RE = re.compile(r"^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$")


def normalize_domain(value: str) -> str:
    """'https://www.Acme.com/careers?x=1' -> 'acme.com'. Does not validate; use DOMAIN_RE for that."""
    v = value.strip().lower()
    v = re.sub(r"^[a-z][a-z0-9+.-]*://", "", v)       # scheme
    v = re.split(r"[/?#]", v, maxsplit=1)[0]          # path, query, fragment
    if v.startswith("www."):
        v = v[4:]
    return v.rstrip(".")


class SalaryReportIn(BaseModel):
    job_title: str = Field(min_length=2, max_length=150)
    city: str = Field(min_length=2, max_length=100)
    salary_min: int = Field(ge=MIN_MONTHLY, le=MAX_MONTHLY)
    salary_max: int = Field(ge=MIN_MONTHLY, le=MAX_MONTHLY)
    years_experience: int = Field(ge=0, le=50)
    company_domain: str = Field(max_length=300)

    @field_validator("job_title", "city", mode="before")
    @classmethod
    def tidy_text(cls, v):
        return re.sub(r"\s+", " ", v).strip() if isinstance(v, str) else v

    @field_validator("company_domain")
    @classmethod
    def check_domain(cls, v: str) -> str:
        d = normalize_domain(v)
        if not DOMAIN_RE.match(d):
            raise ValueError("Enter a valid company domain, for example acme.com")
        return d

    @model_validator(mode="after")
    def check_range(self):
        if self.salary_min > self.salary_max:
            raise ValueError("Minimum salary cannot be higher than maximum salary")
        return self


# --- tiny in-memory limiter: 5 submissions per hour per IP. Per process, so it resets on restart. ---
_hits: dict[str, list[float]] = {}
LIMIT, WINDOW = 5, 3600


def _rate_limit(request: Request) -> None:
    fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()   # Render/Vercel sit behind a proxy
    ip = fwd or (request.client.host if request.client else "unknown")
    now = time.time()
    if len(_hits) > 5000:
        _hits.clear()                                                         # keep memory bounded
    recent = [t for t in _hits.get(ip, []) if now - t < WINDOW]
    if len(recent) >= LIMIT:
        raise HTTPException(429, "You have submitted several reports recently. Please try again later.")
    recent.append(now)
    _hits[ip] = recent


@router.post("/report", status_code=201)
def submit_report(data: SalaryReportIn, request: Request, db: Session = Depends(get_db)):
    """Anonymous: no login needed, and nothing identifying the sender is stored."""
    _rate_limit(request)
    db.add(BlindSalaryReport(**data.model_dump()))
    db.commit()
    return {"ok": True, "message": "Thank you. Your anonymous report was added."}


@router.get("/insights")
def salary_insights(title: str = Query("", max_length=150), city: str = Query("", max_length=100),
                    domain: str = Query("", max_length=300), db: Session = Depends(get_db)):
    """Average, min, max and count for a role (partial, case-insensitive match). City and company domain are optional filters."""
    title, city = title.strip(), city.strip()
    if len(title) < 2:
        raise HTTPException(422, "Enter a job title to search")
    R = BlindSalaryReport
    conds = [R.job_title.ilike(f"%{title}%")]
    if city:
        conds.append(R.city.ilike(f"%{city}%"))
    if domain.strip():
        conds.append(R.company_domain == normalize_domain(domain))
    avg_mid, lowest, highest, n = db.execute(
        select(func.avg((R.salary_min + R.salary_max) / 2.0), func.min(R.salary_min), func.max(R.salary_max), func.count())
        .where(*conds)).one()
    # recent individual ranges, for the bar chart. The company domain is deliberately left out so a row cannot be traced.
    rows = db.execute(select(R.job_title, R.city, R.salary_min, R.salary_max, R.years_experience)
                      .where(*conds).order_by(R.created_at.desc()).limit(10)).all()
    return {
        "count": n,
        "average": round(float(avg_mid)) if avg_mid is not None else None,   # average of each report's midpoint
        "min": lowest, "max": highest,
        "currency": "PKR", "period": "month",
        "reports": [{"job_title": t, "city": c, "salary_min": a, "salary_max": b, "years_experience": y} for t, c, a, b, y in rows],
    }
