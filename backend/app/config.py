from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env", override=False)


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    app_name: str = os.getenv("APP_NAME", "Prompt Template Service")
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv(
        "DATABASE_URL", "sqlite:///./backend/data/prompt_template_service.sqlite3"
    )
    auto_create_tables: bool = os.getenv("AUTO_CREATE_TABLES", "true").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    cors_origins: list[str] = _split_csv(
        os.getenv(
            "BACKEND_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175",
        )
    )

    ai_base_url: str = os.getenv("AI_BASE_URL", "https://api.deepseek.com")
    ai_api_key: str | None = os.getenv("AI_API_KEY") or None
    default_ai_model: str = os.getenv("DEFAULT_AI_MODEL", "deepseek-chat")
    ai_request_timeout_seconds: float = float(
        os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "60")
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
