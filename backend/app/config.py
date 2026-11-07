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
    openrouter_api_key: str = ""            # OpenRouter key (starts with sk-or-v1-); powers the admin "AI parse job text" ingest. Empty = feature off
    openrouter_model: str = "openrouter/free"   # auto-picks an available free model; or set e.g. meta-llama/llama-3.3-70b-instruct:free
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
    # --- AI article generation (Groq) ---
    groq_api_key: str = ""                    # https://console.groq.com/keys ; empty = no articles are generated
    groq_model: str = "openai/gpt-oss-120b"   # the Llama 3 models are not offered to this account; list the ids your key can use at GET https://api.groq.com/openai/v1/models
    ai_articles_per_run: int = 15             # most Groq calls per ingest run (free tier is rate limited); the rest are picked up by the next run
    ai_article_pause: float = 2.0             # seconds between Groq calls
    ingest_interval_minutes: int = 1440       # how often the scheduler fetches jobs: 1440 = daily (it also runs once at startup)
    # --- social auto-sharing (all optional: a platform with no credentials is skipped) ---
    social_max_per_run: int = 5               # most new jobs shared per run, so the accounts are not flooded
    social_dry_run: bool = False              # true = log the posts instead of sending them
    linkedin_access_token: str = ""           # OAuth token with the w_member_social (or w_organization_social) scope
    linkedin_client_id: str = ""              # from your LinkedIn developer app (used when you generate or renew the access token)
    linkedin_client_secret: str = ""
    linkedin_company_id: str = ""             # numeric id of the Company Page, e.g. 104945423 -> posts as urn:li:organization:104945423
    linkedin_author_urn: str = ""             # optional: post as this urn instead (urn:li:person:XXXX)
    twitter_bearer_token: str = ""            # token used for POST /2/tweets. Tweeting needs an OAuth 2.0 USER-context token (tweet.write); an app-only bearer cannot post
    twitter_access_token: str = ""            # OAuth 2.0 user-context token, same use; kept for older .env files
    facebook_page_id: str = ""
    facebook_page_token: str = ""             # Page access token with pages_manage_posts
    github_token: str = ""                    # optional: raises GitHub's API limit (60/h unauthenticated) for Real Match checks
    public_base_url: str = ""                 # e.g. https://api.mysite.com ; empty = same origin / dev proxy

    # backend/.env is found no matter which folder uvicorn is started from (a plain ".env" only works from inside backend/).
    # utf-8-sig also copes with a .env that was saved with a byte-order mark. Real OS environment variables (Render) still win.
    model_config = {"env_file": (str(BACKEND_DIR / ".env"), ".env"), "env_file_encoding": "utf-8-sig", "extra": "ignore"}

    @field_validator("smtp_host", "smtp_user", "smtp_password", "smtp_from_email", "site_url", "openrouter_api_key",
                     "groq_api_key", "linkedin_access_token", "linkedin_author_urn", "linkedin_client_id", "linkedin_client_secret", "linkedin_company_id", "twitter_access_token", "twitter_bearer_token", "facebook_page_id", "facebook_page_token", mode="before")
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
