# LiveWell GPLP Platform - Phase 5 Claude Handoff

## Overview
The LiveWell GPLP platform has successfully implemented Phases 1-4 of the Master Platform Blueprint. The core architecture (LPs, Investors, Properties, Communities, Operators), role-based permissions, and foundational financial engines (waterfall distributions, construction cost estimation) are in place and functioning correctly.

**Phase 5** focuses on closing the remaining gaps identified in the blueprint, specifically around advanced financial modeling, time-phased projections, debt amortization, and specialized operational workflows.

This document provides detailed instructions for Claude to implement these Phase 5 features on the local development environment.

---

## Priority 1: Advanced Financial Engines

The blueprint requires deterministic, reusable calculation engines in the backend service layer. These engines must be built in `backend/app/services/` and exposed via new or existing routes.

### 1.1 Mortgage Amortization Engine
**Blueprint Reference:** Section 14.4 (Debt and Financing Calculations)
**Current State:** The `DebtFacility` model exists, but there is no service to generate payment schedules or project annual debt service.

**Implementation Instructions:**
1. Create a new service file: `backend/app/services/debt.py`.
2. Implement a `MortgageEngine` class with methods to calculate:
   - Monthly payment amount (handling interest-only periods vs. amortization).
   - Full amortization schedule (interest, principal, balance per period).
   - Annual debt projection (aggregating periodic payments into annual totals).
3. Ensure the engine handles Canadian mortgage compounding rules if specified, or standard US compounding as a default.
4. Create a new route in `backend/app/routes/portfolio.py` (e.g., `GET /properties/{property_id}/debt/{debt_id}/amortization`) to expose this schedule to the frontend.

### 1.2 Time-Phased Annual Projection Engine
**Blueprint Reference:** Section 14.5 (Property Lifecycle and Annual Projection Calculations)
**Current State:** Missing. We need a year-by-year projection that transitions through lifecycle stages.

**Implementation Instructions:**
1. Create a new service file: `backend/app/services/projections.py`.
2. Implement a `LifecycleProjectionEngine` that takes a `Property` and its associated `DevelopmentPlan` and `DebtFacility`.
3. The engine must project financials year-by-year (e.g., Year 1 to Year 10), determining for each year:
   - **Phase:** Interim, Construction, Lease-up, or Stabilized.
   - **Rentable Months:** How many months the property generates revenue in that year.
   - **Revenue & Expenses:** Based on the phase (interim assumptions vs. stabilized pro forma).
   - **Debt Service:** Pulled from the `MortgageEngine`.
   - **Cash Flow:** NOI minus Debt Service.
4. Implement lease-up logic to ramp up occupancy/revenue over a configurable number of months.

### 1.3 LP Roll-up and Equity Value Engine
**Blueprint Reference:** Section 14.6B and 14.7 (LP Roll-up and Fund Economics)
**Current State:** Basic fund performance exists in `reporting.py`, but it needs a formal roll-up engine.

**Implementation Instructions:**
1. In `backend/app/services/calculations.py` (or a new `lp_economics.py`), implement an `LPRollupEngine`.
2. This engine must aggregate data across all properties linked to an `LPEntity`:
   - Total Portfolio Value (sum of property valuations).
   - Total Debt Outstanding.
   - LP Equity Value (Portfolio Value - Debt - Liquidation Costs/Reserves).
   - Projected Annual Cash Flow (sum of property cash flows).
3. Update the `GET /api/reports/fund-performance` endpoint to use this new engine.

---

## Priority 2: Strategic Workflows

### 2.1 Refinance and Sale Analysis Workflows
**Blueprint Reference:** Section 13.8 (Debt, Refinance, and Sale Workflow)
**Current State:** Missing.

**Implementation Instructions:**
1. Create new models in `backend/app/db/models.py`:
   - `RefinanceScenario`: Links to `Property`, tracks assumed new valuation, new loan terms, existing debt payout, and net proceeds.
   - `SaleScenario`: Links to `Property`, tracks assumed sale price, selling costs, debt payout, and net proceeds.
2. Create corresponding schemas in `backend/app/schemas/portfolio.py`.
3. Add endpoints in `backend/app/routes/portfolio.py` to CRUD these scenarios and calculate the net proceeds dynamically.

### 2.2 Redevelopment Scenario Comparison
**Blueprint Reference:** Section 14.3B (Redevelopment Scenario Comparison Engine)
**Current State:** `DevelopmentPlan` exists, but no side-by-side comparison logic.

**Implementation Instructions:**
1. In `backend/app/services/modeling.py`, add a `compare_scenarios(plan_ids: List[int])` function.
2. This function should return a structured comparison of costs, NOI, debt impact, and projected valuation across multiple `DevelopmentPlan` versions for the same property.
3. Add an endpoint `GET /api/properties/{property_id}/plans/compare` to serve this data.

---

## Priority 3: Operational Workflows

### 3.1 Grant and Funding Workflow
**Blueprint Reference:** Section 13.10C (Grant and Funding Workflow)
**Current State:** Missing.

**Implementation Instructions:**
1. Add a `FundingOpportunity` model in `backend/app/db/models.py` linked to `OperatorEntity` or `Community`.
   - Fields: `title`, `amount`, `status` (draft, submitted, awarded, denied), `submission_deadline`, `reporting_deadline`, `notes`.
2. Create schemas and CRUD routes in `backend/app/routes/operator.py`.
3. Build a frontend page `livingwell-frontend/src/app/(dashboard)/funding/page.tsx` (accessible to GP_ADMIN and OPERATIONS_MANAGER) to manage these grants.

### 3.2 Advanced Property Management (Turnover & Arrears)
**Blueprint Reference:** Section 13.11 (City Property Management Workflow)
**Current State:** Basic `MaintenanceRequest` and `RentPayment` exist.

**Implementation Instructions:**
1. Add a `UnitTurnover` model to track inspection checklists, readiness status, and assigned repairs between residents.
2. Add an `ArrearsRecord` model or enhance `RentPayment` to track collection follow-up actions and aging (30/60/90 days).
3. Create a Property Manager specific dashboard view in the frontend that highlights vacant beds, upcoming move-outs, and overdue payments.

---

## Priority 4: Reporting Enhancements

### 4.1 Report Versioning and State Management
**Blueprint Reference:** Section 16.10 (Report Lifecycle)
**Current State:** `QuarterlyReport` has a basic status, but lacks version history.

**Implementation Instructions:**
1. Update the `QuarterlyReport` model to support versioning (e.g., `version` integer, `superseded_by` self-referential foreign key).
2. Ensure the status enum strictly follows: `draft` -> `reviewed` -> `approved` -> `published` -> `archived`.

### 4.2 GP Monthly Management Report Package
**Blueprint Reference:** Section 16.4 (GP / Executive Reporting)
**Current State:** Missing.

**Implementation Instructions:**
1. In `backend/app/services/reporting.py`, create a `generate_management_pack()` function.
2. This function must aggregate:
   - LP Summary (capital raised, equity value).
   - Property Summary (occupancy, NOI).
   - Development Update (active projects, budget variance).
   - Operator Budget Issues (variances).
3. Expose this via a new endpoint `GET /api/reports/management-pack`.

---

## Development Workflow Guidelines for Claude

1. **Sequential Execution:** Tackle these priorities one at a time. Do not attempt to build the frontend for a feature until the backend models, services, and routes are fully tested.
2. **Database Migrations:** Since we are using `Base.metadata.create_all(bind=engine)` in `main.py`, adding new models will automatically create the tables on startup. However, if you modify existing columns, you may need to drop and recreate the database locally or write a script to alter the tables.
3. **Testing:** After implementing a backend service (e.g., the Mortgage Engine), write a quick test script in the `backend/` directory to verify the math before wiring it to the API.
4. **Frontend Integration:** When building frontend components, strictly adhere to the existing `@base-ui/react` component patterns and Tailwind CSS responsive classes established in Phase 4.
