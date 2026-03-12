# Living Well Communities — Development Workflow

**Last updated:** 2026-03-11

---

## Overview

This project uses a two-platform development workflow:

- **Manus** — Architecture, design, planning, integration testing, research, creative decisions
- **Claude (local)** — High-volume coding, file generation, following build specifications

All code flows through GitHub as the single source of truth.

---

## The Sprint Cycle

### Step 1: Manus Plans the Sprint

Manus reviews the current codebase, designs the architecture for the next feature set, and produces a **Build Specification** document in `docs/build-specs/`. This document contains:

- Exact SQLAlchemy model definitions (copy-paste ready)
- Exact Pydantic schema definitions
- Exact API route code with imports
- Exact TypeScript type definitions
- Updated seed data
- A verification checklist

The spec is committed and pushed to GitHub.

### Step 2: Claude Implements Locally

On your local machine:

```bash
git pull origin main
```

Open the latest build spec in `docs/build-specs/` and give it to Claude with this prompt template:

> I am working on the Living Well Communities platform. Please implement the changes described in the attached build specification document. Work through each section (A through H) in order. Use the exact code provided — do not paraphrase or simplify. After completing all sections, run through the verification checklist at the end.

Claude implements the changes, you review them, test locally, and push:

```bash
git add -A
git commit -m "Sprint N: <description from spec>"
git push origin main
```

### Step 3: Manus Reviews and Integrates

In the next Manus session:

```
Please pull the latest code from GitHub, run the full stack, and verify Sprint N was implemented correctly. Then plan Sprint N+1.
```

Manus will:
1. Pull the latest code
2. Install dependencies and seed the database
3. Run backend + frontend end-to-end
4. Verify all endpoints and UI work
5. Fix any integration issues
6. Design and write the next sprint spec

### Step 4: Repeat

---

## Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm or pnpm

### First-Time Setup

```bash
git clone https://github.com/vidwad/LiveWell-GPLP-Model.git
cd LiveWell-GPLP-Model

# Backend
cd backend
pip install -r requirements.txt
python seed.py          # Creates livingwell_dev.db with demo data
uvicorn app.main:app --reload

# Frontend (in a separate terminal)
cd livingwell-frontend
npm install
npm run dev
```

### After Pulling New Code

```bash
git pull origin main

# If models changed, rebuild the database:
cd backend
rm -f livingwell_dev.db
pip install -r requirements.txt   # in case new deps were added
python seed.py

# Restart backend
uvicorn app.main:app --reload

# If frontend deps changed:
cd livingwell-frontend
npm install
npm run dev
```

### Demo Accounts

All passwords: `Password1!`

| Email | Role | Access Level |
|-------|------|-------------|
| admin@livingwell.ca | GP Admin | Full access |
| ops@livingwell.ca | Operations Manager | Most features |
| pm@livingwell.ca | Property Manager | Community + maintenance |
| investor1@example.ca | Investor (Sarah Mitchell) | Investor portal |
| investor2@example.ca | Investor (David Nguyen) | Investor portal |
| resident1@example.ca | Resident (Tom Clarke) | Resident features |

---

## Database Strategy

- **Development:** SQLite (`backend/livingwell_dev.db`) — zero config, auto-created by `seed.py`
- **Production:** PostgreSQL — set `DATABASE_URL` environment variable
- **Schema sync:** SQLAlchemy models are the source of truth. Both environments auto-create tables on startup.
- **Data sync:** `seed.py` is idempotent. Run it after any model change to get consistent demo data.
- **The `.db` file is in `.gitignore`** — each environment has its own instance.

---

## File Organization

```
docs/
  architecture.md           — System architecture overview
  project_vision.md         — Full business vision and requirements
  DEVELOPMENT_WORKFLOW.md   — This file
  build-specs/
    sprint-01-enhanced-data-model.md
    sprint-02-*.md          — Future sprints
    ...
```

---

## Sprint Roadmap

| Sprint | Focus | Status |
|--------|-------|--------|
| 1 | Enhanced Data Model (beds, clusters, economic entities, lifecycle) | Ready for implementation |
| 2 | Construction Cost Estimation Engine | Ready for implementation |
| 3 | Investor Portal Enhancement (waterfall, documents, messaging) | Planned |
| 4 | AI Decision Layer (assumption validation, compliance, market intel) | Planned |
| 5 | Dashboard & Reporting Overhaul | Planned |
| 6 | Community Apps Integration (RecoverWell, StudyWell, RetireWell) | Planned |

---

## Rules of Engagement

1. **Never commit directly to `main` without testing.** Always verify locally before pushing.
2. **Build specs are the contract.** Claude should follow them exactly. If something seems wrong in a spec, flag it rather than improvising.
3. **Manus handles cross-cutting concerns.** If a change touches 5+ files or requires architectural decisions, save it for a Manus session.
4. **Claude handles volume work.** If a task is well-defined and involves generating code from clear specs, it is ideal for Claude.
5. **When in doubt, ask Manus.** Start a Manus task with a question before making architectural changes locally.
