# Living Well Communities: Production Deployment Guide

Moving from a local SQLite/localhost setup to a production-ready application requires several architectural shifts. The current codebase is already well-structured for this transition: the backend uses SQLAlchemy (which supports PostgreSQL), Alembic for migrations, and JWT for authentication with RBAC. The frontend is a standard Next.js application with environment-based API URL configuration.

This document provides step-by-step instructions to deploy the application so that others can access it securely with real data.

## 1. Architecture Overview

| Component | Local Development | Production | Provider |
|-----------|------------------|------------|----------|
| **Database** | SQLite (`livingwell_dev.db`) | PostgreSQL 15+ | Supabase (free tier) |
| **Backend API** | `uvicorn` on port 8000 | Docker container | Render (free or $7/mo) |
| **Frontend** | `next dev` on port 3000 | Static/Serverless | Vercel (free tier) |

### Files Created for Deployment

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Docker image for the FastAPI backend |
| `backend/.dockerignore` | Excludes dev files from Docker builds |
| `backend/start.sh` | Startup script: runs migrations, optionally seeds, starts uvicorn |
| `backend/.env.example` | Template for backend environment variables |
| `render.yaml` | Render Blueprint for one-click backend deployment |
| `docker-compose.yml` | Local development with PostgreSQL (optional) |
| `livingwell-frontend/vercel.json` | Vercel configuration for frontend deployment |
| `livingwell-frontend/.env.example` | Template for frontend environment variables |
| `backend/alembic/versions/002_add_profit_share_columns.py` | Migration for new LP profit share columns |

## 2. Step-by-Step Deployment

### Phase 1: Set Up the Database (Supabase)

1. Go to [supabase.com](https://supabase.com/) and create a free account.
2. Click **New Project** and name it `livingwell-prod`.
3. Choose a strong database password and save it securely.
4. Once the project is created, go to **Settings** > **Database** > **Connection string** > **URI**.
5. Copy the connection string. It looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-REF].supabase.co:5432/postgres
   ```

### Phase 2: Deploy the Backend (Render)

**Option A: One-Click Blueprint (Recommended)**

1. Go to [render.com](https://render.com/) and create a free account.
2. Click **New** > **Blueprint** and connect your GitHub repository (`vidwad/LiveWell-GPLP-Model`).
3. Render will detect the `render.yaml` file and auto-configure the service.
4. Fill in the required environment variables:
   - `DATABASE_URL`: Paste the Supabase connection string from Phase 1
   - `FRONTEND_URL`: Leave blank for now (you will fill this after Phase 3)
   - `OPENAI_API_KEY`: Your OpenAI key (optional, for AI assistant)
5. Click **Apply**. Render will build the Docker image and deploy.

**Option B: Manual Setup**

1. Click **New** > **Web Service** and connect your GitHub repo.
2. Configure:
   - **Root Directory:** `backend`
   - **Environment:** `Docker`
   - **Dockerfile Path:** `./Dockerfile`
3. Add the same environment variables as Option A, plus:
   - `ENVIRONMENT`: `production`
   - `JWT_SECRET_KEY`: Generate with `openssl rand -hex 32`
4. Click **Create Web Service**.

**After Deployment — Seed the Database:**

1. Go to the Render dashboard > your service > **Shell** tab.
2. Run: `SEED_DB=true python seed.py`
3. This creates the demo users and sample data. **Change passwords immediately** for production use.

### Phase 3: Deploy the Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com/) and create a free account.
2. Click **Add New** > **Project** and import `vidwad/LiveWell-GPLP-Model`.
3. Configure:
   - **Root Directory:** `livingwell-frontend`
   - **Framework Preset:** Next.js (auto-detected)
4. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Your Render backend URL (e.g., `https://livingwell-api.onrender.com`)
5. Click **Deploy**.
6. Copy the resulting URL (e.g., `https://livingwell-app.vercel.app`).

### Phase 4: Connect Frontend to Backend

1. Go back to Render > your service > **Environment** tab.
2. Set `FRONTEND_URL` to your Vercel URL (e.g., `https://livingwell-app.vercel.app`).
3. Click **Save Changes**. The service will automatically redeploy with the updated CORS settings.

## 3. Security Configuration

The application has a robust Role-Based Access Control (RBAC) system with five roles:

| Role | Access Level |
|------|-------------|
| `GP_ADMIN` | Full access to all endpoints and data |
| `OPERATIONS_MANAGER` | Operational data, P&L, budgets, communities |
| `PROPERTY_MANAGER` | Scoped to assigned communities and properties |
| `INVESTOR` | Read-only access to their LP investments and documents |
| `RESIDENT` | Access to their unit, lease, and maintenance requests |

### Production Security Checklist

1. **JWT Secret:** The `render.yaml` auto-generates a strong `JWT_SECRET_KEY`. If you deployed manually, generate one with `openssl rand -hex 32`. Never use the default `supersecretkey`.
2. **Default Passwords:** The seed script creates users with `Password1!`. Force a password reset or change these hashes in the database immediately after seeding.
3. **CORS:** In production (`ENVIRONMENT=production`), CORS is restricted to only the configured `FRONTEND_URL`. The wildcard `*` is only used in development mode.
4. **API Docs:** The `/docs` and `/redoc` endpoints are automatically disabled in production mode.
5. **HTTPS:** Both Vercel and Render provide automatic SSL/TLS. All traffic is encrypted.
6. **Environment Variables:** Never commit `.env` files. Use the hosting provider dashboards to manage secrets.

## 4. Local Development with PostgreSQL (Optional)

If you want to develop locally against PostgreSQL instead of SQLite:

```bash
# Start PostgreSQL in Docker
docker compose up -d db

# Run the backend against PostgreSQL
cd backend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/livingwell python -m uvicorn app.main:app --reload

# Or start everything with Docker Compose
docker compose up -d
```

## 5. Database Migrations

When modifying the SQLAlchemy models:

```bash
cd backend

# Generate a new migration
alembic revision --autogenerate -m "describe your change"

# Apply migrations locally
alembic upgrade head

# Commit the migration file to Git
# Render will auto-apply migrations on next deploy (via start.sh)
```

## 6. Continuous Deployment

Once connected to GitHub, both Vercel and Render will automatically deploy when you push to the `master` branch. The workflow is:

1. Develop locally (SQLite + localhost)
2. Commit and push to `master`
3. Vercel rebuilds the frontend automatically
4. Render rebuilds the backend Docker image and runs migrations automatically
5. Changes are live within minutes

## 7. Demo Login Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@livingwell.ca | Password1! | GP Admin |
| ops@livingwell.ca | Password1! | Operations Manager |
| pm@livingwell.ca | Password1! | Property Manager |
| investor1@example.com | Password1! | Investor |
| investor2@example.com | Password1! | Investor |
| resident@example.com | Password1! | Resident |
