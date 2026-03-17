# Claude Development Sprints — Round 2

This document outlines the next set of development sprints for the Living Well Communities GPLP Model. These tasks focus on wiring up the remaining stub pages to the backend API, fixing minor bugs discovered during end-to-end testing, and ensuring all pages have proper loading states.

## Sprint 5: Wiring Up Stub Pages (Part 1)

Several pages in the dashboard are currently using static mock data and have no API integration (0 `useQuery` or `apiClient` calls). Your task is to wire these up using the existing hooks or by creating new ones.

### Task 5.1: Dashboard Page
- **File:** `livingwell-frontend/src/app/(dashboard)/dashboard/page.tsx`
- **Current State:** 643 lines of code, 8 hooks imported, but 0 API calls. All data is hardcoded.
- **Action:** 
  1. Import and use `usePortfolioSummary`, `useLPs`, and `useCommunities` from the respective hook files.
  2. Replace the hardcoded `portfolioStats` with real data from `usePortfolioSummary`.
  3. Replace the hardcoded `recentActivity` with real notifications from `useNotifications`.
  4. Ensure loading states (`Skeleton`) are displayed while data is fetching.

### Task 5.2: Reports Page
- **File:** `livingwell-frontend/src/app/(dashboard)/reports/page.tsx`
- **Current State:** 448 lines of code, imports `useReportSummary` and `useManagementPack`, but the hooks themselves might be returning mock data or the backend endpoints are missing.
- **Action:**
  1. Verify the `useReportSummary` hook in `src/hooks/useReports.ts`.
  2. Ensure it calls a real backend endpoint (e.g., `/api/reports/summary`).
  3. If the backend endpoint is missing or returns a 404, create a basic implementation in `backend/app/routes/reports.py` that aggregates data from properties, units, and financials.

## Sprint 6: Wiring Up Stub Pages (Part 2)

### Task 6.1: eTransfers Page
- **File:** `livingwell-frontend/src/app/(dashboard)/etransfers/page.tsx`
- **Current State:** 267 lines of code, 0 API calls.
- **Action:**
  1. Import `useETransfers` from `src/hooks/useLifecycle.ts` (it exists but isn't used in the page).
  2. Replace the hardcoded `transactions` array with the data returned from the hook.
  3. Wire up the "Approve" and "Reject" buttons to a mutation (you may need to add `useUpdateETransferStatus` to the hooks file).

### Task 6.2: Quarterly Reports Page
- **File:** `livingwell-frontend/src/app/(dashboard)/quarterly-reports/page.tsx`
- **Current State:** 434 lines of code, 0 API calls.
- **Action:**
  1. Import `useQuarterlyReports` from `src/hooks/useLifecycle.ts`.
  2. Replace the hardcoded `reports` array with real data.
  3. Wire up the "Generate New Report" button to a mutation.

## Sprint 7: Bug Fixes & Polish

### Task 7.1: Financial Model Step Validation
- **File:** `livingwell-frontend/src/app/(dashboard)/portfolio/[id]/model/page.tsx`
- **Issue:** The "Exit Cap Rate" field (and potentially others) has a restrictive `step` attribute that prevents users from entering decimal values like `5.5`. The browser throws a validation error: "Please enter a valid value. The two nearest valid values are 5.35 and 5.6".
- **Action:**
  1. Find all `<Input type="number">` fields in the projection form.
  2. Change the `step` attribute to `"any"` or `"0.01"` for percentage and rate fields (Exit Cap Rate, Vacancy Rate, Expense Ratio, Annual Rent Increase, Expense Growth Rate).

### Task 7.2: Community Detail Occupancy Calculation
- **File:** `livingwell-frontend/src/app/(dashboard)/communities/[id]/page.tsx`
- **Issue:** The community detail page mixes baseline and redevelopment units in its top-level stats. For example, a property with 14 occupied beds and 24 planned redevelopment beds shows an occupancy rate of 29.2% (14 / 48) instead of 100% (14 / 14).
- **Action:**
  1. Update the frontend calculation to only include `is_baseline = true` units in the "Available" and "Occupancy Rate" calculations.
  2. Alternatively, update the backend endpoint (`/api/communities/{id}`) to return separated stats (baseline vs. redevelopment) similar to how the property `unit-summary` endpoint was fixed.

## Sprint 8: Empty State Handling

### Task 8.1: Empty Data Tables
- **Issue:** Several database tables are completely empty even after seeding: `arrears_records`, `funding_opportunities`, `notifications`, `refinance_scenarios`, `sale_scenarios`, `unit_turnovers`, `valuation_history`.
- **Action:**
  1. Update `backend/seed.py` to include at least 2-3 sample records for each of these tables so the corresponding frontend pages have data to display during development.
  2. Ensure the foreign keys (e.g., `property_id`, `unit_id`, `resident_id`) point to valid seeded entities.
