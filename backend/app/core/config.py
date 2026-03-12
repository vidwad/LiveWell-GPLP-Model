from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os


class Settings(BaseSettings):
    APP_NAME: str = "Living Well Communities Platform"
    PROJECT_NAME: str = "livingwell"
    POSTGRES_USER: str = Field("postgres", validation_alias="POSTGRES_USER")
    POSTGRES_PASSWORD: str = Field("postgres", validation_alias="POSTGRES_PASSWORD")
    POSTGRES_SERVER: str = Field("localhost", validation_alias="POSTGRES_SERVER")
    POSTGRES_PORT: str = Field("5432", validation_alias="POSTGRES_PORT")
    POSTGRES_DB: str = Field("livingwell", validation_alias="POSTGRES_DB")
    DATABASE_URL: str | None = Field(None, validation_alias="DATABASE_URL")
    JWT_SECRET_KEY: str = Field("supersecretkey", validation_alias="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = Field("HS256", validation_alias="JWT_ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    OPENAI_API_KEY: str = Field("", validation_alias="OPENAI_API_KEY")

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


settings = Settings()
