from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, model_validator

WorkplaceType = Literal["in_person", "remote", "hybrid"]
JobType = Literal["full_time", "part_time", "contract", "fresher", "temporary", "internship"]
SalaryPeriod = Literal["hour", "day", "week", "month", "year"]
JobCategory = Literal["private", "government", "contract", "ngo"]

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

    @model_validator(mode="after")
    def check_pay(self):
        if self.salary_min is not None and self.salary_max is not None and self.salary_min > self.salary_max:
            raise ValueError("Minimum pay cannot be higher than maximum pay")
        return self

class JobPublic(BaseModel):
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
    created_at: datetime
    model_config = {"from_attributes": True}

class JobFull(JobPublic):
    company_id: int | None
    hiring_timeline: str | None
    status: str
    updated_at: datetime | None

class EmployerJobOut(JobFull):
    applications_count: int = 0

class ApplicationIn(BaseModel):
    cover_letter: str | None = Field(default=None, max_length=5000)
    resume_url: str | None = Field(default=None, max_length=500)

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