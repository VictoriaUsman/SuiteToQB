from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    app_secret_key: str = "dev-secret-key-change-in-production"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    database_url: str = "sqlite+aiosqlite:///./accountingsuite.db"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    qb_client_id: str = ""
    qb_client_secret: str = ""
    qb_redirect_uri: str = "http://localhost:8000/api/quickbooks/callback"
    qb_environment: str = "sandbox"

    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    upload_dir: str = "./uploads"
    max_upload_mb: int = 50

    tesseract_cmd: str = "tesseract"

    class Config:
        env_file = str(ENV_FILE)
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
