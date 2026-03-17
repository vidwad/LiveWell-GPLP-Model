#!/bin/bash
set -e

echo "=== Living Well Communities — Backend Startup ==="
echo "Environment: ${ENVIRONMENT:-development}"
echo "Database: ${DATABASE_URL:-sqlite (local)}"

# Run Alembic migrations
echo "Running database migrations..."
alembic upgrade head || {
    echo "Alembic migration failed. Falling back to create_all..."
    python -c "
from app.db.session import engine
from app.db.base import Base
import app.db.models
Base.metadata.create_all(bind=engine)
print('Tables created via create_all.')
"
}

# Seed the database if SEED_DB=true
# The seed script drops and recreates tables, so only run on first deploy
if [ "${SEED_DB}" = "true" ]; then
    # Check if the database already has data (users table)
    HAS_DATA=$(python -c "
from app.db.session import SessionLocal
from app.db.models import User
db = SessionLocal()
count = db.query(User).count()
db.close()
print(count)
" 2>/dev/null || echo "0")

    if [ "$HAS_DATA" = "0" ]; then
        echo "Empty database detected. Seeding with demo data..."
        python seed.py
        echo "Database seeded successfully."
    else
        echo "Database already has $HAS_DATA users. Skipping seed."
    fi
fi

# Start the application
echo "Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
