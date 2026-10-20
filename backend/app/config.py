from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./jobs.db"
    secret_key: str = "dev-secret-change-me"
    access_token_minutes: int = 60 * 24
    require_approval: bool = True
    model_config = {"env_file": ".env"}

settings = Settings()