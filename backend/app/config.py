"""Application configuration loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings (loaded from .env or process env)."""

    # Ollama
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    ollama_timeout: int = 120

    # API server
    cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 10

    # Persistence — single SQLite file (created on first run)
    db_path: str = "data/app.db"

    # Auth — single fixed account configured via env. No registration UI.
    auth_username: str = "admin"
    auth_password: str = "admin"
    # 32+ random chars; used for HMAC-signing session cookies.
    auth_secret: str = "change-me-to-a-long-random-string-please"
    auth_session_days: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Cached singleton accessor."""
    return Settings()
