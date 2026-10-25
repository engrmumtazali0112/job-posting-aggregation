from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./jobs.db"
    secret_key: str = "dev-secret-change-me"
    environment: str = "development"          # set ENVIRONMENT=production on Render
    access_token_minutes: int = 60 * 24
    require_approval: bool = True
    jooble_api_key: str = ""
    cors_origins: str = "http://localhost:5173"
    google_client_id: str = ""
    google_client_secret: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""                # e.g. @mychannel or -100123...
    telegram_share_aggregated: bool = False   # employer jobs are always shared
    site_url: str = "http://localhost:5173"   # used for links in Telegram posts
    stale_job_days: int = 30
    upload_dir: str = "uploads"               # resumes are stored here (swap for S3/R2 later, see storage.py)
    max_upload_mb: int = 5
    public_base_url: str = ""                 # e.g. https://api.mysite.com ; empty = same origin / dev proxy
    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

if settings.environment == "production" and settings.secret_key == "dev-secret-change-me":
    raise RuntimeError("SECRET_KEY must be set in production")