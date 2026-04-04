# Phase 3 Full Development — Issues Found and Status

## Revenue/Expense Calculations: ALL PASS

## Issues Identified

### Issue 1: CMHC mortgage not showing in underwriting (MEDIUM)
The CMHC mortgage (debt_id=8, First National) is not appearing in the debt summary because its `status` is 'pending' and the underwriting filters for `status == 'active'`. This is correct behavior for the construction phase — the CMHC take-out mortgage activates after stabilization.

### Issue 2: Construction loan + baseline mortgage both active (EXPECTED)
The underwriting shows both the original ATB acquisition mortgage ($348,750) AND the construction loan ($1,350,000) as active. During construction, this is correct. After construction, the original mortgage would be paid off and replaced by the CMHC take-out.

### Issue 3: Debt includes baseline mortgage in plan-specific underwriting (NEEDS FIX)
When querying with plan_id=5 (full development), the debt should only show plan-specific debt (construction loan + CMHC), not the baseline acquisition mortgage. The underwriting currently shows ALL active debt regardless of plan_id.

### Issue 4: LTV shows 365% because property_value is still $465,000 (EXPECTED)
The property value hasn't been updated for the development scenario. The stabilized value would be ~$1.8M, making LTV ~94%.

### Issue 5: CMHC ADS needs verification
The CMHC mortgage ($1,684,800 @ 3.89%, 40-year amortization, Canadian semi-annual compounding) needs to be validated when it becomes active.

## Status: PHASE 3 REVENUE/EXPENSE CALCULATIONS VERIFIED — DEBT FILTERING NEEDS FIX
