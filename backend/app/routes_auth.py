import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .emailer import send_email
from .models import User, Company
from .security import hash_password, verify_password, create_token, current_user
from .schemas import ForgotPasswordIn, ResetPasswordIn

router = APIRouter(prefix="/api/auth", tags=["auth"])

VERIFY_HOURS = 48                           # how long an emailed verification link works
RESEND_COOLDOWN = timedelta(seconds=60)     # at most one new link per minute
RESET_HOURS = 1                             # how long an emailed password-reset link works


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Literal["job_seeker", "employer"] = "job_seeker"
    full_name: str | None = Field(default=None, max_length=150)
    company_name: str | None = Field(default=None, max_length=200)
    website: str | None = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def strong_enough(cls, v: str) -> str:
        if len(v.encode()) > 72:                                    # bcrypt only uses the first 72 bytes
            raise ValueError("Password is too long")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must contain at least one letter and one number")
        return v

    @field_validator("full_name", "company_name", "website", mode="before")
    @classmethod
    def tidy(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class EmailIn(BaseModel):
    email: EmailStr


# ---------- email verification helpers ----------
def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)          # DateTime columns hold naive UTC


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def needs_verification(user: User) -> bool:
    """True only for accounts that were SENT a verification link and have not used it. Accounts created before this
    feature (no token), Google sign-ups and admins are never blocked."""
    return not user.is_verified and bool(user.verification_token)


def start_verification(user: User) -> str:
    """Creates a fresh token. Only its SHA-256 is stored; the plain token only travels in the email."""
    token = secrets.token_urlsafe(32)
    user.verification_token = _digest(token)
    user.verification_sent_at = _utcnow()
    return token


def send_verification_email(user: User, token: str) -> str:
    link = f"{settings.site_url.rstrip('/')}/verify-email/{token}"
    try:
        send_email(user.email, "Verify your email for JobBoard",
                   f"Hi {user.full_name or 'there'},\n\nWelcome to JobBoard! Please confirm your email address by opening this link:\n\n"
                   f"{link}\n\nThe link works for {VERIFY_HOURS} hours. If you did not create this account you can ignore this email.")
    except Exception as exc:                                       # the account exists; the user can ask for a new link
        print("[auth] could not send verification email:", repr(exc))
    return link


@router.post("/register", status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == data.email.lower())):
        raise HTTPException(409, "Email already registered")
    if data.role == "employer" and (not data.company_name or len(data.company_name) < 2):
        raise HTTPException(422, "company_name is required for employers")
    user = User(email=data.email.lower(), password_hash=hash_password(data.password),
                role=data.role, full_name=data.full_name, is_verified=False)
    db.add(user)
    db.flush()
    if data.role == "employer":
        db.add(Company(user_id=user.id, name=data.company_name, website=data.website))
    token = start_verification(user)
    db.commit()
    link = send_verification_email(user, token)                    # after the commit, so a failed save never sends a link
    out = {"id": user.id, "email": user.email, "role": user.role,
           "verification_required": settings.require_email_verification}
    if settings.environment != "production":
        out["dev_verify_url"] = link                               # lets you test locally without a mail server
    return out


@router.get("/verify/{token}")
def verify_email(token: str, db: Session = Depends(get_db)):
    """Opened from the link in the email (the React page /verify-email/:token calls this). Safe to open twice."""
    user = db.scalar(select(User).where(User.verification_token == _digest(token)))
    if not user:
        raise HTTPException(400, "This verification link is not valid. Request a new one from the login page.")
    if user.is_verified:
        return {"ok": True, "email": user.email}
    if user.verification_sent_at and _utcnow() - user.verification_sent_at > timedelta(hours=VERIFY_HOURS):
        raise HTTPException(400, "This verification link has expired. Request a new one from the login page.")
    user.is_verified = True
    db.commit()
    return {"ok": True, "email": user.email}


@router.post("/resend-verification")
def resend_verification(data: EmailIn, db: Session = Depends(get_db)):
    """Always answers the same, so it cannot be used to find out which emails have accounts."""
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user and needs_verification(user):
        if not user.verification_sent_at or _utcnow() - user.verification_sent_at >= RESEND_COOLDOWN:
            token = start_verification(user)
            db.commit()
            send_verification_email(user, token)
    return {"ok": True}


# ---------- forgot / reset password ----------
def start_password_reset(user: User) -> str:
    """Creates a fresh reset token. Only its SHA-256 is stored; the plain token only travels in the email."""
    token = secrets.token_urlsafe(32)
    user.reset_token = _digest(token)
    user.reset_sent_at = _utcnow()
    return token


def send_reset_email(user: User, token: str) -> None:
    link = f"{settings.site_url.rstrip('/')}/reset-password/{token}"
    try:
        send_email(user.email, "Reset your JobBoard password",
                   f"Hi {user.full_name or 'there'},\n\nWe received a request to reset your JobBoard password. Open this link to choose a new one:\n\n"
                   f"{link}\n\nThe link works for {RESET_HOURS} hour. If you did not ask for this you can ignore this email; your password stays the same.")
    except Exception as exc:
        print("[auth] could not send reset email:", repr(exc))


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordIn, db: Session = Depends(get_db)):
    """Always answers the same, so it cannot be used to find out which emails have accounts."""
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user and user.is_active is not False and user.auth_provider == "password":      # Google accounts have no password to reset
        if not user.reset_sent_at or _utcnow() - user.reset_sent_at >= RESEND_COOLDOWN:
            token = start_password_reset(user)
            db.commit()
            send_reset_email(user, token)
    return {"ok": True}


@router.post("/reset-password")
def reset_password(data: ResetPasswordIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.reset_token == _digest(data.token)))
    if not user or user.is_active is False:
        raise HTTPException(400, "This reset link is not valid. Request a new one from the login page.")
    if not user.reset_sent_at or _utcnow() - user.reset_sent_at > timedelta(hours=RESET_HOURS):
        raise HTTPException(400, "This reset link has expired. Request a new one from the login page.")
    user.password_hash = hash_password(data.password)
    user.reset_token = None                    # one use only
    user.reset_sent_at = None
    user.is_verified = True                    # they just proved they own this mailbox
    db.commit()
    return {"ok": True}


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username.lower()))
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    if user.is_active is False:
        raise HTTPException(403, "This account has been deactivated")
    if settings.require_email_verification and needs_verification(user):
        raise HTTPException(403, {"code": "email_not_verified",
                                  "message": "Please verify your email first. We sent a link to " + user.email + "."})
    return {"access_token": create_token(user.id), "token_type": "bearer", "role": user.role}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    company = db.scalar(select(Company).where(Company.user_id == user.id))
    return {"id": user.id, "email": user.email, "role": user.role, "full_name": user.full_name,
            "is_verified": user.is_verified, "company_name": company.name if company else None}
