# Living Well Communities Platform — Full Project Vision

## Overview

The **Living Well Communities Platform** is an integrated development, operations, and investor management system for the **Alberta Multiplex LP** — a GP/LP real estate investment vehicle that acquires, develops, and operates purpose-built residential communities.

## Three Housing Verticals (Living Well Brand)

| Brand | Segment | Purpose |
|-------|---------|---------|
| **Recover Well** | Sober/Recovery Housing | Support individuals transitioning through addiction recovery |
| **Study Well** | Student Housing | Structured environments for academic success |
| **Retire Well** | Retirement Housing | Supportive communities for independent seniors |

All three share: bed-based occupancy, community-oriented environments, operating entities, property management, recurring rental revenue, and technology-enabled operations.

## Investment Structure

- **Alberta Multiplex LP** holds all real estate assets
- **General Partner (GP)** manages acquisitions, development, operations, capital raising, and investor relations
- **Limited Partners (LPs)** provide capital and participate in returns
- Structure includes: preferred annual return hurdles, operating income sharing, refinancing proceeds participation, and sale profit participation

## Property Lifecycle (Each Property)

1. **Acquisition** — purchase existing residential property
2. **Interim Operation** — renovate lightly, operate as Living Well community (RecoverWell/StudyWell/RetireWell)
3. **Development Planning** — zoning analysis, building envelope, multiplex design
4. **Construction** — redevelop into multiplex structure (costs vary by timing/scale)
5. **Stabilized Operation** — higher unit density, new rent levels
6. **Exit** — sell individually, sell portfolio, or refinance

## Revenue Model

- **Bed-based rent** (not unit-based) — some rooms have 2 occupants at different rates
- **Rent types**: private pay, government-assisted, shared room, transitional
- **Optional meal plans** — one commercial kitchen per 5 properties in a cluster
- **Three economic layers**: Property LP (owns real estate), Operating Company (runs program), Property Management Company (subcontracted services)

## Key Platform Components

### 1. Property Portfolio Management
- Property master table with individual timelines
- Development stage tracking (acquisition → rental → planning → construction → stabilized → exit)
- Building envelope calculator (lot size × FAR = buildable area)

### 2. Construction Cost Estimation Engine
- **Hard costs**: structure, mechanical, electrical, interior finishes
- **Soft costs**: architecture, engineering, permits, development fees
- **Site costs**: land preparation
- **Financing costs**: construction interest, loan fees
- **Contingency**
- **Time-based cost escalation** (e.g., +4% per year)
- **Kitchen infrastructure costs** (allocated across 5-property clusters)
- Alberta-specific benchmarks ($230-$450/sq ft depending on building type)

### 3. Financial Modeling Engine
- NOI, DSCR, cap rate, IRR, equity multiple
- Development cost projections
- Debt service calculations
- LP waterfall distributions (preferred return hurdles → profit sharing)
- Exit valuation (cap rate method, cost-based, portfolio premium)
- Scenario analysis (best/base/worst case)

### 4. AI Decision Layer (OpenAI Integration)
- **Auto-populate defaults** — enter address + zoning → AI suggests buildable area, unit config, construction cost range, rental income, timeline
- **Assumption validation** — flag unrealistic inputs
- **Compliance guidance** — Alberta assisted living regs, municipal zoning, building codes, fire safety, health authority standards
- **Development process guidance** — rezoning checklists, timeline estimates, missing approval warnings
- **Market intelligence** — rental rates, land prices, construction costs, cap rates, financing rates
- **Macroeconomic monitoring** — interest rates, inflation, materials pricing, population growth
- **Risk detection** — development cost too low, timeline unrealistic, DSCR too tight, aggressive exit assumptions
- **Scenario simulation** — delayed construction, higher rates, lower rents, cost overruns
- **Natural language interaction** — "What happens to IRR if construction costs increase by 10%?"
- **Exit strategy analysis** — comparable sales, portfolio premiums, institutional demand

### 5. Investor Portal
- Secure LP login with access to:
  - Subscription documents and partnership agreements
  - Capital contribution records
  - Quarterly financial reports
  - Development progress updates
  - Tax documentation
- Document upload (subscription agreements, accreditation, banking details)
- Secure messaging with GP team
- **Distribution management**: automated calculation per partnership agreement, eTransfer to bank accounts

### 6. Community Technology Apps
- **RecoverWell App** — approaching pilot (most advanced)
- **Study Well Platform** — under development
- **Retire Well Platform** — design phase
- Shared features: rent payments, maintenance requests, house rules/agreements, community events, communication, resident onboarding
- Data feeds back into central platform (occupancy, payment patterns, maintenance activity, engagement)

### 7. Reporting Dashboards
- Portfolio performance
- Development pipeline
- Occupancy and bed utilization
- Rent collections
- Investor returns
- Operating metrics (cost per resident, staffing costs)

## User Roles (RBAC)

| Role | Access |
|------|--------|
| GP_ADMIN | Full system access |
| OPERATIONS_MANAGER | Community operations, residents, programming |
| PROPERTY_MANAGER | Maintenance, building operations, compliance |
| INVESTOR | Investor portal only |
| RESIDENT | Community app only |

## Current Codebase State (March 2026 — Phase 6 Complete)

- **Backend**: FastAPI + SQLAlchemy + JWT auth + Claude API (Anthropic) integration
- **Frontend**: Next.js 14 + React 18 + TypeScript + Tailwind CSS + shadcn/ui + Recharts
- **Database**: SQLite for dev (auto-fallback), PostgreSQL for production
- **Models**: 60+ SQLAlchemy models covering GP/LP, investors, subscriptions, holdings, distributions, properties, communities, units, beds, residents, debt, development plans, valuations, construction budgets, maintenance, staffing, turnovers, grants, documents, notifications, audit logs
- **Seed data**: 2 LPs, 4 properties, 3 communities, 13 units, 26 beds, 7 residents, 3 investors, demo users (5 roles)
- **Pages**: ~42 frontend pages covering dashboard, investment, portfolio (12 property tabs), investors, communities, operations, reporting, analytics, AI chat, documents, admin
- **API Endpoints**: ~156 endpoints across 13 route modules
- **Tests**: 284 passing tests (116 comprehensive + 168 AI integration)
- **Completion**: ~160 DONE / 8 PARTIAL / 1 NOT DONE out of ~170 items

## Development Roadmap (from ChatGPT conversation)

### Phase 1 (6-9 months): Foundation + Pilot
- Complete RecoverWell App pilot
- Central property database
- Construction cost estimation module v1
- Basic financial modeling
- Investor portal v1

### Phase 2 (6-12 months): Portfolio Management + Expansion
- Study Well platform deployment
- Portfolio-level analytics
- Enhanced development planning
- Automated distribution management
- Property management integration

### Phase 3 (6-9 months): AI Integration
- AI scenario analysis
- Automated error detection
- Market intelligence feeds
- Regulatory awareness tools

### Phase 4: Mature Ecosystem
- Retire Well platform launch
- Full app ↔ platform integration
- Enhanced investor dashboards
- Expanded automation
