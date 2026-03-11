# Living Well Communities Platform

Enterprise-scale architecture scaffold for project planning.

## Components

- backend: FastAPI + SQLAlchemy + PostgreSQL
- frontend: Next.js (not yet scaffolded)
- mobile: React Native (not yet scaffolded)
- docs: architecture diagrams and implementation plan

## Quick start

1. Create `.env` in backend:

   `POSTGRES_USER=postgres`

   `POSTGRES_PASSWORD=postgres`

   `POSTGRES_SERVER=localhost`

   `POSTGRES_PORT=5432`

   `POSTGRES_DB=livingwell`

   `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/livingwell`

   `JWT_SECRET_KEY=replace_this`

2. Install backend deps:

   `cd backend && python -m pip install -r requirements.txt`

3. Run migrations (alembic to be initialized):

   `alembic upgrade head`

4. Start server:

   `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
