"""
Phase 1 As-Is Seed Script
=========================
Seeds the 1847 Bowness Road NW property with:
- Property record (As-Is, interim_operation stage)
- 1 unit (whole house) with 6 bedrooms, 8 beds
- Ancillary revenue streams (parking, pets, storage, laundry)
- Operating expense line items (7 categories)
- Acquisition mortgage (conventional, 75% LTV)
"""
import requests
import json
import sys

BASE = "http://localhost:8000"
TOKEN = None

def login():
    global TOKEN
    r = requests.post(f"{BASE}/api/auth/login", json={
        "email": "admin@livingwell.ca",
        "password": "Password1!"
    })
    r.raise_for_status()
    TOKEN = r.json()["access_token"]
    print(f"✓ Logged in as admin")

def headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def api_post(path, data):
    r = requests.post(f"{BASE}{path}", json=data, headers=headers())
    if r.status_code not in (200, 201):
        print(f"  ERROR {r.status_code}: {r.text[:500]}")
        return None
    return r.json()

def api_get(path):
    r = requests.get(f"{BASE}{path}", headers=headers())
    if r.status_code != 200:
        print(f"  ERROR {r.status_code}: {r.text[:500]}")
        return None
    return r.json()

def api_put(path, data):
    r = requests.put(f"{BASE}{path}", json=data, headers=headers())
    if r.status_code != 200:
        print(f"  ERROR {r.status_code}: {r.text[:500]}")
        return None
    return r.json()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Create Property
# ─────────────────────────────────────────────────────────────────────────────
def create_property():
    print("\n═══ STEP 1: Create Property ═══")
    data = {
        "address": "1847 Bowness Road NW",
        "city": "Calgary",
        "province": "Alberta",
        "purchase_date": "2025-01-15",
        "purchase_price": 465000.00,
        "assessed_value": 445000.00,
        "current_market_value": 465000.00,
        "lot_size": 6000.00,
        "zoning": "RF-2",
        "max_buildable_area": 4200.00,
        "floor_area_ratio": 0.70,
        "development_stage": "interim_operation",
        "rent_pricing_mode": "by_bed",
        "annual_rent_increase_pct": 5.0,
        "year_built": 1962,
        "property_type": "Single Family",
        "building_sqft": 2000.00,
        "bedrooms": 6,
        "bathrooms": 2,
        "property_style": "Bungalow",
        "garage": "Single Detached",
        "neighbourhood": "Bowness",
        "latitude": 51.0886,
        "longitude": -114.1891,
        "lp_id": 1,  # Living Well Fund I LP
        "community_id": 1,  # RecoverWell Calgary
    }
    result = api_post("/api/portfolio/properties", data)
    if result:
        pid = result.get("property_id")
        print(f"  ✓ Property created: ID={pid}")
        return pid
    return None

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Create Unit (whole house) with 6 bedrooms, 8 beds
# ─────────────────────────────────────────────────────────────────────────────
def create_unit_and_beds(property_id):
    print("\n═══ STEP 2: Create Unit & Beds ═══")
    
    # Create the unit (whole house)
    unit_data = {
        "unit_number": "House",
        "unit_type": "house",
        "bed_count": 8,
        "sqft": 2000.0,
        "floor": "Main+Basement",
        "bedroom_count": 6,
        "monthly_rent": 0,  # priced by bed, not by unit
        "renovation_phase": "pre_renovation",
    }
    result = api_post(f"/api/portfolio/properties/{property_id}/units", unit_data)
    if not result:
        print("  ✗ Failed to create unit")
        return None, []
    
    unit_id = result.get("unit_id")
    print(f"  ✓ Unit created: ID={unit_id}")
    
    # Create 8 beds across 6 bedrooms
    beds_config = [
        # (label, monthly_rent, bedroom_number, rent_type)
        ("BR1-A", 750.00, 1, "private_pay"),    # Bedroom 1 (Master) - single ($750)
        ("BR2-A", 550.00, 2, "shared_room"),     # Bedroom 2 - double occ, bed A ($1,100/room)
        ("BR2-B", 550.00, 2, "shared_room"),     # Bedroom 2 - double occ, bed B
        ("BR3-A", 700.00, 3, "private_pay"),     # Bedroom 3 - single ($700)
        ("BR4-A", 650.00, 4, "private_pay"),     # Bedroom 4 (Basement) - single ($650)
        ("BR5-A", 550.00, 5, "shared_room"),     # Bedroom 5 (Basement converted) - double ($1,100/room)
        ("BR5-B", 550.00, 5, "shared_room"),     # Bedroom 5 - bed B
        ("BR6-A", 625.00, 6, "private_pay"),     # Bedroom 6 (Basement converted) - single ($625)
    ]
    
    bed_ids = []
    for label, rent, br_num, rent_type in beds_config:
        bed_data = {
            "bed_label": label,
            "monthly_rent": rent,
            "bedroom_number": br_num,
            "rent_type": rent_type,
            "status": "occupied",
        }
        result = api_post(f"/api/portfolio/properties/{property_id}/units/{unit_id}/beds", bed_data)
        if result:
            bed_ids.append(result.get("bed_id"))
            print(f"  ✓ Bed {label}: ${rent}/mo (BR{br_num})")
        else:
            print(f"  ✗ Failed to create bed {label}")
    
    total_monthly = sum(b[1] for b in beds_config)
    total_annual = total_monthly * 12
    print(f"\n  Total Monthly Bed Revenue: ${total_monthly:,.2f}")
    print(f"  Total Annual Bed Revenue:  ${total_annual:,.2f}")
    
    return unit_id, bed_ids

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Add Ancillary Revenue Streams
# ─────────────────────────────────────────────────────────────────────────────
def create_ancillary_revenue(property_id):
    print("\n═══ STEP 3: Ancillary Revenue Streams ═══")
    
    streams = [
        {
            "stream_type": "parking",
            "description": "Driveway Parking (2 spots)",
            "total_count": 2,
            "utilization_pct": 100.0,
            "monthly_rate": 50.00,
            "annual_escalation_pct": 3.0,
        },
        {
            "stream_type": "pet_fee",
            "description": "Pet Fees (2 residents)",
            "total_count": 2,
            "utilization_pct": 100.0,
            "monthly_rate": 50.00,
            "annual_escalation_pct": 0.0,
        },
        {
            "stream_type": "storage",
            "description": "Garage Storage Lockers",
            "total_count": 3,
            "utilization_pct": 67.0,
            "monthly_rate": 75.00,
            "annual_escalation_pct": 3.0,
        },
        {
            "stream_type": "laundry",
            "description": "Shared Coin-Op Laundry",
            "total_count": 1,
            "utilization_pct": 100.0,
            "monthly_rate": 100.00,
            "annual_escalation_pct": 0.0,
        },
    ]
    
    total_annual = 0
    for s in streams:
        result = api_post(f"/api/portfolio/properties/{property_id}/ancillary-revenue", s)
        if result:
            monthly = s["total_count"] * (s["utilization_pct"]/100) * s["monthly_rate"]
            annual = monthly * 12
            total_annual += annual
            print(f"  ✓ {s['stream_type']}: ${monthly:,.2f}/mo = ${annual:,.2f}/yr")
        else:
            print(f"  ✗ Failed: {s['stream_type']}")
    
    print(f"\n  Total Ancillary Revenue: ${total_annual:,.2f}/yr")
    return total_annual

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Add Operating Expense Line Items
# ─────────────────────────────────────────────────────────────────────────────
def create_operating_expenses(property_id):
    print("\n═══ STEP 4: Operating Expense Line Items ═══")
    
    expenses = [
        {
            "category": "property_tax",
            "description": "Municipal Property Tax",
            "calc_method": "fixed",
            "base_amount": 3800.00,
            "annual_escalation_pct": 3.0,
        },
        {
            "category": "insurance",
            "description": "Property & Liability Insurance",
            "calc_method": "fixed",
            "base_amount": 2400.00,
            "annual_escalation_pct": 5.0,
        },
        {
            "category": "utilities",
            "description": "All Utilities (owner-paid)",
            "calc_method": "fixed",
            "base_amount": 12000.00,  # $125/bed/month x 8 beds
            "annual_escalation_pct": 3.0,
        },
        {
            "category": "repairs_maintenance",
            "description": "Maintenance & Repairs",
            "calc_method": "fixed",
            "base_amount": 4000.00,
            "annual_escalation_pct": 2.0,
        },
        {
            "category": "management_fee",
            "description": "Property Management (8% of EGI)",
            "calc_method": "pct_egi",
            "base_amount": 8.0,  # 8% of EGI
            "annual_escalation_pct": 0.0,
        },
        {
            "category": "other",
            "description": "Landscaping & Snow Removal",
            "calc_method": "fixed",
            "base_amount": 2400.00,
            "annual_escalation_pct": 2.0,
        },
        {
            "category": "reserves",
            "description": "Capital Reserves ($300/bed/yr)",
            "calc_method": "fixed",
            "base_amount": 2400.00,  # 8 beds x $300
            "annual_escalation_pct": 2.0,
        },
    ]
    
    total = 0
    for e in expenses:
        result = api_post(f"/api/portfolio/properties/{property_id}/operating-expenses", e)
        if result:
            if e["calc_method"] == "fixed":
                total += e["base_amount"]
                print(f"  ✓ {e['category']}: ${e['base_amount']:,.2f}/yr (fixed)")
            elif e["calc_method"] == "pct_egi":
                print(f"  ✓ {e['category']}: {e['base_amount']}% of EGI")
            elif e["calc_method"] == "per_unit":
                print(f"  ✓ {e['category']}: ${e['base_amount']:,.2f}/unit/yr")
        else:
            print(f"  ✗ Failed: {e['category']}")
    
    print(f"\n  Total Fixed Expenses: ${total:,.2f}/yr (+ management fee as % of EGI)")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Add Acquisition Mortgage
# ─────────────────────────────────────────────────────────────────────────────
def create_acquisition_mortgage(property_id):
    print("\n═══ STEP 5: Acquisition Mortgage ═══")
    
    purchase_price = 465000.00
    loan_amount = 465000.00  # 100% financed

    debt_data = {
        "lender_name": "RFA Mortgage",
        "debt_type": "permanent_mortgage",
        "status": "active",
        "debt_purpose": "acquisition",
        "commitment_amount": loan_amount,
        "drawn_amount": loan_amount,
        "outstanding_balance": loan_amount,
        "interest_rate": 5.50,
        "rate_type": "fixed",
        "term_months": 60,  # 5-year term
        "amortization_months": 300,  # 25-year amortization
        "io_period_months": 0,
        "origination_date": "2025-01-15",
        "maturity_date": "2030-01-15",
        "compounding_method": "semi_annual",
        "is_cmhc_insured": False,
        "notes": "Mortgage, 5-year fixed @ 5.5%, 25-year amortization, semi-annual compounding",
    }
    
    result = api_post(f"/api/portfolio/properties/{property_id}/debt", debt_data)
    if result:
        debt_id = result.get("debt_id")
        print(f"  ✓ Mortgage created: ID={debt_id}")
        print(f"    Loan Amount: ${loan_amount:,.2f}")
        print(f"    Rate: {debt_data['interest_rate']}% fixed")
        print(f"    Term: {debt_data['term_months']}mo / Amort: {debt_data['amortization_months']}mo")
        print(f"    Compounding: {debt_data['compounding_method']}")
        return debt_id
    return None

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: Validate Calculations
# ─────────────────────────────────────────────────────────────────────────────
def validate_calculations(property_id):
    print("\n═══ STEP 6: Validate Calculations ═══")
    
    # Expected values from our scenario
    expected = {
        "annual_bed_revenue": 59100.00,  # 8 beds: 750+550+550+700+650+550+550+625 = 4925/mo x 12
        "annual_ancillary": 5409.00,     # parking 1200 + pets 1200 + storage 1809 + laundry 1200
        "gross_potential": 64509.00,     # bed + ancillary
        "vacancy_rate": 5.0,
        "egi": 61283.55,                 # GPR x 0.95
        "total_fixed_expenses": 27000.00, # sum of fixed items
        "mgmt_fee_pct": 8.0,
        "loan_amount": 465000.00,
        "interest_rate": 5.50,
    }
    
    # 1. Get property details
    prop = api_get(f"/api/portfolio/properties/{property_id}")
    if prop:
        print(f"  Property: {prop.get('address')}, {prop.get('city')}")
        print(f"  Stage: {prop.get('development_stage')}")
        print(f"  Pricing Mode: {prop.get('rent_pricing_mode')}")
    
    # 2. Get units and beds
    units = api_get(f"/api/portfolio/properties/{property_id}/units")
    if units:
        total_beds = 0
        total_monthly_rent = 0
        for u in units:
            beds = u.get("beds", [])
            total_beds += len(beds)
            for b in beds:
                total_monthly_rent += float(b.get("monthly_rent", 0))
        annual_rent = total_monthly_rent * 12
        print(f"\n  Beds: {total_beds} (expected 8)")
        print(f"  Monthly Bed Revenue: ${total_monthly_rent:,.2f} (expected $4,925.00)")
        print(f"  Annual Bed Revenue: ${annual_rent:,.2f} (expected ${expected['annual_bed_revenue']:,.2f})")
        if abs(annual_rent - expected["annual_bed_revenue"]) > 1:
            print(f"  ⚠ MISMATCH: ${annual_rent - expected['annual_bed_revenue']:,.2f} difference")
        else:
            print(f"  ✓ Bed revenue matches")
    
    # 3. Get ancillary revenue
    anc = api_get(f"/api/portfolio/properties/{property_id}/ancillary-revenue")
    if anc:
        total_anc = 0
        for s in anc:
            count = s.get("total_count", 0)
            util = float(s.get("utilization_pct", 100)) / 100
            rate = float(s.get("monthly_rate", 0))
            annual = count * util * rate * 12
            total_anc += annual
        print(f"\n  Ancillary Revenue: ${total_anc:,.2f}/yr")
    
    # 4. Get operating expenses
    opex = api_get(f"/api/portfolio/properties/{property_id}/operating-expenses")
    if opex:
        print(f"\n  Operating Expenses: {len(opex)} line items")
        for item in opex:
            print(f"    {item.get('category')}: ${float(item.get('base_amount', 0)):,.2f} ({item.get('calc_method')})")
    
    # 5. Get debt facilities
    debt = api_get(f"/api/portfolio/properties/{property_id}/debt")
    if debt:
        for d in debt:
            print(f"\n  Debt: {d.get('lender_name')} - ${float(d.get('commitment_amount', 0)):,.2f}")
            print(f"    Rate: {d.get('interest_rate')}%, Compounding: {d.get('compounding_method')}")
    
    # 6. Try to get underwriting summary
    uw = api_get(f"/api/portfolio/properties/{property_id}/underwriting-summary")
    if uw:
        print(f"\n  ── Underwriting Summary ──")
        for k, v in uw.items():
            if isinstance(v, (int, float)):
                print(f"    {k}: {v:,.2f}")
            else:
                print(f"    {k}: {v}")
    else:
        print(f"\n  ⚠ Underwriting summary endpoint returned error")
    
    # 7. Try pro forma
    pf = api_get(f"/api/portfolio/properties/{property_id}/proforma")
    if pf:
        print(f"\n  ── Pro Forma ──")
        for k, v in pf.items():
            if isinstance(v, (int, float)):
                print(f"    {k}: {v:,.4f}" if abs(v) < 1 else f"    {k}: ${v:,.2f}")
            elif isinstance(v, list):
                print(f"    {k}: [{len(v)} items]")
            else:
                print(f"    {k}: {v}")
    else:
        print(f"\n  ⚠ Pro forma endpoint returned error")

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    login()
    
    property_id = create_property()
    if not property_id:
        print("FATAL: Could not create property")
        sys.exit(1)
    
    unit_id, bed_ids = create_unit_and_beds(property_id)
    create_ancillary_revenue(property_id)
    create_operating_expenses(property_id)
    create_acquisition_mortgage(property_id)
    validate_calculations(property_id)
    
    print(f"\n{'='*60}")
    print(f"Phase 1 seed complete. Property ID: {property_id}")
    print(f"{'='*60}")
