from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

_is_sqlite = settings.db_url.startswith("sqlite")
engine = create_engine(
    settings.db_url,
    pool_pre_ping=not _is_sqlite,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
