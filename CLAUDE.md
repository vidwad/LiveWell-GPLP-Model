# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Enterprise real-estate syndication + community-operations platform for the **Alberta Multiplex LP** (a GP/LP investment vehicle that acquires, develops, and operates purpose-built residential communities under the RecoverWell / StudyWell / RetireWell brands). This is **not** a generic PE/VC fund-administration system — the domain model is opinionated.

## Repository Layout

```
backend/                FastAPI + SQLAlchemy + Pydantic (Python 3.11+)
livingwell-frontend/    Next.js 14 App Router + React 18 + TS + Tailwind + shadcn/ui
docs/                   Architecture, gap analyses, and per-phase build specs
docs/build-specs/       Sprint contracts — Claude implements these verbatim
CLAUDE_HANDOFF.md       Running handoff log of state + conventions
TODO.md                 Master item-by-item status list (~170 items)
docker-compose.yml      Full prod stack (postgres + backend + frontend [+ caddy])
db_update.sh            Applies Alembic migrations + manual column patches
```

## Common Commands

### Backend (run from `backend/`)

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python seed.py                              # drops + recreates SQLite with demo data
uvicorn app.main:app --reload --port 8000   # dev server at :8000, /docs for Swagger
./start.sh                                  # production entrypoint (alembic upgrade → seed if empty → uvicorn)
alembic upgrade head                        # apply migrations (currently at 007)
bash ../db_update.sh                        # migrations + manual column patches (run after model changes)
```

Tests (all run against the seeded DB via FastAPI `TestClient`):

```bash
python seed.py && python test_comprehensive.py   # 116 tests — all features
python seed.py && python test_ai_integration.py  # 168 tests — AI + document extraction
python seed.py && python test_projections.py     # lifecycle projection engine
python seed.py && python test_investor_returns.py
```

There is **no** `pytest` harness; tests are plain scripts that count `passed`/`errors` and exit non-zero on failure. To run a single assertion, edit the script or use the Swagger UI at `/docs`.

### Frontend (run from `livingwell-frontend/`)

```bash
pnpm install           # or npm install
pnpm dev               # Next.js dev server on :3000
pnpm build             # production build
pnpm lint              # next lint
```

There is no separate unit-test runner for the frontend; verify UI changes by hitting the dev server.

### Docker (full stack)

```bash
docker compose up -d --build   # postgres + backend + frontend
```

### Demo accounts (password `Password1!` for all)

`admin@livingwell.ca` (GP Admin) · `ops@livingwell.ca` (Ops Mgr) · `pm@livingwell.ca` (Property Mgr) · `investor1@example.com` (Investor) · `resident@example.com` (Resident)

## Architecture — The Big Picture

### Three separated layers (do not conflate)

1. **LP Ownership** — legal asset ownership via the Limited Partnership vehicle (`GPEntity`, `LPEntity`, `LPTranche`, `Subscription`, `Holding`, `DistributionEvent`).
2. **Community Operator** — day-to-day program management per city+brand (`Community`, `Resident`, `OperatingExpense`, `OperatorBudget`, maintenance, staffing).
3. **Property Manager** — third-party building management (`PropertyManagerEntity`, maintenance queue, rent collection, inspections).

A `Property` belongs to exactly **one** LP (ownership) and exactly **one** Community (operations). Multiple LPs can feed properties into the same city-level community.

### Key domain invariants (memorize these)

- **Bed is the atomic revenue unit**, not unit or room. `PropertyUnit → Bed` and revenue rolls up bed → unit → property → community → LP.
- **LP is a hard economic boundary.** All financials are computed per-LP. List endpoints must apply LP scope filtering.
- **Target vs actual properties coexist** in each LP — target pipeline (prospect stage) entities are excluded from LP analytics.
- **Tranche-based funding** — subscriptions are funded upfront via `LPTranche`, not via capital calls.
- **Configurable 4-tier waterfall** is per-LP (preferred return → GP catch-up → profit share → second hurdle); styles: European / American / custom.
- **8-stage property lifecycle**: Prospect → Acquisition → Interim Operation → Planning → Permit → Construction → Lease-Up → Stabilized → Exit. Transitions go through `StageTransition` gates with audit trail.
- **Interim operations matter** — properties often operate "as-is" before redevelopment. The system tracks real occupancy, bed-level revenue, and house expenses during this phase.

### Permission model — three independent layers

1. **Roles** (`UserRole` enum): DEVELOPER, GP_ADMIN, OPERATIONS_MANAGER, PROPERTY_MANAGER, PARTNER, INVESTOR, RESIDENT. Guards live in `app/core/deps.py` (`require_gp_admin`, `require_gp_or_ops`, `require_investor_or_above`, etc.). DEVELOPER is a superset of GP_ADMIN.
2. **Scopes** (`ScopeAssignment`): row-level grants linking a user to a specific LP / Community / Property / Cluster with `view | manage | admin` level. Apply via `filter_by_lp_scope(query, current_user, db, Model.lp_id)`, `filter_by_community_scope(...)`, `filter_by_property_scope(...)` on every list endpoint.
3. **Capabilities** (15, defined via `UserCapability` + `ROLE_DEFAULT_CAPABILITIES`): fine-grained permissions like `approve_distributions`, `manage_waterfall`, `transition_stages`. Check with `Depends(require_capability("..."))`.

### Backend structure (`backend/app/`)

```
main.py            FastAPI app; mounts ~20 routers under /api/*, CORS, /uploads static
core/              config (pydantic-settings), security (JWT), deps (auth + RBAC + scope filters)
db/                base, models.py (~3000 lines — single source of truth), session
routes/            thin HTTP handlers (portfolio.py, investment.py, community.py, …). Sub-routers are included from portfolio.py, not main.py.
services/          business logic (waterfall.py, projections.py, debt.py, proforma_service.py, reporting.py, ai.py, ai_tools.py, calculations.py, statement_service.py, …)
schemas/           Pydantic request/response models
```

Routing convention: **fat services, thin routes**. Complex logic belongs in `services/`. Pro-forma / valuation / construction / ancillary-revenue / operating-expense / underwriting routers are wired through `routes/portfolio.py` via `router.include_router(...)` — not registered separately in `main.py`.

Enum columns use `native_enum=False` (see `_enum` helper in `models.py`) so the same definitions work on both SQLite and PostgreSQL.

DB selection in `core/config.py#db_url`: explicit `DATABASE_URL` wins; then `POSTGRES_*` env vars build a PG URL; otherwise falls back to a SQLite file at `backend/livingwell_dev.db`.

Auth: JWT in `Authorization: Bearer` header **or** `lwc_access_token` httpOnly cookie (the cookie is set by `/api/auth/login` and is the default path for the browser client).

### Frontend structure (`livingwell-frontend/src/`)

```
app/(auth)/           login, register
app/(dashboard)/      ~35 route folders — dashboard, investment, portfolio, investors, communities, operations, reports, analytics, ai, settings, admin, etc.
components/property/  property-detail tabs (Overview, Lifecycle, UnitsBeds, RentRoll, DevPlans, ConstructionBudget, DebtFinancing, Projections, ExitScenarios, Valuation, ProForma, AreaResearch, …)
components/ui/        shadcn/ui primitives
hooks/                one React Query hooks file per domain (usePortfolio, useInvestment, useCommunities, useInvestors, useOperator, useAI, …)
lib/api.ts            single Axios client + all typed API methods
lib/utils.ts          formatCurrency, formatCurrencyCompact, formatDate, formatPercent
types/                mirrors backend Pydantic schemas — keep in sync
providers/AuthProvider.tsx
middleware.ts         auth gate
```

Data flow: **always React Query via the hooks in `src/hooks/`** → `src/lib/api.ts` → backend. Do not call `axios` directly from components. Use `usePermissions()` for role/capability-aware UI.

## Conventions That Are Easy to Miss

- **Decimal precision**: use `Decimal` for every monetary/percentage calculation. See `_d()` and `_pct()` helpers in `services/investment_service.py`. Floats corrupt waterfall math.
- **When adding a `Property` field**, propagate it through every consumer or AI/reporting output will lie:
  1. `app/db/models.py` Property model
  2. `_property_to_out()` in `app/routes/portfolio.py`
  3. `_get_property_context()` in `app/routes/ai.py`
  4. `get_property_detail` tool in `app/services/ai_tools.py`
  5. `PropertyRollup` in `app/services/reporting.py`
  6. Frontend `Property` interface in `livingwell-frontend/src/types/portfolio.ts`
  7. Property overview cards in `components/property/OverviewTab.tsx`
- **Scope filter before returning lists.** Every list endpoint must pass through `filter_by_*_scope` or it leaks cross-LP data.
- **Claude model default** is `claude-opus-4-7` (`core/config.py` + commit `9e3d74e`). Configurable via Settings UI or `CLAUDE_MODEL` env var.
- **AI chat has 16+ tools** defined in `services/ai_tools.py` (property details, LP summary, NAV, waterfall simulation, occupancy, trends, etc.). Adding a new data area to the chat requires registering a new tool here.
- **Migrations are at revision `007`.** Some columns on `users` (`google_calendar_connected`, `google_calendar_email`) and `debt_facilities` (`lender_fee_amount`) were added manually and are patched by `db_update.sh`; a future migration `008` should formalize them.
- **`seed.py` is destructive** — it drops and recreates tables. Each environment has its own SQLite file; `*.db` is git-ignored.
- **Frontend Property tabs are extracted components** (`components/property/*Tab.tsx`). When adding a new tab, wire it in the property-detail page and add the interface fields in `types/portfolio.ts`.

## Development Workflow (as documented in `docs/DEVELOPMENT_WORKFLOW.md`)

Two-platform split: **Manus** (human-guided) plans sprints and writes `docs/build-specs/*.md` — Claude implements them **verbatim** locally. If a spec seems wrong, flag it rather than improvising. The Phase-1 specs (`sprint-01` … `sprint-04`) are **superseded** by the Phase-1 Foundation Rebuild — do not implement them; use Phase-2 specs and beyond. Git `master` is the source of truth; always pull before starting and test locally before pushing.

## Current Status

~160 DONE / 8 PARTIAL / 1 NOT DONE of ~170 items. Remaining PARTIAL work (investor-document workflow integration, interim-expense phase tagging, support-service cost-center rollup, structured appraisal record, subscription-history timeline, arrears UI polish, residual service extraction) and the single NOT DONE item (K-1 / tax-document generation) are tracked in `TODO.md` and `CLAUDE_HANDOFF.md`.

## Key Docs to Read Before Large Changes

- `CLAUDE_HANDOFF.md` — current state, patterns, file-location map (kept current)
- `docs/architecture.md` — system layers, entity ER, route + service map
- `docs/project_vision.md` — business requirements
- `docs/Gap_Analysis_Report.md` — blueprint vs implementation diff
- `docs/build-specs/` — active sprint contracts
