"""
Phase 3: Full Development Seed Script
=======================================
New 6-unit / 24-bed purpose-built development at 1847 Bowness Road NW (property_id=11)

Scenario:
- Demolish existing house, build 6-unit purpose-built rental
- 6 units × 4 beds each = 24 beds
- Mix of 2BR and 3BR units with shared rooms
- Construction budget: $1.8M total
  - Hard costs: $1,400,000
  - Soft costs: $180,000
  - Site costs: $80,000
  - Financing costs: $60,000
  - Contingency: 5% = $80,000
- Construction loan: $1,350,000 (75% LTC), 7.5% IO
- Take-out CMHC insured mortgage: $1,620,000 (90% LTV @ stabilized value)
  - 3.89% fixed, 40-year amortization
  - CMHC premium: 4.0%
  - MLI Select program
- Stabilized rents: avg $850/bed/month
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
    "hard_costs": 1400000,
    "soft_costs": 180000,
    "site_costs": 80000,
    "financing_costs": 60000,
    "contingency_percent": 5.0,
    "cost_per_sqft": 300,
    "estimated_construction_cost": 1800000,
    "projected_annual_revenue": 244800,  # 24 beds × $850 × 12
    "projected_annual_noi": 150000,  # rough estimate
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

# Unit mix: 3 × 3BR units (4 beds each) + 3 × 2BR units (4 beds each)
unit_configs = [
    {"unit_number": "101", "unit_type": "3br", "bed_count": 4, "sqft": 1100, "floor": "1", "bedroom_count": 3},
    {"unit_number": "102", "unit_type": "2br", "bed_count": 4, "sqft": 900,  "floor": "1", "bedroom_count": 2},
    {"unit_number": "201", "unit_type": "3br", "bed_count": 4, "sqft": 1100, "floor": "2", "bedroom_count": 3},
    {"unit_number": "202", "unit_type": "2br", "bed_count": 4, "sqft": 900,  "floor": "2", "bedroom_count": 2},
    {"unit_number": "301", "unit_type": "3br", "bed_count": 4, "sqft": 1100, "floor": "3", "bedroom_count": 3},
    {"unit_number": "302", "unit_type": "2br", "bed_count": 4, "sqft": 900,  "floor": "3", "bedroom_count": 2},
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

# Bed configurations per unit type
# 3BR units: BR1 (private $900), BR2 (shared 2×$800), BR3 (private $875)
# 2BR units: BR1 (shared 2×$825), BR2 (shared 2×$825)
bed_configs = {
    "3br": [
        {"bed_label": "BR1-A", "monthly_rent": 900, "bedroom_number": 1, "rent_type": "private_pay"},
        {"bed_label": "BR2-A", "monthly_rent": 800, "bedroom_number": 2, "rent_type": "shared_room"},
        {"bed_label": "BR2-B", "monthly_rent": 800, "bedroom_number": 2, "rent_type": "shared_room"},
        {"bed_label": "BR3-A", "monthly_rent": 875, "bedroom_number": 3, "rent_type": "private_pay"},
    ],
    "2br": [
        {"bed_label": "BR1-A", "monthly_rent": 825, "bedroom_number": 1, "rent_type": "shared_room"},
        {"bed_label": "BR1-B", "monthly_rent": 825, "bedroom_number": 1, "rent_type": "shared_room"},
        {"bed_label": "BR2-A", "monthly_rent": 825, "bedroom_number": 2, "rent_type": "shared_room"},
        {"bed_label": "BR2-B", "monthly_rent": 825, "bedroom_number": 2, "rent_type": "shared_room"},
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
    {"stream_type": "parking", "description": "Surface parking (12 spots)", "total_count": 12, "monthly_rate": 75.00, "utilization_pct": 85, "development_plan_id": PLAN_ID},
    {"stream_type": "storage", "description": "Storage lockers (8 available)", "total_count": 8, "monthly_rate": 50.00, "utilization_pct": 75, "development_plan_id": PLAN_ID},
    {"stream_type": "laundry", "description": "Coin laundry (2 machines)", "total_count": 2, "monthly_rate": 150.00, "utilization_pct": 100, "development_plan_id": PLAN_ID},
    {"stream_type": "pet_fee", "description": "Pet fees (est. 6 pets)", "total_count": 6, "monthly_rate": 50.00, "utilization_pct": 100, "development_plan_id": PLAN_ID},
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
    {"category": "property_tax", "description": "Municipal Property Tax", "calc_method": "fixed", "base_amount": 18000, "development_plan_id": PLAN_ID},
    {"category": "insurance", "description": "Property & Liability Insurance", "calc_method": "fixed", "base_amount": 8400, "development_plan_id": PLAN_ID},
    {"category": "utilities", "description": "All Utilities (owner-paid)", "calc_method": "fixed", "base_amount": 24000, "development_plan_id": PLAN_ID},
    {"category": "repairs_maintenance", "description": "Maintenance & Repairs", "calc_method": "fixed", "base_amount": 9600, "development_plan_id": PLAN_ID},
    {"category": "management_fee", "description": "Property Management (8% of EGI)", "calc_method": "pct_egi", "base_amount": 8.0, "development_plan_id": PLAN_ID},
    {"category": "other", "description": "Common Area & Admin", "calc_method": "fixed", "base_amount": 6000, "development_plan_id": PLAN_ID},
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

# CMHC Take-out Mortgage: $1,620,000 (90% of $1.8M stabilized value)
# CMHC premium: 4.0% = $64,800
# Total insured amount: $1,684,800
cmhc_premium_pct = 4.0
cmhc_commitment = 1620000.00
cmhc_premium_amount = cmhc_commitment * cmhc_premium_pct / 100  # $64,800
cmhc_total = cmhc_commitment + cmhc_premium_amount  # $1,684,800

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
     3.89, 'fixed', 120, 480, 0,
     '2027-03-01', '2037-03-01', 'semi_annual',
     1, ?, ?,
     3500, 'MLI Select', ?,
     0.5, ?, 'CMHC MLI Select insured mortgage, 90% LTV, 10-year term, 40-year amortization')
''', (PROPERTY_ID, PLAN_ID,
      cmhc_commitment, cmhc_total, cmhc_total,
      cmhc_premium_pct, cmhc_premium_amount,
      cmhc_premium_amount,  # capitalized_fees = premium (lender fee added below)
      cmhc_commitment * 0.005))  # lender fee 0.5%

# Update capitalized fees to include lender fee
lender_fee = cmhc_commitment * 0.005  # $8,100
total_cap_fees = cmhc_premium_amount + lender_fee  # $72,900
cursor.execute('UPDATE debt_facilities SET capitalized_fees = ? WHERE debt_id = (SELECT MAX(debt_id) FROM debt_facilities)', (total_cap_fees,))

cmhc_debt_id = cursor.lastrowid
print(f"  ✓ CMHC Mortgage: ${cmhc_commitment:,.0f} + ${cmhc_premium_amount:,.0f} premium = ${cmhc_total:,.0f} @ 3.89% (ID: {cmhc_debt_id})")
print(f"    CMHC Premium: {cmhc_premium_pct}% = ${cmhc_premium_amount:,.0f}")
print(f"    Lender Fee: 0.5% = ${lender_fee:,.0f}")
print(f"    Total Capitalized Fees: ${total_cap_fees:,.0f}")

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

# 3BR units: $900 + $800 + $800 + $875 = $3,375/unit × 3 = $10,125
# 2BR units: $825 × 4 = $3,300/unit × 3 = $9,900
expected_monthly = 10125 + 9900  # $20,025
expected_annual = expected_monthly * 12  # $240,300

# Ancillary: parking 12×$75×0.85×12 + storage 8×$50×0.75×12 + laundry 2×$150×12 + pet 6×$50×12
exp_parking = 12 * 75 * 0.85 * 12  # $9,180
exp_storage = 8 * 50 * 0.75 * 12   # $3,600
exp_laundry = 2 * 150 * 1.0 * 12   # $3,600
exp_pet = 6 * 50 * 1.0 * 12        # $3,600
expected_ancillary = exp_parking + exp_storage + exp_laundry + exp_pet  # $19,980

expected_gpr = expected_annual + expected_ancillary
expected_vacancy = expected_gpr * 0.05
expected_egi = expected_gpr - expected_vacancy

expected_fixed_exp = 18000 + 8400 + 24000 + 9600 + 6000 + 7200  # $73,200
expected_mgmt = expected_egi * 0.08
expected_total_exp = expected_fixed_exp + expected_mgmt
expected_noi = expected_egi - expected_total_exp

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
