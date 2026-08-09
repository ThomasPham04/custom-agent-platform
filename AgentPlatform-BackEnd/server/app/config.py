"""The only module in the service that reads the environment.

Every other module receives configuration through `container.py`.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Port 4000 matches the Express server, so client/nginx.conf needs no change.
    port: int = 4000
    cors_origin: str = "http://localhost:5173"

    # Code default is `memory` so the service boots and pytest runs with no
    # database. Deployment sets `postgres` via .env / compose.
    store_backend: Literal["postgres", "memory"] = "memory"
    database_url: str = "postgresql://app:app@db:5432/agents"

    llm_provider: Literal["adk_gemini", "mock"] = "mock"
    gemini_api_key: str = ""

    tool_http_timeout_ms: int = 5000
    log_payload_max_bytes: int = 32_768
    max_body_bytes: int = 256 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
