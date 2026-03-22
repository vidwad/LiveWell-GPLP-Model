# Living Well Communities Platform Architecture

> Last updated: 2026-03-22

## 1. System Layers

### Core Platform (Backend Monolith)
- **Investment Management:** GP/LP entities, tranches, subscriptions, holdings, distributions, waterfall calculations, NAV, P&L
- **Property Portfolio:** Property lifecycle (8 stages), development plans, construction budgets, debt facilities, valuations, pro forma, projections, exit scenarios
- **Community Operations:** Communities, units, beds, residents, rent payments, maintenance, staffing, budgets, vacancy tracking, arrears
- **Investor Relations:** Onboarding, statements (PDF), document management, notifications
- **Reporting:** Fund performance, management packs, quarterly reports, portfolio analytics, trends
- **AI Decision Layer:** Claude API integration for chat, risk analysis, underwriting, document extraction, area research

### Community Apps (Future)
- RecoverWell, StudyWell, RetireWell mobile applications
- Connect via shared REST API with tenant/scope scoping

### Investor Portal
- LP investor UI for documents, reports, holdings, distributions, waterfall visibility
- Role-restricted access to their own investments only

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Python 3.11+, FastAPI | Async-ready, Pydantic validation |
| Database | SQLite (dev), PostgreSQL (prod) | Auto-fallback in main.py |
| ORM | SQLAlchemy 2.0 | Declarative models in models.py |
| Auth | JWT (httpOnly cookies) | Role + Scope + Capability permissions |
| Frontend | Next.js 14 (App Router), React 18, TypeScript | ~42 pages |
| UI Library | shadcn/ui + Tailwind CSS | Responsive, accessible |
| Charts | Recharts | Dashboard visualizations |
| Data Fetching | React Query (@tanstack/react-query) | With Axios |
| AI | Claude API (Anthropic) | With fallback mock responses |
| PDF | fpdf2 | Investor statement generation |

## 3. Security & RBAC

### Three-Layer Permission Model
1. **Roles:** GP_ADMIN, OPERATIONS_MANAGER, PROPERTY_MANAGER, INVESTOR, RESIDENT
2. **Scopes:** ScopeAssignment links users to specific entities (LP, Community, Property) with view/edit/admin levels
3. **Capabilities:** 15 fine-grained permissions (view_financials, manage_properties, approve_distributions, etc.)

### Enforcement
- Route-level: `Depends(require_gp_or_ops)`, `Depends(require_investor_or_above)`, `Depends(require_capability("approve_distributions"))`
- Data-level: `filter_by_lp_scope()`, `filter_by_community_scope()`, `filter_by_property_scope()` on all list endpoints
- Frontend: `usePermissions()` hook for role-aware UI rendering
- Audit: `AuditLog` model for high-risk action tracking

## 4. Data Architecture

### Core Entity Relationships
```
GPEntity (1) ──── (N) LPEntity
LPEntity (1) ──── (N) Property
LPEntity (1) ──── (N) LPTranche
LPEntity (1) ──── (N) Subscription ──── (1) Investor
LPEntity (1) ──── (N) Holding ──── (1) Investor
LPEntity (1) ──── (N) DistributionEvent ──── (N) DistributionAllocation

Property (N) ──── (1) Community ──── (1) OperatorEntity
Property (1) ──── (N) PropertyUnit ──── (N) Bed
Property (1) ──── (N) DevelopmentPlan
Property (1) ──── (N) DebtFacility
Property (1) ──── (1) PropertyManagerEntity

Community (1) ──── (N) Resident
Community (1) ──── (N) OperatingExpense
Community (1) ──── (N) OperatorBudget
```

### Key Design Decisions
- **Community is city+purpose level** (e.g., "RecoverWell Calgary"), not property-level
- **Bed is the atomic revenue unit**, not unit or room
- **LP is a hard economic boundary** — all financials computed per-LP
- **Target properties** (pipeline) and actual properties coexist within each LP
- **Tranche-based funding** — subscriptions funded upfront, not via capital calls

## 5. Backend Architecture

### Route Modules (13)
```
/api/auth           → auth.py (login, register, capabilities)
/api/investment     → investment.py (GP, LP, tranches, subscriptions, holdings, distributions)
/api/portfolio      → portfolio.py + sub-routers (properties, units, debt, dev plans)
                      portfolio_proforma.py (pro forma)
                      portfolio_valuation.py (valuations, exit scenarios)
                      portfolio_construction.py (construction budget, draws)
/api/community      → community.py (communities, residents, rent, maintenance)
/api/investor       → investor.py (CRUD, dashboard, statements, onboarding)
/api/lifecycle      → lifecycle.py (transitions, milestones, reports)
/api/operator       → operator.py (budgets, expenses, turnovers, staff)
/api/reports        → reports.py (fund performance, management pack, cash flow)
/api/ai             → ai.py (chat, risk, underwriting, research)
/api/documents      → documents.py (upload, download)
/api/calculations   → calculations.py (NOI, DSCR, LTV, IRR)
/api/notifications  → notifications.py
/api/settings       → settings.py
```

### Service Layer
- `investment_service.py` — LP summary, holdings, NAV, P&L
- `waterfall.py` — Configurable distribution waterfall (4-tier, LP-specific)
- `projections.py` — Year-by-year lifecycle projections
- `debt.py` — Mortgage amortization engine
- `proforma_service.py` — Stabilized pro forma generation
- `reporting.py` — LP roll-up, fund performance, management pack
- `ai.py` — Claude API calls with structured prompts
- `ai_tools.py` — 16+ data access tools for AI chat
- `calculations.py` — Financial formulas (NOI, DSCR, LTV, IRR, XIRR)
- `modeling.py` — Construction cost estimation (Alberta benchmarks)
- `operations_service.py` — Community P&L, occupancy metrics

## 6. Frontend Architecture

### Page Structure (~42 pages)
```
(auth)/
  login, register

(dashboard)/
  dashboard           → Role-specific home
  investment/          → LP list, LP detail (7 tabs), LP create, distributions
  portfolio/           → Properties list, property detail (12 tabs), property create
  investors/           → Investor list, detail, create, CRM/onboarding
  communities/         → Community list, detail, create
  operations/          → Operations P&L
  maintenance/         → Kanban board
  staffing/            → Staff directory, shift scheduling
  vacancy-alerts/      → Threshold-based vacancy detection
  operator/turnovers/  → Unit turnover workflow
  reports/             → Dashboard, management pack
  quarterly-reports/   → AI-generated quarterly reports
  analytics/           → Portfolio analytics
  lp-comparison/       → Cross-LP comparison
  trends/              → Time-series analysis
  cash-flow/           → Cash flow projections
  debt-maturity/       → Debt schedule
  tax-documents/       → K-1 documents
  documents/           → Document hub
  ai/                  → Chat assistant
  area-research/       → Neighbourhood analysis
  property-managers/   → PM management
  operator/            → Operator management
  etransfers/          → Payment tracking
  funding/             → Grants & funding
  settings/            → Platform configuration
```

### Component Organization
```
src/components/
  property/     → 12 tab components (OverviewTab, LifecycleTab, etc.)
  layout/       → Sidebar, Header, MobileMenu
  ui/           → shadcn/ui components (Card, Table, Badge, Dialog, etc.)
```

## 7. Testing

- **284 total tests** (116 comprehensive + 168 AI integration)
- All tests pass against seed data
- Tests cover: auth, onboarding, trends, pro forma, AI, regression, document extraction, AI fallbacks, CSV import, edge cases
