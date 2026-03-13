# Alberta Multiplex / Living Well Platform
## Blueprint Review, Codebase Comparison, and Remediation Package

**Date:** March 13, 2026
**Author:** Manus AI
**Source of Truth:** Comprehensive Master Platform Blueprint (155 pages)
**Review Framework:** Structured Discrepancy Matrix and Code-Comparison Framework (23 pages)
**Current Codebase:** `vidwad/LiveWell-GPLP-Model` (Post-Sprint 3, Sprint 4 spec pending)

---

## A. Executive Assessment Memo

### 1. Overall Current-State Fit

The current codebase represents a functional early prototype that successfully demonstrates a working authentication system, basic property and community management, a bed-level revenue model, a construction cost estimation engine with Alberta benchmarks, a 3-tier waterfall distribution engine, and a structured AI assistant. It is built on a sound technology stack (FastAPI, SQLAlchemy, Next.js, Tailwind, shadcn/ui) and demonstrates competent engineering.

However, when measured against the Comprehensive Master Platform Blueprint, the current implementation diverges from the target architecture at a **foundational level**. The divergence is not a matter of missing features or incomplete screens. It is a structural misframing of the core business model. The platform as designed in the blueprint is a **multi-entity real estate investment, operations, redevelopment, and reporting system** organized around LP-level economic segregation. The current app is built as a **property management tool with an investor sidebar**, which is a fundamentally different product.

### 2. Major Architectural Mismatch Areas

**LP Entity Architecture (Critical).** The blueprint's single most important structural requirement is that each LP is a hard economic boundary. The current codebase has no `LP` entity. Investors hold `Ownership` records linked directly to `Property` records. There is no subscription workflow, no holding model, no LP-level fee logic, no LP-level reporting boundary, and no LP-level distribution segregation. This is not a gap that can be patched. The entire investment data flow is wired incorrectly.

**Scope-Based Permissions (Critical).** The blueprint requires that users see only the data within their assigned scope (e.g., an operator sees only their community, an investor sees only their LP holdings). The current system uses a flat `UserRole` enum with global visibility at each role level. A `GP_ADMIN` sees everything, an `OPERATIONS_MANAGER` sees everything, and an `INVESTOR` sees all investors. There is no `ScopeAssignment` model, no entity-level access control, and no mechanism to restrict a property manager to their assigned city or properties.

**Debt and Financing Architecture (Critical).** The blueprint requires a complete debt facility model with term structure, amortization schedules, maturity tracking, refinance logic, and sale/disposition handling. The current codebase has no debt-related models, no mortgage calculations, and no amortization logic. This makes it impossible to generate accurate stabilized pro formas, LP roll-ups, or investor return calculations, because debt service is a core input to all downstream financial outputs.

**Subscription and Holding Architecture (Critical).** The blueprint requires a formal investment lifecycle: Subscription (with workflow states: draft, submitted, under review, accepted, funded, issued, closed) leading to a Holding (the actual equity position in an LP). The current system uses a flat `CapitalContribution` table and a percentage-based `Ownership` table, neither of which supports LP-specific segregation, subscription state tracking, or holding-based distribution allocation.

**Interim vs. Stabilized Operations (High).** The blueprint distinguishes between interim operations (the holding period before redevelopment, especially important for sober living properties generating revenue during planning) and stabilized operations (post-construction). The current codebase has a `DevelopmentStage` enum but does not model interim operating assumptions, interim cash flows, or the transition between phases.

### 3. Recommended Path

The current app is best approached through a **selective rebuild of core modules**. Specifically:

The **UI shell** (Next.js, Tailwind, shadcn/ui components, authentication flow, sidebar navigation pattern) should be **kept**. It is well-built and can be adapted to the correct data model.

The **operational layer** (Units, Beds, Residents, Maintenance Requests, Rent Payments, Community structure) should be **kept with minor refactoring**. It correctly models the physical reality of the properties and is aligned with the blueprint's community operations design.

The **calculation engines** (CostEstimator, WaterfallEngine) should be **kept and refactored** to consume data from the corrected entity structure rather than generic inputs.

The **investment and ownership layer** (Investor, Ownership, CapitalContribution, Distribution, EconomicEntity) must be **replaced** with the correct LP/Subscription/Holding/DistributionEvent architecture.

The **permission system** must be **replaced** with a scope-aware model.

The **financial modeling layer** must be **expanded significantly** with new engines for debt, interim operations, stabilized pro formas, LP roll-up, and lifecycle projections.

### 4. Biggest Risk Areas if Left As-Is

If the current implementation continues without foundational correction, the following risks are near-certain:

The platform will be unable to support more than one LP without commingling investor capital, distributions, and reporting. This is a legal and regulatory risk for a real investment vehicle.

Investor-facing outputs (dashboards, reports, distribution statements) will be inaccurate because they cannot account for debt service, LP fees, or LP-specific economics.

Operators and property managers will see data they should not have access to, because the permission model has no scope boundaries.

Financial reports cannot be frozen or versioned, meaning historical statements will retroactively change as new data is entered.

---

## B. Full Module-by-Module Discrepancy Matrix

### Step 1: Foundation and Access

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Authentication / User System | Secure JWT-based auth with user profiles, active/inactive status. | JWT access/refresh token flow with `User` model (email, hashed_password, full_name, role, is_active). Login, register, refresh, and /me endpoints. | Functionally complete for current needs. | Low | Strong fit | Keep | P1 | None | Solid implementation. |
| Role Model | Roles for GP Partner, LP Investor, Property Manager (by city), Sober Living Operator (by community), Student Housing Operator, Retirement Living Operator. | Five roles: `GP_ADMIN`, `OPERATIONS_MANAGER`, `PROPERTY_MANAGER`, `INVESTOR`, `RESIDENT`. | Missing operator-type roles (Sober Living Operator, Student Housing Operator, Retirement Operator). Current roles are too coarse. | High | Partial fit | Refactor | P1 | None | Add operator sub-roles or use scope to differentiate. |
| Scope Assignment Model | Users must be assigned to specific entities (LPs, Communities, Properties). Visibility and actions restricted to assigned scope. | Does not exist. All users at a given role level see all data globally. | Entirely missing. No `ScopeAssignment` table, no entity-level filtering in queries. | Critical | Incompatible | Replace | P1 | Role Model | Foundational blocker. Every query must be scope-filtered. |
| Capability Permission Model | Fine-grained capabilities beyond role (e.g., can_approve_distributions, can_publish_reports). | `require_roles()` helper in `deps.py` checks role membership only. | No capability-level permissions. Authorization is role-only. | Medium | Weak fit | Refactor | P1 | Scope Model | Can be layered on after scope is implemented. |
| Audit Trail / History Model | High-risk actions must be auditable (who changed what, when). | Does not exist. No audit log table, no change tracking. | Entirely missing. | Medium | Incompatible | Replace | P1 | User Model | Important for financial governance. |
| Document Access Inheritance | Documents should inherit access rules from their parent entity (LP, Property, Community). | `InvestorDocument` exists but is linked only to Investor. No entity-polymorphic document model. | Documents are investor-only. No property documents, community documents, or LP documents. No access inheritance. | High | Weak fit | Replace | P1 | Scope Model, LP Model | Need a polymorphic `Document` model with entity linkage. |

### Step 2: Legal and Investment Structure

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GP Entity Model | GP is the managing entity across all LPs. Should be a first-class record with legal details. | No GP entity. The concept exists only as a `UserRole.GP_ADMIN` and as `is_gp` boolean on `Ownership`. | GP is a role, not an entity. Cannot store GP legal name, management fee terms, or GP-level reporting. | High | Weak fit | Replace | P1 | None | GP entity needed for LP fee calculations. |
| LP Offering Model | LP must be a first-class legal/economic entity with separate offering terms, fee rules, distribution rules, and linked properties. | Does not exist. `EconomicEntity` (with types: property_lp, operating_company, property_management) is the closest analog, but it is tied to a single Property and lacks offering terms, fee rules, or investor linkage. | No LP entity. Investors cannot subscribe to an LP. Properties cannot be owned by an LP. Distributions cannot be LP-segregated. | Critical | Incompatible | Replace | P1 | GP Model | The single most important missing entity. |
| LP Rule Set Model | Each LP should have configurable rules: preferred return rate, GP promote structure, management fee percentage, reserve requirements. | Waterfall engine has hardcoded defaults (8% pref, 20% GP promote). `Investor` has a `preferred_return_rate` field. | Rules are scattered and not LP-specific. Different LPs cannot have different waterfall structures. | High | Weak fit | Replace | P1 | LP Model | Must be LP-level configuration, not investor-level. |
| Investor Master Profile | Investor record with accreditation, contact info, linked to user account. | `Investor` model with name, email, accredited_status, phone, user_id FK. | Structurally adequate as a master profile. Needs minor extension (address, entity type: individual/trust/corp). | Low | Strong fit | Keep | P1 | None | Good foundation. |
| Subscription Model | Formal workflow record: draft -> submitted -> under review -> accepted -> funded -> issued -> closed. Tracks commitment amount, funding date, LP linkage. | Does not exist. `CapitalContribution` records exist but have no workflow state and no LP linkage. | Entirely missing. No subscription workflow, no commitment tracking, no LP-specific capital raising. | Critical | Incompatible | Replace | P1 | LP Model, Investor | Required before Holdings can exist. |
| Holding Model | The actual equity position of an investor in a specific LP. Derived from funded Subscriptions. Tracks ownership percentage, cost basis, unreturned capital. | `Ownership` model exists with investor_id, property_id, ownership_percent, is_gp. | Wrong linkage (to Property, not LP). No cost basis tracking. No unreturned capital balance. | Critical | Incompatible | Replace | P1 | Subscription Model | Holdings are the basis for all distribution allocations. |
| Distribution Event Model | A parent record for a batch of distributions. Has workflow state (draft, calculated, approved, allocated, paid, published). Links to LP and period. | Does not exist. Individual `Distribution` records exist per investor but with no parent event, no workflow state, and no LP linkage. | No batch distribution concept. Cannot approve or publish a distribution run. Cannot link distributions to a specific LP or period. | Critical | Weak fit | Replace | P2 | LP Model, Holding Model | Required for governance and audit. |
| Investor Distribution Allocation Model | Per-holding allocation within a distribution event. Calculated by the waterfall engine based on holding percentages. | `Distribution` records exist per investor with amount, date, method, type. | Not holding-based. Not LP-specific. Not linked to a distribution event. | High | Weak fit | Replace | P2 | Distribution Event, Holding | Must be recalculated from holdings. |

### Step 3: Property and Ownership Structure

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Property Master Model | Property is the bridge entity connecting LP ownership, community operations, debt, redevelopment, and reporting. Fields for address, lot, zoning, lifecycle stage, acquisition details. | `Property` model with address, city, province, purchase_date, purchase_price, lot_size, zoning, max_buildable_area, floor_area_ratio, development_stage, cluster_id. | Structurally sound as a physical asset record. Missing LP ownership FK. Missing assessed value, current market value, and insurance fields. | Medium | Partial fit | Refactor | P1 | LP Model | Add lp_id FK and valuation fields. |
| Property Cluster Model | Group of nearby properties sharing infrastructure (commercial kitchen). | `PropertyCluster` with name, city, has_commercial_kitchen, kitchen_capacity, notes. Properties have cluster_id FK. | Well-implemented. Matches blueprint concept. | Low | Strong fit | Keep | P1 | None | Good implementation. |
| Community Model | City-based and purpose-based operating grouping. Distinct from LP. Links to Property and Operator. | `Community` with property_id FK, community_type (RecoverWell/StudyWell/RetireWell), name, has_meal_plan, meal_plan_monthly_cost. | Directionally correct. Missing operator_id FK. Missing community-level financial fields (operating budget, target occupancy). | Medium | Partial fit | Refactor | P1 | Operator Model | Needs operator linkage and financial fields. |
| Operator Entity Model | The business entity operating a community (e.g., RecoverWell Operations Inc). Has its own budget, staffing, and reporting. | Does not exist. | Entirely missing. Communities have no operator linkage. | High | Incompatible | Replace | P1 | Community Model | Required for operator budget and variance tracking. |
| Property Management Entity Model | The entity managing the physical property (maintenance, inspections, vendor coordination). May be different from the operator. | Does not exist as a separate entity. Property management is implied through the `PROPERTY_MANAGER` role. | No formal property management entity. Cannot track PM contracts, fees, or performance. | Medium | Incompatible | Replace | P3 | Property Model | Lower priority than operator model. |
| LP-to-Property Linkage | Properties are owned by LPs. One LP may own multiple properties. | `Ownership` links Investor to Property. No LP-to-Property relationship. | Wrong direction. Ownership should flow: LP owns Property, Investor holds position in LP. | Critical | Incompatible | Replace | P1 | LP Model | Must be corrected before any financial roll-up. |
| Property-to-Community Linkage | A property may host one or more communities. | `Community.property_id` FK exists. Property has `communities` relationship. | Correctly implemented. | Low | Strong fit | Keep | P1 | None | Sound relationship. |

### Step 4: Property Financial Modeling

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Interim Operating Assumptions Model | Structured inputs for the holding period before redevelopment: current rent roll, operating expenses, interim NOI, interim cash flow. | Does not exist. No interim operating model. | Entirely missing. Cannot model the pre-development revenue phase (critical for sober living properties generating income during planning). | High | Incompatible | Replace | P2 | Property Model | Important for RecoverWell properties. |
| Redevelopment Scenario Model | Multiple development scenarios per property (draft vs approved). Includes unit mix, cost breakdown, timeline, and projected stabilized returns. | `DevelopmentPlan` exists with version, planned_units, planned_beds, planned_sqft, detailed cost breakdown, dates. | Partially implemented. Has cost fields but no scenario comparison, no draft/approved state, no projected revenue or return fields. | Medium | Partial fit | Refactor | P2 | Property Model | Extend with projected revenue and state control. |
| Construction Budget Model | Detailed structured cost estimation with Alberta benchmarks. | `CostEstimator` service with CMHC Q1-2025 benchmarks, hard/soft/site/financing costs, contingency, and escalation. `DevelopmentPlan` stores the breakdown. | Well-implemented. Matches blueprint intent for structured, input-driven cost estimation. | Low | Strong fit | Keep | P2 | None | Excellent implementation. |
| Stabilized Pro Forma Model | Post-construction projected income, expenses, NOI, debt service, cash flow, cap rate, and valuation. | Basic `calculate_noi` and `calculate_cap_rate` functions exist in `modeling.py` but are not connected to any data model or API endpoint. | Functions exist but are orphaned. No stabilized pro forma data model, no API endpoint, no UI. | High | Weak fit | Replace | P2 | Debt Model, Property Model | Needs a full pro forma engine and data model. |
| Lifecycle Schedule Model | Timeline tracking: acquisition date, interim start, planning start, construction start, completion, lease-up, stabilization date. | `DevelopmentPlan` has `development_start_date`, `construction_duration_days`, `estimated_completion_date`. Property has `purchase_date`. | Partially covered. Missing interim period dates, lease-up period, and stabilization date. No formal lifecycle timeline entity. | Medium | Partial fit | Refactor | P2 | Property Model | Extend DevelopmentPlan or create separate timeline model. |
| Valuation Model | Property valuation based on cap rate, NOI, comparable sales, or replacement cost. | Does not exist as a model. `calculate_cap_rate` function exists but is not wired to data. | No valuation data model. No API endpoint. No UI. | High | Incompatible | Replace | P2 | Stabilized Pro Forma | Depends on having accurate NOI projections. |

### Step 5: Debt and Capital Events

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Debt Facility Model | Mortgage/loan records with lender, principal, interest rate, term, amortization period, payment frequency, maturity date, prepayment terms. | Does not exist. | Entirely missing. No debt tracking of any kind. | Critical | Incompatible | Replace | P2 | Property Model | Blocks all cash flow calculations. |
| Amortization Logic | Engine to calculate periodic principal and interest payments, remaining balance at any point. | Does not exist. | Entirely missing. | Critical | Incompatible | Replace | P2 | Debt Facility | Core financial engine. |
| Refinance Model | Ability to model refinancing events: new terms, proceeds, impact on LP economics. | Does not exist. | Entirely missing. | High | Incompatible | Replace | P2 | Debt Facility, LP Model | Important for lifecycle planning. |
| Sale / Disposition Model | Ability to model property sale: sale price, costs, net proceeds, distribution of proceeds to LP investors. | Does not exist. `DevelopmentStage.exit` enum value exists but no sale data model. | Entirely missing. | High | Incompatible | Replace | P2 | Debt Facility, LP Model | Required for investor return calculations. |

### Step 6: LP Economics

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LP Financial Roll-up | Aggregate property-level cash flows to LP level. Apply LP-level expenses, management fees, and reserves. | Does not exist. | Entirely missing. No LP-level aggregation of any kind. | Critical | Incompatible | Replace | P2 | LP Model, Property Financials, Debt | The core financial intelligence of the platform. |
| LP Fee Logic | Management fees, asset management fees, acquisition fees — configurable per LP. | Does not exist. | Entirely missing. | High | Incompatible | Replace | P2 | LP Model, LP Roll-up | Fees reduce distributable cash. |
| Reserve Logic | LP-level reserves (capital reserves, operating reserves) that reduce distributable cash. | Does not exist. | Entirely missing. | Medium | Incompatible | Replace | P2 | LP Model, LP Roll-up | Important for conservative financial modeling. |
| LP Equity Value Logic | Track LP equity value over time based on property valuations, debt, and accumulated returns. | Does not exist. | Entirely missing. | High | Incompatible | Replace | P2 | LP Roll-up, Valuation | Required for investor reporting. |
| LP Dashboard Logic | Dedicated LP-level dashboard showing fund performance, property summary, distribution history, investor composition. | Does not exist. Current dashboard is a global summary. | Entirely missing. | High | Incompatible | Replace | P3 | LP Model, LP Roll-up | Key investor-facing output. |

### Step 7: Distributions and Investor Returns

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Distribution Engine | LP-specific, rule-driven distribution using the LP's waterfall structure. Allocates to holdings. | `WaterfallEngine` in `waterfall.py` implements a correct 3-tier waterfall (return of capital + 8% pref, GP catch-up, 80/20 split). | Math is correct and deterministic. But it operates on generic inputs, not LP-specific data. Not wired to holdings or distribution events. | High | Partial fit | Refactor | P2 | LP Model, Holdings, Distribution Event | Keep the engine math. Rewire the data inputs. |
| Extraordinary Distribution Logic | Support for non-recurring distributions (refinance proceeds, sale proceeds) with different waterfall treatment. | `DistributionType` enum includes `refinancing` and `sale_proceeds` but no separate logic path. | Enum values exist but no differentiated calculation logic. | Medium | Weak fit | Refactor | P2 | Distribution Engine | Extend the waterfall engine with type-specific paths. |
| Investor Performance Engine | Calculate IRR, equity multiple, cash-on-cash return per investor per LP. | `calculate_irr` function exists in `modeling.py` but uses a simplified NPV approach, not a true IRR solver. Not connected to any data model. | Orphaned and mathematically simplified. No true IRR (would need Newton-Raphson or scipy). No equity multiple or cash-on-cash. | High | Weak fit | Replace | P2 | Holdings, Distribution History | Need a proper return calculation engine. |
| Consolidated Investor Portfolio View | An investor should see all their holdings across all LPs with aggregated performance. | Investor detail page shows contributions, ownership, and distributions, but not LP-segregated. | Not LP-aware. Cannot show per-LP performance. | High | Weak fit | Replace | P3 | Holdings, Investor Performance | Key investor experience. |

### Step 8: Operator and Community Operations

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Resident / Member Model | Resident records with bed assignment, rent type, move-in/out dates, meal plan enrollment. | `Resident` model with community_id, unit_id, bed_id, full_name, email, phone, rent_type, move_in/out dates, enrolled_meal_plan. | Well-implemented. Matches blueprint. | Low | Strong fit | Keep | P3 | None | Good implementation. |
| Occupancy Assignment Model | Formal bed assignment workflow with availability tracking. | `Bed` model with status (available, occupied, reserved, maintenance). `Resident.bed_id` FK. | Directionally correct. Missing formal assignment/transfer workflow. | Medium | Partial fit | Refactor | P3 | Bed Model | Add assignment history and transfer records. |
| Staffing / Service Schedule | Staff scheduling, shift management, service calendars for communities. | Does not exist. | Entirely missing. | Medium | Incompatible | Replace | P3 | Community, Operator | Important for operational management. |
| Events / Bookings | Community event management, common area bookings. | Does not exist. | Entirely missing. | Low | Incompatible | Replace | P4 | Community Model | Lower priority enhancement. |
| Operator Budget Model | Annual/monthly budget for each community operator with line items. | Does not exist. | Entirely missing. | High | Incompatible | Replace | P3 | Operator Model | Required for financial accountability. |
| Budget vs Actual Model | Compare actual operating results against budgeted amounts. Variance tracking. | Does not exist. | Entirely missing. | High | Incompatible | Replace | P3 | Operator Budget | Key operational intelligence. |
| Funding / Grant Model | Track government grants, funding applications, and award status for communities. | Does not exist. | Entirely missing. | Medium | Incompatible | Replace | P4 | Community Model | Important for RecoverWell (government-supported beds). |

### Property Management Workflows

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Maintenance Ticket Model | Maintenance requests with property, unit, description, status, priority, assigned vendor, resolution tracking. | `MaintenanceRequest` with property_id, resident_id, description, status (open/in_progress/resolved), created_at, resolved_at. | Functional but basic. Missing priority, category, assigned vendor, cost tracking, and unit linkage. | Medium | Partial fit | Refactor | P3 | Property Model | Extend with priority, vendor, and cost fields. |
| Inspections | Scheduled property inspections with checklists and findings. | Does not exist. | Entirely missing. | Medium | Incompatible | Replace | P3 | Property Model | Important for property management. |
| Turnover / Readiness | Unit turnover workflow: move-out, cleaning, repair, inspection, ready-to-rent. | Does not exist. | Entirely missing. | Medium | Incompatible | Replace | P3 | Unit Model | Affects occupancy tracking. |
| Arrears / Rent Collection | Track overdue rent, payment plans, collection actions. | `RentPayment` with status (pending/paid/overdue) and `PaymentStatus` enum. | Basic payment tracking exists. Missing arrears aging, payment plans, and collection workflow. | Medium | Partial fit | Refactor | P3 | Resident Model | Extend with aging and collection features. |
| Vendor Coordination | Vendor records, contracts, work orders, invoice tracking. | Does not exist. | Entirely missing. | Low | Incompatible | Replace | P3 | Property Model | Lower priority. |

### Reporting and UI

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Investor Dashboard | LP-specific view showing holdings, distributions, returns, documents, and messages for a specific investor. | Investor detail page shows contributions, ownership percent, distributions, documents, and messages. | Not LP-segregated. Shows global data, not per-LP holdings. | High | Partial fit | Refactor | P3 | Holdings, LP Model | Rewire to show per-LP data. |
| GP Dashboard | Executive view across all LPs, properties, and key financial metrics. | `/dashboard` page shows global KPIs (properties, units, occupancy, revenue, contributions, distributions) with Recharts. | Directionally correct as a global summary. Missing LP-level drill-down, actual vs projected, and exception alerts. | Medium | Partial fit | Refactor | P3 | LP Roll-up | Extend with LP-level views. |
| Property Dashboard | Per-property view showing lifecycle stage, financials, communities, debt, and maintenance. | `/portfolio/[id]` detail page shows property details, development plans, and communities. | Missing debt summary, interim vs stabilized financials, and lifecycle timeline visualization. | Medium | Partial fit | Refactor | P3 | Property Financials, Debt | Extend with financial sections. |
| Community Dashboard | Per-community view showing occupancy, residents, revenue, operator performance. | `/communities/[id]` detail page shows community details, units, and residents. | Missing revenue summary, operator budget vs actual, and bed-level occupancy visualization. | Medium | Partial fit | Refactor | P3 | Operator Budget | Extend with financial sections. |
| Operator Dashboard | Operator-specific view showing their communities, budgets, staffing, and performance. | Does not exist. | Entirely missing. | High | Incompatible | Replace | P3 | Operator Model, Budget | Key operational experience. |
| Property Manager Dashboard | City/portfolio-level view for property managers showing maintenance, inspections, and turnover. | Does not exist. | Entirely missing. | Medium | Incompatible | Replace | P3 | Scope Model | Requires scope-based filtering. |
| LP Reports | Formal LP financial summaries with period context and publication state. | Does not exist. `/api/reports/summary` returns a global JSON blob. | No LP-level reports. No period context. No publication state. | High | Incompatible | Replace | P3 | LP Roll-up, Report State | Key investor deliverable. |
| Investor Reports | Per-investor report packages (K-1s, distribution statements, performance summaries). | `InvestorDocument` model exists for document storage. No report generation. | Document storage exists but no automated report generation. | High | Partial fit | Refactor | P3 | Investor Performance, Holdings | Add report generation service. |
| Operator Reports | Operator performance reports (budget vs actual, occupancy, maintenance). | Does not exist. | Entirely missing. | Medium | Incompatible | Replace | P3 | Operator Budget | Depends on operator budget model. |
| Maintenance / Occupancy Reports | Aggregated maintenance and occupancy reporting across properties. | `/api/reports/summary` includes basic maintenance counts and occupancy rates. | Basic aggregation exists. Missing trend analysis, per-property breakdown, and formal report format. | Medium | Partial fit | Refactor | P3 | Maintenance Model | Extend existing summary. |
| Report State Control | Draft, reviewed, approved, published, archived states for all formal reports. | Does not exist. All reports are generated dynamically. | Entirely missing. Cannot freeze a report at a point in time. | High | Incompatible | Replace | P3 | All Report Types | Critical for governance. |

### Technical / Architectural

| Module / Area | Target Design Requirement | Current Implementation Summary | Gap / Discrepancy | Severity | Structural Fit | Recommended Action | Priority | Dependencies | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Domain Module Structure | Modular domain-driven structure with clear separation of concerns. | Backend organized as: routes/, schemas/, services/, db/, core/. Clean separation. | Good structure. Could benefit from domain-based grouping (e.g., investment/, operations/, finance/) as complexity grows. | Low | Strong fit | Keep | P1 | None | Solid foundation. |
| Calculation Engine Separation | Dedicated calculation layer with independently testable engines. | `CostEstimator` and `WaterfallEngine` are properly separated in services/. Legacy functions (`calculate_noi`, `calculate_irr`) are in the same file but orphaned. | Good start with two engines. Many engines missing. Legacy functions should be removed or replaced. | Medium | Partial fit | Refactor | P2 | None | Add missing engines, clean up legacy. |
| Backend vs Frontend Logic Distribution | All financial calculations must be in the backend. Frontend is for display only. | Financial calculations are in backend services. Frontend uses React Query hooks to fetch computed results. | Correctly implemented. No financial logic in the frontend. | Low | Strong fit | Keep | P1 | None | Good practice. |
| Workflow State Handling | Disciplined state models for subscriptions, distributions, reports, and property lifecycle. | `DevelopmentStage` enum exists but is not enforced as a workflow. No other workflow states. | Mostly missing. Need state machines for subscriptions, distributions, and reports. | High | Weak fit | Replace | P2 | Core Models | Add state fields and transition logic. |
| API Design Quality | RESTful, well-structured API with proper error handling, pagination, and filtering. | Clean FastAPI routes with proper HTTP methods, auth dependencies, and Pydantic validation. | Missing pagination, filtering, and sorting on list endpoints. Error responses could be more structured. | Medium | Partial fit | Refactor | P2 | None | Add pagination and filtering. |
| Report Generation Structure | Structured report generation services that produce versioned, publishable documents. | `/api/reports/summary` returns a single JSON blob computed on the fly. | No report generation service. No document output. No versioning. | High | Incompatible | Replace | P3 | Report State Control | Need a proper report generation layer. |
| Dashboard Summary Services | Dedicated aggregation services feeding dashboards, not raw table reads. | `/api/reports/summary` is a single monolithic query function. | One summary endpoint exists but it is not role-aware, not scope-filtered, and not LP-specific. | High | Weak fit | Replace | P3 | Scope Model, LP Model | Need role-specific summary services. |
| AI Layer Alignment | AI as a support layer for structured outputs, not replacing deterministic logic. | Sprint 4 spec (pending implementation) adds structured risk analysis and auto-defaults using Pydantic response_format. Current AI is basic OpenAI chat. | Sprint 4 spec is well-aligned with blueprint guidance. Current implementation is basic but not harmful. | Low | Strong fit | Keep | P4 | Core Models | Good direction. Expand after core is stable. |

---

## C. Data Model Remediation Plan

### Entities to Keep (minor tweaks only)

| Entity | Current State | Recommended Changes |
| :--- | :--- | :--- |
| `User` | Solid auth model | Add `scope_assignments` relationship |
| `Property` | Good physical asset record | Add `lp_id` FK, assessed_value, current_market_value |
| `PropertyCluster` | Well-implemented | None |
| `Unit` | Sound | None |
| `Bed` | Sound, atomic revenue unit | None |
| `Resident` | Complete with bed assignment | None |
| `RentPayment` | Functional | Minor: add unit_id for direct lookup |
| `MaintenanceRequest` | Functional | Add priority, category, vendor_id, cost |

### Entities to Refactor

| Entity | Current State | Required Changes |
| :--- | :--- | :--- |
| `Community` | Correct concept, missing linkages | Add `operator_id` FK, operating_budget, target_occupancy |
| `DevelopmentPlan` | Good cost fields, missing state | Add `status` (draft/approved/active), projected_revenue, projected_noi |
| `EconomicEntity` | Useful concept | Integrate with LP model; may become a child of LP rather than Property |
| `Investor` | Good master profile | Remove `preferred_return_rate` (move to LP rules). Add address, entity_type |
| `InvestorDocument` | Functional | Generalize to polymorphic `Document` model with entity_type + entity_id |
| `InvestorMessage` | Functional | Keep as-is or generalize to platform messaging |

### Entities to Replace (remove and rebuild)

| Entity | Why Replace | Replacement |
| :--- | :--- | :--- |
| `Ownership` | Links Investor to Property directly, bypassing LP | `Holding` (Investor -> LP, with ownership_percent, cost_basis, unreturned_capital) |
| `CapitalContribution` | No LP linkage, no subscription workflow | `Subscription` (with workflow state) + `CapitalCall` / `FundingEvent` |
| `Distribution` | Not LP-specific, not event-based, not holding-based | `DistributionEvent` (parent) + `DistributionAllocation` (per-holding child) |

### New Entities Required

| Entity | Purpose | Key Fields |
| :--- | :--- | :--- |
| `ScopeAssignment` | Map users to entities they can access | user_id, entity_type (LP/Community/Property), entity_id, permission_level |
| `GPEntity` | The general partner managing entity | legal_name, management_fee_percent, address |
| `LPEntity` | The limited partnership fund vehicle | name, gp_id, offering_date, target_raise, pref_rate, gp_promote, status |
| `Subscription` | Investor commitment to an LP | investor_id, lp_id, commitment_amount, status (draft->funded->issued) |
| `Holding` | Investor equity position in an LP | investor_id, lp_id, subscription_id, ownership_percent, cost_basis, unreturned_capital |
| `DebtFacility` | Mortgage/loan on a property | property_id, lender, principal, interest_rate, term_years, amortization_years, maturity_date |
| `DistributionEvent` | Batch distribution record | lp_id, period, total_amount, status (draft->approved->paid->published) |
| `DistributionAllocation` | Per-holding allocation | event_id, holding_id, amount, type |
| `OperatorEntity` | Business operating a community | name, community_ids, contact_info |
| `OperatorBudget` | Annual budget for an operator | operator_id, period, line_items (JSON or child table) |
| `AuditLog` | Change tracking | user_id, entity_type, entity_id, action, timestamp, details |

### Relationship Corrections

| Current Relationship | Problem | Corrected Relationship |
| :--- | :--- | :--- |
| Investor -> Ownership -> Property | Bypasses LP | Investor -> Holding -> LP -> Property |
| Investor -> CapitalContribution | No LP context | Investor -> Subscription -> LP (with funding events) |
| Investor -> Distribution | Not LP-specific | Investor -> Holding -> DistributionAllocation -> DistributionEvent -> LP |
| Community -> Property (only) | Missing operator | Community -> OperatorEntity + Community -> Property |

---

## D. Calculation-Engine Remediation Plan

### Engines that Exist

| Engine | Location | Status | Action |
| :--- | :--- | :--- | :--- |
| Construction Budget Engine | `services/modeling.py` (`CostEstimator`) | Complete, deterministic, Alberta benchmarks | **Keep** |
| Waterfall Distribution Engine | `services/waterfall.py` (`WaterfallEngine`) | Correct 3-tier math, deterministic | **Refactor** (wire to LP/Holdings data) |
| Basic NOI Calculator | `services/modeling.py` (`calculate_noi`) | Orphaned function, not connected to data | **Replace** (incorporate into Pro Forma Engine) |
| Basic Cap Rate Calculator | `services/modeling.py` (`calculate_cap_rate`) | Orphaned function, not connected to data | **Replace** (incorporate into Valuation Engine) |
| Basic IRR Calculator | `services/modeling.py` (`calculate_irr`) | Simplified NPV approach, mathematically incorrect as IRR | **Replace** (use scipy or Newton-Raphson) |

### Engines Missing (Must be Built)

| Engine | Purpose | Priority | Dependencies |
| :--- | :--- | :--- | :--- |
| `mortgage_engine` | Amortization schedule, periodic payments, remaining balance | P2 | DebtFacility model |
| `interim_operating_engine` | Cash flow during pre-development holding period | P2 | Property model, interim assumptions |
| `stabilized_proforma_engine` | Post-construction NOI, debt service, cash flow projection | P2 | Mortgage engine, property financials |
| `lifecycle_projection_engine` | Multi-year projection across all lifecycle phases | P2 | All property financial engines |
| `valuation_engine` | Property valuation (cap rate, comparable, replacement cost methods) | P2 | Stabilized pro forma |
| `lp_rollup_engine` | Aggregate property cash flows to LP level, apply fees and reserves | P2 | LP model, property financials, debt |
| `distribution_engine` (enhanced) | LP-specific distribution calculation using holdings and LP rules | P2 | LP roll-up, holdings, waterfall engine |
| `investor_return_engine` | IRR, equity multiple, cash-on-cash per investor per LP | P2 | Holdings, distribution history |
| `operator_variance_engine` | Budget vs actual comparison for community operators | P3 | Operator budget model |

### Architecture Principle

All engines must follow the pattern established by `CostEstimator` and `WaterfallEngine`:
- Accept structured inputs (Pydantic models or typed dicts)
- Produce structured outputs
- Be independently testable
- Live in `backend/app/services/`
- Be called by API routes, never by frontend code

---

## E. UI / UX Remediation Plan

### Navigation Changes Needed

The current sidebar shows the same navigation to all users at a role level. The blueprint requires role-specific experiences. The sidebar must be restructured to support:

| Role | Current Experience | Required Experience |
| :--- | :--- | :--- |
| GP_ADMIN | Sees all 7 nav items | Should see: Executive Dashboard, LPs, Properties, Communities, Investors, Reports, AI, Settings |
| OPERATIONS_MANAGER | Sees 6 nav items (no AI in some configs) | Should see: scoped to assigned LPs/Communities |
| PROPERTY_MANAGER | Sees Portfolio, Communities, Maintenance | Should see: only assigned properties/cities, Maintenance, Inspections, Turnover |
| INVESTOR | Sees Investors only | Should see: My Holdings, My Distributions, My Documents, My Messages |
| RESIDENT | Sees Dashboard, Maintenance | Should see: My Unit, My Payments, Maintenance Requests |
| OPERATOR (new) | Does not exist | Should see: My Communities, Occupancy, Budget, Staffing, Reports |

### Screens to Keep

| Screen | Notes |
| :--- | :--- |
| Login / Register | Solid implementation |
| AI Assistant | Well-designed (Sprint 4 spec improves it further) |
| Maintenance list | Functional, needs minor extension |
| All shadcn/ui components | Reusable across rebuilt screens |

### Screens to Refactor

| Screen | Required Changes |
| :--- | :--- |
| Dashboard | Split into role-specific dashboards (GP, Investor, Operator, PM) |
| Portfolio list/detail | Add LP context, debt summary, lifecycle timeline |
| Communities list/detail | Add operator info, budget summary, bed-level occupancy visualization |
| Investors list/detail | Restructure around Holdings by LP, not flat contributions |
| Reports | Replace monolithic summary with role-specific, LP-specific reports |

### Missing Screens

| Screen | Purpose | Priority |
| :--- | :--- | :--- |
| LP List / Detail | View and manage LP funds | P1 |
| Subscription Management | Track investor commitments through workflow states | P1 |
| Holdings View | Show investor positions by LP | P1 |
| Debt Facility Management | Add/edit mortgages per property | P2 |
| Distribution Workflow | Create, calculate, approve, and publish distribution events | P2 |
| Stabilized Pro Forma | Input assumptions and view projected financials | P2 |
| Operator Budget | Create and manage community operating budgets | P3 |
| Budget vs Actual | Compare actual results to budget | P3 |
| Inspection Management | Schedule and track property inspections | P3 |

---

## F. Sequenced Remediation Roadmap

### Phase 1: Foundation (P1) — Estimated 2-3 Sprints

**Objective:** Correct the core entity architecture so that all downstream modules build on the right foundation.

| Step | Work Item | Dependencies |
| :--- | :--- | :--- |
| 1.1 | Implement `ScopeAssignment` model and update `deps.py` with scope-aware query helpers | User model |
| 1.2 | Implement `GPEntity` and `LPEntity` models | None |
| 1.3 | Implement `Subscription` model with workflow states | LP model, Investor model |
| 1.4 | Implement `Holding` model | Subscription model |
| 1.5 | Add `lp_id` FK to `Property`. Add `operator_id` FK to `Community`. Create `OperatorEntity`. | LP model |
| 1.6 | Remove `Ownership` and `CapitalContribution` models. Migrate seed data to new structure. | Holdings, Subscriptions |
| 1.7 | Implement `AuditLog` model | User model |
| 1.8 | Update all API routes to enforce scope filtering | ScopeAssignment |
| 1.9 | Add LP management pages to frontend (list, detail, create) | LP model + API |
| 1.10 | Add Subscription and Holdings pages to frontend | Subscription/Holding models + API |

### Phase 2: Core Finance & Modeling (P2) — Estimated 3-4 Sprints

**Objective:** Build the financial intelligence layer that makes the platform credible as an investment tool.

| Step | Work Item | Dependencies |
| :--- | :--- | :--- |
| 2.1 | Implement `DebtFacility` model and `mortgage_engine` | Property model |
| 2.2 | Build `interim_operating_engine` | Property model |
| 2.3 | Build `stabilized_proforma_engine` | Mortgage engine |
| 2.4 | Build `valuation_engine` | Pro forma engine |
| 2.5 | Build `lifecycle_projection_engine` | All property engines |
| 2.6 | Build `lp_rollup_engine` | LP model, property financials, debt |
| 2.7 | Implement `DistributionEvent` and `DistributionAllocation` models | LP model, Holdings |
| 2.8 | Refactor `WaterfallEngine` to consume LP roll-up data and allocate to Holdings | LP roll-up, Holdings |
| 2.9 | Build `investor_return_engine` (true IRR, equity multiple, cash-on-cash) | Holdings, distributions |
| 2.10 | Add Debt, Pro Forma, and Distribution pages to frontend | All P2 models + APIs |

### Phase 3: Operations & Reporting (P3) — Estimated 2-3 Sprints

**Objective:** Build the operational management and formal reporting capabilities.

| Step | Work Item | Dependencies |
| :--- | :--- | :--- |
| 3.1 | Implement `OperatorBudget` model and `operator_variance_engine` | Operator model |
| 3.2 | Implement report state control (Draft/Approved/Published) | All data models |
| 3.3 | Build role-specific dashboard summary services | Scope model, LP roll-up |
| 3.4 | Rebuild frontend dashboards (GP, Investor, Operator, PM) | Summary services |
| 3.5 | Build report generation services (LP reports, investor statements) | LP roll-up, report state |
| 3.6 | Extend maintenance model (priority, vendor, cost) and add inspections | Property model |
| 3.7 | Add occupancy assignment history and turnover workflow | Unit/Bed models |

### Phase 4: Advanced & AI (P4) — Estimated 1-2 Sprints

**Objective:** Add strategic and differentiating features on top of the stable core.

| Step | Work Item | Dependencies |
| :--- | :--- | :--- |
| 4.1 | Extend AI layer to analyze LP roll-up anomalies and operator budget variances | LP roll-up, operator budget |
| 4.2 | Add funding/grant tracking for communities | Community model |
| 4.3 | Add advanced scenario comparison (side-by-side development plans) | Development plan model |
| 4.4 | Add staffing/scheduling for community operators | Operator model |
| 4.5 | Add events/bookings for communities | Community model |

---

## G. Final Recommendation

### What Should Be Salvaged

The following components represent genuine value and should be preserved:

The **technology stack and project structure** (FastAPI + SQLAlchemy + Next.js + Tailwind + shadcn/ui) is well-chosen and well-organized. The backend module structure (routes/schemas/services/db/core) is clean and extensible.

The **authentication system** (JWT access/refresh tokens, user model, login/register flow) is production-ready and requires no changes.

The **operational layer** (Units, Beds, Residents, Rent Payments, Maintenance Requests, Community structure) correctly models the physical reality of the properties and is aligned with the blueprint.

The **Construction Cost Estimator** is a well-built, deterministic engine with real Alberta CMHC benchmarks.

The **Waterfall Engine** implements correct 3-tier distribution math and needs only to be rewired to the correct data structure.

The **UI component library** (shadcn/ui cards, tables, forms, badges, dialogs) and the **frontend patterns** (React Query hooks, Axios interceptors, role-based sidebar) are reusable across all rebuilt screens.

### What Should Be Rebuilt

The **investment architecture** (Ownership, CapitalContribution, Distribution) must be replaced with the correct LP/Subscription/Holding/DistributionEvent structure. This is non-negotiable.

The **permission system** must be replaced with scope-aware access control. This is non-negotiable.

The **financial modeling layer** must be expanded from 2 engines to 10+ engines covering debt, interim operations, stabilized pro formas, LP roll-up, and investor returns.

The **reporting layer** must be rebuilt with state control, period context, and role-specific outputs.

### Practical Order of Work

1. **Immediately:** Execute Phase 1 (Foundation). Fix the entity architecture. This unlocks everything else.
2. **Next:** Execute Phase 2 (Core Finance). Build the financial engines. This makes the platform credible.
3. **Then:** Execute Phase 3 (Operations & Reporting). Build the user-facing experiences. This makes the platform usable.
4. **Finally:** Execute Phase 4 (Advanced & AI). Add the differentiating features. This makes the platform competitive.

The estimated total effort across all four phases is approximately 8-12 sprints, depending on sprint duration and team velocity. Phase 1 is the most critical and should be started immediately.
