from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./jobs.db"
    model_config = {"env_file": ".env"}

settings = Settings()