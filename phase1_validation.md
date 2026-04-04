# Phase 1 As-Is Validation Results

## Property: 1847 Bowness Road NW (ID: 11)

### Revenue Validation

| Line Item | Calculated | Expected | Status |
|---|---|---|---|
| Gross Potential Rent (8 beds) | $59,100.00 | $59,100.00 | PASS |
| Ancillary Revenue | $5,409.00 | $5,409.00 | PASS |
| Gross Potential Revenue | $64,509.00 | $64,509.00 | PASS |
| Vacancy Loss (5%) | $3,225.45 | $3,225.45 | PASS |
| Effective Gross Income | $61,283.55 | $61,283.55 | PASS |

### Expense Validation

| Category | Amount | Method | Status |
|---|---|---|---|
| Property Tax | $3,800.00 | fixed | PASS |
| Insurance | $2,400.00 | fixed | PASS |
| Utilities | $12,000.00 | fixed | PASS |
| Repairs/Maintenance | $4,000.00 | fixed | PASS |
| Management Fee (8% EGI) | $4,902.68 | pct_egi | PASS |
| Landscaping/Snow | $2,400.00 | fixed | PASS |
| Capital Reserves | $2,400.00 | fixed | PASS |
| **Total OpEx** | **$31,902.68** | | PASS |
| Expense Ratio | 52.06% | | PASS |

### NOI Validation

| Metric | Value | Status |
|---|---|---|
| NOI | $29,380.87 | PASS |
| NOI/Unit | $29,380.87 | PASS |
| NOI/Bed | $3,672.61 | PASS |
| NOI/SqFt | $14.69 | PASS |

### Debt Validation

| Metric | Value | Expected | Status |
|---|---|---|---|
| Loan Amount | $348,750.00 | $348,750.00 | PASS |
| Interest Rate | 5.49% | 5.49% | PASS |
| Compounding | semi_annual | semi_annual | PASS |
| Annual Debt Service | $25,520.53 | ~$25,520 | PASS |
| Cash Flow After Debt | $3,860.34 | | PASS |

### Key Ratios

| Ratio | Value | Assessment |
|---|---|---|
| DSCR | 1.15x | Adequate |
| LTV | 75.0% | Moderate |
| Debt Yield | 8.42% | |
| Break-Even Occupancy | 89.02% | |
| Implied Value @ 5.5% Cap | $534,197.56 | |
| Cash-on-Cash (est) | 3.32% | $3,860 / $116,250 equity |

### Manual Verification of ADS Calculation

Canadian semi-annual compounding:
- Nominal rate: 5.49%
- Effective monthly rate: (1 + 0.0549/2)^(1/6) - 1 = 0.004519 (approx)
- Monthly P&I: $348,750 × [0.004519 × (1.004519)^300] / [(1.004519)^300 - 1]
- Monthly payment: ~$2,126.71
- Annual: ~$25,520.53 PASS

### Issues Fixed

1. BedCreate schema required unit_id in body (made optional)
2. Debt creation failed with date string error (added date conversion)
3. Debt endpoint was at /debt-facilities not /properties/{id}/debt
4. Auto-created beds had $0 rent (deleted and recreated with proper rents)

### Status: PHASE 1 COMPLETE - ALL CALCULATIONS VERIFIED
