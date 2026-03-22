# Living Well Communities Platform

Enterprise-scale real estate syndication and community operations platform for the **Alberta Multiplex LP** — a GP/LP investment vehicle that acquires, develops, and operates purpose-built residential communities.

## Three Housing Verticals

| Brand | Segment | Purpose |
|-------|---------|---------|
| **RecoverWell** | Sober/Recovery Housing | Support individuals transitioning through addiction recovery |
| **StudyWell** | Student Housing | Structured environments for academic success |
| **RetireWell** | Retirement Housing | Supportive communities for independent seniors |

## Architecture

Three-layer separation:

1. **LP Ownership** — Legal real estate asset ownership via Limited Partnership vehicle
2. **Community Operator** — Day-to-day program management (residents, staffing, programming)
3. **Property Manager** — Third-party building management (maintenance, rent collection, inspections)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy + Pydantic |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| AI | Claude API (Anthropic) with fallback mock responses |
| Auth | JWT with httpOnly cookies, role-based + scope-based + capability-based permissions |
| Charts | Recharts |
| PDF | fpdf2 (investor statements) |

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python seed.py          # Creates SQLite DB with sample data
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd livingwell-frontend
pnpm install
pnpm dev                # Runs on http://localhost:3000
```

### Login Credentials (seed data)

| Role | Email | Password |
|------|-------|----------|
| GP Admin | `admin@livingwell.ca` | `Password1!` |
| Operations Manager | `ops@livingwell.ca` | `Password1!` |
| Property Manager | `pm@livingwell.ca` | `Password1!` |
| Investor | `investor1@example.com` | `Password1!` |
| Resident | `resident@example.com` | `Password1!` |

### Sample Data (seed.py)

- 2 LP funds (Alberta Multiplex LP I & II)
- 1 GP entity
- 4 properties across Calgary and Red Deer
- 3 communities (RecoverWell Calgary, RecoverWell Red Deer, StudyWell Calgary)
- 13 units, 26 beds, 7 residents
- 3 investors with subscriptions, holdings, and distributions
- Development plans, debt facilities, operating budgets, maintenance requests

## Core Features

### Investment Management (GP/LP Model)

- **GP & LP Entities** — Create and manage multiple fund vehicles with independent terms
- **Configurable Waterfall** — 4-tier distribution engine (preferred return → GP catch-up → profit share → second hurdle); European, American, or custom styles per LP
- **Tranches** — Multi-close fundraising with progress tracking
- **Subscriptions** — Full lifecycle: draft → submitted → under review → accepted → funded → issued → closed
- **Holdings** — Unit-based investor ownership with cost basis, unreturned capital, unpaid preferred return
- **Distribution Events** — Automated waterfall calculation, approval workflow, eTransfer payment tracking
- **NAV** — Net Asset Value per unit with property-level breakdown
- **LP P&L** — Aggregated revenue/expenses weighted by LP property share
- **XIRR & Equity Multiple** — Portfolio-level return metrics
- **Target Property Pipeline** — Track prospects through underwriting to acquisition

### Property Portfolio Management

- **8-Stage Lifecycle** — Prospect → Acquisition → Interim Operation → Planning → Permit → Construction → Lease-Up → Stabilized → Exit
- **Stage Transition Gates** — Configurable validation checks with audit trail
- **Property Details** — Physical specs (type, year built, sqft, bed/bath, style, garage), municipal data (neighbourhood, ward, assessment class, roll number, legal description, coordinates), tax data, MLS/market data
- **Development Plans** — Versioned plans with cost breakdown (hard/soft/site/financing/contingency), side-by-side comparison
- **Construction Budget** — Line-item budget vs actual tracking with variance analysis
- **Construction Draws** — Request → Approved → Funded workflow
- **Property Clusters** — Shared infrastructure (e.g., commercial kitchen serving 5 properties)

### Financial Modeling

- **Pro Forma** — Stabilized income statement projection from rent roll, expenses, debt service; generates NOI, cap rate, returns
- **Lifecycle Projections** — Year-by-year cash flow through 4 phases (as-is → construction → lease-up → stabilized) with occupancy ramp
- **Debt Management** — Mortgage amortization engine with Canadian compounding, interest-only periods, monthly/annual schedules
- **Valuation** — Cap rate calculator, valuation history (appraisal, assessment, broker opinion, market comp, internal)
- **Exit Scenarios** — Refinance scenarios (new LTV, rate, proceeds) and sale scenarios (exit cap rate, cost of sale, net proceeds)
- **Financial Calculations** — NOI, DSCR, LTV, cap rate, IRR, XIRR, equity multiple, cash-on-cash

### Community Operations

- **Bed-Level Revenue** — Atomic revenue unit is the bed (not unit); supports private pay, subsidized, grant-funded rent types
- **Occupancy Tracking** — Real-time bed status (available, occupied, reserved, maintenance)
- **Rent Collection** — Monthly payment recording with arrears tracking (30/60/90/120+ day aging)
- **Resident Management** — Move-in/out, lease tracking, meal plan enrollment
- **Maintenance** — Request workflow (open → in progress → resolved) with priority, vendor assignment, cost tracking
- **Staffing** — Staff directory, shift scheduling, weekly cost summary
- **Operating Budgets** — Budget vs actual variance analysis with alerts
- **Vacancy Alerts** — Threshold-based detection with severity levels
- **Unit Turnovers** — Cleaning → Repairs → Painting → Inspection workflow

### Investor Portal

- **Role-Specific Dashboard** — Holdings, distributions, documents, notifications
- **Waterfall Transparency** — Tier-by-tier calculation visibility
- **PDF Statements** — Professional statements with holdings, NAV/unit, distribution history
- **Document Access** — K-1s, subscription agreements, quarterly reports, partnership agreements
- **Onboarding** — Indication of Interest → subscription → funding workflow with checklist tracking

### Reporting & Analytics

- **Dashboard KPIs** — Portfolio value, NOI, LTV, fund count, occupancy, investor count
- **Fund Performance** — Per-LP capital committed, raised, deployed, equity multiple, XIRR
- **Management Pack** — Monthly: LP summary, property overview, development update, budget issues
- **Quarterly Reports** — AI-generated narratives with revenue, expense, distribution, valuation data
- **Portfolio Analytics** — Cross-LP comparison, AUM, blended returns
- **Cash Flow Projections** — Multi-year portfolio-level projections with rent/expense growth assumptions
- **Trends** — Time-series occupancy, revenue, expense analysis with snapshots
- **Debt Maturity** — Upcoming maturity schedule across all facilities
- **Variance Alerts** — Automated detection of budget/expense/NOI deviations

### AI-Powered Features (Claude API)

- **Chat Assistant** — Multi-turn conversation with full portfolio context awareness; 16+ tools (property details, LP summary, NAV, waterfall simulation, community occupancy, trend data, etc.)
- **Risk Analysis** — Financial, regulatory, market, operational risk assessment with mitigation strategies; includes property age, type, neighbourhood, assessment class context
- **Underwriting** — Acquisition memo generation from property data
- **Property Defaults** — AI-suggested zoning analysis (unit count, buildable area, construction cost range)
- **Document Extraction** — Structured data from PDFs (appraisals, leases, insurance, tax assessments, purchase agreements, mortgages) with confidence scoring
- **Area Research** — Neighbourhood analysis, demographics, comparable properties
- **Anomaly Detection** — Trend-based identification of unusual patterns in rent, expenses, occupancy
- **Report Narratives** — AI-generated quarterly report narratives and investor communications

### Document Management

- **14 Property Document Categories** — Appraisals, insurance, title, surveys, environmental, permits, inspections, purchase agreements, leases, construction contracts, mortgages, tax assessments, photos, other
- **Investor Documents** — K-1, subscription agreements, partnership agreements, quarterly reports, capital call notices, distribution notices
- **Expiry Tracking** — Alerts for documents expiring within 90 days
- **AI Extraction** — Automatic structured data extraction with confidence scoring
- **Document Hub** — Centralized search and filtering across all properties

### Notifications

- In-app notification inbox with read/unread status
- Types: distribution, stage transition, document upload, onboarding, system alerts
- Broadcast capability to all LP investors

### Platform Settings

- API key management (Claude AI, Google Maps, MLS/IDX via Repliers)
- AI model selection (Sonnet, Opus, Haiku)
- eTransfer configuration
- Grant & funding opportunity tracking

## User Roles & Access

| Role | Access Scope | Key Capabilities |
|------|-------------|-----------------|
| **GP Admin** | All LPs, all properties | Full system access, fund management, investor relations, distribution approval |
| **Operations Manager** | Assigned LP(s) and communities | Community operations, resident management, budgets, maintenance |
| **Property Manager** | Assigned properties | Maintenance queue, unit turnovers, rent collection, inspections |
| **Investor** | Their LP holdings only | Holdings, distributions, statements, documents |
| **Resident** | Their community/unit only | Maintenance requests, community info |

### Capability-Based Permissions (15)

`view_financials`, `manage_properties`, `approve_distributions`, `manage_debt`, `manage_construction`, `manage_staff`, `manage_residents`, `manage_investors`, `create_reports`, `manage_grants`, `manage_documents`, `transition_stages`, `manage_valuations`, `manage_waterfall`, `admin_users`

## API Endpoints (~156 endpoints)

| Module | Prefix | Key Areas |
|--------|--------|-----------|
| Auth | `/api/auth` | Login, register, refresh, capabilities |
| Investment | `/api/investment` | GP, LP, tranches, subscriptions, holdings, distributions, waterfall, NAV, P&L |
| Portfolio | `/api/portfolio` | Properties, units, beds, development plans, debt, pro forma, valuations, construction |
| Community | `/api/community` | Communities, residents, rent payments, maintenance, events |
| Investor | `/api/investor` | Investor CRUD, dashboard, statements, onboarding, IOI |
| Lifecycle | `/api/lifecycle` | Stage transitions, milestones, quarterly reports, eTransfers |
| Operator | `/api/operator` | Budgets, expenses, turnovers, arrears, staff, shifts |
| Reports | `/api/reports` | Fund performance, management pack, summary, cash flow, variance, arrears aging |
| AI | `/api/ai` | Chat, risk analysis, underwriting, area research, anomaly detection, document extraction |
| Documents | `/api/documents` | Upload, download, property docs, investor docs |
| Calculations | `/api/calculations` | NOI, DSCR, LTV, IRR, financial summary |
| Notifications | `/api/notifications` | List, read, read-all |
| Settings | `/api/settings` | Platform configuration |

## Frontend Pages (~42 pages)

| Section | Pages |
|---------|-------|
| Dashboard | Role-specific home (GP: portfolio KPIs + returns + capital stack chart; Investor: holdings + distributions; PM: assigned properties; Resident: community info) |
| Investment | LP funds list, LP detail (7 tabs: overview, subscriptions, holdings, tranches, pipeline, P&L, NAV, projections), LP create, distributions |
| Portfolio | Properties list (grid/list view), property detail (12 tabs: overview, lifecycle, units/beds, rent roll, dev plans, construction budget, debt/financing, projections, exit scenarios, valuation, pro forma, area research), property create |
| Investors | Investor list (grid/table), investor detail, investor create, CRM & onboarding |
| Operations | Operations P&L, vacancy alerts, maintenance (kanban), staffing, unit turnovers, arrears aging, variance alerts |
| Reporting | Reports dashboard, quarterly reports, cash flow, debt maturity, K-1 tax docs, documents hub |
| Analytics | Portfolio analytics, LP comparison, trends |
| AI | Chat assistant with suggested questions and tool-use display, area research |
| Admin | Operators, property managers, eTransfers, grants & funding, settings |

## Project Status

> Updated: 2026-03-22

| Status | Count |
|--------|-------|
| DONE | ~160 |
| PARTIAL | 8 |
| NOT DONE | 1 |

See [TODO.md](TODO.md) for the detailed item-by-item breakdown.

## Documentation

| Document | Description |
|----------|-------------|
| [TODO.md](TODO.md) | Master task list with item-by-item status |
| [docs/Gap_Analysis_Report.md](docs/Gap_Analysis_Report.md) | Blueprint vs implementation gap analysis |
| [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md) | Handoff document for Claude continuation |
| [docs/project_vision.md](docs/project_vision.md) | Full project vision and roadmap |
| [docs/architecture.md](docs/architecture.md) | System architecture overview |
| [docs/Claude_Handoff_Phase5.md](docs/Claude_Handoff_Phase5.md) | Phase 5 handoff (financial engines) |
| [docs/Claude_Handoff_Phase6.md](docs/Claude_Handoff_Phase6.md) | Phase 6 handoff (frontend for engines) |

## Tests

```bash
cd backend
python seed.py && python test_comprehensive.py     # 116 tests
python seed.py && python test_ai_integration.py     # 168 tests
# Total: 284 tests, all passing
```
