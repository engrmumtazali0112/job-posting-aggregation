import re
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

WorkplaceType = Literal["in_person", "remote", "hybrid"]
JobType = Literal["full_time", "part_time", "contract", "fresher", "temporary", "internship"]
SalaryPeriod = Literal["hour", "day", "week", "month", "year"]
JobCategory = Literal["private", "government", "contract", "ngo"]

QuestionType = Literal["yes_no", "text", "number", "choice"]

class QuestionIn(BaseModel):
    """A screening question the employer adds to a job post."""
    text: str = Field(min_length=3, max_length=200)
    type: QuestionType = "text"
    required: bool = True
    options: list[str] = Field(default_factory=list, max_length=8)          # only for type "choice"
    ideal: Literal["yes", "no"] | None = None                                # only for yes_no: the answer the employer hopes for

    @model_validator(mode="after")
    def tidy(self):
        self.text = self.text.strip()
        opts = [o.strip()[:80] for o in self.options if o.strip()]
        if self.type == "choice" and len(opts) < 2:
            raise ValueError("A multiple-choice question needs at least 2 options")
        self.options = opts if self.type == "choice" else []
        if self.type != "yes_no":
            self.ideal = None
        return self

class QuestionPublic(BaseModel):
    id: str
    text: str
    type: str
    required: bool = True
    options: list[str] = []

class QuestionFull(QuestionPublic):
    ideal: str | None = None          # employer / admin only

class AnswerIn(BaseModel):
    id: str = Field(max_length=20)
    answer: str = Field(default="", max_length=500)

class JobIn(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    workplace_type: WorkplaceType = "in_person"
    location: str = Field(default="", max_length=200)
    job_type: JobType = "full_time"
    job_category: JobCategory = "private"
    openings: int = Field(default=1, ge=1, le=500)
    hiring_timeline: str | None = Field(default=None, max_length=40)
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_period: SalaryPeriod = "month"
    description: str = Field(min_length=20)
    apply_url: str | None = Field(default=None, max_length=500)
    questions: list[QuestionIn] | None = Field(default=None, max_length=10)   # None = leave the job's questions as they are

    @model_validator(mode="after")
    def check_pay(self):
        if self.salary_min is not None and self.salary_max is not None and self.salary_min > self.salary_max:
            raise ValueError("Minimum pay cannot be higher than maximum pay")
        return self

class _JobBase(BaseModel):
    """Fields shared by the public and the employer/admin job views. `questions` is declared in each subclass
    (QuestionPublic vs QuestionFull): redeclaring it in a subclass of JobPublic is an invariant list override."""
    id: int
    title: str
    company_name: str
    location: str
    workplace_type: str
    job_type: str
    job_category: str
    openings: int
    salary_min: int | None
    salary_max: int | None
    salary_period: str
    currency: str
    description: str
    apply_url: str | None
    source_type: str
    company_id: int | None = None
    created_at: datetime
    model_config = {"from_attributes": True}

    @field_validator("questions", mode="before", check_fields=False)     # `questions` lives on the subclasses
    @classmethod
    def no_questions(cls, v):
        return v or []

class JobPublic(_JobBase):
    questions: list[QuestionPublic] = []                  # public view: no `ideal` answers

class JobFull(_JobBase):
    questions: list[QuestionFull] = []                    # employer / admin view: includes `ideal`
    hiring_timeline: str | None
    status: str
    updated_at: datetime | None

class EmployerJobOut(JobFull):
    applications_count: int = 0

class ApplicationIn(BaseModel):
    cover_letter: str | None = Field(default=None, max_length=5000)
    resume_url: str | None = Field(default=None, max_length=500)
    answers: list[AnswerIn] = Field(default_factory=list, max_length=10)

class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str = Field(min_length=3, max_length=150)
    pros: str = Field(min_length=10)
    cons: str = Field(min_length=10)

class ReviewOut(ReviewIn):
    id: int
    company_id: int
    created_at: datetime
    model_config = {"from_attributes": True}

class _Item(BaseModel):
    model_config = {"coerce_numbers_to_str": True, "str_strip_whitespace": True}

class ExperienceItem(_Item):
    title: str | None = Field(default=None, max_length=150)
    company: str | None = Field(default=None, max_length=150)
    start: str | None = Field(default=None, max_length=20)
    end: str | None = Field(default=None, max_length=20)
    current: bool = False
    description: str | None = Field(default=None, max_length=1500)

class EducationItem(_Item):
    degree: str | None = Field(default=None, max_length=150)
    institution: str | None = Field(default=None, max_length=150)
    year: str | None = Field(default=None, max_length=20)

class LanguageItem(_Item):
    language: str | None = Field(default=None, max_length=150)
    level: str | None = Field(default=None, max_length=150)

class CertificationItem(_Item):
    name: str | None = Field(default=None, max_length=150)
    issuer: str | None = Field(default=None, max_length=150)
    year: str | None = Field(default=None, max_length=20)

class ProjectItem(_Item):
    name: str | None = Field(default=None, max_length=150)
    description: str | None = Field(default=None, max_length=1500)
    tech_stack: list[str] = Field(default_factory=list, max_length=20)
    url: str | None = Field(default=None, max_length=300)

    @field_validator("url", mode="before")
    @classmethod
    def safe_url(cls, v):                             # rendered as a link: only http(s) is allowed (blocks javascript: links)
        v = v.strip() if isinstance(v, str) else v
        if not v:
            return None
        if not re.match(r"^https?://", v, re.I):
            v = "https://" + v
        if "." not in (urlparse(v).hostname or ""):
            raise ValueError("Enter a valid project link")
        return v[:300]

    @field_validator("tech_stack", mode="before")
    @classmethod
    def split_stack(cls, v):
        if isinstance(v, str):                       # the profile form sends "Python, React"
            v = v.split(",")
        return [str(s).strip()[:40] for s in (v or []) if str(s).strip()][:20]

class ProfileIn(BaseModel):
    full_name: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=150)
    visible: bool = True
    resume_url: str | None = Field(default=None, max_length=500)
    resume_name: str | None = Field(default=None, max_length=200)
    job_titles: list[str] = Field(default_factory=list, max_length=15)
    job_types: list[JobType] = Field(default_factory=list)
    min_pay: int | None = Field(default=None, ge=0)
    min_pay_period: SalaryPeriod = "month"
    relocation: str | None = Field(default=None, max_length=100)
    available_now: bool = False
    # sections edited on the profile page (the page always sends the whole profile)
    summary: str | None = Field(default=None, max_length=2000)
    skills: list[str] = Field(default_factory=list, max_length=40)
    experience: list[ExperienceItem] = Field(default_factory=list, max_length=30)
    education: list[EducationItem] = Field(default_factory=list, max_length=30)
    languages: list[LanguageItem] = Field(default_factory=list, max_length=30)
    certifications: list[CertificationItem] = Field(default_factory=list, max_length=30)
    # proof of work: employers check these against the job (see real_match.py)
    linkedin_url: str | None = Field(default=None, max_length=300)
    github_url: str | None = Field(default=None, max_length=300)
    portfolio_url: str | None = Field(default=None, max_length=300)
    projects: list[ProjectItem] = Field(default_factory=list, max_length=20)

    @field_validator("linkedin_url", "github_url", "portfolio_url", mode="before")
    @classmethod
    def clean_link(cls, v, info):
        v = v.strip() if isinstance(v, str) else v
        if not v:
            return None
        if not re.match(r"^https?://", v, re.I):
            v = "https://" + v
        host = (urlparse(v).hostname or "").lower()
        need = {"linkedin_url": "linkedin.com", "github_url": "github.com"}.get(info.field_name)
        if need and not (host == need or host.endswith("." + need)):
            raise ValueError(f"Enter a link on {need}")
        if "." not in host:
            raise ValueError("Enter a valid link")
        return v[:300]

class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=3000)

# --- forgot / reset password ---
def check_password_strength(v: str) -> str:
    if len(v.encode()) > 72:                                   # bcrypt only uses the first 72 bytes
        raise ValueError("Password is too long")
    if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("Password must contain at least one letter and one number")
    return v

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def strong_enough(cls, v: str) -> str:
        return check_password_strength(v)