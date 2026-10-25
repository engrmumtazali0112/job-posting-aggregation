from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings

BACKEND_DIR = Path(__file__).resolve().parent.parent      # .../backend


class Settings(BaseSettings):
    database_url: str = "sqlite:///./jobs.db"
    secret_key: str = "dev-secret-change-me"
    environment: str = "development"          # set ENVIRONMENT=production on Render
    access_token_minutes: int = 60 * 24
    require_approval: bool = True
    jooble_api_key: str = ""
    cors_origins: str = "http://localhost:5173"
    cors_origin_regex: str = ""               # optional, e.g. ^https://job-board-frontend-[a-z0-9-]+\.vercel\.app$ for Vercel preview URLs
    require_email_verification: bool = True   # new accounts must click the emailed link before they can log in (set false to turn off)
    google_client_id: str = ""
    google_client_secret: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""                # e.g. @mychannel or -100123...
    telegram_share_aggregated: bool = False   # employer jobs are always shared
    # Address of the FRONTEND, used for the links in verification / password-reset / job-alert emails and Telegram posts.
    # Local: http://localhost:5173   Production: https://job-board-frontend-opal.vercel.app   (a trailing / is removed)
    site_url: str = "http://localhost:5173"
    stale_job_days: int = 30
    upload_dir: str = "uploads"               # resumes are stored here (swap for S3/R2 later, see storage.py)
    max_upload_mb: int = 5
    smtp_host: str = ""                       # e.g. smtp.gmail.com ; empty = emails are only printed to the log, not sent
    smtp_port: int = 587                      # 587 = STARTTLS (Gmail, most providers), 465 = SSL
    smtp_user: str = ""                       # the login, for Gmail your full address
    smtp_password: str = ""                   # for Gmail a 16-character App Password, NOT your normal password
    smtp_from_email: str = ""                 # the From address; empty = same as smtp_user (Gmail always sends from the logged-in account)
    smtp_from_name: str = "JobBoard"          # the name recipients see
    github_token: str = ""                    # optional: raises GitHub's API limit (60/h unauthenticated) for Real Match checks
    public_base_url: str = ""                 # e.g. https://api.mysite.com ; empty = same origin / dev proxy

    # backend/.env is found no matter which folder uvicorn is started from (a plain ".env" only works from inside backend/).
    # utf-8-sig also copes with a .env that was saved with a byte-order mark. Real OS environment variables (Render) still win.
    model_config = {"env_file": (str(BACKEND_DIR / ".env"), ".env"), "env_file_encoding": "utf-8-sig", "extra": "ignore"}

    @field_validator("smtp_host", "smtp_user", "smtp_password", "smtp_from_email", "site_url", mode="before")
    @classmethod
    def _clean(cls, v):
        if isinstance(v, str):                # stray spaces or quotes pasted around a value would break login / links
            v = v.strip().strip("\"'").strip()
        return v

    @field_validator("site_url", mode="after")
    @classmethod
    def _no_trailing_slash(cls, v: str) -> str:
        return v.rstrip("/") or "http://localhost:5173"


settings = Settings()

if settings.environment == "production" and settings.secret_key == "dev-secret-change-me":
    raise RuntimeError("SECRET_KEY must be set in production")
