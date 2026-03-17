# Living Well Communities: Production Deployment Plan

Moving from a local SQLite/localhost setup to a production-ready application requires several architectural shifts. The current codebase is already well-structured for this transition: the backend uses SQLAlchemy (which supports PostgreSQL), Alembic for migrations, and JWT for authentication. The frontend is a standard Next.js application.

This document outlines the recommended architecture, hosting providers, and step-by-step deployment process to make the application accessible to others securely.

## 1. Target Architecture

To support real users, concurrent access, and data persistence, the architecture should be split into three tiers:

| Component | Current (Local) | Target (Production) | Recommended Provider |
|-----------|-----------------|---------------------|----------------------|
| **Database** | SQLite (`livingwell_dev.db`) | PostgreSQL 15+ | Supabase or Neon |
| **Backend API** | FastAPI (uvicorn on port 8000) | Dockerized FastAPI | Render or Railway |
| **Frontend** | Next.js (pnpm dev on port 3000) | Next.js (Static/Serverless) | Vercel |

### Why this stack?
- **Vercel** is the native hosting platform for Next.js, offering zero-config deployments, edge caching, and automatic SSL.
- **Render/Railway** are excellent PaaS (Platform as a Service) providers for Python/FastAPI backends, offering easy GitHub integration and automatic deployments.
- **Supabase/Neon** provide managed PostgreSQL databases with generous free tiers and easy connection pooling.

## 2. Pre-Deployment Code Changes

Before deploying, a few minor adjustments are needed in the codebase:

### Backend Adjustments
1. **CORS Configuration:** Update `backend/app/main.py` to restrict `allow_origins` from `["*"]` to your specific Vercel frontend URL (e.g., `["https://livingwell-app.vercel.app"]`).
2. **Database URL:** The backend already supports PostgreSQL via the `DATABASE_URL` environment variable in `config.py`. No code changes needed, just environment variable configuration.
3. **Procfile/Start Command:** Create a `Procfile` or define the start command for the hosting provider:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

### Frontend Adjustments
1. **API URL:** The frontend already uses `NEXT_PUBLIC_API_URL` in `src/lib/api.ts`. This will need to be set to the production backend URL in Vercel's environment variables.
2. **Build Script:** Ensure `package.json` has a standard build script (`"build": "next build"`).

## 3. Step-by-Step Deployment Guide

### Phase 1: Database Setup (Supabase)
1. Create an account at [Supabase](https://supabase.com/).
2. Create a new project (e.g., "livingwell-prod").
3. Navigate to Project Settings -> Database and copy the **Connection String (URI)**.
   - It will look like: `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`

### Phase 2: Backend Deployment (Render)
1. Create an account at [Render](https://render.com/).
2. Click "New +" -> "Web Service" and connect your GitHub repository (`vidwad/LiveWell-GPLP-Model`).
3. Configure the service:
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add Environment Variables:
   - `DATABASE_URL`: [Paste the Supabase connection string]
   - `JWT_SECRET_KEY`: [Generate a strong random string, e.g., using `openssl rand -hex 32`]
   - `JWT_ALGORITHM`: `HS256`
5. Click "Create Web Service". Render will build and deploy the API.
6. **Database Migration:** Once deployed, you need to run the Alembic migrations and seed the database. You can do this via Render's "Shell" tab:
   ```bash
   alembic upgrade head
   python seed.py
   ```
7. Copy the resulting backend URL (e.g., `https://livingwell-api.onrender.com`).

### Phase 3: Frontend Deployment (Vercel)
1. Create an account at [Vercel](https://vercel.com/).
2. Click "Add New..." -> "Project" and import your GitHub repository.
3. Configure the project:
   - **Root Directory:** `livingwell-frontend`
   - **Framework Preset:** Next.js
4. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL`: [Paste the Render backend URL from Phase 2]
5. Click "Deploy". Vercel will build and deploy the frontend.
6. Copy the resulting frontend URL (e.g., `https://livingwell-app.vercel.app`).

### Phase 4: Final Configuration
1. Go back to Render -> Environment Variables.
2. Add a new variable `FRONTEND_URL` (if you implement strict CORS) or update the CORS settings in `main.py` to allow the Vercel URL.
3. Restart the Render service.

## 4. Security & Authorization Readiness

The application already has a robust Role-Based Access Control (RBAC) system implemented in `backend/app/core/deps.py`. 

### Current Roles:
- `GP_ADMIN`: Full access to all endpoints.
- `OPERATIONS_MANAGER`: Access to operational data, P&L, and budgets.
- `PROPERTY_MANAGER`: Access to specific communities/properties they manage.
- `INVESTOR`: Read-only access to their specific LP investments and documents.
- `RESIDENT`: Access to their specific unit, lease, and maintenance requests.

### Production Security Checklist:
1. **Change Default Passwords:** The `seed.py` script creates default users with the password `Password1!`. In production, you must force a password reset or manually change these hashes in the database immediately after seeding.
2. **JWT Secret:** Ensure the `JWT_SECRET_KEY` is a strong, unique value and never committed to Git.
3. **HTTPS:** Both Vercel and Render provide automatic SSL/TLS encryption. Ensure all API calls use `https://`.
4. **Environment Variables:** Never commit `.env` files. Use the hosting provider's dashboard to manage secrets.

## 5. Ongoing Maintenance

Once deployed, the workflow changes slightly:
- **Local Development:** Continue using SQLite and `localhost:8000` / `localhost:3000`.
- **Database Changes:** When modifying models, generate a new Alembic migration locally (`alembic revision --autogenerate -m "description"`), commit it, and run `alembic upgrade head` on the production server.
- **Continuous Deployment:** Pushing to the `master` branch on GitHub will automatically trigger builds on both Vercel and Render.
