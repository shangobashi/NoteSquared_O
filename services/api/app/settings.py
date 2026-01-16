from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    openai_api_key: str
    openai_transcribe_model: str = "whisper-1"
    openai_llm_model: str = "gpt-4o-mini"

    resend_api_key: str | None = None
    email_from: str | None = None

    class Config:
        env_file = ".env"


settings = Settings()
