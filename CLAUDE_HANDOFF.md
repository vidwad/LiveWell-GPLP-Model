# LiveWell GPLP Platform — Claude Handoff Document

This document provides the necessary context, architectural patterns, and current state for Claude to continue development on the LiveWell GPLP Platform.

> Last updated: 2026-03-22

## 1. Project Overview & Architecture

The LiveWell GPLP Platform is an enterprise-scale real estate syndication and community operations platform for the **Alberta Multiplex LP**. It is **not** a generic PE/VC fund administration system.

### Key Architectural Principles
1. **Separation of Ownership and Operations:** A property belongs to one LP (ownership) and one Community (operations). Multiple LPs may contribute properties into the same city-based community.
2. **Interim Operations:** Properties often operate "as-is" before redevelopment. The system tracks real occupancy, bed-level revenue, and house expenses during this phase.
3. **Three Distinct Layers:** LP Ownership (GP/LP) → Community Operator → Property Manager.
4. **Target vs. Actual:** Target properties (pipeline) and actual properties coexist within each LP.
5. **Tranche-Based Funding:** Subscriptions are funded upfront via tranches, not through capital calls.
6. **Configurable Distributions:** LP-specific distribution logic with 4-tier waterfall engine.
7. **Bed-Level Revenue:** The atomic revenue unit is the bed (not unit). Supports private pay, subsidized, and grant-funded rent types.

### Tech Stack
* **Backend:** FastAPI, SQLAlchemy (SQLite for local dev, PostgreSQL for prod), Pydantic, Uvicorn.
* **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui, React Query, Axios, Recharts.
* **AI:** Claude API (Anthropic) with fallback mock responses.
* **PDF:** fpdf2 for investor statement generation.

---

## 2. Current Platform State (Phase 6 Complete)

The platform is at **~160 DONE / 8 PARTIAL / 1 NOT DONE** out of ~170 total items.

### What's Built & Working

**Investment Layer:**
- GP/LP entities with full configurable terms (fees, waterfall, offering dates, reserves)
- Tranche-based fundraising with progress tracking
- Subscription lifecycle (draft → issued) with validation
- Holdings with unit-based ownership, cost basis, unreturned capital
- Distribution events with automated waterfall calculation and eTransfer tracking
- LP P&L, NAV, XIRR, equity multiple calculations
- Target property pipeline with underwriting to acquisition conversion

**Property Portfolio:**
- 8-stage lifecycle with transition gates and milestone tracking
- 20 extended property fields (physical specs, municipal data, MLS/market data)
- Development plans with versioning and side-by-side comparison
- Construction budget vs actual tracking with draws workflow
- Debt facilities with amortization engine (Canadian compounding, IO periods)
- Valuation history with cap rate calculator
- Refinance and sale exit scenarios
- Pro forma generation from rent roll, expenses, debt service
- Year-by-year lifecycle projections (as-is → construction → lease-up → stabilized)

**Community Operations:**
- Bed-level occupancy and revenue tracking
- Rent collection with arrears aging (30/60/90/120+)
- Maintenance request workflow with cost tracking
- Unit turnover workflow (cleaning → inspection)
- Staff directory and shift scheduling
- Operating budgets with variance analysis and alerts
- Vacancy alerts with threshold-based detection

**Investor Portal:**
- Role-specific dashboards (GP, investor, PM, resident)
- PDF statement generation with holdings, NAV/unit, distributions
- Document management (14 property categories, 9 investor types)
- Onboarding workflow with indication of interest
- Waterfall transparency (tier-by-tier visibility)

**AI Integration:**
- Multi-turn chat with 16+ data tools and full portfolio context
- Risk analysis with property physical details and neighbourhood context
- Underwriting analysis, area research, anomaly detection
- Document extraction from PDFs with confidence scoring
- AI-generated report narratives and investor communications

**Reporting:**
- Dashboard KPIs, fund performance, management packs
- Quarterly reports with AI-generated narratives
- Portfolio analytics, LP comparison, trend analysis
- Cash flow projections, debt maturity, variance alerts

**Infrastructure:**
- 5 user roles with scope-based and capability-based permissions (15 capabilities)
- Scope filtering on all list endpoints
- Audit logging for high-risk actions
- 284 passing tests (116 comprehensive + 168 AI integration)
- ~156 API endpoints across 13 route modules

### Latest Changes (March 2026)
- Added 20 extended property fields (year_built, property_type, building_sqft, bedrooms, bathrooms, property_style, garage, neighbourhood, ward, legal_description, latitude, longitude, roll_number, assessment_class, tax_amount, tax_year, mls_number, list_price, last_sold_price, last_sold_date)
- Propagated new fields to all consumers: AI context helpers, AI tools, risk analysis, management pack reports, fund performance reports, cash flow projections, frontend OverviewTab (3 new display cards: Building Details, Municipal Data, Market Data)
- Updated frontend Property TypeScript interface to match backend schema

---

## 3. Coding Patterns & Conventions

### Backend Patterns
1. **Fat Services, Thin Routes:** Keep route handlers in `app/routes/` thin. Move complex business logic to `app/services/` (e.g., `investment_service.py`, `operations_service.py`, `proforma_service.py`).
2. **Scope Filtering:** When adding new list endpoints, always apply the appropriate scope filter from `app.core.deps` (e.g., `filter_by_lp_scope(query, current_user, db, Model.lp_id)`).
3. **Role Guards:** Protect endpoints using dependencies like `Depends(require_gp_or_ops)` or `Depends(require_investor_or_above)`.
4. **Decimal Precision:** Use `Decimal` for all financial calculations to avoid floating-point errors. See `_d()` and `_pct()` helpers in `investment_service.py`.
5. **Database Models:** Models are defined in `app/db/models.py`. Always use SQLAlchemy 2.0 style relationships.
6. **Property field propagation:** When adding new Property fields, ensure they flow through to: `_property_to_out()` in portfolio routes, `_get_property_context()` in ai routes, `get_property_detail` tool in ai_tools.py, PropertyRollup in reporting.py, and the frontend Property interface in types/portfolio.ts.

### Frontend Patterns
1. **React Query:** Use `@tanstack/react-query` for all data fetching. Define hooks in `src/hooks/` that call API methods defined in `src/lib/api.ts`.
2. **Role-Based UI:** Use the `usePermissions` hook (`const { canEdit, isAdmin } = usePermissions();`) to conditionally render actions.
3. **UI Components:** Use the existing `shadcn/ui` components in `src/components/ui/` (Card, Table, Badge, Dialog, etc.).
4. **Formatting:** Use `formatCurrency`, `formatCurrencyCompact`, `formatDate`, and `formatPercent` from `src/lib/utils.ts`.
5. **Property Tabs:** Property detail uses extracted tab components in `src/components/property/` (OverviewTab, LifecycleTab, UnitsBedsTab, RentRollTab, DevPlansTab, ConstructionBudgetTab, DebtFinancingTab, ProjectionsTab, ExitScenariosTab, ValuationTab, ProFormaTab, AreaResearchTab).

---

## 4. Remaining Work Items

### PARTIAL Items (minor enhancements)
| # | Item | Notes |
|---|------|-------|
| 1.3.13 | Investor document workflow integration | Document upload exists; needs tighter integration into onboarding workflow |
| 2.1.5 | Interim expense phase tagging | OperatingExpense model works; no interim vs stabilized flag |
| 2.1.8 | Support-service cost-center breakdown | CommunityEvent has cost; needs formal rollup reporting |
| 2.7.4 | Structured appraisal record | Document model supports appraisal type; no dedicated data record |
| 3.3.2 | Subscription history timeline | Shown in list form; not a visual timeline |
| 4.3.3 | Arrears UI improvements | Basic UI exists; needs enhanced filtering |
| T.1/T.7 | Service extraction | Core services created; some inline route logic remains |

### NOT DONE
| # | Item | Notes |
|---|------|-------|
| 3.3.5 | K-1 / tax document generation | Future phase |

---

## 5. Key File Locations

### Backend Routes
| File | Endpoints |
|------|-----------|
| `app/routes/auth.py` | Authentication, capabilities |
| `app/routes/investment.py` | GP, LP, tranches, subscriptions, holdings, distributions |
| `app/routes/portfolio.py` | Properties, units, beds, development plans, debt |
| `app/routes/portfolio_proforma.py` | Pro forma generation |
| `app/routes/portfolio_valuation.py` | Valuations, refinance/sale scenarios |
| `app/routes/portfolio_construction.py` | Construction budget, draws |
| `app/routes/community.py` | Communities, residents, rent, maintenance |
| `app/routes/investor.py` | Investor CRUD, dashboard, statements, onboarding |
| `app/routes/lifecycle.py` | Stage transitions, milestones, quarterly reports |
| `app/routes/operator.py` | Budgets, expenses, turnovers, arrears, staff |
| `app/routes/reports.py` | Fund performance, management pack, cash flow |
| `app/routes/ai.py` | Chat, risk analysis, underwriting, area research |
| `app/routes/documents.py` | Document upload/download |
| `app/routes/calculations.py` | Financial calculations |
| `app/routes/notifications.py` | Notifications |
| `app/routes/settings.py` | Platform settings |

### Backend Services
| File | Purpose |
|------|---------|
| `app/services/investment_service.py` | LP summary, holdings, NAV, P&L computations |
| `app/services/waterfall.py` | Distribution waterfall engine |
| `app/services/projections.py` | Lifecycle projection engine |
| `app/services/debt.py` | Mortgage amortization engine |
| `app/services/proforma_service.py` | Pro forma generation |
| `app/services/reporting.py` | LP roll-up, fund performance, management pack |
| `app/services/ai.py` | Claude AI integration |
| `app/services/ai_tools.py` | AI chat tools (16+ data access tools) |
| `app/services/calculations.py` | NOI, DSCR, LTV, IRR, XIRR |
| `app/services/modeling.py` | Construction cost estimation |
| `app/services/operations_service.py` | Community P&L, occupancy |
| `app/services/statement_service.py` | Investor PDF statements |
| `app/services/document_extraction.py` | AI document parsing |
| `app/services/lifecycle.py` | Stage transition logic |
| `app/services/quarterly_reports.py` | Report generation |
| `app/services/validation_service.py` | Entity transition validation |

### Frontend Key Files
| File | Purpose |
|------|---------|
| `src/types/portfolio.ts` | Property, DevelopmentPlan, DebtFacility types |
| `src/types/investment.ts` | LP, Subscription, Holding, Distribution types |
| `src/types/community.ts` | Community, Unit, Resident types |
| `src/lib/api.ts` | All API call methods |
| `src/hooks/` | React Query hooks per domain |
| `src/components/property/` | 12 property tab components |
| `src/providers/AuthProvider.tsx` | Auth state management |

---

## 6. Getting Started Locally

1. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python seed.py  # Resets and seeds the SQLite database
   uvicorn app.main:app --reload --port 8000
   ```

2. **Frontend:**
   ```bash
   cd livingwell-frontend
   pnpm install
   pnpm dev
   ```

3. **Login Credentials (from seed data):**
   * GP Admin: `admin@livingwell.ca` / `Password1!`
   * Ops Manager: `ops@livingwell.ca` / `Password1!`
   * Property Manager: `pm@livingwell.ca` / `Password1!`
   * Investor: `investor1@example.com` / `Password1!`
   * Resident: `resident@example.com` / `Password1!`

4. **Run Tests:**
   ```bash
   cd backend
   python seed.py && python test_comprehensive.py     # 116 tests
   python seed.py && python test_ai_integration.py     # 168 tests
   ```
