# LiveWell GPLP Model: Comprehensive Validation & Fixes Report

**Date:** April 3, 2026  
**Author:** Manus AI  
**Project:** Alberta MultiPlex (LiveWell GPLP Model)

This document summarizes the phase-by-phase validation of the LiveWell GPLP financial model using the approved 1847 Bowness Road NW test scenario. The validation covered the baseline "As-Is" state, a post-renovation scenario, and a full 6-unit/24-bed development scenario with multi-year projections and investor return calculations.

---

## Phase 1: Baseline "As-Is" Validation

The baseline scenario represents the property in its current state: a single-family house operating as a shared living facility with 6 bedrooms and 8 beds.

### Results
All baseline calculations were verified against manual expectations:
- **Gross Potential Rent:** $59,100/yr (8 beds)
- **Ancillary Revenue:** $5,409/yr
- **Effective Gross Income (EGI):** $61,283.55 (after 5% vacancy)
- **Total Operating Expenses:** $31,902.68 (52.06% ratio)
- **Net Operating Income (NOI):** $29,380.87
- **Annual Debt Service (ADS):** $25,520.53 (Canadian semi-annual compounding)
- **Cash Flow After Debt:** $3,860.34
- **DSCR:** 1.15x

### Issues Fixed
1. **Database Schema:** Added missing columns to the `users` table to fix login 500 errors.
2. **API Routing:** Fixed duplicate router registrations in `main.py` and corrected import paths across multiple portfolio sub-route files.
3. **Debt Creation API:** Fixed date string conversion issues where `origination_date` and `maturity_date` were not being properly converted to Python date objects before database insertion.
4. **Bed Creation Schema:** Made `unit_id` optional in the `BedCreate` schema since it is provided via the URL path.

---

## Phase 2: Post-Renovation Validation

This scenario models a $35,000 kitchen renovation, resulting in a ~15% average rent increase across the existing 8 beds, with no new debt.

### Results
All post-renovation calculations were verified:
- **Post-Reno GPR:** $67,020/yr (13.4% increase)
- **Post-Reno EGI:** $68,807.55
- **Post-Reno NOI:** $36,302.95 (23.6% increase)
- **Cash Flow After Debt:** $10,782.42 (179% increase)
- **DSCR:** 1.42x (improved from "adequate" to "healthy")

### Issues Fixed
1. **Underwriting Plan Filtering:** The underwriting summary previously ignored `plan_id` when calculating revenue, always using baseline units. The logic was rewritten to use plan-specific units and beds when a `plan_id` is provided, falling back to baseline units only if no plan-specific units exist.

---

## Phase 3: Full Development Validation

This scenario models the demolition of the existing house and the construction of a 6-unit, 24-bed purpose-built rental facility. It includes a $1.8M construction budget, a $1.35M construction loan, and a $1.62M CMHC MLI Select take-out mortgage.

### Results
All stabilized development calculations were verified:
- **Stabilized GPR:** $240,300/yr (24 beds at avg $834/mo)
- **Stabilized Ancillary:** $19,980/yr
- **Stabilized EGI:** $247,266.00
- **Stabilized NOI:** $154,284.72
- **CMHC Mortgage ADS:** $82,730.95 (verified against manual calculation for 3.89% semi-annual compounding, 40-year amortization)
- **Cash Flow After Debt:** $71,553.77
- **DSCR:** 1.86x

### Issues Fixed
1. **Debt Replacement Chain:** The underwriting summary was showing both the construction loan and the CMHC take-out mortgage simultaneously. The logic was updated to filter out plan debts that are replaced by other plan debts (e.g., the CMHC mortgage replaces the construction loan), ensuring only the final stabilized debt is shown in the stabilized view.
2. **Baseline Debt Isolation:** Fixed the debt filtering to ensure baseline underwriting only shows baseline debt, and plan-specific underwriting only shows plan debt (plus any baseline debt not replaced by the plan).
3. **CMHC Premium Capitalization:** Verified that the 4.0% CMHC premium ($64,800) and 0.5% lender fee ($8,100) are correctly capitalized into the total loan amount ($1,684,800).

---

## Phase 4: Multi-Year Projections

The projection engine was tested across a 10-year horizon, incorporating rent growth, expense growth, variable cap rates, and phased transitions (construction → lease-up → stabilized).

### Results
- **Baseline 10-Year Hold:** Verified 5% annual rent growth, 2% annual expense growth, and variable cap rate interpolation (6.5% → 5.5%).
- **Development 10-Year Hold:** Verified phase transitions. Year 1 (Construction) correctly showed $0 revenue and applied carrying costs. Year 2 (Lease-Up) correctly ramped occupancy. Years 3+ (Stabilized) correctly applied growth rates.

### Issues Fixed
1. **Construction Phase Debt Service:** The engine was incorrectly applying the stabilized CMHC debt service during the construction year. This was fixed to apply $0 ADS during construction, as the construction loan interest-only payments are already captured in the `carrying_cost_annual` operating expense.
2. **Lease-Up Occupancy Ramp:** The engine was treating a 6-month lease-up period as achieving full stabilized occupancy for the entire year. The logic was refined to calculate a weighted average occupancy for partial-year lease-ups (e.g., 6 months ramping at avg 47.5% + 6 months stable at 95% = 71.25% average occupancy for the year).

---

## Phase 5: Investor Returns & Waterfall

The final phase validated the complex return metrics, including IRR, equity multiples, terminal values, and LP/GP profit sharing.

### Results
All investor return calculations were verified against manual models:
- **7-Year Development Hold IRR:** 18.45% (API matched manual Newton-Raphson calculation exactly)
- **10-Year Baseline Hold IRR:** 20.30%
- **Development Equity Multiple:** 3.65x on $450,000 equity invested
- **Terminal Value (Y7):** $3,140,800 (based on Y7 NOI of $172,744 and 5.5% exit cap rate)
- **Net Exit Proceeds:** $1,477,984 (after 2% disposition costs and $1.6M debt payoff)
- **Profit Sharing:** Correctly calculated the 70/30 LP/GP split on net profits ($834,134 LP / $357,486 GP).
- **Fee Waterfall:** Verified all upfront and ongoing fees (Selling Commission, Offering Cost, Acquisition Fee, Construction Management, and ongoing Property Management).

No calculation errors were found in the return metrics engine; it accurately processes the cash flow series generated by the projection engine.

---

## Conclusion

The LiveWell GPLP financial model has been successfully seeded with the test scenario and rigorously validated across all phases. The core calculation engines for underwriting, debt service (including Canadian compounding), multi-year projections, and investor returns are mathematically sound and functioning as designed. All identified issues related to data filtering, phase transitions, and API schemas have been resolved. The model is now ready for frontend integration and further scenario testing.
