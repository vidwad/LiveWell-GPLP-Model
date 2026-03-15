# LiveWell GPLP Platform — Master Todo List

> **Platform identity:** Real estate LP syndication + property lifecycle modeling + community operations + investor reporting platform.
> **Not:** A generic PE/VC fund administration system.
>
> Last updated: 2026-03-14

---

## Key Architectural Principles (from user feedback)

1. **LP and Community are separate.** A property belongs to one LP (ownership) and one Community (operations). Multiple LPs may contribute properties into the same city-based community.
2. **Interim house operations are central.** Properties may operate as-is for meaningful periods before redevelopment — with real occupancy, bed-level revenue, and house expenses.
3. **Three distinct system layers:** LP ownership / Community operator / Property manager.
4. **Target and actual portfolios coexist** as first-class concepts within each LP.
5. **Tranche-based subscription funding** — not commitment-and-drawdown capital calls.
6. **LP-specific configurable distribution logic** — not a rigid generic PE waterfall.
7. **Admin-driven subscriptions** — no investor self-service portal for now.

---

## Priority 1 — Foundation

### 1.1 Role / Scope / Capability Permissions

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1.1 | UserRole enum (GP_ADMIN, OPERATIONS_MANAGER, PROPERTY_MANAGER, INVESTOR, RESIDENT) | DONE | 5 roles defined in models.py |
| 1.1.2 | ScopeAssignment model (user → entity_type + entity_id + permission_level) | DONE | Polymorphic FK pattern with view/manage/admin levels |
| 1.1.3 | ScopeAssignment CRUD endpoints | DONE | POST/GET in investment routes |
| 1.1.4 | Role-based route guards on all endpoints | PARTIAL | Only ~16 role checks across all routes. Most endpoints have no role enforcement. |
| 1.1.5 | Scope-based data filtering on all list endpoints | PARTIAL | Only LP list filters by scope for non-GP_ADMIN users. Portfolio, community, operator routes have no scope filtering. |
| 1.1.6 | Frontend role-aware UI (hide/show actions based on user role) | NOT DONE | All UI shows all actions regardless of role. |
| 1.1.7 | Capability-based permissions (e.g., "can_create_subscription", "can_approve_distribution") | NOT DONE | No fine-grained capability system exists. |

### 1.2 LP Model

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.2.1 | GPEntity model (legal_name, management_fee, address, contact) | DONE | |
| 1.2.2 | LPEntity model — core fields (name, legal_name, lp_number, gp_id) | DONE | |
| 1.2.3 | LPEntity — financial fields (target_raise, unit_price, min/max subscription, preferred_return_rate, gp_promote_percent) | DONE | |
| 1.2.4 | LPEntity — fee structure (management_fee_percent, acquisition_fee_percent, disposition_fee_percent) | DONE | |
| 1.2.5 | LPEntity — offering dates (offering_start_date, offering_close_date) | DONE | |
| 1.2.6 | LPEntity — focus fields (city_focus, community_focus, purpose_type) | DONE | |
| 1.2.7 | LPEntity — reserve assumptions (operating_reserve_percent, capital_reserve_percent, financing_cost_percent) | DONE | |
| 1.2.8 | LPEntity — total_units_authorized field | DONE | |
| 1.2.9 | LP status lifecycle (draft → under_review → approved → open_for_subscription → partially_funded → tranche_closed → fully_funded → operating → winding_down → dissolved) | DONE | Enum defined; status transition validation in validation_service.py |
| 1.2.10 | LP CRUD endpoints (create, read, update, list) | DONE | |
| 1.2.11 | LP detail frontend page with Overview tab | DONE | /investment/[lpId] |
| 1.2.12 | LP Edit dialog form | DONE | 22-field dialog |
| 1.2.13 | LP Create form/page | NOT DONE | No "New LP" page or dialog exists. Only edit of existing LPs. |

### 1.3 Investor / Subscription / Holding Model

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.3.1 | Investor model (name, email, phone, investor_type, jurisdiction, tax_id, accreditation_status) | DONE | |
| 1.3.2 | Investor CRUD endpoints | DONE | Full CRUD in investor routes |
| 1.3.3 | Investor list/detail frontend pages | DONE | /investors, /investors/[id], /investors/new |
| 1.3.4 | Subscription model (investor_id, lp_id, tranche_id, commitment_amount, funded_amount, issue_price, unit_quantity, status) | DONE | |
| 1.3.5 | Subscription status lifecycle (draft → submitted → under_review → accepted → funded → issued → closed / rejected) | DONE | Enum defined; transition validation exists |
| 1.3.6 | Subscription CRUD endpoints | DONE | |
| 1.3.7 | Subscription admin UI (list, create, edit dialogs) | DONE | In LP detail page Subscriptions tab |
| 1.3.8 | Holding model (investor_id, lp_id, units_held, average_issue_price, total_capital_contributed, unreturned_capital, unpaid_preferred, is_gp) | DONE | Unit-based primary; ownership_percent computed dynamically |
| 1.3.9 | Holding CRUD endpoints | DONE | |
| 1.3.10 | Holding admin UI (list, create, edit dialogs) | DONE | In LP detail page Holdings tab |
| 1.3.11 | Holding ownership_percent computed from units_held / total_units | DONE | Service layer computes this |
| 1.3.12 | Investor exemption/accreditation document tracking | NOT DONE | Document model exists but no exemption-specific fields or workflow |
| 1.3.13 | Investor master record with supporting documents UI | PARTIAL | Investor detail page exists; document upload exists but not well-integrated into investor workflow |

### 1.4 Property / Community / Operator / Property Manager Relationships

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.4.1 | Property model with lp_id FK (LP ownership) | DONE | Property → LP relationship exists |
| 1.4.2 | Community model with property_id FK and operator_id FK | DONE | Community → Property → LP chain exists |
| 1.4.3 | **CRITICAL: Community is currently property-level, not city-level** | NEEDS REDESIGN | Current: Community has property_id FK (1 community per property). User's intent: Community is a city+purpose grouping (e.g., "Calgary Recovery Community") that contains MULTIPLE properties from potentially different LPs. This is the biggest structural mismatch. |
| 1.4.4 | OperatorEntity model (legal_name, contact_name, email, phone) | DONE | |
| 1.4.5 | Operator → Community relationship | DONE | Community has operator_id FK |
| 1.4.6 | **PropertyManager as a distinct entity/role** | NOT DONE | No PropertyManager model exists. Property management is not separated from operator workflows. The PROPERTY_MANAGER role exists in UserRole enum but has no dedicated model, routes, or UI. |
| 1.4.7 | Property belongs to one LP (ownership) AND one Community (operations) — enforced | PARTIAL | Property → LP exists. Property → Community exists (reverse: Community → Property). But the Community model needs redesign (see 1.4.3). |
| 1.4.8 | Multiple LPs can contribute properties to the same Community | NOT POSSIBLE | Current schema: Community.property_id is a single FK. Need Community as a city-level entity that properties join, not the other way around. |

### 1.5 Target Property vs Actual Property Distinction

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.5.1 | TargetProperty model (hypothetical/planned properties for LP pipeline) | DONE | Full model with 40+ underwriting fields |
| 1.5.2 | TargetProperty CRUD endpoints | DONE | |
| 1.5.3 | TargetProperty admin UI (list, create, edit dialogs) | DONE | In LP detail page Pipeline tab |
| 1.5.4 | Target → Actual Property conversion endpoint | DONE | POST /convert endpoint |
| 1.5.5 | Target → Actual Property conversion UI (Convert button) | DONE | Button on each pipeline card |
| 1.5.6 | TargetProperty status lifecycle (prospect → under_evaluation → under_offer → due_diligence → approved → converted → dropped) | DONE | |

---

## Priority 2 — Core Property and LP Modeling

### 2.1 Interim Operating Model (Pre-Redevelopment)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1.1 | Property development_stage enum includes interim/as-is states | PARTIAL | Stages: prospect, pre_development, construction, lease_up, stabilized. Missing an explicit "interim_operations" or "as_is_operating" stage. |
| 2.1.2 | Bed-level revenue tracking (monthly_rent per bed, rent_type) | DONE | Bed model with monthly_rent and rent_type (private_pay, subsidized, grant_funded) |
| 2.1.3 | Unit/bed occupancy tracking (is_occupied, bed status) | DONE | Unit.is_occupied, Bed.status (available, occupied, reserved, maintenance) |
| 2.1.4 | Resident model (move_in/out dates, rent_amount, payment_status) | DONE | |
| 2.1.5 | Interim house expense tracking | PARTIAL | OperatingExpense model exists with categories (utilities, insurance, maintenance, etc.) but not explicitly tied to "interim" vs "stabilized" phase |
| 2.1.6 | Interim revenue vs expense summary (actual house P&L) | NOT DONE | No endpoint or UI that calculates interim-phase property-level P&L |
| 2.1.7 | Interim occupancy dashboard | NOT DONE | No dedicated view showing current occupancy rates, bed availability, revenue per bed |
| 2.1.8 | Support-service cost tracking for interim operations | NOT DONE | No model for support services (counseling, meals, etc.) as distinct cost items |

### 2.2 Redevelopment Scenario

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.2.1 | DevelopmentPlan model (planned_units, planned_beds, planned_sqft, costs, timeline) | DONE | Full model with hard/soft/site/financing costs, contingency, escalation |
| 2.2.2 | DevelopmentPlan versioning | DONE | version field exists |
| 2.2.3 | DevelopmentPlan status lifecycle (draft → approved → in_progress → completed → archived) | DONE | |
| 2.2.4 | DevelopmentPlan CRUD endpoints | DONE | In portfolio routes |
| 2.2.5 | DevelopmentPlan UI (property detail page Dev Plans tab) | DONE | |
| 2.2.6 | Multiple scenario comparison (side-by-side plan versions) | NOT DONE | Versioning exists but no comparison UI |

### 2.3 Construction Budget

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.3.1 | Cost breakdown fields (hard_costs, soft_costs, site_costs, financing_costs, contingency) | DONE | In DevelopmentPlan model |
| 2.3.2 | Cost per sqft calculation | DONE | cost_per_sqft field |
| 2.3.3 | Cost escalation modeling | DONE | cost_escalation_percent_per_year field |
| 2.3.4 | Construction budget vs actual tracking | NOT DONE | No actual-spend tracking against budget |
| 2.3.5 | Construction draw schedule | NOT DONE | No draw/disbursement model |

### 2.4 Stabilized Pro Forma

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.4.1 | Projected annual revenue and NOI in DevelopmentPlan | DONE | projected_annual_revenue, projected_annual_noi fields |
| 2.4.2 | Stabilized pro forma calculation service | PARTIAL | calculations.py has NOI, DSCR, LTV, IRR calculators. modeling.py has scenario modeling. But no dedicated stabilized pro forma builder. |
| 2.4.3 | Stabilized pro forma UI | PARTIAL | Property detail page shows some projected values. No dedicated pro forma view. |

### 2.5 Debt / Mortgage Model

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.5.1 | DebtFacility model (lender, principal, interest_rate, term, amortization, maturity_date, type) | DONE | Full model with construction/permanent/bridge/mezzanine types |
| 2.5.2 | DebtFacility CRUD endpoints | DONE | In portfolio routes |
| 2.5.3 | DebtFacility UI (property detail page Debt tab) | DONE | |
| 2.5.4 | RefinanceScenario model | DONE | With assumed_new_valuation, new_ltv, new_rate, etc. |
| 2.5.5 | Refinance scenario UI | DONE | In property detail page Exit Scenarios tab |
| 2.5.6 | Debt service calculations (DSCR, LTV) | DONE | In calculations service |
| 2.5.7 | Amortization schedule generation | NOT DONE | No month-by-month amortization table |

### 2.6 Lifecycle Timing Model

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.6.1 | PropertyStageTransition model (from_stage → to_stage with dates) | DONE | |
| 2.6.2 | PropertyMilestone model (milestone_type, target_date, actual_date, status) | DONE | |
| 2.6.3 | Lifecycle routes (transitions, milestones CRUD) | DONE | Full lifecycle.py routes |
| 2.6.4 | Lifecycle UI page | DONE | /lifecycle page |
| 2.6.5 | Timeline visualization (Gantt-style or milestone chart) | NOT DONE | List-based UI only |

### 2.7 Valuation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.7.1 | Property valuation fields (purchase_price, assessed_value, current_market_value, estimated_value) | DONE | On Property model |
| 2.7.2 | Valuation history tracking | NOT DONE | No ValuationHistory model to track changes over time |
| 2.7.3 | Cap rate / income approach valuation calculator | NOT DONE | No automated valuation method |
| 2.7.4 | Appraisal document storage | PARTIAL | Document model exists with "appraisal" type but no structured appraisal record |

### 2.8 LP Roll-up

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.8.1 | Portfolio rollup endpoint (aggregate target + actual property metrics) | DONE | GET /lp/{lp_id}/rollup |
| 2.8.2 | Rollup includes: target property count, total acquisition cost, construction budget, all-in cost, planned units/beds | DONE | |
| 2.8.3 | Rollup includes: actual property count, total purchase price, current market value | DONE | |
| 2.8.4 | Rollup includes: projected equity multiple, cash-on-cash | DONE | |
| 2.8.5 | Rollup UI (Projections tab in LP detail) | DONE | With ESTIMATED/ACTUAL/BLENDED badges |
| 2.8.6 | Combined Expected Portfolio view (actual + target) | DONE | Blended card in Projections tab |
| 2.8.7 | LP-level financial summary (total capital raised, deployed, remaining) | PARTIAL | Capital summary card exists but "deployed" is not tracked as a separate field |

---

## Priority 3 — Funding and Reporting Workflows

### 3.1 Tranche-Based Subscriptions

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.1.1 | LPTranche model (tranche_number, name, target_amount, status, open/close dates) | DONE | |
| 3.1.2 | Tranche status lifecycle (draft → open → closed → cancelled) | DONE | |
| 3.1.3 | Tranche CRUD endpoints | DONE | |
| 3.1.4 | Tranche admin UI (list, create, edit) | DONE | LP detail page Tranches tab |
| 3.1.5 | Subscription → Tranche linkage | DONE | Subscription has tranche_id FK |
| 3.1.6 | Tranche funding progress (raised vs target with progress bar) | DONE | Progress bars in Tranches tab |

### 3.2 LP Funding Progress

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.2.1 | Total capital raised vs target_raise | DONE | Computed in LP detail |
| 3.2.2 | Funding progress visualization | DONE | KPI strip and progress bars |
| 3.2.3 | Capital deployed tracking (how much of raised capital has been spent on acquisitions) | NOT DONE | No capital_deployed field or tracking |
| 3.2.4 | Remaining investable capital calculation | NOT DONE | Depends on 3.2.3 |

### 3.3 Investor Outputs

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.3.1 | Investor detail page with holdings across LPs | DONE | /investors/[id] |
| 3.3.2 | Investor subscription history | PARTIAL | Subscriptions shown but not as a dedicated timeline |
| 3.3.3 | Investor distribution history | NOT DONE | No per-investor distribution view |
| 3.3.4 | Investor statement generation (PDF) | NOT DONE | |
| 3.3.5 | Investor K-1 / tax document support | NOT DONE | Future phase |

### 3.4 LP Financial Summaries

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.4.1 | QuarterlyReport model (lp_id, quarter, year, status, financials) | DONE | Full model with narrative, financials, approval workflow |
| 3.4.2 | QuarterlyReport CRUD endpoints | DONE | |
| 3.4.3 | QuarterlyReport UI | DONE | /quarterly-reports page |
| 3.4.4 | LP-level P&L summary | NOT DONE | No aggregated income/expense view at LP level |
| 3.4.5 | LP NAV calculation | NOT DONE | No net asset value computation |

### 3.5 Target Portfolio Roll-up

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.5.1 | Target portfolio aggregation | DONE | In rollup endpoint |
| 3.5.2 | Projected returns (equity multiple, cash-on-cash) | DONE | |
| 3.5.3 | Target vs actual comparison view | DONE | Side-by-side in Projections tab |

---

## Priority 4 — Operations

### 4.1 Occupancy

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1.1 | Unit/Bed/Resident models | DONE | Full models with occupancy tracking |
| 4.1.2 | Occupancy tracking endpoints | PARTIAL | Community routes exist but occupancy-specific endpoints are limited |
| 4.1.3 | Occupancy dashboard UI | NOT DONE | No dedicated occupancy view |
| 4.1.4 | Occupancy rate calculations (by community, by property) | NOT DONE | |
| 4.1.5 | Vacancy tracking and alerts | NOT DONE | |

### 4.2 Maintenance

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.2.1 | MaintenanceRequest model (property_id, unit_id, category, priority, status, cost) | DONE | |
| 4.2.2 | Maintenance CRUD endpoints | DONE | In portfolio routes |
| 4.2.3 | Maintenance UI page | DONE | /maintenance page |
| 4.2.4 | Maintenance cost tracking and reporting | PARTIAL | Cost field exists but no aggregation/reporting |

### 4.3 Arrears

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.3.1 | ArrearsRecord model (resident_id, community_id, amount_owing, months_behind) | DONE | |
| 4.3.2 | Arrears CRUD endpoints | DONE | In operator routes |
| 4.3.3 | Arrears UI | PARTIAL | Exists in operator page but limited |
| 4.3.4 | Arrears aging report | NOT DONE | |

### 4.4 Staffing / Scheduling

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.4.1 | Staff/Employee model | NOT DONE | No model exists |
| 4.4.2 | Schedule model | NOT DONE | No model exists |
| 4.4.3 | Staffing CRUD endpoints | NOT DONE | |
| 4.4.4 | Staffing/scheduling UI | NOT DONE | |

### 4.5 Operator Budget vs Actual

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.5.1 | OperatorBudget model (operator_id, community_id, period, line items) | DONE | |
| 4.5.2 | OperatingExpense model (community_id, category, amount, date) | DONE | |
| 4.5.3 | Budget CRUD endpoints | DONE | In operator routes |
| 4.5.4 | Expense CRUD endpoints | DONE | In operator routes |
| 4.5.5 | Budget vs actual comparison endpoint | DONE | GET /operator/budget-vs-actual |
| 4.5.6 | Budget vs actual UI | PARTIAL | Operator page exists but comparison view may be limited |
| 4.5.7 | Variance analysis and alerts | NOT DONE | |

### 4.6 Community Operations

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.6.1 | Community CRUD endpoints | DONE | |
| 4.6.2 | Community list/detail UI | DONE | /communities, /communities/[id] |
| 4.6.3 | Community-level reporting (occupancy, revenue, expenses) | NOT DONE | |
| 4.6.4 | **Community model redesign (city-level, not property-level)** | NOT DONE | See 1.4.3 — this is a critical structural change |
| 4.6.5 | Events and services tracking | NOT DONE | No model for community events or support services |
| 4.6.6 | Grant/funding opportunity tracking | DONE | FundingOpportunity model and CRUD exist |

---

## Priority 5 — Advanced Features

### 5.1 Grant / Funding Workflow Expansion

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1.1 | FundingOpportunity model | DONE | Basic model exists |
| 5.1.2 | Funding CRUD endpoints | DONE | |
| 5.1.3 | Funding UI | DONE | /funding page |
| 5.1.4 | Grant application tracking workflow | NOT DONE | |
| 5.1.5 | Grant reporting requirements tracking | NOT DONE | |

### 5.2 AI Support

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.2.1 | AI service (OpenAI integration) | DONE | ai.py service exists |
| 5.2.2 | AI chat UI | DONE | /ai page |
| 5.2.3 | AI-powered property analysis | NOT DONE | |
| 5.2.4 | AI-powered report generation | NOT DONE | |

### 5.3 Advanced Analytics

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.3.1 | Portfolio-level analytics dashboard | NOT DONE | |
| 5.3.2 | Cross-LP comparison | NOT DONE | |
| 5.3.3 | Trend analysis (occupancy, revenue, expenses over time) | NOT DONE | |

### 5.4 Capital Calls (Only If Later Confirmed)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.4.1 | Capital call model | NOT DONE | Not currently required |
| 5.4.2 | Capital call workflow | NOT DONE | Not currently required |

---

## Cross-Cutting Technical Debt

| # | Item | Status | Notes |
|---|------|--------|-------|
| T.1 | Extract inline computations from route handlers into service layers | PARTIAL | investment_service.py and validation_service.py created. Other routes still have inline logic. |
| T.2 | Reduce oversized route files (investment.py is ~1000 lines) | NOT DONE | |
| T.3 | Reduce oversized page files (LP detail page is ~1100 lines) | NOT DONE | |
| T.4 | Centralize calculation logic | PARTIAL | calculations.py exists but some calcs are duplicated |
| T.5 | Strengthen validations across all endpoints | PARTIAL | validation_service.py covers investment routes. Other routes lack validation. |
| T.6 | Enforce workflow state transitions consistently | PARTIAL | LP and subscription transitions validated. Other entities (maintenance, milestones) are not. |
| T.7 | Backend/frontend separation of concern | PARTIAL | Some computed fields done in service layer, some still inline in routes |
| T.8 | Report generation structure (PDF export) | PARTIAL | quarterly_reports.py service exists. No investor statement PDF. |
| T.9 | Waterfall engine: make LP-specific and configurable | PARTIAL | European-style waterfall built. Needs to support LP-specific rule sets, special class/founding LP, refinance/sale proceeds. |
| T.10 | Seed data: remove ownership_percent and cost_basis from holdings | NOT DONE | Seed still has these fields even though model computes them. Seed runs but fields are ignored. |
| T.11 | **Community model architectural redesign** | NOT DONE | Most impactful structural change needed. See 1.4.3. |
| T.12 | PropertyManager as distinct entity | NOT DONE | See 1.4.6. |

---

## Summary Statistics

| Category | Done | Partial | Not Done | Total |
|----------|------|---------|----------|-------|
| Priority 1 — Foundation | 24 | 6 | 5 | 35 |
| Priority 2 — Core Modeling | 22 | 5 | 10 | 37 |
| Priority 3 — Funding & Reporting | 11 | 2 | 6 | 19 |
| Priority 4 — Operations | 10 | 3 | 10 | 23 |
| Priority 5 — Advanced | 5 | 0 | 5 | 10 |
| Technical Debt | 0 | 7 | 5 | 12 |
| **Total** | **72** | **23** | **41** | **136** |

---

## Top 5 Most Impactful Items to Address Next

1. **Community model redesign (1.4.3 / T.11)** — Currently property-level; needs to become city+purpose-level. This is the single biggest architectural mismatch with the user's vision. Affects how properties, operators, and communities relate.

2. **PropertyManager as distinct entity (1.4.6 / T.12)** — The three-layer separation (LP ownership / Community operator / Property manager) is a core architectural principle that is not yet implemented.

3. **Role/scope enforcement across all routes (1.1.4, 1.1.5)** — Most endpoints are unprotected. This is a security and data isolation issue.

4. **Interim operations emphasis (2.1.6, 2.1.7)** — The "as-is house" operating phase needs a dedicated P&L view and occupancy dashboard. This is central to the business model, not secondary.

5. **LP Create form (1.2.13)** — Cannot create new LPs from the UI. Only edit existing ones.
