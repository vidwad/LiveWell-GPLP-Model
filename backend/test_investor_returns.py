"""
Phase 5: Investor Return Calculations Validation
=================================================
Validate IRR, equity multiple, cash waterfall, and LP/GP profit sharing
for the full development scenario with Year 7 exit.
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
# TEST 1: Full Development — 7-Year Hold with Exit
# ═══════════════════════════════════════════════════════════════
print("=" * 70)
print("TEST 1: FULL DEVELOPMENT — 7-Year Hold with Exit")
print("=" * 70)

payload_7yr = {
    "baseline_annual_revenue": 59100.0,
    "baseline_annual_expenses": 31902.68,
    "stabilized_annual_revenue": 240300.0,
    "annual_expense_ratio": 0.376,
    "vacancy_rate": 0.05,
    "annual_rent_increase": 0.05,
    "expense_growth_rate": 0.02,
    "construction_start_date": "2025-09-01",
    "construction_months": 12,
    "lease_up_months": 6,
    "carrying_cost_annual": 101250.0,
    "annual_debt_service": 82730.95,
    "exit_cap_rate": 0.055,
    "disposition_cost_pct": 0.02,
    "total_equity_invested": 450000.0,
    "debt_balance_at_exit": 1600000.0,
    "projection_years": 7,  # 7-year hold
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
    "cap_rate_curve": {"1": 0.065, "3": 0.06, "5": 0.055, "7": 0.055},
}

r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/projection", json=payload_7yr, headers=H)
result = r.json()

print(f"\n{'Year':>4} {'Phase':>12} {'Occ%':>6} {'GPR':>12} {'EGI':>12} {'NOI':>12} {'ADS':>12} {'CF':>12} {'Cum CF':>12}")
print("-" * 110)
for y in result["projections"]:
    print(f"{y['year']:>4} {y['phase']:>12} {y['occupancy_rate']:>5.0%} ${y['gross_potential_rent']:>10,.0f} ${y['effective_gross_income']:>10,.0f} ${y['noi']:>10,.0f} ${y['annual_debt_service']:>10,.0f} ${y['cash_flow']:>10,.0f} ${y['cumulative_cash_flow']:>10,.0f}")

s = result["summary"]
print(f"\n  --- Return Summary ---")
print(f"  Total Cash Flow:    ${s['total_cash_flow']:>12,.2f}")
print(f"  Exit NOI (Y7):      ${s['exit_noi']:>12,.2f}")
print(f"  Exit Cap Rate:      {s['exit_cap_rate']:.1%}")
print(f"  Terminal Value:     ${s['terminal_value']:>12,.2f}")
print(f"  Disposition Costs:  ${s['disposition_costs']:>12,.2f}")
print(f"  Debt Payoff:        ${payload_7yr['debt_balance_at_exit']:>12,.2f}")
print(f"  Net Exit Proceeds:  ${s['net_exit_proceeds']:>12,.2f}")
print(f"  Total Return:       ${s['total_return']:>12,.2f}")
print(f"  Equity Invested:    ${s['total_equity_invested']:>12,.2f}")
print(f"  Equity Multiple:    {s['equity_multiple']}x")
print(f"  IRR Estimate:       {s['irr_estimate']}%")
print(f"  Cash-on-Cash Avg:   {s['cash_on_cash_avg']}%")
print(f"  Annualized ROI:     {s.get('annualized_roi')}%")

# ── Manual IRR Verification ──
print(f"\n  --- Manual IRR Verification ---")
# Cash flow series for IRR
cfs = [-450000.0]  # Year 0: equity invested
for y in result["projections"]:
    cf = y["cash_flow"]
    cfs.append(cf)
# Add net exit proceeds to final year
cfs[-1] += s["net_exit_proceeds"]

print(f"  Cash flows: {[round(c, 0) for c in cfs]}")

# Verify IRR using numpy
try:
    import numpy as np
    irr_np = np.irr(cfs) * 100
    print(f"  NumPy IRR: {irr_np:.2f}%")
except:
    # Manual Newton-Raphson
    rate = 0.10
    for _ in range(200):
        npv = sum(cf / (1 + rate) ** t for t, cf in enumerate(cfs))
        dnpv = sum(-t * cf / (1 + rate) ** (t + 1) for t, cf in enumerate(cfs))
        if abs(dnpv) < 1e-12:
            break
        new_rate = rate - npv / dnpv
        if abs(new_rate - rate) < 1e-8:
            rate = new_rate
            break
        rate = new_rate
    print(f"  Manual IRR: {rate * 100:.2f}%")

print(f"  API IRR:    {s['irr_estimate']}%")

# Verify equity multiple
manual_em = s["total_return"] / 450000.0
print(f"\n  Manual Equity Multiple: {manual_em:.2f}x")
print(f"  API Equity Multiple:    {s['equity_multiple']}x")

# Verify terminal value
manual_tv = s["exit_noi"] / s["exit_cap_rate"]
print(f"\n  Manual Terminal Value: ${manual_tv:,.2f}")
print(f"  API Terminal Value:    ${s['terminal_value']:,.2f}")

# Verify net exit proceeds
manual_nep = manual_tv - (manual_tv * 0.02) - 1600000.0
print(f"  Manual Net Exit:      ${manual_nep:,.2f}")
print(f"  API Net Exit:         ${s['net_exit_proceeds']:,.2f}")

# ── Fee Verification ──
if s.get("fees"):
    f = s["fees"]
    print(f"\n  --- Fee Verification ---")
    print(f"  Selling Commission:  ${f['selling_commission']:,.2f} (10% of ${payload_7yr['gross_raise']:,.0f} = ${payload_7yr['gross_raise'] * 0.10:,.0f})")
    print(f"  Offering Cost:       ${f['offering_cost']:,.2f} (fixed)")
    print(f"  Acquisition Fee:     ${f['acquisition_fee']:,.2f} (2% of ${payload_7yr['acquisition_cost']:,.0f} = ${payload_7yr['acquisition_cost'] * 0.02:,.0f})")
    print(f"  Construction Mgmt:   ${f['total_construction_mgmt_fees']:,.2f} (1.5% of ${payload_7yr['construction_budget']:,.0f} = ${payload_7yr['construction_budget'] * 0.015:,.0f})")
    print(f"  Management Fees:     ${f['total_management_fees']:,.2f} (2.5% of EGI across all years)")
    print(f"  Total All Fees:      ${f['total_all_fees']:,.2f}")
    print(f"  Net Deployable:      ${f['net_deployable_capital']:,.2f} (${payload_7yr['gross_raise']:,.0f} - ${f['total_upfront_fees']:,.0f})")

# ── Profit Sharing ──
print(f"\n  --- Profit Sharing ---")
net_profit = max(0, s["total_return"] - 450000.0)
lp_share = net_profit * 0.70
gp_share = net_profit * 0.30
print(f"  Net Profit:     ${net_profit:,.2f}")
print(f"  LP Share (70%): ${lp_share:,.2f} (API: ${s.get('lp_share_of_profits', 0):,.2f})")
print(f"  GP Share (30%): ${gp_share:,.2f} (API: ${s.get('gp_share_of_profits', 0):,.2f})")

# ═══════════════════════════════════════════════════════════════
# TEST 2: As-Is Baseline — 10-Year Hold IRR
# ═══════════════════════════════════════════════════════════════
print("\n\n" + "=" * 70)
print("TEST 2: AS-IS BASELINE — 10-Year Hold IRR Verification")
print("=" * 70)

payload_baseline = {
    "baseline_annual_revenue": 59100.0,
    "baseline_annual_expenses": 31902.68,
    "vacancy_rate": 0.05,
    "annual_rent_increase": 0.05,
    "expense_growth_rate": 0.02,
    "annual_debt_service": 25520.53,
    "exit_cap_rate": 0.055,
    "disposition_cost_pct": 0.02,
    "total_equity_invested": 116250.0,
    "debt_balance_at_exit": 300000.0,
    "projection_years": 10,
    "management_fee_rate": 0.0,
    "construction_mgmt_fee_rate": 0.0,
    "offering_cost": 0.0,
    "selling_commission_rate": 0.0,
    "acquisition_fee_rate": 0.0,
    "cap_rate_curve": {"1": 0.065, "5": 0.06, "10": 0.055},
}

r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/projection", json=payload_baseline, headers=H)
result2 = r.json()
s2 = result2["summary"]

print(f"  Equity Multiple: {s2['equity_multiple']}x")
print(f"  IRR:             {s2['irr_estimate']}%")
print(f"  Cash-on-Cash:    {s2['cash_on_cash_avg']}%")
print(f"  Total Return:    ${s2['total_return']:,.2f}")

# Manual IRR
cfs2 = [-116250.0]
for y in result2["projections"]:
    cf = y["cash_flow"]
    cfs2.append(cf)
cfs2[-1] += s2["net_exit_proceeds"]

rate = 0.10
for _ in range(200):
    npv = sum(cf / (1 + rate) ** t for t, cf in enumerate(cfs2))
    dnpv = sum(-t * cf / (1 + rate) ** (t + 1) for t, cf in enumerate(cfs2))
    if abs(dnpv) < 1e-12:
        break
    new_rate = rate - npv / dnpv
    if abs(new_rate - rate) < 1e-8:
        rate = new_rate
        break
    rate = new_rate

print(f"  Manual IRR:      {rate * 100:.2f}%")
print(f"  Match: {'✓' if abs(rate * 100 - s2['irr_estimate']) < 0.5 else '✗'}")

print("\n" + "=" * 70)
print("INVESTOR RETURN TESTS COMPLETE")
print("=" * 70)
