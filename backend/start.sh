#!/bin/bash
set -e

echo "=== Living Well Communities — Backend Startup ==="
echo "Environment: ${ENVIRONMENT:-development}"

# Run Alembic migrations
echo "Running database migrations..."
alembic upgrade head

# Optionally seed the database (only if SEED_DB=true)
if [ "${SEED_DB}" = "true" ]; then
    echo "Seeding database..."
    python seed.py
fi

# Start the application
echo "Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
