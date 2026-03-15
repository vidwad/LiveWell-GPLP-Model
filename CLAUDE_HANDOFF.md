# LiveWell GPLP Platform — Claude Handoff Document

This document provides the necessary context, architectural patterns, and next steps for Claude to continue development on the LiveWell GPLP Platform on the user's local machine.

## 1. Project Overview & Architecture

The LiveWell GPLP Platform is an enterprise-scale real estate syndication and community operations platform. It is **not** a generic PE/VC fund administration system.

### Key Architectural Principles
1. **Separation of Ownership and Operations:** A property belongs to one LP (ownership) and one Community (operations). Multiple LPs may contribute properties into the same city-based community.
2. **Interim Operations:** Properties often operate "as-is" before redevelopment. The system tracks real occupancy, bed-level revenue, and house expenses during this phase.
3. **Three Distinct Layers:** LP Ownership (GP/LP) → Community Operator → Property Manager.
4. **Target vs. Actual:** Target properties (pipeline) and actual properties coexist within each LP.
5. **Tranche-Based Funding:** Subscriptions are funded upfront via tranches, not through capital calls.
6. **Configurable Distributions:** LP-specific distribution logic rather than a rigid generic waterfall.

### Tech Stack
* **Backend:** FastAPI, SQLAlchemy (SQLite for local dev, PostgreSQL for prod), Pydantic, Uvicorn.
* **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui, React Query, Axios.

---

## 2. Recent Accomplishments (What Manus Just Built)

Manus has completed several major foundational and feature batches. The project is currently at **94 DONE / 16 PARTIAL / 26 NOT DONE** out of 136 total items (69% complete).

### Latest Features Added:
* **Scope-Based Data Filtering:** Implemented `filter_by_lp_scope`, `filter_by_community_scope`, and `filter_by_property_scope` in `backend/app/core/deps.py`. All list endpoints now filter data based on the user's role and assigned scopes.
* **Role-Aware UI:** Created `usePermissions` hook in the frontend. The UI now dynamically hides/shows admin actions (e.g., Edit LP, Add Tranche, Convert Property) based on the user's role (`GP_ADMIN`, `OPERATIONS_MANAGER`, `PROPERTY_MANAGER`, `INVESTOR`, `RESIDENT`).
* **LP P&L and NAV:** Added backend services (`compute_lp_pnl`, `compute_lp_nav`) and frontend tabs on the LP detail page to show aggregated revenue/expenses and Net Asset Value.
* **Valuation History:** Added `ValuationHistory` model and CRUD endpoints to track property appraisals and assessments over time.
* **Investor PDF Statements:** Implemented `statement_service.py` using `fpdf2` to generate professional PDF statements showing holdings, distributions, and subscriptions. Added a "Download Statement" button to the investor detail page.
* **Development Plan Comparison:** Added a side-by-side comparison UI on the property detail page to compare different versions of development plans, highlighting differences in costs, units, and NOI.

---

## 3. Coding Patterns & Conventions

When continuing development, please adhere to the following established patterns:

### Backend Patterns
1. **Fat Services, Thin Routes:** Keep route handlers in `app/routes/` thin. Move complex business logic, aggregations, and calculations to `app/services/` (e.g., `investment_service.py`, `operations_service.py`).
2. **Scope Filtering:** When adding new list endpoints, always apply the appropriate scope filter from `app.core.deps` (e.g., `filter_by_lp_scope(query, current_user, db, Model.lp_id)`).
3. **Role Guards:** Protect endpoints using dependencies like `Depends(require_gp_or_ops)` or `Depends(require_investor_or_above)`.
4. **Decimal Precision:** Use `Decimal` for all financial calculations to avoid floating-point errors. See `_d()` and `_pct()` helpers in `investment_service.py`.
5. **Database Models:** Models are defined in `app/db/models.py`. Always use SQLAlchemy 2.0 style relationships.

### Frontend Patterns
1. **React Query:** Use `@tanstack/react-query` for all data fetching. Define hooks in `src/hooks/` (e.g., `useInvestment.ts`) that call API methods defined in `src/lib/api.ts`.
2. **Role-Based UI:** Use the `usePermissions` hook (`const { canEdit, isAdmin } = usePermissions();`) to conditionally render buttons or sections that require specific privileges.
3. **UI Components:** Use the existing `shadcn/ui` components in `src/components/ui/` (e.g., `Card`, `Table`, `Badge`, `Dialog`).
4. **Formatting:** Use `formatCurrency`, `formatCurrencyCompact`, and `formatDate` from `src/lib/utils.ts` for consistent data display.

---

## 4. Next Priority Tasks (TODO.md)

The following items are the recommended next steps to tackle. They are listed in priority order based on the `TODO.md` file.

### 1. Cap Rate / Income Approach Valuation Calculator (2.7.3)
* **Goal:** Automate property valuation using Net Operating Income (NOI) and a capitalization rate.
* **Backend:** Add a calculation service that takes NOI and Cap Rate to produce an estimated value. Integrate this into the `ValuationHistory` creation flow.
* **Frontend:** Add a "Calculate via Cap Rate" option in the Add Valuation dialog.

### 2. Construction Budget vs Actual Tracking (2.3.4)
* **Goal:** Track actual construction spend against the approved development plan budget.
* **Backend:** Create a model to record actual construction expenses (distinct from interim operating expenses) and link them to a `DevelopmentPlan`.
* **Frontend:** Add a budget vs. actual tracking table to the Dev Plans tab.

### 3. Construction Draw Schedule (2.3.5)
* **Goal:** Model the draw/disbursement schedule for construction financing.
* **Backend:** Create a `ConstructionDraw` model linked to `DebtFacility` (for construction loans).
* **Frontend:** Add a UI to request, approve, and track loan draws.

### 4. Timeline Visualization (2.6.5)
* **Goal:** Provide a Gantt-style or visual milestone chart for the property lifecycle.
* **Frontend:** Enhance the `/lifecycle` page or property detail page to show `PropertyStageTransition` and `PropertyMilestone` data visually, rather than just in a table.

### 5. Waterfall Engine LP-Specific Configurability (T.9)
* **Goal:** Make the distribution waterfall engine configurable per LP.
* **Backend:** Currently, `WaterfallEngine` uses a hardcoded 4-tier European model. Update the `LPEntity` model to store waterfall configuration rules (e.g., hurdle rates, catch-ups, GP promote splits) and update the engine to read these rules dynamically.

### 6. Vacancy Tracking and Alerts (4.1.5)
* **Goal:** Proactive monitoring of unit/bed vacancies.
* **Backend:** Add logic to identify units/beds that have been vacant beyond a certain threshold.
* **Frontend:** Add a "Vacancy Alerts" section to the Operations dashboard.

### 7. Portfolio-Level Analytics Dashboard (5.3.1)
* **Goal:** Cross-LP analytics and trend analysis.
* **Frontend:** Create a high-level dashboard for GP Admins that aggregates data across all LPs (total AUM, blended returns, portfolio-wide occupancy trends).

---

## 5. Getting Started Locally

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

Good luck with the next phase of development!
