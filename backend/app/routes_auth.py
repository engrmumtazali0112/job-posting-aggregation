from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Company
from .security import hash_password, verify_password, create_token, current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Literal["job_seeker", "employer"] = "job_seeker"
    company_name: str | None = None
    website: str | None = None

@router.post("/register", status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == data.email.lower())):
        raise HTTPException(409, "Email already registered")
    if data.role == "employer" and not data.company_name:
        raise HTTPException(422, "company_name is required for employers")
    user = User(email=data.email.lower(), password_hash=hash_password(data.password), role=data.role)
    db.add(user)
    db.flush()
    if data.role == "employer":
        db.add(Company(user_id=user.id, name=data.company_name, website=data.website))
    db.commit()
    return {"id": user.id, "email": user.email, "role": user.role}

@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username.lower()))
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return {"access_token": create_token(user.id), "token_type": "bearer", "role": user.role}

@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "email": user.email, "role": user.role}