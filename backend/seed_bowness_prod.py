"""Seed 1847 Bowness Road NW on production (creates new property)."""
from decimal import Decimal as D
from datetime import date
from app.db.session import SessionLocal
from app.db.models import (
    Property, Unit, Bed, BedStatus, UnitType, RenovationPhase, RentPricingMode,
    DevelopmentPlan, DevelopmentPlanStatus, DevelopmentStage,
    DebtFacility, DebtType, DebtStatus,
    AncillaryRevenueStream, OperatingExpenseLineItem, ExpenseCalcMethod,
    AcquisitionBaseline, ExitForecast,
)

db = SessionLocal()

existing = db.query(Property).filter(Property.address.like("%1847 Bowness%")).first()
if existing:
    print(f"Already exists as property_id={existing.property_id}. Skipping.")
    db.close()
    exit()

prop = Property(
    lp_id=1, address="1847 Bowness Road NW", city="Calgary", province="AB",
    purchase_price=D("465000"), purchase_date=date(2024, 6, 15),
    development_stage=DevelopmentStage.interim_operation,
    rent_pricing_mode=RentPricingMode.by_bed, property_type="Single Family",
    bedrooms=6, bathrooms=2, building_sqft=D("1800"), year_built=1962,
    zoning="R-C2", lot_size=D("6100"),
)
db.add(prop)
db.flush()
PID = prop.property_id

# === PHASE 1: BASELINE ===
bl_unit = Unit(property_id=PID, unit_number="House", unit_type=UnitType.shared,
    bed_count=8, bedroom_count=6, sqft=D("1800"), floor="Main + Upper",
    is_occupied=True, renovation_phase=RenovationPhase.pre_renovation)
db.add(bl_unit)
db.flush()

for i, rent in enumerate([800, 600, 600, 775, 700, 550, 550, 625], 1):
    db.add(Bed(unit_id=bl_unit.unit_id, bed_label=f"Bed {i}", monthly_rent=D(str(rent)),
        rent_type="private_pay", status=BedStatus.occupied, bedroom_number=min(i, 6), is_post_renovation=False))

for st, desc, cnt, util, rate in [
    ("parking", "Parking", 2, 100, D("50")), ("pet_fee", "Pet Fee", 2, 100, D("50")),
    ("storage", "Storage", 3, 67, D("75")), ("laundry", "Laundry", 1, 100, D("100")),
]:
    db.add(AncillaryRevenueStream(property_id=PID, stream_type=st, description=desc,
        total_count=cnt, utilization_pct=D(str(util)), monthly_rate=rate))

for cat, desc, method, amt in [
    ("property_tax", "Property Tax", "fixed", D("3500")),
    ("insurance", "Insurance", "fixed", D("2200")),
    ("utilities", "Utilities", "fixed", D("10800")),
    ("repairs_maintenance", "Maintenance", "fixed", D("4000")),
    ("management_fee", "Mgmt Fee 8%", "pct_egi", D("8")),
    ("other", "Landscaping", "fixed", D("2400")),
    ("reserves", "Reserves", "fixed", D("2400")),
]:
    db.add(OperatingExpenseLineItem(property_id=PID, category=cat, description=desc,
        calc_method=ExpenseCalcMethod(method), base_amount=amt))

bl_debt = DebtFacility(property_id=PID, lender_name="RFA Mortgage",
    debt_type=DebtType.permanent_mortgage, status=DebtStatus.active,
    debt_purpose="acquisition", commitment_amount=D("348750"),
    drawn_amount=D("348750"), outstanding_balance=D("348750"),
    interest_rate=D("4.79"), rate_type="fixed", term_months=60,
    amortization_months=300, compounding_method="semi_annual",
    origination_date=date(2024, 6, 15))
db.add(bl_debt)
db.flush()
BL_DEBT_ID = bl_debt.debt_id

# === PHASE 2: POST-RENO ===
plan_reno = DevelopmentPlan(property_id=PID, version=1, plan_name="Kitchen Renovation",
    status=DevelopmentPlanStatus.approved, planned_units=1, planned_beds=8,
    planned_sqft=D("1800"), estimated_construction_cost=D("35000"),
    hard_costs=D("28000"), soft_costs=D("5000"), contingency_percent=D("5"),
    construction_duration_months=2)
db.add(plan_reno)
db.flush()
RENO_ID = plan_reno.plan_id

reno_unit = Unit(property_id=PID, unit_number="House (Renovated)", unit_type=UnitType.shared,
    bed_count=8, bedroom_count=6, sqft=D("1800"), floor="Main + Upper", is_occupied=True,
    renovation_phase=RenovationPhase.post_renovation, development_plan_id=RENO_ID)
db.add(reno_unit)
db.flush()

for i, rent in enumerate([850, 625, 625, 800, 750, 625, 625, 685], 1):
    db.add(Bed(unit_id=reno_unit.unit_id, bed_label=f"Bed {i}", monthly_rent=D(str(rent)),
        rent_type="private_pay", status=BedStatus.occupied, bedroom_number=min(i, 6), is_post_renovation=True))

for st, desc, cnt, util, rate in [
    ("parking", "Parking", 2, 100, D("50")), ("pet_fee", "Pet Fee", 2, 100, D("50")),
    ("storage", "Storage", 3, 67, D("75")), ("laundry", "Laundry", 1, 100, D("100")),
]:
    db.add(AncillaryRevenueStream(property_id=PID, development_plan_id=RENO_ID,
        stream_type=st, description=desc, total_count=cnt, utilization_pct=D(str(util)), monthly_rate=rate))

for cat, desc, method, amt in [
    ("property_tax", "Property Tax", "fixed", D("3500")),
    ("insurance", "Insurance", "fixed", D("2200")),
    ("utilities", "Utilities", "fixed", D("10800")),
    ("repairs_maintenance", "Maintenance", "fixed", D("4000")),
    ("management_fee", "Mgmt Fee 8%", "pct_egi", D("8")),
    ("other", "Landscaping", "fixed", D("2400")),
    ("reserves", "Reserves", "fixed", D("2400")),
]:
    db.add(OperatingExpenseLineItem(property_id=PID, development_plan_id=RENO_ID,
        category=cat, description=desc, calc_method=ExpenseCalcMethod(method), base_amount=amt))

# === PHASE 3: FULL DEV ===
plan_dev = DevelopmentPlan(property_id=PID, version=2,
    plan_name="Full Development 6-Unit/24-Bed", status=DevelopmentPlanStatus.active,
    planned_units=6, planned_beds=24, planned_sqft=D("4800"),
    estimated_construction_cost=D("1800000"), hard_costs=D("1350000"),
    soft_costs=D("250000"), site_costs=D("100000"), financing_costs=D("50000"),
    contingency_percent=D("10"), development_start_date=date(2025, 3, 1),
    construction_duration_days=365, construction_duration_months=12,
    lease_up_months=6, estimated_completion_date=date(2026, 3, 1),
    estimated_stabilization_date=date(2026, 9, 1),
    projected_annual_revenue=D("240300"), projected_annual_noi=D("154285"),
    exit_sale_year=2032, exit_cap_rate=D("5.0"), exit_noi=D("175000"),
    exit_sale_price=D("3500000"), exit_selling_cost_pct=D("5.0"),
    exit_irr=D("18.45"), exit_equity_multiple=D("3.65"))
db.add(plan_dev)
db.flush()
DEV_ID = plan_dev.plan_id

rents_3br = [900, 800, 800, 875]
rents_2br = [825, 825, 825, 825]
for unum, utype, beds, brs, sqft, floor in [
    ("Unit 101", "3br", 4, 3, D("800"), "Ground"),
    ("Unit 102", "3br", 4, 3, D("800"), "Ground"),
    ("Unit 103", "3br", 4, 3, D("800"), "Ground"),
    ("Unit 201", "2br", 4, 2, D("700"), "Upper"),
    ("Unit 202", "2br", 4, 2, D("700"), "Upper"),
    ("Unit 203", "2br", 4, 2, D("700"), "Upper"),
]:
    u = Unit(property_id=PID, unit_number=unum, unit_type=UnitType(utype),
        bed_count=beds, bedroom_count=brs, sqft=sqft, floor=floor,
        is_occupied=True, renovation_phase=RenovationPhase.post_renovation,
        development_plan_id=DEV_ID)
    db.add(u)
    db.flush()
    for bi, rent in enumerate(rents_3br if utype == "3br" else rents_2br, 1):
        db.add(Bed(unit_id=u.unit_id, bed_label=f"{unum}-B{bi}",
            monthly_rent=D(str(rent)), rent_type="private_pay",
            status=BedStatus.occupied, bedroom_number=min(bi, brs), is_post_renovation=True))

for st, desc, cnt, util, rate in [
    ("parking", "Parking", 12, 85, D("75")), ("storage", "Storage", 8, 75, D("50")),
    ("laundry", "Laundry", 2, 100, D("150")), ("pet_fee", "Pet Fee", 6, 100, D("50")),
]:
    db.add(AncillaryRevenueStream(property_id=PID, development_plan_id=DEV_ID,
        stream_type=st, description=desc, total_count=cnt,
        utilization_pct=D(str(util)), monthly_rate=rate))

for cat, desc, method, amt in [
    ("property_tax", "Property Tax", "fixed", D("18000")),
    ("insurance", "Insurance", "fixed", D("8400")),
    ("utilities", "Utilities", "fixed", D("24000")),
    ("repairs_maintenance", "Maintenance", "fixed", D("9600")),
    ("management_fee", "Mgmt Fee 8%", "pct_egi", D("8")),
    ("other", "Common Area", "fixed", D("6000")),
    ("reserves", "Reserves", "fixed", D("7200")),
]:
    db.add(OperatingExpenseLineItem(property_id=PID, development_plan_id=DEV_ID,
        category=cat, description=desc, calc_method=ExpenseCalcMethod(method), base_amount=amt))

constr = DebtFacility(property_id=PID, lender_name="ATB Financial",
    debt_type=DebtType.construction_loan, status=DebtStatus.active,
    debt_purpose="construction", development_plan_id=DEV_ID,
    replaces_debt_id=BL_DEBT_ID, commitment_amount=D("1350000"),
    drawn_amount=D("0"), outstanding_balance=D("0"), interest_rate=D("7.5"),
    rate_type="variable", term_months=24, amortization_months=0,
    io_period_months=24, compounding_method="monthly")
db.add(constr)
db.flush()

cmhc = DebtFacility(property_id=PID, lender_name="First National",
    debt_type=DebtType.permanent_mortgage, status=DebtStatus.active,
    debt_purpose="refinancing", development_plan_id=DEV_ID,
    replaces_debt_id=constr.debt_id, commitment_amount=D("1684800"),
    drawn_amount=D("1684800"), outstanding_balance=D("1684800"),
    interest_rate=D("3.89"), rate_type="fixed", term_months=120,
    amortization_months=480, compounding_method="semi_annual",
    is_cmhc_insured=True, cmhc_program="MLI Select",
    cmhc_insurance_premium_pct=D("4.0"), cmhc_insurance_premium_amount=D("64800"),
    lender_fee_pct=D("0.5"), lender_fee_amount=D("8100"), capitalized_fees=D("72900"))
db.add(cmhc)

db.add(AcquisitionBaseline(property_id=PID, purchase_price=D("465000"),
    purchase_date=date(2024, 6, 15), closing_costs=D("15000"),
    total_acquisition_cost=D("480000"), initial_equity=D("116250"),
    initial_debt=D("348750"), acquisition_noi=D("29381"),
    acquisition_cap_rate=D("6.32"), acquisition_occupancy_pct=D("100"),
    target_hold_years=7, target_sale_year=2032, original_exit_cap_rate=D("5.0"),
    original_exit_noi=D("175000"), original_selling_cost_pct=D("5.0"),
    original_sale_price=D("3500000"), original_net_proceeds=D("1640200"),
    target_irr=D("18.45"), target_equity_multiple=D("3.65"),
    intended_disposition_type="stabilized_sale", created_by=1,
    notes="1847 Bowness Road NW - 3-phase sober living development"))

db.add(ExitForecast(property_id=PID, sale_status="planned", forecast_sale_year=2032,
    forecast_exit_noi=D("175000"), forecast_exit_cap_rate=D("5.0"),
    forecast_sale_price=D("3500000"), forecast_selling_cost_pct=D("5.0"),
    forecast_selling_costs=D("175000"), forecast_debt_payoff=D("1684800"),
    forecast_net_proceeds=D("1640200"), forecast_irr=D("18.45"),
    forecast_equity_multiple=D("3.65"), planned_disposition_type="stabilized_sale",
    min_occupancy_threshold_pct=D("90"), required_trailing_months=12, updated_by=1))

db.commit()
print(f"DONE: property_id={PID}, 8 units, 40 beds, 3 debts, 2 plans, baseline + forecast")
db.close()
