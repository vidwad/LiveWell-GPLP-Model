"""
Phase 3: Full Development Seed Script
=======================================
New 6-unit / 18-bedroom / 24-bed purpose-built development at 1847 Bowness Road NW

Scenario:
- Demolish existing house, build 6-unit purpose-built rental
- 6 units × 3 bedrooms × 4 beds each = 18 bedrooms, 24 beds
  - Each unit: 2 single-occupancy BR + 1 double-occupancy BR
  - Per unit: $863 + $805 + $1,300 (2×$650) = $2,968/mo
- Construction budget: $1.8M total
  - Hard costs: $1,500,000
  - Soft costs: $200,000
  - Site costs: $100,000
- Construction loan: $1,350,000 (75% LTC), 7.5% IO
- Take-out CMHC insured mortgage: $2,430,000 (75% LTV @ stabilized value $3.24M)
  - 3.85% fixed, 35-year amortization
  - CMHC premium: 2.75% ($66,825)
  - MLI Select program
  - DSCR: 1.10x
- Stabilized NOI: $145,783
- 5% annual rent growth, 2% expense growth
"""
import requests
import json
import sqlite3
import sys

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

print("=" * 60)
print("PHASE 3: Full Development Seed")
print("=" * 60)

# ── STEP 1: Create Full Development Plan ─────────────────────
print("\n═══ STEP 1: Create Full Development Plan ═══")

plan_data = {
    "version": 2,
    "plan_name": "6-Unit Purpose-Built Development",
    "status": "approved",
    "planned_units": 6,
    "planned_beds": 24,
    "planned_sqft": 6000,
    "hard_costs": 1500000,
    "soft_costs": 200000,
    "site_costs": 100000,
    "financing_costs": 0,
    "contingency_percent": 0,
    "cost_per_sqft": 300,
    "estimated_construction_cost": 1800000,
    "projected_annual_revenue": 222714,  # $213,696 beds + $9,018 ancillary
    "projected_annual_noi": 145783,
    "development_start_date": "2025-09-01",
    "construction_duration_days": 365,
    "estimated_completion_date": "2026-09-01",
    "estimated_stabilization_date": "2027-03-01",
    "rent_pricing_mode": "by_bed",
    "annual_rent_increase_pct": 5.0,
}

r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/plans", json=plan_data, headers=H)
if r.status_code == 201:
    plan = r.json()
    PLAN_ID = plan["plan_id"]
    print(f"  ✓ Created plan: {plan['plan_name']} (ID: {PLAN_ID})")
else:
    print(f"  ✗ Failed: {r.status_code} {r.text}")
    sys.exit(1)

# ── STEP 2: Create 6 Post-Development Units ─────────────────
print("\n═══ STEP 2: Create 6 Post-Development Units ═══")

# All 6 units are 3BR (2 single-occ + 1 double-occ bedroom = 4 beds each)
unit_configs = [
    {"unit_number": "101", "unit_type": "3br", "bed_count": 4, "sqft": 1000, "floor": "1", "bedroom_count": 3},
    {"unit_number": "102", "unit_type": "3br", "bed_count": 4, "sqft": 1000, "floor": "1", "bedroom_count": 3},
    {"unit_number": "201", "unit_type": "3br", "bed_count": 4, "sqft": 1000, "floor": "2", "bedroom_count": 3},
    {"unit_number": "202", "unit_type": "3br", "bed_count": 4, "sqft": 1000, "floor": "2", "bedroom_count": 3},
    {"unit_number": "301", "unit_type": "3br", "bed_count": 4, "sqft": 1000, "floor": "3", "bedroom_count": 3},
    {"unit_number": "302", "unit_type": "3br", "bed_count": 4, "sqft": 1000, "floor": "3", "bedroom_count": 3},
]

unit_ids = []
for uc in unit_configs:
    unit_data = {
        **uc,
        "is_legal_suite": False,
        "is_occupied": True,
        "renovation_phase": "post_renovation",
        "development_plan_id": PLAN_ID,
        "notes": f"New build - {uc['unit_type']} unit"
    }
    r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/units", json=unit_data, headers=H)
    if r.status_code == 201:
        unit = r.json()
        unit_ids.append(unit["unit_id"])
        print(f"  ✓ Unit {uc['unit_number']} ({uc['unit_type']}, {uc['bed_count']} beds, {uc['sqft']} sqft) → ID: {unit['unit_id']}")
    else:
        print(f"  ✗ Unit {uc['unit_number']}: {r.status_code} {r.text}")

# ── STEP 3: Create Beds for Each Unit ────────────────────────
print("\n═══ STEP 3: Create Beds for Each Unit ═══")

conn = sqlite3.connect('livingwell_dev.db')
cursor = conn.cursor()

# Bed configurations — all units are identical 3BR
# BR1 (single $863), BR2 (single $805), BR3 (double 2×$650 = $1,300/room)
# Per unit: $863 + $805 + $650 + $650 = $2,968/mo
# Rents are 15% above as-is baseline rates for new construction
bed_configs = {
    "3br": [
        {"bed_label": "BR1-A", "monthly_rent": 863, "bedroom_number": 1, "rent_type": "private_pay"},
        {"bed_label": "BR2-A", "monthly_rent": 805, "bedroom_number": 2, "rent_type": "private_pay"},
        {"bed_label": "BR3-A", "monthly_rent": 650, "bedroom_number": 3, "rent_type": "shared_room"},
        {"bed_label": "BR3-B", "monthly_rent": 650, "bedroom_number": 3, "rent_type": "shared_room"},
    ],
}

total_monthly = 0
total_beds = 0

for i, (unit_id, uc) in enumerate(zip(unit_ids, unit_configs)):
    # Delete auto-created beds
    cursor.execute('DELETE FROM beds WHERE unit_id = ?', (unit_id,))
    
    unit_type = uc["unit_type"]
    beds = bed_configs[unit_type]
    unit_monthly = 0
    
    for bed in beds:
        cursor.execute('''INSERT INTO beds (unit_id, bed_label, monthly_rent, bedroom_number, rent_type, status, is_post_renovation)
                          VALUES (?, ?, ?, ?, ?, 'occupied', 1)''',
                       (unit_id, bed["bed_label"], bed["monthly_rent"], bed["bedroom_number"], bed["rent_type"]))
        unit_monthly += bed["monthly_rent"]
        total_beds += 1
    
    total_monthly += unit_monthly
    print(f"  ✓ Unit {uc['unit_number']} ({unit_type}): 4 beds, ${unit_monthly:,.0f}/mo")

conn.commit()
conn.close()

print(f"\n  Total Beds: {total_beds}")
print(f"  Total Monthly Rent: ${total_monthly:,.2f}")
print(f"  Total Annual Rent:  ${total_monthly * 12:,.2f}")
print(f"  Avg Rent/Bed:       ${total_monthly / total_beds:,.2f}/mo") if total_beds > 0 else print("  Avg Rent/Bed: N/A")

# ── STEP 4: Create Stabilized Ancillary Revenue ─────────────
print("\n═══ STEP 4: Stabilized Ancillary Revenue ═══")

ancillary_streams = [
    {"stream_type": "parking", "description": "Surface Parking (6 stalls)", "total_count": 6, "monthly_rate": 50.00, "utilization_pct": 100, "development_plan_id": PLAN_ID},
    {"stream_type": "pet_fee", "description": "Pet Fees (6 units @ 50% util)", "total_count": 6, "monthly_rate": 50.00, "utilization_pct": 50, "development_plan_id": PLAN_ID},
    {"stream_type": "storage", "description": "Storage Lockers (6 available)", "total_count": 6, "monthly_rate": 75.00, "utilization_pct": 67, "development_plan_id": PLAN_ID},
    # Laundry is in-unit — no revenue
]

anc_total = 0
for stream in ancillary_streams:
    r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/ancillary-revenue", json=stream, headers=H)
    if r.status_code == 201:
        util = stream["utilization_pct"] / 100
        annual = stream["monthly_rate"] * stream["total_count"] * util * 12
        anc_total += annual
        print(f"  ✓ {stream['stream_type']}: ${annual:,.2f}/yr")
    else:
        print(f"  ✗ {stream['stream_type']}: {r.status_code} {r.text}")

print(f"  Total Ancillary: ${anc_total:,.2f}/yr")

# ── STEP 5: Create Stabilized Operating Expenses ────────────
print("\n═══ STEP 5: Stabilized Operating Expenses ═══")

expenses = [
    {"category": "property_tax", "description": "Municipal Property Tax", "calc_method": "fixed", "base_amount": 10800, "development_plan_id": PLAN_ID},
    {"category": "insurance", "description": "Property & Liability Insurance", "calc_method": "fixed", "base_amount": 5400, "development_plan_id": PLAN_ID},
    {"category": "utilities", "description": "All Utilities (owner-paid)", "calc_method": "fixed", "base_amount": 14400, "development_plan_id": PLAN_ID},
    {"category": "repairs_maintenance", "description": "Maintenance & Repairs", "calc_method": "fixed", "base_amount": 6000, "development_plan_id": PLAN_ID},
    {"category": "management_fee", "description": "Property Management (8% of EGI)", "calc_method": "pct_egi", "base_amount": 8.0, "development_plan_id": PLAN_ID},
    {"category": "other", "description": "Common Area & Admin", "calc_method": "fixed", "base_amount": 5069, "development_plan_id": PLAN_ID},
    {"category": "reserves", "description": "Capital Reserves ($300/bed/yr)", "calc_method": "fixed", "base_amount": 7200, "development_plan_id": PLAN_ID},
]

for exp in expenses:
    r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/operating-expenses", json=exp, headers=H)
    if r.status_code == 201:
        print(f"  ✓ {exp['category']}: ${exp['base_amount']}/yr ({exp['calc_method']})")
    else:
        print(f"  ✗ {exp['category']}: {r.status_code} {r.text}")

# ── STEP 6: Create Construction Loan ────────────────────────
print("\n═══ STEP 6: Create Construction Loan ═══")

conn = sqlite3.connect('livingwell_dev.db')
cursor = conn.cursor()

# Construction loan: $1,350,000 (75% of $1.8M), 7.5% IO, 24-month term
cursor.execute('''INSERT INTO debt_facilities 
    (property_id, lender_name, debt_type, status, debt_purpose, development_plan_id,
     commitment_amount, drawn_amount, outstanding_balance,
     interest_rate, rate_type, term_months, amortization_months, io_period_months,
     origination_date, maturity_date, compounding_method,
     is_cmhc_insured, capitalized_fees, notes)
    VALUES 
    (?, 'ATB Financial', 'construction_loan', 'active', 'construction', ?,
     1350000.00, 0.00, 0.00,
     7.50, 'variable', 24, 0, 24,
     '2025-09-01', '2027-09-01', 'monthly',
     0, 0.0, 'Construction loan, 75% LTC, IO during construction')
''', (PROPERTY_ID, PLAN_ID))

construction_debt_id = cursor.lastrowid
print(f"  ✓ Construction Loan: $1,350,000 @ 7.5% IO (ID: {construction_debt_id})")

# CMHC Take-out Mortgage: $2,430,000 (75% LTV on $3,240,000 stabilized value)
# CMHC premium: 2.75% = $66,825
# Total insured amount: $2,496,825
# DSCR: $145,783 / $132,800 = 1.10x (meets CMHC minimum)
cmhc_premium_pct = 2.75
cmhc_commitment = 2430000.00
cmhc_premium_amount = cmhc_commitment * cmhc_premium_pct / 100  # $66,825
cmhc_total = cmhc_commitment + cmhc_premium_amount  # $2,496,825

cursor.execute('''INSERT INTO debt_facilities
    (property_id, lender_name, debt_type, status, debt_purpose, development_plan_id,
     commitment_amount, drawn_amount, outstanding_balance,
     interest_rate, rate_type, term_months, amortization_months, io_period_months,
     origination_date, maturity_date, compounding_method,
     is_cmhc_insured, cmhc_insurance_premium_pct, cmhc_insurance_premium_amount,
     cmhc_application_fee, cmhc_program, capitalized_fees,
     lender_fee_pct, lender_fee_amount, notes)
    VALUES
    (?, 'First National', 'permanent_mortgage', 'pending', 'refinancing', ?,
     ?, ?, ?,
     3.85, 'fixed', 120, 420, 0,
     '2027-03-01', '2037-03-01', 'semi_annual',
     1, ?, ?,
     3500, 'MLI Select', ?,
     0.5, ?, 'CMHC MLI Select insured mortgage, 75% LTV, 10-year term, 35-year amortization')
''', (PROPERTY_ID, PLAN_ID,
      cmhc_commitment, cmhc_total, cmhc_total,
      cmhc_premium_pct, cmhc_premium_amount,
      cmhc_premium_amount,  # capitalized_fees = premium (lender fee added below)
      cmhc_commitment * 0.005))  # lender fee 0.5%

# Update capitalized fees to include lender fee
lender_fee = cmhc_commitment * 0.005  # $12,150
total_cap_fees = cmhc_premium_amount + lender_fee  # $78,975
cursor.execute('UPDATE debt_facilities SET capitalized_fees = ? WHERE debt_id = (SELECT MAX(debt_id) FROM debt_facilities)', (total_cap_fees,))

cmhc_debt_id = cursor.lastrowid
print(f"  ✓ CMHC Mortgage: ${cmhc_commitment:,.0f} + ${cmhc_premium_amount:,.0f} premium = ${cmhc_total:,.0f} @ 3.85% (ID: {cmhc_debt_id})")
print(f"    CMHC Premium: {cmhc_premium_pct}% = ${cmhc_premium_amount:,.0f}")
print(f"    Lender Fee: 0.5% = ${lender_fee:,.0f}")
print(f"    Total Capitalized Fees: ${total_cap_fees:,.0f}")
print(f"    35-year amortization, 75% LTV, DSCR 1.10x")

conn.commit()
conn.close()

# ── STEP 7: Validate Full Development Underwriting ──────────
print("\n═══ STEP 7: Validate Full Development Underwriting ═══")

r = requests.get(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/underwriting-summary?plan_id={PLAN_ID}", headers=H)
uw = r.json()

print(f"\n  Property: {uw['property_address']}")
print(f"  Plan ID: {uw['plan_id']}")
print()
print("  --- Revenue ---")
print(f"  Gross Potential Rent:    ${uw['gross_potential_rent']:>12,.2f}")
print(f"  Ancillary Revenue:       ${uw['ancillary_revenue']:>12,.2f}")
print(f"  Gross Potential Revenue: ${uw['gross_potential_revenue']:>12,.2f}")
print(f"  Vacancy Rate:            {uw['vacancy_rate']}%")
print(f"  Vacancy Loss:            ${uw['vacancy_loss']:>12,.2f}")
print(f"  Effective Gross Income:  ${uw['effective_gross_income']:>12,.2f}")
print()
print("  --- Expenses ---")
print(f"  Total Operating Expenses:${uw['total_operating_expenses']:>12,.2f}")
print(f"  Expense Ratio:           {uw['expense_ratio']}%")
for item in uw['expense_breakdown']:
    print(f"    {item['category']:25s} ${item['annual_amount']:>10,.2f} ({item['calc_method']})")
print()
print("  --- NOI ---")
print(f"  NOI:                     ${uw['noi']:>12,.2f}")
print(f"  NOI/Unit:                ${uw.get('noi_per_unit', 'N/A')}")
print(f"  NOI/Bed:                 ${uw.get('noi_per_bed', 'N/A')}")
print()
print("  --- Debt ---")
print(f"  Total Debt:              ${uw['total_debt']:>12,.2f}")
print(f"  Annual Debt Service:     ${uw['annual_debt_service']:>12,.2f}")
print(f"  Cash Flow After Debt:    ${uw['cash_flow_after_debt']:>12,.2f}")
for d in uw['debt_facilities']:
    print(f"    {d['lender_name']}: ${d['outstanding_balance']:,.2f} @ {d['interest_rate']}% ({d.get('compounding_method', 'N/A')})")
    print(f"      ADS: ${d['annual_debt_service']:,.2f}")
print()
print("  --- CMHC Info ---")
for c in uw.get('cmhc_insured_loans', []):
    print(f"    Program: {c.get('cmhc_program')}")
    print(f"    Premium: {c.get('insurance_premium_pct')}% = ${c.get('insurance_premium_amount'):,.2f}")
    print(f"    Application Fee: ${c.get('application_fee'):,.2f}")
    print(f"    Capitalized Fees: ${c.get('capitalized_fees'):,.2f}")
print()
print("  --- Key Ratios ---")
print(f"  DSCR:                    {uw.get('dscr')}")
print(f"  DSCR Health:             {uw.get('dscr_health')}")
print(f"  LTV:                     {uw.get('ltv')}%")
print(f"  Debt Yield:              {uw.get('debt_yield')}%")
print(f"  Break-Even Occupancy:    {uw.get('break_even_occupancy')}%")
print(f"  Value/Suite:             ${uw.get('value_per_suite', 0):,.2f}")
print(f"  Total Units:             {uw.get('total_units')}")
print(f"  Total Beds:              {uw.get('total_beds')}")

# ── Manual Verification ──────────────────────────────────────
print("\n═══ MANUAL VERIFICATION ═══")

# All 6 units: $863 + $805 + $650 + $650 = $2,968/unit × 6 = $17,808/mo
expected_monthly = 2968 * 6  # $17,808
expected_annual = expected_monthly * 12  # $213,696

# Ancillary: parking 6×$50×1.0×12 + pet 6×$50×0.5×12 + storage 6×$75×0.67×12
exp_parking = 6 * 50 * 1.0 * 12    # $3,600
exp_pet = 6 * 50 * 0.50 * 12       # $1,800
exp_storage = 6 * 75 * 0.67 * 12   # $3,618
expected_ancillary = exp_parking + exp_pet + exp_storage  # $9,018

expected_gpr = expected_annual + expected_ancillary  # $222,714
expected_vacancy = expected_gpr * 0.05  # $11,136
expected_egi = expected_gpr - expected_vacancy  # $211,578

expected_fixed_exp = 10800 + 5400 + 14400 + 6000 + 5069 + 7200  # $48,869
expected_mgmt = expected_egi * 0.08  # $16,926
expected_total_exp = expected_fixed_exp + expected_mgmt  # $65,795
expected_noi = expected_egi - expected_total_exp  # $145,783

print(f"  Expected Monthly Rent:  ${expected_monthly:,.2f}")
print(f"  Expected Annual Rent:   ${expected_annual:,.2f}")
print(f"  Expected Ancillary:     ${expected_ancillary:,.2f}")
print(f"  Expected GPR:           ${expected_gpr:,.2f}")
print(f"  Expected Vacancy:       ${expected_vacancy:,.2f}")
print(f"  Expected EGI:           ${expected_egi:,.2f}")
print(f"  Expected Fixed Exp:     ${expected_fixed_exp:,.2f}")
print(f"  Expected Mgmt Fee:      ${expected_mgmt:,.2f}")
print(f"  Expected Total Exp:     ${expected_total_exp:,.2f}")
print(f"  Expected NOI:           ${expected_noi:,.2f}")

# Compare
print("\n  --- Comparison ---")
checks = [
    ("GPR", uw['gross_potential_rent'], expected_annual),
    ("Ancillary", uw['ancillary_revenue'], expected_ancillary),
    ("Gross Potential", uw['gross_potential_revenue'], expected_gpr),
    ("EGI", uw['effective_gross_income'], expected_egi),
    ("Total Expenses", uw['total_operating_expenses'], expected_total_exp),
    ("NOI", uw['noi'], expected_noi),
]

all_pass = True
for name, actual, expected in checks:
    diff = abs(actual - expected)
    status = "✓ PASS" if diff < 1.0 else f"✗ FAIL (diff: ${diff:,.2f})"
    if diff >= 1.0:
        all_pass = False
    print(f"  {name:20s}: ${actual:>12,.2f} vs ${expected:>12,.2f} {status}")

print(f"\n{'ALL CHECKS PASSED' if all_pass else 'SOME CHECKS FAILED - NEED INVESTIGATION'}")
print("=" * 60)
