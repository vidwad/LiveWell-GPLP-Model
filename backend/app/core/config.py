from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os


class Settings(BaseSettings):
    APP_NAME: str = "Living Well Communities Platform"
    PROJECT_NAME: str = "livingwell"
    ENVIRONMENT: str = Field("development", validation_alias="ENVIRONMENT")

    # Database
    POSTGRES_USER: str = Field("postgres", validation_alias="POSTGRES_USER")
    POSTGRES_PASSWORD: str = Field("postgres", validation_alias="POSTGRES_PASSWORD")
    POSTGRES_SERVER: str = Field("localhost", validation_alias="POSTGRES_SERVER")
    POSTGRES_PORT: str = Field("5432", validation_alias="POSTGRES_PORT")
    POSTGRES_DB: str = Field("livingwell", validation_alias="POSTGRES_DB")
    DATABASE_URL: str | None = Field(None, validation_alias="DATABASE_URL")

    # Authentication
    JWT_SECRET_KEY: str = Field("supersecretkey", validation_alias="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = Field("HS256", validation_alias="JWT_ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — comma-separated list of allowed origins for production
    FRONTEND_URL: str = Field("http://localhost:3000", validation_alias="FRONTEND_URL")

    # Email (Resend)
    RESEND_API_KEY: str = Field("", validation_alias="RESEND_API_KEY")
    RESEND_FROM_EMAIL: str = Field("onboarding@resend.dev", validation_alias="RESEND_FROM_EMAIL")

    # External APIs
    OPENAI_API_KEY: str = Field("", validation_alias="OPENAI_API_KEY")
    ANTHROPIC_API_KEY: str = Field("", validation_alias="ANTHROPIC_API_KEY")
    CLAUDE_MODEL: str = Field("claude-sonnet-4-20250514", validation_alias="CLAUDE_MODEL")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def db_url(self) -> str:
        # 1. Explicit DATABASE_URL always wins
        if self.DATABASE_URL:
            return self.DATABASE_URL

        # 2. If PostgreSQL env vars are explicitly set, build a PG URL
        if os.environ.get("POSTGRES_SERVER") or os.environ.get("POSTGRES_USER"):
            return (
                f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )

        # 3. Default: SQLite for local development (zero-config)
        _backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        _db_path = os.path.join(_backend_dir, "livingwell_dev.db")
        return f"sqlite:///{_db_path}"

    @property
    def cors_origins(self) -> list[str]:
        """Return allowed CORS origins based on environment."""
        origins = [
            self.FRONTEND_URL,
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
        if self.ENVIRONMENT == "production":
            # Also allow the frontend URL without port (for reverse-proxy setups)
            from urllib.parse import urlparse
            parsed = urlparse(self.FRONTEND_URL)
            base = f"{parsed.scheme}://{parsed.hostname}"
            origins.append(base)
            # Common port variants
            origins.append(f"{base}:3000")
            origins.append(f"{base}:8000")
            if "vercel.app" in self.FRONTEND_URL:
                origins.append("https://*.vercel.app")
        # Deduplicate while preserving order
        return list(dict.fromkeys(origins))


settings = Settings()
