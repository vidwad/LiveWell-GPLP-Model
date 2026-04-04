"""
Phase 2: Post-Renovation Seed Script
=====================================
Kitchen renovation for 1847 Bowness Road NW (property_id=11)

Scenario:
- $35,000 kitchen renovation
- Same 6 bedrooms, 8 beds
- Post-reno rents increase ~15% on average
- Same ancillary revenue (linked to plan)
- Same expense structure (linked to plan)
- No new debt (renovation funded from reserves/equity)
"""
import requests
import json
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
print("PHASE 2: Post-Renovation Seed")
print("=" * 60)

# ── STEP 1: Create Development Plan ──────────────────────────
print("\n═══ STEP 1: Create Development Plan ═══")

plan_data = {
    "version": 1,
    "plan_name": "Kitchen Renovation",
    "status": "approved",
    "planned_units": 1,
    "planned_beds": 8,
    "planned_sqft": 2000,
    "hard_costs": 30000,
    "soft_costs": 3000,
    "site_costs": 0,
    "financing_costs": 0,
    "contingency_percent": 5.71,  # ~$2,000 contingency on $35,000
    "estimated_construction_cost": 35000,
    "projected_annual_revenue": 74220,  # post-reno projected
    "projected_annual_noi": 36000,  # rough estimate
    "development_start_date": "2025-06-01",
    "construction_duration_days": 30,
    "estimated_completion_date": "2025-07-01",
    "estimated_stabilization_date": "2025-09-01",
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

# ── STEP 2: Create Post-Renovation Unit ──────────────────────
print("\n═══ STEP 2: Create Post-Renovation Unit ═══")

unit_data = {
    "unit_number": "HOUSE-PostReno",
    "unit_type": "house",
    "bed_count": 8,
    "sqft": 2000,
    "floor": "Main",
    "is_legal_suite": False,
    "is_occupied": True,
    "bedroom_count": 6,
    "renovation_phase": "post_renovation",
    "development_plan_id": PLAN_ID,
    "notes": "Post kitchen renovation - same layout, updated kitchen"
}

r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/units", json=unit_data, headers=H)
if r.status_code == 201:
    unit = r.json()
    POST_RENO_UNIT_ID = unit["unit_id"]
    print(f"  ✓ Created post-reno unit: {unit['unit_number']} (ID: {POST_RENO_UNIT_ID})")
else:
    print(f"  ✗ Failed: {r.status_code} {r.text}")
    sys.exit(1)

# ── STEP 3: Create Post-Renovation Beds with Updated Rents ──
print("\n═══ STEP 3: Create Post-Renovation Beds ═══")

# Post-renovation rents (~15% increase)
post_reno_beds = [
    {"bed_label": "BR1-A", "monthly_rent": 850,  "bedroom_number": 1, "rent_type": "private_pay"},
    {"bed_label": "BR2-A", "monthly_rent": 625,  "bedroom_number": 2, "rent_type": "shared_room"},
    {"bed_label": "BR2-B", "monthly_rent": 625,  "bedroom_number": 2, "rent_type": "shared_room"},
    {"bed_label": "BR3-A", "monthly_rent": 800,  "bedroom_number": 3, "rent_type": "private_pay"},
    {"bed_label": "BR4-A", "monthly_rent": 750,  "bedroom_number": 4, "rent_type": "private_pay"},
    {"bed_label": "BR5-A", "monthly_rent": 625,  "bedroom_number": 5, "rent_type": "shared_room"},
    {"bed_label": "BR5-B", "monthly_rent": 625,  "bedroom_number": 5, "rent_type": "shared_room"},
    {"bed_label": "BR6-A", "monthly_rent": 685,  "bedroom_number": 6, "rent_type": "private_pay"},
]

# First delete auto-created beds for this unit
import sqlite3
conn = sqlite3.connect('livingwell_dev.db')
cursor = conn.cursor()
cursor.execute('DELETE FROM beds WHERE unit_id = ?', (POST_RENO_UNIT_ID,))
deleted = cursor.rowcount
conn.commit()
if deleted > 0:
    print(f"  Deleted {deleted} auto-created beds")

total_monthly = 0
for bed in post_reno_beds:
    cursor.execute('''INSERT INTO beds (unit_id, bed_label, monthly_rent, bedroom_number, rent_type, status, is_post_renovation)
                      VALUES (?, ?, ?, ?, ?, 'occupied', 1)''',
                   (POST_RENO_UNIT_ID, bed["bed_label"], bed["monthly_rent"], bed["bedroom_number"], bed["rent_type"]))
    total_monthly += bed["monthly_rent"]
    print(f"  ✓ {bed['bed_label']}: ${bed['monthly_rent']}/mo (BR{bed['bedroom_number']}, {bed['rent_type']})")

conn.commit()
conn.close()

print(f"\n  Total Monthly Post-Reno Rent: ${total_monthly:,.2f}")
print(f"  Total Annual Post-Reno Rent:  ${total_monthly * 12:,.2f}")

# ── STEP 4: Create Post-Reno Ancillary Revenue ──────────────
print("\n═══ STEP 4: Post-Reno Ancillary Revenue ═══")

# Same ancillary revenue, but linked to the plan
ancillary_streams = [
    {"stream_type": "parking", "description": "Driveway parking (2 spots)", "total_count": 2, "monthly_rate": 50.00, "utilization_pct": 100, "development_plan_id": PLAN_ID},
    {"stream_type": "pet_fee", "description": "Pet deposit/fee (2 pets)", "total_count": 2, "monthly_rate": 50.00, "utilization_pct": 100, "development_plan_id": PLAN_ID},
    {"stream_type": "storage", "description": "Storage lockers (3 available)", "total_count": 3, "monthly_rate": 75.00, "utilization_pct": 67, "development_plan_id": PLAN_ID},
    {"stream_type": "laundry", "description": "Coin laundry revenue", "total_count": 1, "monthly_rate": 100.00, "utilization_pct": 100, "development_plan_id": PLAN_ID},
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

print(f"  Total Post-Reno Ancillary: ${anc_total:,.2f}/yr")

# ── STEP 5: Create Post-Reno Operating Expenses ─────────────
print("\n═══ STEP 5: Post-Reno Operating Expenses ═══")

# Same expenses, linked to plan
expenses = [
    {"category": "property_tax", "description": "Municipal Property Tax", "calc_method": "fixed", "base_amount": 3800, "development_plan_id": PLAN_ID},
    {"category": "insurance", "description": "Property & Liability Insurance", "calc_method": "fixed", "base_amount": 2400, "development_plan_id": PLAN_ID},
    {"category": "utilities", "description": "All Utilities (owner-paid)", "calc_method": "fixed", "base_amount": 12000, "development_plan_id": PLAN_ID},
    {"category": "repairs_maintenance", "description": "Maintenance & Repairs", "calc_method": "fixed", "base_amount": 4000, "development_plan_id": PLAN_ID},
    {"category": "management_fee", "description": "Property Management (8% of EGI)", "calc_method": "pct_egi", "base_amount": 8.0, "development_plan_id": PLAN_ID},
    {"category": "other", "description": "Landscaping & Snow Removal", "calc_method": "fixed", "base_amount": 2400, "development_plan_id": PLAN_ID},
    {"category": "reserves", "description": "Capital Reserves ($300/bed/yr)", "calc_method": "fixed", "base_amount": 2400, "development_plan_id": PLAN_ID},
]

for exp in expenses:
    r = requests.post(f"{BASE}/api/portfolio/properties/{PROPERTY_ID}/operating-expenses", json=exp, headers=H)
    if r.status_code == 201:
        print(f"  ✓ {exp['category']}: ${exp['base_amount']}/yr ({exp['calc_method']})")
    else:
        print(f"  ✗ {exp['category']}: {r.status_code} {r.text}")

# ── STEP 6: Validate Post-Reno Underwriting ──────────────────
print("\n═══ STEP 6: Validate Post-Reno Underwriting ═══")

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
print(f"  NOI/Bed:                 ${uw['noi_per_bed']:>12,.2f}" if uw.get('noi_per_bed') else "  NOI/Bed: N/A")
print()
print("  --- Debt ---")
print(f"  Total Debt:              ${uw['total_debt']:>12,.2f}")
print(f"  Annual Debt Service:     ${uw['annual_debt_service']:>12,.2f}")
print(f"  Cash Flow After Debt:    ${uw['cash_flow_after_debt']:>12,.2f}")
print()
print("  --- Key Ratios ---")
print(f"  DSCR:                    {uw['dscr']}")
print(f"  DSCR Health:             {uw['dscr_health']}")

# ── Manual Verification ──────────────────────────────────────
print("\n═══ MANUAL VERIFICATION ═══")
expected_monthly = 850 + 625 + 625 + 800 + 750 + 625 + 625 + 685
expected_annual = expected_monthly * 12
expected_ancillary = 5409  # same as baseline
expected_gpr = expected_annual + expected_ancillary
expected_vacancy = expected_gpr * 0.05
expected_egi = expected_gpr - expected_vacancy
expected_fixed_exp = 3800 + 2400 + 12000 + 4000 + 2400 + 2400  # 27,000
expected_mgmt = expected_egi * 0.08
expected_total_exp = expected_fixed_exp + expected_mgmt
expected_noi = expected_egi - expected_total_exp
expected_ads = 25520.53
expected_cf = expected_noi - expected_ads

print(f"  Expected Monthly Rent:  ${expected_monthly:,.2f}")
print(f"  Expected Annual Rent:   ${expected_annual:,.2f}")
print(f"  Expected GPR:           ${expected_gpr:,.2f}")
print(f"  Expected Vacancy:       ${expected_vacancy:,.2f}")
print(f"  Expected EGI:           ${expected_egi:,.2f}")
print(f"  Expected Fixed Exp:     ${expected_fixed_exp:,.2f}")
print(f"  Expected Mgmt Fee:      ${expected_mgmt:,.2f}")
print(f"  Expected Total Exp:     ${expected_total_exp:,.2f}")
print(f"  Expected NOI:           ${expected_noi:,.2f}")
print(f"  Expected ADS:           ${expected_ads:,.2f}")
print(f"  Expected CF:            ${expected_cf:,.2f}")

# Compare
print("\n  --- Comparison ---")
checks = [
    ("GPR", uw['gross_potential_rent'], expected_annual),
    ("Ancillary", uw['ancillary_revenue'], expected_ancillary),
    ("Gross Potential", uw['gross_potential_revenue'], expected_gpr),
    ("EGI", uw['effective_gross_income'], expected_egi),
    ("Total Expenses", uw['total_operating_expenses'], expected_total_exp),
    ("NOI", uw['noi'], expected_noi),
    ("ADS", uw['annual_debt_service'], expected_ads),
    ("Cash Flow", uw['cash_flow_after_debt'], expected_cf),
]

all_pass = True
for name, actual, expected in checks:
    diff = abs(actual - expected)
    status = "✓ PASS" if diff < 1.0 else f"✗ FAIL (diff: ${diff:,.2f})"
    if diff >= 1.0:
        all_pass = False
    print(f"  {name:20s}: ${actual:>12,.2f} vs ${expected:>12,.2f} {status}")

print(f"\n{'ALL CHECKS PASSED' if all_pass else 'SOME CHECKS FAILED'}")
print("=" * 60)
