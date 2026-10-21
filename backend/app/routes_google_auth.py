import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as g_requests

from .config import settings
from .database import get_db
from .models import User
from .security import hash_password, create_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

class GoogleIn(BaseModel):
    credential: str                      # ID token from Google Identity Services
    role: str = "job_seeker"             # only used when the account is created

@router.post("/google")
def google_login(data: GoogleIn, db: Session = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(503, "Google sign-in is not configured")
    
    try:
        info = id_token.verify_oauth2_token(
            data.credential, 
            g_requests.Request(), 
            settings.google_client_id
        )
    except ValueError:
        raise HTTPException(401, "Invalid Google token")
        
    if not info.get("email_verified"):
        raise HTTPException(401, "Google email is not verified")
        
    email = info["email"].lower()
    user = db.scalar(select(User).where(User.email == email))
    
    if not user:
        # Google sign-up is for job seekers only. Employers register with a company profile.
        user = User(
            email=email, 
            password_hash=hash_password(secrets.token_urlsafe(32)), 
            role="job_seeker",
            full_name=info.get("name"), 
            is_verified=True, 
            auth_provider="google"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    if user.is_active is False:
        raise HTTPException(403, "This account has been deactivated")
        
    return {"access_token": create_token(user.id), "token_type": "bearer", "role": user.role}