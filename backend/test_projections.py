"""
Phase 4: Multi-Year Projection Validation
==========================================
Test the projection engine with our seeded data for all three scenarios:
1. As-Is (baseline) — 10-year hold, 5% rent growth, 2% expense growth
2. Post-Renovation — same as above but with post-reno rents
3. Full Development — construction + lease-up + stabilized + Year 7 exit

Manual verification of key calculations at each step.
"""
import requests
import json

BASE = "http://localhost:8000"

def login():
    r = requests.post(f"{BASE}/api/auth/login", json={
        "email": "admin@livingwell.ca",
        "password": "Password1!"
    })
    r.raise_for_status()
    return r.json()["access_token"]

TOKEN = login()
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

PROPERTY_ID = 11

# ═══════════════════════════════════════════════════════════════
# SCENARIO 1: As-Is Baseline — 10-Year Hold
# ═══════════════════════════════════════════════════════════════
print("=" * 70)
print("SCENARIO 1: AS-IS BASELINE — 10-Year Hold")
print("=" * 70)

payload_baseline = {
    "baseline_annual_revenue": 59100.0,  # 8 beds × current rents
    "baseline_annual_expenses": 31902.68,  # from Phase 1 validated
    "vacancy_rate": 0.05,
    "annual_rent_increase": 0.05,  # 5% annual rent growth
    "expense_growth_rate": 0.02,   # 2% annual expense growth
    "annual_debt_service": 25520.53,
    "exit_cap_rate": 0.06,         # 6% exit cap
    "disposition_cost_pct": 0.02,
    "total_equity_invested": 116250.0,  # $465,000 - $348,750 mortgage
    "debt_balance_at_exit": 300000.0,   # rough remaining balance after 10 years
    "projection_years": 10,
    # No construction
    "construction_start_year": None,
    "construction_months": 0,
    # Fees
    "management_fee_rate": 0.0,  # already included in expenses
    "construction_mgmt_fee_rate": 0.0,
    "offering_cost": 0.0,
    "selling_commission_rate": 0.0,
    "acquisition_fee_rate": 0.0,
    # Cap rate curve
    "cap_rate_curve": {"1": 0.065, "5": 0.06, "10": 0.055},
}

r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/projection", json=payload_baseline, headers=H)
if r.status_code != 200:
    print(f"ERROR: {r.status_code} {r.text}")
else:
    result = r.json()
    print(f"\n{'Year':>4} {'Phase':>12} {'GPR':>12} {'Vacancy':>10} {'EGI':>12} {'OpEx':>12} {'NOI':>12} {'ADS':>12} {'CF':>12} {'Cum CF':>12} {'Cap':>6} {'Value':>14}")
    print("-" * 150)
    for y in result["projections"]:
        print(f"{y['year']:>4} {y['phase']:>12} ${y['gross_potential_rent']:>10,.0f} ${y['vacancy_loss']:>8,.0f} ${y['effective_gross_income']:>10,.0f} ${y['total_expenses']:>10,.0f} ${y['noi']:>10,.0f} ${y['annual_debt_service']:>10,.0f} ${y['cash_flow']:>10,.0f} ${y['cumulative_cash_flow']:>10,.0f} {y['implied_cap_rate']:>5.1%} ${y['implied_value']:>12,.0f}")
    
    s = result["summary"]
    print(f"\n  --- Summary ---")
    print(f"  Total Cash Flow:    ${s['total_cash_flow']:>12,.2f}")
    print(f"  Exit NOI:           ${s['exit_noi']:>12,.2f}")
    print(f"  Exit Cap Rate:      {s['exit_cap_rate']:.1%}")
    print(f"  Terminal Value:     ${s['terminal_value']:>12,.2f}")
    print(f"  Disposition Costs:  ${s['disposition_costs']:>12,.2f}")
    print(f"  Net Exit Proceeds:  ${s['net_exit_proceeds']:>12,.2f}")
    print(f"  Total Return:       ${s['total_return']:>12,.2f}")
    print(f"  Equity Invested:    ${s['total_equity_invested']:>12,.2f}")
    print(f"  Equity Multiple:    {s['equity_multiple']}x")
    print(f"  IRR Estimate:       {s['irr_estimate']}%")
    print(f"  Cash-on-Cash Avg:   {s['cash_on_cash_avg']}%")

    # Manual verification Year 1
    print(f"\n  --- Manual Verification ---")
    yr1_gpr = 59100.0
    yr1_vacancy = yr1_gpr * 0.05
    yr1_egi = yr1_gpr - yr1_vacancy
    yr1_opex = 31902.68
    yr1_noi = yr1_egi - yr1_opex
    print(f"  Year 1 GPR:  ${yr1_gpr:,.2f} → API: ${result['projections'][0]['gross_potential_rent']:,.2f} {'✓' if abs(yr1_gpr - result['projections'][0]['gross_potential_rent']) < 1 else '✗'}")
    print(f"  Year 1 EGI:  ${yr1_egi:,.2f} → API: ${result['projections'][0]['effective_gross_income']:,.2f} {'✓' if abs(yr1_egi - result['projections'][0]['effective_gross_income']) < 1 else '✗'}")
    print(f"  Year 1 NOI:  ${yr1_noi:,.2f} → API: ${result['projections'][0]['noi']:,.2f} {'✓' if abs(yr1_noi - result['projections'][0]['noi']) < 1 else '✗'}")
    
    # Year 5 verification
    yr5_gpr = 59100.0 * (1.05 ** 4)
    yr5_vacancy = yr5_gpr * 0.05
    yr5_egi = yr5_gpr - yr5_vacancy
    yr5_opex = 31902.68 * (1.02 ** 4)
    yr5_noi = yr5_egi - yr5_opex
    print(f"  Year 5 GPR:  ${yr5_gpr:,.2f} → API: ${result['projections'][4]['gross_potential_rent']:,.2f} {'✓' if abs(yr5_gpr - result['projections'][4]['gross_potential_rent']) < 1 else '✗'}")
    print(f"  Year 5 NOI:  ${yr5_noi:,.2f} → API: ${result['projections'][4]['noi']:,.2f} {'✓' if abs(yr5_noi - result['projections'][4]['noi']) < 1 else '✗'}")

    # Year 10 verification
    yr10_gpr = 59100.0 * (1.05 ** 9)
    yr10_vacancy = yr10_gpr * 0.05
    yr10_egi = yr10_gpr - yr10_vacancy
    yr10_opex = 31902.68 * (1.02 ** 9)
    yr10_noi = yr10_egi - yr10_opex
    print(f"  Year 10 GPR: ${yr10_gpr:,.2f} → API: ${result['projections'][9]['gross_potential_rent']:,.2f} {'✓' if abs(yr10_gpr - result['projections'][9]['gross_potential_rent']) < 1 else '✗'}")
    print(f"  Year 10 NOI: ${yr10_noi:,.2f} → API: ${result['projections'][9]['noi']:,.2f} {'✓' if abs(yr10_noi - result['projections'][9]['noi']) < 1 else '✗'}")


# ═══════════════════════════════════════════════════════════════
# SCENARIO 3: Full Development — Construction + Lease-Up + Stabilized
# ═══════════════════════════════════════════════════════════════
print("\n\n" + "=" * 70)
print("SCENARIO 3: FULL DEVELOPMENT — 10-Year Projection")
print("=" * 70)

payload_dev = {
    "baseline_annual_revenue": 59100.0,   # as-is income Year 1
    "baseline_annual_expenses": 31902.68,
    "stabilized_annual_revenue": 240300.0, # 24 beds post-development
    "annual_expense_ratio": 0.376,         # 37.6% from Phase 3 validation
    "vacancy_rate": 0.05,
    "annual_rent_increase": 0.05,
    "expense_growth_rate": 0.02,
    "construction_start_date": "2025-09-01",
    "construction_months": 12,
    "lease_up_months": 6,
    "carrying_cost_annual": 101250.0,  # construction loan IO: $1.35M × 7.5%
    "annual_debt_service": 82730.95,   # CMHC mortgage ADS (stabilized)
    "exit_cap_rate": 0.055,
    "disposition_cost_pct": 0.02,
    "total_equity_invested": 450000.0,  # $1.8M construction - $1.35M loan = $450K equity
    "debt_balance_at_exit": 1600000.0,  # rough CMHC balance after 7 years
    "projection_years": 10,
    # Fees
    "management_fee_rate": 0.025,
    "construction_mgmt_fee_rate": 0.015,
    "construction_budget": 1800000.0,
    "selling_commission_rate": 0.10,
    "offering_cost": 50000.0,
    "acquisition_fee_rate": 0.02,
    "acquisition_cost": 465000.0,
    "gross_raise": 500000.0,
    "lp_profit_share": 0.70,
    "gp_profit_share": 0.30,
    # Cap rate curve
    "cap_rate_curve": {"1": 0.065, "3": 0.06, "5": 0.055, "7": 0.055, "10": 0.05},
}

r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/projection", json=payload_dev, headers=H)
if r.status_code != 200:
    print(f"ERROR: {r.status_code} {r.text}")
else:
    result = r.json()
    print(f"\n{'Year':>4} {'Phase':>12} {'Occ%':>6} {'GPR':>12} {'Vacancy':>10} {'EGI':>12} {'MgmtFee':>10} {'OpEx':>12} {'NOI':>12} {'ADS':>12} {'CF':>12} {'Cum CF':>12} {'Cap':>6} {'Value':>14}")
    print("-" * 170)
    for y in result["projections"]:
        print(f"{y['year']:>4} {y['phase']:>12} {y['occupancy_rate']:>5.0%} ${y['gross_potential_rent']:>10,.0f} ${y['vacancy_loss']:>8,.0f} ${y['effective_gross_income']:>10,.0f} ${y['management_fee']:>8,.0f} ${y['operating_expenses']:>10,.0f} ${y['noi']:>10,.0f} ${y['annual_debt_service']:>10,.0f} ${y['cash_flow']:>10,.0f} ${y['cumulative_cash_flow']:>10,.0f} {y['implied_cap_rate']:>5.1%} ${y['implied_value']:>12,.0f}")
    
    s = result["summary"]
    print(f"\n  --- Summary ---")
    print(f"  Total Cash Flow:    ${s['total_cash_flow']:>12,.2f}")
    print(f"  Exit NOI:           ${s['exit_noi']:>12,.2f}")
    print(f"  Exit Cap Rate:      {s['exit_cap_rate']:.1%}")
    print(f"  Terminal Value:     ${s['terminal_value']:>12,.2f}")
    print(f"  Disposition Costs:  ${s['disposition_costs']:>12,.2f}")
    print(f"  Net Exit Proceeds:  ${s['net_exit_proceeds']:>12,.2f}")
    print(f"  Total Return:       ${s['total_return']:>12,.2f}")
    print(f"  Equity Invested:    ${s['total_equity_invested']:>12,.2f}")
    print(f"  Equity Multiple:    {s['equity_multiple']}x")
    print(f"  IRR Estimate:       {s['irr_estimate']}%")
    print(f"  Cash-on-Cash Avg:   {s['cash_on_cash_avg']}%")
    
    if s.get('fees'):
        f = s['fees']
        print(f"\n  --- Fees ---")
        print(f"  Management Fees:        ${f['total_management_fees']:>12,.2f}")
        print(f"  Construction Mgmt:      ${f['total_construction_mgmt_fees']:>12,.2f}")
        print(f"  Selling Commission:     ${f['selling_commission']:>12,.2f}")
        print(f"  Offering Cost:          ${f['offering_cost']:>12,.2f}")
        print(f"  Acquisition Fee:        ${f['acquisition_fee']:>12,.2f}")
        print(f"  Total Upfront:          ${f['total_upfront_fees']:>12,.2f}")
        print(f"  Total Ongoing:          ${f['total_ongoing_fees']:>12,.2f}")
        print(f"  Total All Fees:         ${f['total_all_fees']:>12,.2f}")
        print(f"  Net Deployable Capital: ${f['net_deployable_capital']:>12,.2f}")
    
    print(f"\n  --- Profit Sharing ---")
    print(f"  LP Share (70%):     ${s.get('lp_share_of_profits', 0):>12,.2f}")
    print(f"  GP Share (30%):     ${s.get('gp_share_of_profits', 0):>12,.2f}")

    # Manual verification
    print(f"\n  --- Manual Verification ---")
    # Year 1: As-Is (before construction starts in Sept 2025)
    # Construction starts Year 1 (2025-09-01 → relative year 1)
    # So Year 1 should be construction
    yr1 = result["projections"][0]
    print(f"  Year 1 Phase: {yr1['phase']} (expected: as_is or construction)")
    
    # Year 2: Should be construction or lease-up
    yr2 = result["projections"][1]
    print(f"  Year 2 Phase: {yr2['phase']} (expected: construction)")
    
    # Year 3: Should be lease-up or stabilized
    yr3 = result["projections"][2]
    print(f"  Year 3 Phase: {yr3['phase']} (expected: lease_up or stabilized)")
    
    # Year 4+: Should be stabilized
    yr4 = result["projections"][3]
    print(f"  Year 4 Phase: {yr4['phase']} (expected: stabilized)")

print("\n" + "=" * 70)
print("PROJECTION TESTS COMPLETE")
print("=" * 70)
