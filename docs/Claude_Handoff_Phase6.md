# LiveWell GPLP Platform - Phase 6 Handoff Document

## Overview
Welcome to Phase 6! In Phase 5, you successfully built the backend engines for advanced financial modeling (mortgage amortization, time-phased projections, LP roll-up, refinance/sale scenarios) and the operational workflows (grants/funding, unit turnovers). 

**The goal of Phase 6 is to build the frontend UI to expose these powerful backend engines to the users.** The backend endpoints are already fully tested and working. Your job is to build the React components, hooks, and pages to consume them.

---

## Priority 1: Property Financial Projections & Amortization UI

The backend has two powerful endpoints that need to be visualized on the Property Detail page (`/portfolio/[id]/page.tsx`):
1. `GET /api/portfolio/properties/{pid}/debt/{did}/amortization`
2. `POST /api/portfolio/properties/{pid}/projection`

### 1.1 Add Amortization Schedule to Debt Facilities
Currently, the Property Detail page lists Debt Facilities but doesn't show the amortization schedule.

**Tasks:**
1. Create a new hook in `usePortfolio.ts`: `useAmortizationSchedule(propertyId, debtId)`
2. Update the Debt Facilities tab in `portfolio/[id]/page.tsx`:
   - Add a "View Schedule" button next to each debt facility.
   - When clicked, open a Dialog or expandable row showing the amortization table.
   - The table should display: `payment_number`, `date`, `payment`, `principal`, `interest`, `remaining_balance`.
   - Add a summary card showing `total_interest_paid` and `total_principal_paid`.

### 1.2 Build the Projections Tab
Create a new "Projections" tab on the Property Detail page to show the year-by-year financial projection.

**Tasks:**
1. Create a new hook: `useRunProjection(propertyId)`
2. Build a form to collect the `ProjectionInput` parameters:
   - `projection_years` (default 10)
   - `revenue_growth` (default 0.03)
   - `expense_growth` (default 0.02)
   - `stabilized_annual_revenue`
   - `stabilized_operating_expenses`
   - `interim_revenue` (default 0)
   - `interim_expenses` (default 0)
3. Display the results (`_YearProjectionOut`) in a comprehensive data table:
   - Columns: Year, Phase (interim/construction/lease_up/stabilized), Occupancy, Gross Rev, Vacancy Loss, EGI, OpEx, NOI, Debt Service, Cash Flow, Cumulative CF.
   - Use conditional formatting (colors) for the `phase` column.

---

## Priority 2: Refinance & Sale Scenario UI

The backend supports creating and comparing Refinance and Sale scenarios for a property.

**Tasks:**
1. Create hooks in `usePortfolio.ts`:
   - `useRefinanceScenarios(propertyId)`
   - `useCreateRefinanceScenario(propertyId)`
   - `useSaleScenarios(propertyId)`
   - `useCreateSaleScenario(propertyId)`
2. Create a new "Exit Scenarios" tab on the Property Detail page.
3. **Refinance Section:**
   - Form to create: `scenario_name`, `target_ltv`, `new_interest_rate`, `new_amortization_years`, `estimated_valuation`.
   - Table to display results: Name, Valuation, New Loan Amount, Payoff Amount, Net Proceeds, New Annual Payment.
4. **Sale Section:**
   - Form to create: `scenario_name`, `exit_cap_rate`, `cost_of_sale_percent`, `projected_noi`.
   - Table to display results: Name, Gross Sale Price, Cost of Sale, Debt Payoff, Net Proceeds.

---

## Priority 3: LP Roll-up & Management Pack UI

The backend has a powerful `GET /api/reports/management-pack` endpoint that aggregates data across all LPs, properties, and operator budgets.

**Tasks:**
1. Create a hook in `useReports.ts`: `useManagementPack()`
2. Update the `/reports` page to include a "Management Pack" section.
3. Display the data in clean, professional cards/tables:
   - **LP Summary:** Table showing Capital Committed, Capital Raised, Total Distributions, Equity Multiple.
   - **Property Summary:** Table showing Occupancy Rates and Projected NOI.
   - **Development Update:** Table showing Active Plans, Budget Variances, and Timelines.
   - **Operator Budget Issues:** Alert cards for any budgets with material negative variances.
4. Add an "Export to PDF" button (you can just use `window.print()` with print-specific CSS for now, hiding the sidebar).

---

## Priority 4: Unit Turnover Workflow UI

The backend has full CRUD for `UnitTurnover` tracking (cleaning, repairs, painting, inspection).

**Tasks:**
1. Create hooks in `useOperator.ts`: `useTurnovers()`, `useCreateTurnover()`, `useUpdateTurnover()`.
2. Create a new page: `/operator/turnovers/page.tsx` (add to Sidebar under Operator section).
3. Build a Kanban board or Table view for Turnovers:
   - Columns/Status: `scheduled` -> `in_progress` -> `ready`.
   - Display checkboxes for the workflow steps: `cleaning_complete`, `repairs_complete`, `painting_complete`, `inspection_passed`.
   - When all 4 checkboxes are checked, the backend automatically sets status to `ready`. Ensure the UI reflects this.

---

## Code Patterns & Rules

1. **Component Library:** We use `@base-ui/react` (NOT shadcn/radix). 
   - Dialogs use `DialogTrigger` with `className` and `buttonVariants` (no `asChild`).
   - Select components pass `string | null` to `onValueChange`.
2. **Mobile Responsiveness:** 
   - Always wrap `<Table>` components in `<div className="overflow-x-auto">`.
   - Use responsive grids (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
3. **Formatting:** Use the existing `formatCurrency`, `formatDate`, and `formatPercent` helpers from `lib/utils.ts`. Note: if the backend returns a percentage as a whole number (e.g., `13.62`), do not use `formatPercent` (which multiplies by 100); just use `${Number(val).toFixed(2)}%`.

Good luck! The backend is ready and waiting for these UIs.
