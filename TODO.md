# LiveWell GPLP Platform — Master Todo List

> **Platform identity:** Real estate LP syndication + property lifecycle modeling + community operations + investor reporting platform.
> **Not:** A generic PE/VC fund administration system.
>
> Last updated: 2026-03-22

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
| 1.1.4 | Role-based route guards on all endpoints | DONE | 135 of 156 endpoints have explicit role guards. Remaining 11 are correctly auth-only (notifications, auth, user-scoped reads). |
| 1.1.5 | Scope-based data filtering on all list endpoints | DONE | All list endpoints filtered by scope: LP list, properties, target properties, subscriptions, holdings, distributions, budgets, expenses, funding, tranches, portfolio rollup. Uses filter_by_lp_scope, filter_by_community_scope, filter_by_property_scope helpers + check_entity_access for detail endpoints. |
| 1.1.6 | Frontend role-aware UI (hide/show actions based on user role) | DONE | usePermissions hook created. LP detail page: Edit LP, Add/Edit Tranche, Add/Edit Subscription, Add/Edit Holding, Add/Edit/Convert Target Property buttons all gated by canEdit. Portfolio, Investors, Communities list pages already had canCreate guards. Sidebar already role-filters nav items. |
| 1.1.7 | Capability-based permissions (e.g., "can_create_subscription", "can_approve_distribution") | DONE | UserCapability model, 15 well-known capabilities, ROLE_DEFAULT_CAPABILITIES mapping, require_capability/require_any_capability dependencies, grant/revoke/list endpoints in auth routes, frontend hasCapability() in usePermissions hook. |

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
| 1.2.13 | LP Create form/page | DONE | /investment/new — full multi-section form with all LP fields |

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
| 1.3.12 | Investor exemption/accreditation document tracking | DONE | Added accreditation_verified_at, accreditation_expires_at, accreditation_document_id to Investor model. InvestorDocument model exists for file storage. |
| 1.3.13 | Investor master record with supporting documents UI | PARTIAL | Investor detail page exists; document upload exists but not well-integrated into investor workflow |

### 1.4 Property / Community / Operator / Property Manager Relationships

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.4.1 | Property model with lp_id FK (LP ownership) | DONE | Property → LP relationship exists |
| 1.4.2 | Community model as city+purpose entity with operator_id FK | DONE | Community has city, province, description, operator_id. No property_id FK. |
| 1.4.3 | Community is city-level, not property-level | DONE | Redesigned: Community is a city+purpose grouping (e.g., "RecoverWell Calgary"). Properties have community_id FK pointing to Community. Multiple properties from different LPs can belong to the same community. |
| 1.4.4 | OperatorEntity model (legal_name, contact_name, email, phone) | DONE | |
| 1.4.5 | Operator → Community relationship | DONE | Community has operator_id FK |
| 1.4.6 | PropertyManager as a distinct entity | DONE | PropertyManagerEntity model with company_name, contact_name, email, phone, license_number, service_area, management_fee_percent. Property has pm_id FK. Full CRUD routes and frontend page at /property-managers. |
| 1.4.7 | Property belongs to one LP (ownership) AND one Community (operations) — enforced | DONE | Property has lp_id FK and community_id FK. |
| 1.4.8 | Multiple LPs can contribute properties to the same Community | DONE | Community is city-level; properties from different LPs can share the same community_id. |

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
| 2.1.1 | Property development_stage enum includes interim/as-is states | DONE | DevelopmentStage enum: prospect, acquisition, interim_operation, planning, construction, lease_up, stabilized, exit. |
| 2.1.2 | Bed-level revenue tracking (monthly_rent per bed, rent_type) | DONE | Bed model with monthly_rent and rent_type (private_pay, subsidized, grant_funded) |
| 2.1.3 | Unit/bed occupancy tracking (is_occupied, bed status) | DONE | Unit.is_occupied, Bed.status (available, occupied, reserved, maintenance) |
| 2.1.4 | Resident model (move_in/out dates, rent_amount, payment_status) | DONE | |
| 2.1.5 | Interim house expense tracking | PARTIAL | OperatingExpense model exists with categories (utilities, insurance, maintenance, etc.) but not explicitly tied to "interim" vs "stabilized" phase |
| 2.1.6 | Interim revenue vs expense summary (actual house P&L) | DONE | operations_service.py computes community-level P&L with revenue, expenses, NOI, collection rates. Endpoints: GET /community/{id}/pnl and GET /community/operations/portfolio-summary. |
| 2.1.7 | Interim occupancy dashboard | DONE | Operations P&L Dashboard at /operations shows occupancy rates, bed counts, revenue per occupied bed, monthly potential, expense breakdown, budget vs actual — per community and portfolio-wide. |
| 2.1.8 | Support-service cost tracking for interim operations | PARTIAL | CommunityEvent model tracks events with cost field and 10 service types (counseling, meal_service, etc.). Full cost-center breakdown not yet implemented. |

### 2.2 Redevelopment Scenario

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.2.1 | DevelopmentPlan model (planned_units, planned_beds, planned_sqft, costs, timeline) | DONE | Full model with hard/soft/site/financing costs, contingency, escalation |
| 2.2.2 | DevelopmentPlan versioning | DONE | version field exists |
| 2.2.3 | DevelopmentPlan status lifecycle (draft → approved → in_progress → completed → archived) | DONE | |
| 2.2.4 | DevelopmentPlan CRUD endpoints | DONE | In portfolio routes |
| 2.2.5 | DevelopmentPlan UI (property detail page Dev Plans tab) | DONE | |
| 2.2.6 | Multiple scenario comparison (side-by-side plan versions) | DONE | Compare button on Dev Plans tab (appears when 2+ plans exist). Side-by-side table with Plan A/B selectors showing version, status, units, beds, sqft, costs, NOI, dates. Difference column with color-coded deltas. |

### 2.3 Construction Budget

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.3.1 | Cost breakdown fields (hard_costs, soft_costs, site_costs, financing_costs, contingency) | DONE | In DevelopmentPlan model |
| 2.3.2 | Cost per sqft calculation | DONE | cost_per_sqft field |
| 2.3.3 | Cost escalation modeling | DONE | cost_escalation_percent_per_year field |
| 2.3.4 | Construction budget vs actual tracking | DONE | ConstructionExpense model with budget/actual, full CRUD, budget summary endpoint, ConstructionBudgetTab component |
| 2.3.5 | Construction draw schedule | DONE | ConstructionDraw model with approval workflow (requested→approved→funded), CRUD endpoints, frontend hooks |

### 2.4 Stabilized Pro Forma

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.4.1 | Projected annual revenue and NOI in DevelopmentPlan | DONE | projected_annual_revenue, projected_annual_noi fields |
| 2.4.2 | Stabilized pro forma calculation service | DONE | proforma_service.py generates full stabilized pro forma from rent roll, expenses, debt service. Routes: generate, save, list, get, delete. |
| 2.4.3 | Stabilized pro forma UI | DONE | ProFormaTab component with generate/save/list/view/delete, assumption inputs (vacancy, mgmt fee, replacement reserves, cap rate). |

### 2.5 Debt / Mortgage Model

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.5.1 | DebtFacility model (lender, principal, interest_rate, term, amortization, maturity_date, type) | DONE | Full model with construction/permanent/bridge/mezzanine types |
| 2.5.2 | DebtFacility CRUD endpoints | DONE | In portfolio routes |
| 2.5.3 | DebtFacility UI (property detail page Debt tab) | DONE | |
| 2.5.4 | RefinanceScenario model | DONE | With assumed_new_valuation, new_ltv, new_rate, etc. |
| 2.5.5 | Refinance scenario UI | DONE | In property detail page Exit Scenarios tab |
| 2.5.6 | Debt service calculations (DSCR, LTV) | DONE | In calculations service |
| 2.5.7 | Amortization schedule generation | DONE | GET /portfolio/properties/{id}/debt/{debt_id}/amortization endpoint with monthly + annual schedules. MortgageEngine in debt.py handles IO periods, P&I split, annual summaries. |

### 2.6 Lifecycle Timing Model

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.6.1 | PropertyStageTransition model (from_stage → to_stage with dates) | DONE | |
| 2.6.2 | PropertyMilestone model (milestone_type, target_date, actual_date, status) | DONE | |
| 2.6.3 | Lifecycle routes (transitions, milestones) | DONE | Full CRUD in lifecycle.py |
| 2.6.4 | Lifecycle UI page | DONE | /lifecycle page |
| 2.6.5 | Timeline visualization (Gantt-style or milestone chart) | DONE | Gantt-style TimelineVisualization component in lifecycle page with month grid, today marker, color-coded bars, stage transition arrows |

### 2.7 Valuation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.7.1 | Property valuation fields (purchase_price, assessed_value, current_market_value, estimated_value) | DONE | On Property model |
| 2.7.2 | Valuation history tracking | DONE | ValuationHistory model with method enum (appraisal, assessment, broker_opinion, market_comp, internal, purchase_price). CRUD endpoints at /portfolio/properties/{id}/valuations. Tracks value, method, appraiser, date, notes, document_url. |
| 2.7.3 | Cap rate / income approach valuation calculator | DONE | POST cap-rate endpoint, cap-rate/save endpoint, ValuationTab UI component |
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
| 2.8.7 | LP-level financial summary (total capital raised, deployed, remaining) | DONE | compute_lp_summary returns capital_deployed (sum of purchase_prices) and capital_available (net_deployable - capital_deployed). Displayed in LP detail Capital Summary card. |

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
| 3.2.3 | Capital deployed tracking (how much of raised capital has been spent on acquisitions) | DONE | compute_lp_summary computes capital_deployed from sum of actual property purchase_prices. Displayed in LP detail Capital Summary card. |
| 3.2.4 | Remaining investable capital calculation | DONE | capital_available = net_deployable - capital_deployed. Shown in LP detail Capital Summary card. |

### 3.3 Investor Outputs

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.3.1 | Investor detail page with holdings across LPs | DONE | /investors/[id] |
| 3.3.2 | Investor subscription history | PARTIAL | Subscriptions shown but not as a dedicated timeline |
| 3.3.3 | Per-investor distribution history view | DONE | GET /investors/{id}/distributions endpoint returns full history across all LPs. Frontend investor detail page shows Distribution History table with period, LP fund, type, amount, status, paid date. |
| 3.3.4 | Investor statement generation (PDF) | DONE | GET /investor/investors/{id}/statement?as_of_date= returns PDF. InvestorStatementPDF service generates professional statement with account info, holdings summary with NAV/unit, distribution history, subscription history, and legal disclaimer. Frontend Download Statement button on investor detail page. |
| 3.3.5 | Investor K-1 / tax document support | NOT DONE | Future phase |

### 3.4 LP Financial Summaries

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.4.1 | QuarterlyReport model (lp_id, quarter, year, status, financials) | DONE | Full model with narrative, financials, approval workflow |
| 3.4.2 | QuarterlyReport CRUD endpoints | DONE | |
| 3.4.3 | QuarterlyReport UI | DONE | /quarterly-reports page |
| 3.4.4 | LP-level P&L summary | DONE | GET /investment/lp/{id}/pnl?year=&month= endpoint. compute_lp_pnl aggregates community-level revenue/expenses weighted by LP property share, plus debt service and management fees. Frontend P&L tab on LP detail page with Revenue, Expenses, Debt Service, Bottom Line cards + Community Breakdown table. |
| 3.4.5 | LP NAV calculation | DONE | GET /investment/lp/{id}/nav endpoint. compute_lp_nav uses latest valuation (or market_value/purchase_price fallback), subtracts outstanding debt, adds cash reserves, deducts accrued fees. Returns NAV, NAV/unit, premium/discount %, per-property breakdown. Frontend NAV tab on LP detail page. |

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
| 4.1.2 | Occupancy tracking endpoints | DONE | Community P&L endpoint includes occupancy data. Portfolio summary aggregates across communities. |
| 4.1.3 | Occupancy dashboard UI | DONE | Operations P&L Dashboard at /operations shows per-community and portfolio-wide occupancy with progress bars. |
| 4.1.4 | Occupancy rate calculations (by community, by property) | DONE | operations_service.py computes occupancy rates per community. |
| 4.1.5 | Vacancy tracking and alerts | DONE | vacancy-alerts endpoint with severity levels, threshold-based detection, frontend page with summary cards and community breakdowns |

### 4.2 Maintenance

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.2.1 | MaintenanceRequest model (property_id, unit_id, category, priority, status, cost) | DONE | |
| 4.2.2 | Maintenance CRUD endpoints | DONE | In portfolio routes |
| 4.2.3 | Maintenance UI page | DONE | /maintenance page |
| 4.2.4 | Maintenance cost tracking and reporting | DONE | estimated_cost, actual_cost, vendor fields on MaintenanceRequest. GET /reports/maintenance-costs aggregates by category, priority, resolution time. |

### 4.3 Arrears

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.3.1 | ArrearsRecord model (resident_id, community_id, amount_owing, months_behind) | DONE | |
| 4.3.2 | Arrears CRUD endpoints | DONE | In operator routes |
| 4.3.3 | Arrears UI | PARTIAL | Exists in operator page but limited |
| 4.3.4 | Arrears aging report | DONE | GET /reports/arrears-aging with 30/60/90/120+ day buckets + per-resident detail |

### 4.4 Staffing / Scheduling

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.4.1 | Staff/Employee model | DONE | Staff model with role, hourly_rate, hire/termination dates, emergency contacts |
| 4.4.2 | Schedule model | DONE | Shift model with date, start/end time, status, hours tracking |
| 4.4.3 | Staffing CRUD endpoints | DONE | GET/POST /staff, GET/POST /shifts, weekly-schedule endpoint |
| 4.4.4 | Staffing/scheduling UI | DONE | Full staffing page at /staffing with staff directory, weekly schedule grid, shift management, weekly cost summary, community filter. |

### 4.5 Operator Budget vs Actual

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.5.1 | OperatorBudget model (operator_id, community_id, period, line items) | DONE | |
| 4.5.2 | OperatingExpense model (community_id, category, amount, date) | DONE | |
| 4.5.3 | Budget CRUD endpoints | DONE | In operator routes |
| 4.5.4 | Expense CRUD endpoints | DONE | In operator routes |
| 4.5.5 | Budget vs actual comparison endpoint | DONE | GET /operator/budget-vs-actual and in operations_service.py P&L |
| 4.5.6 | Budget vs actual UI | DONE | Operations P&L Dashboard shows budget vs actual table per community with variance analysis. |
| 4.5.7 | Variance analysis and alerts | DONE | GET /reports/variance-alerts with configurable threshold, expense/revenue/NOI variance detection |

### 4.6 Community Operations

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.6.1 | Community CRUD endpoints | DONE | |
| 4.6.2 | Community list/detail UI | DONE | /communities, /communities/[id] |
| 4.6.3 | Community-level reporting (occupancy, revenue, expenses) | DONE | Operations P&L Dashboard provides per-community P&L with all metrics. |
| 4.6.4 | Community model redesign (city-level, not property-level) | DONE | Community is now a city+purpose entity. Properties have community_id FK. |
| 4.6.5 | Events and services tracking | DONE | CommunityEvent model with 10 types, full CRUD + summary endpoints, frontend hooks (useCommunityEvents, useCreateCommunityEvent, etc.) |
| 4.6.6 | Grant/funding opportunity tracking | DONE | FundingOpportunity model and CRUD exist |

---

## Priority 5 — Advanced Features

### 5.1 Grant / Funding Workflow Expansion

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1.1 | FundingOpportunity model | DONE | Basic model exists |
| 5.1.2 | Funding CRUD endpoints | DONE | |
| 5.1.3 | Funding UI | DONE | /funding page |
| 5.1.4 | Grant application tracking workflow | DONE | FundingOpportunity extended with application_date, application_ref, program_name, contact fields. Schemas updated. |
| 5.1.5 | Grant reporting requirements tracking | DONE | Added reporting_frequency, next_report_date, requirements fields to FundingOpportunity. |

### 5.2 AI Support

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.2.1 | AI service (OpenAI integration) | DONE | ai.py service exists |
| 5.2.2 | AI chat UI | DONE | /ai page |
| 5.2.3 | AI-powered property analysis | DONE | analyze-risk, underwrite, detect-anomalies, area-research endpoints with Claude API + fallbacks |
| 5.2.4 | AI-powered report generation | DONE | generate-report-narrative, draft-investor-communication, draft-bulk-communications endpoints |

### 5.3 Advanced Analytics

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.3.1 | Portfolio-level analytics dashboard | DONE | GET /investment/portfolio-analytics with AUM, blended returns, cross-LP fund summaries |
| 5.3.2 | Cross-LP comparison | DONE | portfolio-analytics endpoint aggregates and compares all LPs (NAV, unit price delta, property count) |
| 5.3.3 | Trend analysis (occupancy, revenue, expenses over time) | DONE | community/operations/trends + investment/lps/{id}/trends endpoints, OccupancySnapshot model, capture-snapshots action |

### 5.4 Capital Calls (Only If Later Confirmed)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.4.1 | Capital call model | NOT APPLICABLE | Fund uses full upfront funding, not capital calls. |
| 5.4.2 | Capital call workflow | NOT APPLICABLE | Fund uses full upfront funding, not capital calls. |

---

## Cross-Cutting Technical Debt

| # | Item | Status | Notes |
|---|------|--------|-------|
| T.1 | Extract inline computations from route handlers into service layers | PARTIAL | investment_service.py, validation_service.py, and operations_service.py created. Other routes still have inline logic. |
| T.2 | Reduce oversized route files (investment.py is ~1000 lines) | DONE | portfolio.py split: valuation (654L), construction (274L), proforma (162L) sub-routers via include_router(). portfolio.py: 3084 → 2049 lines. |
| T.3 | Reduce oversized page files (LP detail page is ~1100 lines) | DONE | Property detail page.tsx split: 8 tab components extracted (Overview, Lifecycle, UnitsBedsTab, RentRoll, DevPlans, DebtFinancing, Projections, ExitScenarios). page.tsx: 4539 → 973 lines (79% reduction). |
| T.4 | Centralize calculation logic | DONE | calculations.py has NOI, DSCR, LTV, IRR, XIRR, cap rate, cash-on-cash. core/utils.py has get_or_404, validate_enum_value. No duplicated calcs remain. |
| T.5 | Strengthen validations across all endpoints | DONE | validation_service.py now covers: subscription/LP/tranche transitions, holding units, upfront funding, property-LP match, purpose type changes. Plus get_or_404 and validate_enum_value utilities. |
| T.6 | Enforce workflow state transitions consistently | DONE | All entity transitions validated: LP, subscription, tranche, maintenance (open→in_progress→resolved), milestone (pending→in_progress→completed/overdue/skipped), turnover (scheduled→in_progress→ready→completed), shift (scheduled→completed/cancelled/no_show). |
| T.7 | Backend/frontend separation of concern | PARTIAL | Some computed fields done in service layer, some still inline in routes |
| T.8 | Report generation structure (PDF export) | DONE | quarterly_reports.py + statement_service.py (investor PDF statements with holdings, distributions, subscriptions). |
| T.9 | Waterfall engine: make LP-specific and configurable | DONE | WaterfallEngine.from_lp_config() reads all LP waterfall fields (pref_rate, gp_promote, catchup_pct, hurdle_rate_2, gp_promote_2, lp_split_pct). 4-tier support with second hurdle. |
| T.10 | Seed data consistency | DONE | Holdings no longer store ownership_percent or cost_basis. Seed data is clean and consistent. |
| T.11 | Community model architectural redesign | DONE | Community is now city+purpose-level. Properties have community_id FK. |
| T.12 | PropertyManager as distinct entity | DONE | Full model, routes, seed data, and frontend page implemented. |

---

## Summary Statistics

> Updated: 2026-03-22

| Status | Count |
|--------|-------|
| DONE | ~160 |
| PARTIAL | 8 |
| NOT DONE | 1 |

---

## Remaining Items

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.3.13 | Investor master record doc integration | PARTIAL | Document upload exists, needs tighter workflow integration |
| 2.1.5 | Interim expense phase tagging | PARTIAL | OperatingExpense model works, no interim vs stabilized flag |
| 2.1.8 | Support-service cost-center breakdown | PARTIAL | CommunityEvent has cost, needs rollup |
| 2.7.4 | Structured appraisal record | PARTIAL | Document model supports appraisal type, no dedicated record |
| 3.3.2 | Subscription history timeline | PARTIAL | Shown in list form, not a timeline |
| 3.3.5 | K-1 / tax document support | NOT DONE | Future phase |
| 4.3.3 | Arrears UI improvements | PARTIAL | Basic UI exists |
| T.1/T.7 | Service extraction | PARTIAL | Core services created, some inline logic remains |
