# Local Development Sprints for Claude

This document outlines a series of well-defined, structured "grunt work" sprints for Claude to execute on your local machine. These tasks focus on fleshing out incomplete features, improving data realism, adding validation, and fixing known bugs, allowing Manus to focus on high-level architecture and complex feature design.

## Sprint 1: Critical Bug Fixes & Seed Data Enrichment

**Goal:** Fix the management fee calculation bug and enrich the seed data so the application feels more "lived in" during demos.

### Task 1.1: Fix Management Fee Calculation
**File:** `backend/app/services/investment_service.py`
**Instructions for Claude:**
1. Locate the `compute_lp_pnl` function (around line 411).
2. Scroll down to the "Management fees" section (around line 521).
3. Currently, it calculates the fee based on `total_funded` (capital invested):
   `annual_mgmt_fee = total_funded * mgmt_fee_pct`
4. Change this to calculate based on **gross revenue** as per the LP agreement:
   `annual_mgmt_fee = total_revenue_billed * mgmt_fee_pct`
5. Ensure the `period_mgmt_fee` calculation still works correctly with this new basis.

### Task 1.2: Enrich Seed Data
**File:** `backend/seed.py`
**Instructions for Claude:**
1. The current database only has 5 properties, 22 units, and 7 residents. We need more volume to make the dashboards look realistic.
2. Add 5 more properties to `Living Well Fund II LP` (RetireWell focus).
3. Create at least 20 more units across these new properties.
4. Add 15 more residents and generate 3-6 months of `RentPayment` records for each to populate the revenue charts.
5. Add 5-10 more `OperatingExpense` records across different categories (utilities, property_tax, insurance, maintenance) to make the NOI calculations more realistic.
6. Add 3-5 `ConstructionDraw` and `ConstructionExpense` records for the properties currently in the `construction` stage.

---

## Sprint 2: Form Validation & Error Handling

**Goal:** Make the frontend robust by adding proper validation to forms and ensuring the backend handles errors gracefully.

### Task 2.1: Frontend Form Validation
**Files:** `livingwell-frontend/src/app/(dashboard)/investment/[lpId]/page.tsx` and `livingwell-frontend/src/app/(dashboard)/operator/turnovers/page.tsx`
**Instructions for Claude:**
1. The LP detail page has a massive edit form (94 form fields) but almost zero validation.
2. Implement proper HTML5 validation attributes (`required`, `min="0"`, `max="100"`, `step="0.01"`) for all percentage and currency inputs.
3. Add `type="number"` to all numeric fields to trigger the correct mobile keyboard and prevent text input.
4. Do the same for the Unit Turnovers page forms.

### Task 2.2: Backend Error Handling
**Files:** `backend/app/routes/*.py`
**Instructions for Claude:**
1. Many backend routes lack `try/except` blocks, meaning database errors will cause 500 Internal Server Errors instead of graceful 400/422 responses.
2. Audit `portfolio.py`, `investment.py`, and `community.py`.
3. Wrap database commit operations (`db.commit()`) in `try/except` blocks.
4. Catch `sqlalchemy.exc.IntegrityError` and return a `HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")`.
5. Ensure `db.rollback()` is called in the `except` block before raising the HTTP exception.

---

## Sprint 3: Fleshing out "Stub" Pages

**Goal:** Replace placeholder pages with fully functional UI connected to the existing backend APIs.

### Task 3.1: Build out the Financial Model Page
**File:** `livingwell-frontend/src/app/(dashboard)/portfolio/[id]/model/page.tsx`
**Instructions for Claude:**
1. This page currently has a basic calculator UI but is mostly a stub.
2. Connect it to the backend endpoint: `POST /api/portfolio/properties/{property_id}/projection` or `POST /api/portfolio/model`.
3. Update the form state to match the `ModelingRequest` schema expected by the backend.
4. Render the results in a comprehensive table showing Year 1 through Year 10 projections (Revenue, Expenses, NOI, Debt Service, Cash Flow).
5. Add a Recharts line chart showing the projected NOI growth over the hold period.

### Task 3.2: Complete the Communities Detail Page
**File:** `livingwell-frontend/src/app/(dashboard)/communities/[id]/page.tsx`
**Instructions for Claude:**
1. This page has 500 lines of code but currently makes **zero** API calls (it uses mock data).
2. Wire it up to the `useCommunity(id)` hook to fetch real data.
3. Replace the mock `CommunityProperty` list with data from `useCommunityProperties(id)`.
4. Wire up the "Add Unit" and "Add Resident" dialogs to use the `useCreateUnit` and `useCreateResident` mutations.
5. Ensure the page displays a loading skeleton while `isLoading` is true.

---

## Sprint 4: Type Safety & UI Polish

**Goal:** Eliminate TypeScript `any`/`unknown` types and improve the visual consistency of loading states.

### Task 4.1: Fix TypeScript "unknown" Types
**File:** `livingwell-frontend/src/app/(dashboard)/portfolio/[id]/page.tsx`
**Instructions for Claude:**
1. Search for `Record<string, unknown>` in this file (used heavily in the Projections and Dev Plans tabs).
2. Create proper TypeScript interfaces in `src/types/portfolio.ts` for these structures (e.g., `ProjectionResult`, `EscalationProjection`).
3. Replace the `unknown` types with these strict interfaces.
4. Fix any resulting type errors in the rendering logic.

### Task 4.2: Add Loading Skeletons to Auth Pages
**Files:** `livingwell-frontend/src/app/(auth)/login/page.tsx` and `register/page.tsx`
**Instructions for Claude:**
1. These pages currently lack loading states during the authentication process.
2. Add `isPending` state tracking during the login/register API calls.
3. Disable the submit buttons and show a `Loader2` spinning icon when `isPending` is true.
4. Ensure error messages from failed logins are displayed clearly using the `toast` component or inline red text.
