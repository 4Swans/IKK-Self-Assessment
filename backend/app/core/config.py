import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://ikk_user:ikk_password@localhost:5433/ikk_db"
    )
    TEST_DATABASE_URL: str = Field(
        default="postgresql+asyncpg://ikk_user:ikk_password@localhost:5433/ikk_test_db"
    )
    SECRET_KEY: str = Field(
        default="change-me-to-a-super-secret-random-key-in-production-min-32-chars"
    )
    COOKIE_SECURE: bool = Field(default=False)
    UPLOAD_DIR: str = Field(default="/tmp/uploads" if os.getenv("VERCEL") else "./uploads")
    MAX_UPLOAD_MB: int = Field(default=25)
    SIMPAN_KONTEN_DB: bool = Field(default=bool(os.getenv("VERCEL")))
    ENVIRONMENT: str = Field(default="development")
    ENABLE_API_DOCS: bool | None = Field(default=None)
    CORS_ORIGINS: str = Field(default="http://localhost:5173,http://localhost:8000")
    CORS_ORIGIN_REGEX: str = Field(default="")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    @property
    def show_api_docs(self) -> bool:
        if self.ENABLE_API_DOCS is not None:
            return self.ENABLE_API_DOCS
        return not self.is_production

    @property
    def async_database_url(self) -> str:
        url = (
            os.getenv("DATABASE_URL")
            or os.getenv("POSTGRES_URL")
            or os.getenv("NEON_DATABASE_URL")
            or os.getenv("POSTGRES_PRISMA_URL")
            or self.DATABASE_URL
        ).strip()
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Bersihkan query param psycopg2 (sslmode, channel_binding, pgbouncer)
        parts = urlsplit(url)
        if parts.query:
            clean_params = [
                (k, v)
                for k, v in parse_qsl(parts.query)
                if k
                not in (
                    "sslmode",
                    "channel_binding",
                    "pgbouncer",
                    "supa",
                    "options",
                )
            ]
            url = urlunsplit(
                (parts.scheme, parts.netloc, parts.path, urlencode(clean_params), parts.fragment)
            )
        return url

    @property
    def needs_ssl(self) -> bool:
        raw = (
            os.getenv("DATABASE_URL")
            or os.getenv("POSTGRES_URL")
            or os.getenv("NEON_DATABASE_URL")
            or self.DATABASE_URL
        ).lower()
        return (
            "sslmode=require" in raw
            or "neon.tech" in raw
            or "supabase.com" in raw
            or "vercel-storage.com" in raw
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
