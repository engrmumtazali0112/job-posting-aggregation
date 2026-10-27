import hashlib
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, Integer, UniqueConstraint, JSON
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def now():
    return datetime.now(timezone.utc)

def make_hash(title: str, company: str, location: str) -> str:
    """Deduplication key: same job from any source gets the same hash."""
    raw = "|".join(s.strip().lower() for s in (title, company, location))
    return hashlib.sha256(raw.encode()).hexdigest()

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(150))
    role: Mapped[str] = mapped_column(String(20), default="job_seeker")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    auth_provider: Mapped[str] = mapped_column(String(20), default="password")
    verification_token: Mapped[str | None] = mapped_column(String(64), index=True)   # SHA-256 of the emailed token (the token itself is never stored)
    verification_sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    reset_token: Mapped[str | None] = mapped_column(String(64), index=True)   # SHA-256 of the emailed password-reset token (the token itself is never stored)
    reset_sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Company(Base):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))   # NULL = unclaimed (auto-created from aggregated jobs)
    name: Mapped[str] = mapped_column(String(200), index=True)
    website: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    domain_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_number: Mapped[str | None] = mapped_column(String(20))   # digits only, with country code (e.g. 923001234567); used by the "Apply via WhatsApp" button

class JobSource(Base):
    __tablename__ = "job_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20))
    endpoint: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    company_name: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200), default="")
    workplace_type: Mapped[str] = mapped_column(String(20), default="in_person")   # in_person | remote | hybrid
    job_type: Mapped[str] = mapped_column(String(20), default="full_time")
    job_category: Mapped[str] = mapped_column(String(50), default="private") # private | government | contract | ngo
    openings: Mapped[int] = mapped_column(Integer, default=1)
    hiring_timeline: Mapped[str | None] = mapped_column(String(40))
    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)
    salary_period: Mapped[str] = mapped_column(String(10), default="month")
    currency: Mapped[str] = mapped_column(String(5), default="PKR")
    description: Mapped[str] = mapped_column(Text, default="")
    apply_url: Mapped[str | None] = mapped_column(String(500))
    source_type: Mapped[str] = mapped_column(String(20))
    source_id: Mapped[int | None] = mapped_column(ForeignKey("job_sources.id"))
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"))
    status: Mapped[str] = mapped_column(String(20), default="published")
    questions: Mapped[list | None] = mapped_column(JSON)      # screening questions: [{id, text, type, required, options, ideal}]

    dedupe_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=now, onupdate=now)
    company: Mapped[Optional["Company"]] = relationship(lazy="joined")   # joined, so listing 50 jobs does not run 50 extra queries

    @property
    def company_whatsapp(self) -> str | None:
        """Read by the JobPublic/JobFull schemas; the frontend shows the green WhatsApp button when this is set."""
        return self.company.whatsapp_number if self.company else None

class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("job_id", "user_id", name="uq_application_job_user"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="new")
    cover_letter: Mapped[str | None] = mapped_column(Text)
    resume_url: Mapped[str | None] = mapped_column(String(500))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    answers: Mapped[list | None] = mapped_column(JSON)         # answers to the job's screening questions (snapshot)
    resume_text: Mapped[str | None] = mapped_column(Text)      # text read from the resume; None = not read yet, '' = nothing readable
    skipped: Mapped[bool] = mapped_column(Boolean, default=False)   # employer hid it from the list (no notification)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class SavedJob(Base):
    __tablename__ = "saved_jobs"
    __table_args__ = (UniqueConstraint("job_id", "user_id", name="uq_saved_job_user"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class AppSetting(Base):
    __tablename__ = "app_settings"
    name: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(500), default="")

# --- NEW GLASSDDOOR-STYLE TABLES ---
class CompanyReview(Base):
    __tablename__ = "company_reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(Integer) # 1 to 5
    title: Mapped[str] = mapped_column(String(150))
    pros: Mapped[str] = mapped_column(Text)
    cons: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class SalaryReport(Base):
    __tablename__ = "salary_reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    job_title: Mapped[str] = mapped_column(String(200))
    base_salary: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(5), default="PKR")
    period: Mapped[str] = mapped_column(String(10), default="month")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

# --- seeker profile, notifications, messages ---
class SeekerProfile(Base):
    __tablename__ = "seeker_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    location: Mapped[str | None] = mapped_column(String(150))
    visible: Mapped[bool] = mapped_column(Boolean, default=True)          # "Employers can find you"
    resume_url: Mapped[str | None] = mapped_column(String(500))
    resume_name: Mapped[str | None] = mapped_column(String(200))
    resume_text: Mapped[str | None] = mapped_column(Text)      # text read from the uploaded resume (used for job matching)
    job_titles: Mapped[list | None] = mapped_column(JSON)
    job_types: Mapped[list | None] = mapped_column(JSON)
    min_pay: Mapped[int | None] = mapped_column(Integer)
    min_pay_period: Mapped[str] = mapped_column(String(10), default="month")
    relocation: Mapped[str | None] = mapped_column(String(100))
    available_now: Mapped[bool] = mapped_column(Boolean, default=False)
    summary: Mapped[str | None] = mapped_column(Text)
    skills: Mapped[list | None] = mapped_column(JSON)
    experience: Mapped[list | None] = mapped_column(JSON)       # [{title, company, start, end, current, description}]
    education: Mapped[list | None] = mapped_column(JSON)        # [{degree, institution, year}]
    languages: Mapped[list | None] = mapped_column(JSON)        # [{language, level}]
    certifications: Mapped[list | None] = mapped_column(JSON)   # [{name, issuer, year}]
    linkedin_url: Mapped[str | None] = mapped_column(String(300))
    github_url: Mapped[str | None] = mapped_column(String(300))
    portfolio_url: Mapped[str | None] = mapped_column(String(300))
    projects: Mapped[list | None] = mapped_column(JSON)         # [{name, description, tech_stack: [..], url}]

class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    text: Mapped[str] = mapped_column(String(300))
    link: Mapped[str | None] = mapped_column(String(200))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

# --- job alerts: a seeker can have several (up to 7), like LinkedIn: each one is a set of keywords + an optional location ---
class JobAlert(Base):
    __tablename__ = "job_alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)      # NOT unique any more (see migrate.relax_job_alert_user_unique)
    keywords: Mapped[list | None] = mapped_column(JSON)            # ["React", "Python"]; a job matches when ANY keyword appears in it
    location: Mapped[str | None] = mapped_column(String(150))      # optional; when set, the job's location must contain it ("Remote" also matches remote jobs)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked_at: Mapped[datetime] = mapped_column(DateTime, default=now)   # the scheduler only emails jobs created after this
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

# --- home page: real testimonials, added by an admin ---
class SuccessStory(Base):
    __tablename__ = "success_stories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    role_title: Mapped[str] = mapped_column(String(150))
    quote: Mapped[str] = mapped_column(Text)
    hired_in: Mapped[str | None] = mapped_column(String(50))      # e.g. "6 weeks"
    photo_url: Mapped[str | None] = mapped_column(String(500))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)