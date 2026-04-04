"""
Seed Script: 1847 Bowness Road NW — 3-Phase Test Scenario
==========================================================
Cleans existing data for this property and re-seeds with exact numbers.
"""
import sys
sys.path.insert(0, ".")

from decimal import Decimal as D
from datetime import date, datetime

from app.db.session import SessionLocal
from app.db.models import (
    Property, Unit, Bed, BedStatus, UnitType, RenovationPhase, RentPricingMode,
    DevelopmentPlan, DevelopmentPlanStatus,
    DebtFacility, DebtType, DebtStatus,
    AncillaryRevenueStream, OperatingExpenseLineItem, ExpenseCalcMethod,
    AcquisitionBaseline, ExitForecast, ExitActual,
    DevelopmentStage,
)

db = SessionLocal()

PROP_ID = 11  # existing property

# ══════════════════════════════════════════════════════════════════════
# STEP 0: Clean existing child data for property 11
# ══════════════════════════════════════════════════════════════════════
print("Cleaning existing data for property 11...")

# Delete in dependency order
db.query(Bed).filter(
    Bed.unit_id.in_(db.query(Unit.unit_id).filter(Unit.property_id == PROP_ID))
).delete(synchronize_session=False)
db.query(Unit).filter(Unit.property_id == PROP_ID).delete(synchronize_session=False)
db.query(AncillaryRevenueStream).filter(AncillaryRevenueStream.property_id == PROP_ID).delete(synchronize_session=False)
db.query(OperatingExpenseLineItem).filter(OperatingExpenseLineItem.property_id == PROP_ID).delete(synchronize_session=False)
db.query(DebtFacility).filter(DebtFacility.property_id == PROP_ID).delete(synchronize_session=False)
db.query(DevelopmentPlan).filter(DevelopmentPlan.property_id == PROP_ID).delete(synchronize_session=False)
db.query(AcquisitionBaseline).filter(AcquisitionBaseline.property_id == PROP_ID).delete(synchronize_session=False)
db.query(ExitForecast).filter(ExitForecast.property_id == PROP_ID).delete(synchronize_session=False)
db.query(ExitActual).filter(ExitActual.property_id == PROP_ID).delete(synchronize_session=False)
db.commit()

# ══════════════════════════════════════════════════════════════════════
# STEP 1: Update Property record
# ══════════════════════════════════════════════════════════════════════
print("Updating property record...")
prop = db.query(Property).filter(Property.property_id == PROP_ID).first()
prop.address = "1847 Bowness Road NW"
prop.city = "Calgary"
prop.province = "AB"
prop.purchase_price = D("465000")
prop.purchase_date = date(2024, 6, 15)
prop.development_stage = DevelopmentStage.interim_operation
prop.rent_pricing_mode = RentPricingMode.by_bed
prop.property_type = "Single Family"
prop.bedrooms = 6
prop.bathrooms = 2
prop.building_sqft = D("1800")
prop.year_built = 1962
prop.zoning = "R-C2"
prop.lot_size = D("6100")
db.commit()

# ══════════════════════════════════════════════════════════════════════
# PHASE 1: BASELINE (As-Is)
# ══════════════════════════════════════════════════════════════════════
print("Seeding Phase 1: Baseline (As-Is)...")

# --- Unit ---
baseline_unit = Unit(
    property_id=PROP_ID,
    unit_number="House",
    unit_type=UnitType.shared,
    bed_count=8,
    bedroom_count=6,
    sqft=D("1800"),
    floor="Main + Upper",
    is_occupied=True,
    renovation_phase=RenovationPhase.pre_renovation,
    development_plan_id=None,
)
db.add(baseline_unit)
db.flush()

# --- Beds ---
bed_rents = [800, 600, 600, 775, 700, 550, 550, 625]
for i, rent in enumerate(bed_rents, 1):
    db.add(Bed(
        unit_id=baseline_unit.unit_id,
        bed_label=f"Bed {i}",
        monthly_rent=D(str(rent)),
        rent_type="private_pay",
        status=BedStatus.occupied,
        bedroom_number=min(i, 6),
        is_post_renovation=False,
    ))

# --- Ancillary Revenue (baseline, plan_id=None) ---
ancillary_baseline = [
    ("parking", "Parking Spot", 2, 100, D("50")),
    ("pet_fee", "Pet Fee", 2, 100, D("50")),
    ("storage", "Storage Locker", 3, 67, D("75")),
    ("laundry", "Laundry", 1, 100, D("100")),
]
for stream_type, desc, count, util, rate in ancillary_baseline:
    db.add(AncillaryRevenueStream(
        property_id=PROP_ID,
        development_plan_id=None,
        stream_type=stream_type,
        description=desc,
        total_count=count,
        utilization_pct=D(str(util)),
        monthly_rate=rate,
    ))

# --- Operating Expenses (baseline, plan_id=None) ---
expenses_baseline = [
    ("property_tax", "Property Tax", "fixed", D("3500")),
    ("insurance", "Insurance", "fixed", D("2200")),
    ("utilities", "Utilities", "fixed", D("10800")),
    ("repairs_maintenance", "Maintenance & Repairs", "fixed", D("4000")),
    ("management_fee", "Management Fee (8% EGI)", "pct_egi", D("8")),
    ("other", "Landscaping / Snow Removal", "fixed", D("2400")),
    ("reserves", "Capital Reserves", "fixed", D("2400")),
]
for cat, desc, method, amount in expenses_baseline:
    db.add(OperatingExpenseLineItem(
        property_id=PROP_ID,
        development_plan_id=None,
        category=cat,
        description=desc,
        calc_method=ExpenseCalcMethod(method),
        base_amount=amount,
    ))

# --- Debt (baseline) ---
baseline_debt = DebtFacility(
    property_id=PROP_ID,
    lender_name="RFA Mortgage",
    debt_type=DebtType.permanent_mortgage,
    status=DebtStatus.active,
    debt_purpose="acquisition",
    development_plan_id=None,
    commitment_amount=D("348750"),
    drawn_amount=D("348750"),
    outstanding_balance=D("348750"),
    interest_rate=D("4.79"),
    rate_type="fixed",
    term_months=60,
    amortization_months=300,
    io_period_months=0,
    compounding_method="semi_annual",
    origination_date=date(2024, 6, 15),
)
db.add(baseline_debt)
db.flush()
baseline_debt_id = baseline_debt.debt_id

db.commit()
print(f"  Baseline unit_id={baseline_unit.unit_id}, debt_id={baseline_debt_id}")

# ══════════════════════════════════════════════════════════════════════
# PHASE 2: POST-RENOVATION (Kitchen Reno)
# ══════════════════════════════════════════════════════════════════════
print("Seeding Phase 2: Post-Renovation (Kitchen Reno)...")

plan_reno = DevelopmentPlan(
    property_id=PROP_ID,
    version=1,
    plan_name="Kitchen Renovation",
    status=DevelopmentPlanStatus.approved,
    planned_units=1,
    planned_beds=8,
    planned_sqft=D("1800"),
    estimated_construction_cost=D("35000"),
    hard_costs=D("28000"),
    soft_costs=D("5000"),
    contingency_percent=D("5"),
    construction_duration_months=2,
)
db.add(plan_reno)
db.flush()
reno_plan_id = plan_reno.plan_id

# --- Unit (linked to reno plan) ---
reno_unit = Unit(
    property_id=PROP_ID,
    unit_number="House (Renovated)",
    unit_type=UnitType.shared,
    bed_count=8,
    bedroom_count=6,
    sqft=D("1800"),
    floor="Main + Upper",
    is_occupied=True,
    renovation_phase=RenovationPhase.post_renovation,
    development_plan_id=reno_plan_id,
)
db.add(reno_unit)
db.flush()

# --- Beds (post-reno rents) ---
reno_rents = [850, 625, 625, 800, 750, 625, 625, 685]
for i, rent in enumerate(reno_rents, 1):
    db.add(Bed(
        unit_id=reno_unit.unit_id,
        bed_label=f"Bed {i}",
        monthly_rent=D(str(rent)),
        rent_type="private_pay",
        status=BedStatus.occupied,
        bedroom_number=min(i, 6),
        is_post_renovation=True,
    ))

# --- Ancillary Revenue (same as baseline, linked to reno plan) ---
for stream_type, desc, count, util, rate in ancillary_baseline:
    db.add(AncillaryRevenueStream(
        property_id=PROP_ID,
        development_plan_id=reno_plan_id,
        stream_type=stream_type,
        description=desc,
        total_count=count,
        utilization_pct=D(str(util)),
        monthly_rate=rate,
    ))

# --- Expenses (same as baseline, linked to reno plan) ---
for cat, desc, method, amount in expenses_baseline:
    db.add(OperatingExpenseLineItem(
        property_id=PROP_ID,
        development_plan_id=reno_plan_id,
        category=cat,
        description=desc,
        calc_method=ExpenseCalcMethod(method),
        base_amount=amount,
    ))

db.commit()
print(f"  Reno plan_id={reno_plan_id}, unit_id={reno_unit.unit_id}")

# ══════════════════════════════════════════════════════════════════════
# PHASE 3: FULL DEVELOPMENT (6-Unit / 24-Bed)
# ══════════════════════════════════════════════════════════════════════
print("Seeding Phase 3: Full Development (6-Unit / 24-Bed)...")

plan_dev = DevelopmentPlan(
    property_id=PROP_ID,
    version=2,
    plan_name="Full Development 6-Unit/24-Bed",
    status=DevelopmentPlanStatus.active,
    planned_units=6,
    planned_beds=24,
    planned_sqft=D("4800"),
    estimated_construction_cost=D("1800000"),
    hard_costs=D("1350000"),
    soft_costs=D("250000"),
    site_costs=D("100000"),
    financing_costs=D("50000"),
    contingency_percent=D("10"),
    development_start_date=date(2025, 3, 1),
    construction_duration_days=365,
    construction_duration_months=12,
    lease_up_months=6,
    estimated_completion_date=date(2026, 3, 1),
    estimated_stabilization_date=date(2026, 9, 1),
    projected_annual_revenue=D("240300"),
    projected_annual_noi=D("154285"),
    # Exit assumptions
    exit_sale_year=2032,
    exit_cap_rate=D("5.0"),
    exit_noi=D("175000"),
    exit_sale_price=D("3500000"),
    exit_selling_cost_pct=D("5.0"),
    exit_irr=D("18.45"),
    exit_equity_multiple=D("3.65"),
)
db.add(plan_dev)
db.flush()
dev_plan_id = plan_dev.plan_id

# --- Units (6 units: 3x 3BR/4-bed + 3x 2BR/4-bed) ---
unit_configs = [
    ("Unit 101", "3br", 4, 3, D("800"), "Ground"),
    ("Unit 102", "3br", 4, 3, D("800"), "Ground"),
    ("Unit 103", "3br", 4, 3, D("800"), "Ground"),
    ("Unit 201", "2br", 4, 2, D("700"), "Upper"),
    ("Unit 202", "2br", 4, 2, D("700"), "Upper"),
    ("Unit 203", "2br", 4, 2, D("700"), "Upper"),
]

# Bed rents: 3BR ($900, $800, $800, $875), 2BR ($825, $825, $825, $825)
rents_3br = [900, 800, 800, 875]
rents_2br = [825, 825, 825, 825]

for unit_num, unit_type, bed_count, br_count, sqft, floor in unit_configs:
    u = Unit(
        property_id=PROP_ID,
        unit_number=unit_num,
        unit_type=UnitType(unit_type),
        bed_count=bed_count,
        bedroom_count=br_count,
        sqft=sqft,
        floor=floor,
        is_occupied=True,
        renovation_phase=RenovationPhase.post_renovation,
        development_plan_id=dev_plan_id,
    )
    db.add(u)
    db.flush()

    rents = rents_3br if "3br" == unit_type else rents_2br
    for bi, rent in enumerate(rents, 1):
        db.add(Bed(
            unit_id=u.unit_id,
            bed_label=f"{unit_num}-B{bi}",
            monthly_rent=D(str(rent)),
            rent_type="private_pay",
            status=BedStatus.occupied,
            bedroom_number=min(bi, br_count),
            is_post_renovation=True,
        ))

# --- Ancillary Revenue (full dev) ---
ancillary_dev = [
    ("parking", "Parking Spot", 12, 85, D("75")),
    ("storage", "Storage Locker", 8, 75, D("50")),
    ("laundry", "Laundry Machine", 2, 100, D("150")),
    ("pet_fee", "Pet Fee", 6, 100, D("50")),
]
for stream_type, desc, count, util, rate in ancillary_dev:
    db.add(AncillaryRevenueStream(
        property_id=PROP_ID,
        development_plan_id=dev_plan_id,
        stream_type=stream_type,
        description=desc,
        total_count=count,
        utilization_pct=D(str(util)),
        monthly_rate=rate,
    ))

# --- Operating Expenses (full dev) ---
expenses_dev = [
    ("property_tax", "Property Tax", "fixed", D("18000")),
    ("insurance", "Insurance", "fixed", D("8400")),
    ("utilities", "Utilities", "fixed", D("24000")),
    ("repairs_maintenance", "Maintenance & Repairs", "fixed", D("9600")),
    ("management_fee", "Management Fee (8% EGI)", "pct_egi", D("8")),
    ("other", "Common Area Maintenance", "fixed", D("6000")),
    ("reserves", "Capital Reserves", "fixed", D("7200")),
]
for cat, desc, method, amount in expenses_dev:
    db.add(OperatingExpenseLineItem(
        property_id=PROP_ID,
        development_plan_id=dev_plan_id,
        category=cat,
        description=desc,
        calc_method=ExpenseCalcMethod(method),
        base_amount=amount,
    ))

# --- Debt 1: Construction Loan (replaces baseline mortgage) ---
construction_debt = DebtFacility(
    property_id=PROP_ID,
    lender_name="ATB Financial",
    debt_type=DebtType.construction_loan,
    status=DebtStatus.active,
    debt_purpose="construction",
    development_plan_id=dev_plan_id,
    replaces_debt_id=baseline_debt_id,
    commitment_amount=D("1350000"),
    drawn_amount=D("0"),
    outstanding_balance=D("0"),
    interest_rate=D("7.5"),
    rate_type="variable",
    term_months=24,
    amortization_months=0,
    io_period_months=24,
    compounding_method="monthly",
)
db.add(construction_debt)
db.flush()
construction_debt_id = construction_debt.debt_id

# --- Debt 2: CMHC Take-Out (replaces construction loan) ---
cmhc_debt = DebtFacility(
    property_id=PROP_ID,
    lender_name="First National",
    debt_type=DebtType.permanent_mortgage,
    status=DebtStatus.active,
    debt_purpose="refinancing",
    development_plan_id=dev_plan_id,
    replaces_debt_id=construction_debt_id,
    commitment_amount=D("1684800"),
    drawn_amount=D("1684800"),
    outstanding_balance=D("1684800"),
    interest_rate=D("3.89"),
    rate_type="fixed",
    term_months=120,
    amortization_months=480,
    io_period_months=0,
    compounding_method="semi_annual",
    is_cmhc_insured=True,
    cmhc_program="MLI Select",
    cmhc_insurance_premium_pct=D("4.0"),
    cmhc_insurance_premium_amount=D("64800"),
    cmhc_application_fee=D("0"),
    lender_fee_pct=D("0.5"),
    lender_fee_amount=D("8100"),
    capitalized_fees=D("72900"),
)
db.add(cmhc_debt)

# --- Acquisition Baseline ---
db.add(AcquisitionBaseline(
    property_id=PROP_ID,
    purchase_price=D("465000"),
    purchase_date=date(2024, 6, 15),
    closing_costs=D("15000"),
    total_acquisition_cost=D("480000"),
    initial_equity=D("116250"),
    initial_debt=D("348750"),
    acquisition_noi=D("29381"),
    acquisition_cap_rate=D("6.32"),
    acquisition_occupancy_pct=D("100"),
    target_hold_years=7,
    target_sale_year=2032,
    original_exit_cap_rate=D("5.0"),
    original_exit_noi=D("175000"),
    original_selling_cost_pct=D("5.0"),
    original_sale_price=D("3500000"),
    original_net_proceeds=D("1640200"),
    target_irr=D("18.45"),
    target_equity_multiple=D("3.65"),
    intended_disposition_type="stabilized_sale",
    created_by=1,
    notes="1847 Bowness Road NW — 3-phase sober living development",
))

# --- Exit Forecast ---
db.add(ExitForecast(
    property_id=PROP_ID,
    sale_status="planned",
    forecast_sale_year=2032,
    forecast_exit_noi=D("175000"),
    forecast_exit_cap_rate=D("5.0"),
    forecast_sale_price=D("3500000"),
    forecast_selling_cost_pct=D("5.0"),
    forecast_selling_costs=D("175000"),
    forecast_debt_payoff=D("1684800"),
    forecast_net_proceeds=D("1640200"),
    forecast_irr=D("18.45"),
    forecast_equity_multiple=D("3.65"),
    planned_disposition_type="stabilized_sale",
    min_occupancy_threshold_pct=D("90"),
    required_trailing_months=12,
    updated_by=1,
))

db.commit()
print(f"  Dev plan_id={dev_plan_id}")
print(f"  Construction debt_id={construction_debt_id}")
print(f"  CMHC debt_id={cmhc_debt.debt_id}")

# ══════════════════════════════════════════════════════════════════════
# VERIFICATION COUNTS
# ══════════════════════════════════════════════════════════════════════
units = db.query(Unit).filter(Unit.property_id == PROP_ID).all()
all_beds = sum(db.query(Bed).filter(Bed.unit_id == u.unit_id).count() for u in units)
debts = db.query(DebtFacility).filter(DebtFacility.property_id == PROP_ID).count()
anc = db.query(AncillaryRevenueStream).filter(AncillaryRevenueStream.property_id == PROP_ID).count()
opex = db.query(OperatingExpenseLineItem).filter(OperatingExpenseLineItem.property_id == PROP_ID).count()
plans = db.query(DevelopmentPlan).filter(DevelopmentPlan.property_id == PROP_ID).count()

print()
print("=" * 60)
print("SEED COMPLETE — 1847 Bowness Road NW")
print("=" * 60)
print(f"  Units: {len(units)} (1 baseline + 1 reno + 6 dev)")
print(f"  Beds: {all_beds} (8 + 8 + 24)")
print(f"  Debt Facilities: {debts} (1 baseline + 2 dev)")
print(f"  Ancillary Streams: {anc} (4 + 4 + 4)")
print(f"  Expense Items: {opex} (7 + 7 + 7)")
print(f"  Development Plans: {plans} (reno + full dev)")
print(f"  Acquisition Baseline: YES")
print(f"  Exit Forecast: YES")

db.close()
