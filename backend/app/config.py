"""Configurazione backend Gestionale Righetti 1967."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Admin
    admin_email: str = "righetti@righetti.club"

    # Log
    log_level: str = "INFO"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
