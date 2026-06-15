from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://vni:vni@localhost:5432/vni_crm"

    # JWT
    jwt_secret_key: str = "change-me-in-production-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480  # 8 hours

    # App
    app_name: str = "VNI CRM"
    app_version: str = "1.0.0"
    debug: bool = False
    frontend_url: str = "http://localhost:5173"   # used in notification links

    # Email (SMTP) — Phase G
    # Set email_enabled=true and fill SMTP fields to activate sending.
    # When email_enabled=false (default), notifications are logged only.
    email_enabled: bool  = False
    smtp_host:     str   = ""
    smtp_port:     int   = 587
    smtp_user:     str   = ""
    smtp_password: str   = ""
    smtp_from:     str   = "noreply@vni.in"
    smtp_from_name:str   = "Vijay Nicole Imprints"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
