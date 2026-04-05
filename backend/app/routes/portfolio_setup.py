"""
Portfolio Setup Status & Property Wizard
=========================================
- Setup status: scans property data completeness, returns prioritized guidance
- Wizard: creates a fully modeled property from a strategy selection + basics
"""
from decimal import Decimal as D
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as _BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_gp_or_ops, require_investor_or_above
from app.db.models import (
    Property, Unit, Bed, BedStatus, UnitType, RenovationPhase, RentPricingMode,
    DevelopmentPlan, DevelopmentPlanStatus, DevelopmentStage,
    DebtFacility, DebtType, DebtStatus,
    AncillaryRevenueStream, OperatingExpenseLineItem, ExpenseCalcMethod,
    AcquisitionBaseline, ExitForecast,
    User,
)
from app.db.session import get_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Setup Status
# ---------------------------------------------------------------------------

@router.get("/properties/{property_id}/setup-status")
def get_setup_status(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """Scan property data completeness and return prioritized guidance."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    required = []
    recommended = []
    complete = []

    def _check(condition: bool, label: str, tab: str, priority: str = "required"):
        item = {"label": label, "tab": tab, "done": condition}
        if condition:
            complete.append(item)
        elif priority == "required":
            required.append(item)
        else:
            recommended.append(item)

    # --- Core Property ---
    _check(bool(prop.purchase_price), "Purchase price recorded", "acquisition")
    _check(bool(prop.purchase_date), "Purchase date recorded", "acquisition")
    _check(bool(prop.address and prop.city), "Address entered", "overview")

    # --- Units & Beds ---
    units = db.query(Unit).filter(
        Unit.property_id == property_id, Unit.development_plan_id.is_(None)
    ).all()
    beds = []
    for u in units:
        beds.extend(db.query(Bed).filter(Bed.unit_id == u.unit_id).all())
    total_beds = len(beds)
    total_rent = sum(float(b.monthly_rent or 0) for b in beds)

    _check(len(units) > 0, f"Baseline units configured ({len(units)} unit{'s' if len(units) != 1 else ''})", "operations")
    _check(total_beds > 0, f"Beds configured ({total_beds} bed{'s' if total_beds != 1 else ''})", "operations")
    _check(total_rent > 0, f"Rent roll entered (${total_rent:,.0f}/mo)", "operations")

    # --- Operating Expenses ---
    opex_count = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.property_id == property_id,
        OperatingExpenseLineItem.development_plan_id.is_(None),
    ).count()
    _check(opex_count >= 3, f"Operating expenses entered ({opex_count} line item{'s' if opex_count != 1 else ''})", "operations")

    # --- Debt ---
    debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == property_id,
        DebtFacility.development_plan_id.is_(None),
    ).all()
    _check(len(debts) > 0, f"Acquisition financing recorded ({len(debts)} facilit{'ies' if len(debts) != 1 else 'y'})", "debt")

    has_maturity = any(d.maturity_date for d in debts)
    if debts:
        _check(has_maturity, "Debt maturity date set", "debt", "recommended")

    # --- Acquisition Baseline ---
    baseline = db.query(AcquisitionBaseline).filter(
        AcquisitionBaseline.property_id == property_id
    ).first()
    _check(baseline is not None, "Acquisition baseline saved", "acquisition")

    has_mandate = baseline and baseline.target_sale_year
    _check(bool(has_mandate), "LP hold mandate configured", "acquisition")

    has_exit_assumptions = baseline and baseline.original_exit_cap_rate
    _check(bool(has_exit_assumptions), "Original exit assumptions recorded", "acquisition")

    # --- Exit Forecast ---
    forecast = db.query(ExitForecast).filter(
        ExitForecast.property_id == property_id
    ).first()
    _check(forecast is not None, "Exit forecast configured", "exit")

    # --- Development Plans ---
    plans = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.property_id == property_id
    ).count()
    _check(plans > 0, f"Development plan{'s' if plans != 1 else ''} created ({plans})", "strategy", "recommended")

    # --- Ancillary Revenue ---
    anc_count = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.property_id == property_id,
        AncillaryRevenueStream.development_plan_id.is_(None),
    ).count()
    _check(anc_count > 0, f"Ancillary revenue streams ({anc_count})", "operations", "recommended")

    # --- Area Research ---
    _check(bool(prop.ai_assessment), "Area research generated", "research", "recommended")

    # --- Photos ---
    from app.db.models import PropertyImage
    photo_count = db.query(PropertyImage).filter(
        PropertyImage.property_id == property_id
    ).count()
    has_listing_photos = bool(prop.listing_photo_urls)
    _check(photo_count > 0 or has_listing_photos, "Property photos uploaded", "research", "recommended")

    # --- Physical Details ---
    _check(bool(prop.building_sqft), "Building sqft recorded", "overview", "recommended")
    _check(bool(prop.year_built), "Year built recorded", "overview", "recommended")
    _check(bool(prop.zoning), "Zoning recorded", "overview", "recommended")

    # Calculate progress
    total = len(required) + len(recommended) + len(complete)
    done = len(complete)
    pct = round(done / total * 100) if total > 0 else 0

    return {
        "property_id": property_id,
        "progress_pct": pct,
        "total_items": total,
        "complete_count": done,
        "required_count": len(required),
        "recommended_count": len(recommended),
        "required": required,
        "recommended": recommended,
        "complete": complete,
    }


# ---------------------------------------------------------------------------
# Configure Units (structured bedroom > bed setup)
# ---------------------------------------------------------------------------

class BedInput(_BaseModel):
    bed_label: str
    monthly_rent: float = 0
    bedroom_number: int = 1

class UnitInput(_BaseModel):
    unit_number: str
    unit_type: str = "shared"
    bed_count: int = 1
    bedroom_count: int = 1
    sqft: float = 0
    floor: str = ""
    beds: list[BedInput] = []

class ConfigureUnitsInput(_BaseModel):
    plan_id: int | None = None  # None = baseline, set = for a development plan
    units: list[UnitInput]
    clear_existing: bool = True  # Remove existing units for this plan before creating

@router.post("/properties/{property_id}/configure-units")
def configure_units(
    property_id: int,
    payload: ConfigureUnitsInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Create units with structured bedroom > bed configuration.

    Works for any phase:
    - plan_id=None: baseline/as-is units
    - plan_id=N: units for a specific development plan
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    if payload.plan_id:
        plan = db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == payload.plan_id).first()
        if not plan:
            raise HTTPException(404, "Development plan not found")

    # Optionally clear existing units for this phase
    if payload.clear_existing:
        existing_units = db.query(Unit).filter(
            Unit.property_id == property_id,
            Unit.development_plan_id == payload.plan_id,
        ).all()
        for u in existing_units:
            db.query(Bed).filter(Bed.unit_id == u.unit_id).delete(synchronize_session=False)
        db.query(Unit).filter(
            Unit.property_id == property_id,
            Unit.development_plan_id == payload.plan_id,
        ).delete(synchronize_session=False)
        db.flush()

    is_post_reno = payload.plan_id is not None
    reno_phase = RenovationPhase.post_renovation if is_post_reno else RenovationPhase.pre_renovation

    created_units = 0
    created_beds = 0

    for u_input in payload.units:
        unit = Unit(
            property_id=property_id,
            unit_number=u_input.unit_number,
            unit_type=UnitType(u_input.unit_type) if u_input.unit_type in [e.value for e in UnitType] else UnitType.shared,
            bed_count=u_input.bed_count or len(u_input.beds),
            bedroom_count=u_input.bedroom_count,
            sqft=D(str(u_input.sqft)) if u_input.sqft else D("0"),
            floor=u_input.floor or None,
            is_occupied=False,
            renovation_phase=reno_phase,
            development_plan_id=payload.plan_id,
        )
        db.add(unit)
        db.flush()
        created_units += 1

        # Create beds
        if u_input.beds:
            for bed_input in u_input.beds:
                db.add(Bed(
                    unit_id=unit.unit_id,
                    bed_label=bed_input.bed_label,
                    monthly_rent=D(str(bed_input.monthly_rent)),
                    rent_type="private_pay",
                    status=BedStatus.available,
                    bedroom_number=bed_input.bedroom_number,
                    is_post_renovation=is_post_reno,
                ))
                created_beds += 1
        else:
            # Auto-create 1 bed per bedroom with $0 rent
            for br in range(1, u_input.bedroom_count + 1):
                db.add(Bed(
                    unit_id=unit.unit_id,
                    bed_label=f"{u_input.unit_number}-BR{br}",
                    monthly_rent=D("0"),
                    rent_type="private_pay",
                    status=BedStatus.available,
                    bedroom_number=br,
                    is_post_renovation=is_post_reno,
                ))
                created_beds += 1

    db.commit()

    return {
        "property_id": property_id,
        "plan_id": payload.plan_id,
        "created_units": created_units,
        "created_beds": created_beds,
    }


# ---------------------------------------------------------------------------
# Property Wizard
# ---------------------------------------------------------------------------

class WizardInput(_BaseModel):
    # Step 1: Strategy
    strategy: str  # "hold_as_is" | "buy_and_renovate" | "buy_renovate_develop"

    # Step 2: Property Basics
    address: str
    city: str = "Calgary"
    province: str = "AB"
    purchase_price: float
    purchase_date: str | None = None  # ISO date
    property_type: str = "Single Family"
    bedrooms: int = 4
    bathrooms: int = 2
    building_sqft: float = 1200
    year_built: int | None = None
    zoning: str | None = None
    lot_size: float | None = None
    listing_url: str | None = None

    # Step 3: Unit & Bed Setup
    baseline_rent_per_bed: float = 700
    reno_rent_per_bed: float | None = None  # post-reno rent (strategy 2+3)

    # Step 4: Development (strategy 3 only)
    dev_units: int | None = None
    dev_beds_per_unit: int | None = None
    dev_rent_per_bed: float | None = None
    dev_construction_cost: float | None = None

    # Step 5: Financing
    mortgage_ltv_pct: float = 75.0
    mortgage_rate: float = 5.0
    mortgage_amort_years: int = 25
    mortgage_term_years: int = 5
    reno_budget: float | None = None  # strategy 2+3

    # Step 6: LP Mandate
    lp_id: int | None = None
    target_hold_years: int = 7
    target_sale_year: int | None = None
    exit_cap_rate: float = 5.5
    target_irr: float | None = None
    target_equity_multiple: float | None = None


@router.post("/properties/wizard", status_code=status.HTTP_201_CREATED)
def create_property_wizard(
    payload: WizardInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Create a fully modeled property from strategy selection + basics."""
    p = payload
    purchase = D(str(p.purchase_price))
    purchase_date = date.fromisoformat(p.purchase_date) if p.purchase_date else date.today()
    beds_count = p.bedrooms  # 1 bed per bedroom for baseline

    # ── Create Property ──
    prop = Property(
        lp_id=p.lp_id,
        address=p.address,
        city=p.city,
        province=p.province,
        purchase_price=purchase,
        purchase_date=purchase_date,
        development_stage=DevelopmentStage.acquisition,
        rent_pricing_mode=RentPricingMode.by_bed,
        property_type=p.property_type,
        bedrooms=p.bedrooms,
        bathrooms=p.bathrooms,
        building_sqft=D(str(p.building_sqft)),
        year_built=p.year_built,
        zoning=p.zoning,
        lot_size=D(str(p.lot_size)) if p.lot_size else None,
        listing_url=p.listing_url,
    )
    db.add(prop)
    db.flush()
    PID = prop.property_id

    # ── Baseline Unit + Beds ──
    bl_unit = Unit(
        property_id=PID, unit_number="House", unit_type=UnitType.shared,
        bed_count=beds_count, bedroom_count=p.bedrooms, sqft=D(str(p.building_sqft)),
        floor="Main", is_occupied=False, renovation_phase=RenovationPhase.pre_renovation,
    )
    db.add(bl_unit)
    db.flush()

    rent = D(str(p.baseline_rent_per_bed))
    for i in range(1, beds_count + 1):
        db.add(Bed(
            unit_id=bl_unit.unit_id, bed_label=f"Bed {i}",
            monthly_rent=rent, rent_type="private_pay",
            status=BedStatus.available, bedroom_number=i,
            is_post_renovation=False,
        ))

    monthly_rent = rent * beds_count
    annual_gpr = float(monthly_rent * 12)

    # ── Default Operating Expenses ──
    default_expenses = [
        ("property_tax", "Property Tax", "fixed", round(float(purchase) * 0.008, 0)),  # ~0.8% of value
        ("insurance", "Insurance", "fixed", round(float(purchase) * 0.004, 0)),  # ~0.4% of value
        ("utilities", "Utilities", "fixed", round(beds_count * 150 * 12, 0)),  # $150/bed/mo
        ("repairs_maintenance", "Maintenance & Repairs", "fixed", round(annual_gpr * 0.05, 0)),  # 5% of GPR
        ("management_fee", "Management Fee (8% EGI)", "pct_egi", 8),
        ("other", "Landscaping / Common Area", "fixed", 2400),
        ("reserves", "Capital Reserves", "fixed", round(beds_count * 300, 0)),  # $300/bed/yr
    ]
    for cat, desc, method, amt in default_expenses:
        db.add(OperatingExpenseLineItem(
            property_id=PID, category=cat, description=desc,
            calc_method=ExpenseCalcMethod(method), base_amount=D(str(amt)),
        ))

    # ── Default Ancillary Revenue ──
    default_ancillary = [
        ("parking", "Parking", max(1, beds_count // 3), 100, D("50")),
        ("storage", "Storage", max(1, beds_count // 4), 75, D("50")),
        ("laundry", "Laundry", 1, 100, D("75")),
    ]
    for st, desc, cnt, util, rate in default_ancillary:
        db.add(AncillaryRevenueStream(
            property_id=PID, stream_type=st, description=desc,
            total_count=cnt, utilization_pct=D(str(util)), monthly_rate=rate,
        ))

    # ── Acquisition Mortgage ──
    mortgage_amt = D(str(round(float(purchase) * p.mortgage_ltv_pct / 100, 2)))
    equity = purchase - mortgage_amt

    bl_debt = DebtFacility(
        property_id=PID, lender_name="TBD Lender",
        debt_type=DebtType.permanent_mortgage, status=DebtStatus.active,
        debt_purpose="acquisition", commitment_amount=mortgage_amt,
        drawn_amount=mortgage_amt, outstanding_balance=mortgage_amt,
        interest_rate=D(str(p.mortgage_rate)), rate_type="fixed",
        term_months=p.mortgage_term_years * 12,
        amortization_months=p.mortgage_amort_years * 12,
        compounding_method="semi_annual",
        origination_date=purchase_date,
    )
    db.add(bl_debt)
    db.flush()

    # ── Estimate NOI for baseline ──
    vacancy_rate = 0.05
    egi = annual_gpr * (1 - vacancy_rate)
    fixed_expenses = sum(amt for _, _, method, amt in default_expenses if method == "fixed")
    mgmt_fee = egi * 0.08
    total_opex = fixed_expenses + mgmt_fee
    baseline_noi = egi - total_opex

    # ── Compute exit assumptions ──
    sale_year = p.target_sale_year or (purchase_date.year + p.target_hold_years)
    exit_noi = baseline_noi  # conservative: same as baseline for hold-as-is
    exit_cap = p.exit_cap_rate / 100
    exit_price = round(exit_noi / exit_cap, 0) if exit_cap > 0 else 0

    # ── Phase 2: Renovation Plan (strategy 2 or 3) ──
    reno_plan_id = None
    if p.strategy in ("buy_and_renovate", "buy_renovate_develop") and p.reno_budget:
        reno_rent = D(str(p.reno_rent_per_bed or p.baseline_rent_per_bed * 1.15))
        plan_reno = DevelopmentPlan(
            property_id=PID, version=1, plan_name="Renovation",
            status=DevelopmentPlanStatus.draft,
            planned_units=1, planned_beds=beds_count, planned_sqft=D(str(p.building_sqft)),
            estimated_construction_cost=D(str(p.reno_budget)),
            hard_costs=D(str(round(p.reno_budget * 0.8))),
            soft_costs=D(str(round(p.reno_budget * 0.15))),
            contingency_percent=D("10"),
            construction_duration_months=3,
        )
        db.add(plan_reno)
        db.flush()
        reno_plan_id = plan_reno.plan_id

        reno_unit = Unit(
            property_id=PID, unit_number="House (Renovated)",
            unit_type=UnitType.shared, bed_count=beds_count, bedroom_count=p.bedrooms,
            sqft=D(str(p.building_sqft)), floor="Main", is_occupied=False,
            renovation_phase=RenovationPhase.post_renovation,
            development_plan_id=reno_plan_id,
        )
        db.add(reno_unit)
        db.flush()

        for i in range(1, beds_count + 1):
            db.add(Bed(
                unit_id=reno_unit.unit_id, bed_label=f"Bed {i}",
                monthly_rent=reno_rent, rent_type="private_pay",
                status=BedStatus.available, bedroom_number=i,
                is_post_renovation=True,
            ))

        # Clone baseline expenses for reno plan
        for cat, desc, method, amt in default_expenses:
            db.add(OperatingExpenseLineItem(
                property_id=PID, development_plan_id=reno_plan_id,
                category=cat, description=desc,
                calc_method=ExpenseCalcMethod(method), base_amount=D(str(amt)),
            ))
        for st, desc, cnt, util, rate in default_ancillary:
            db.add(AncillaryRevenueStream(
                property_id=PID, development_plan_id=reno_plan_id,
                stream_type=st, description=desc,
                total_count=cnt, utilization_pct=D(str(util)), monthly_rate=rate,
            ))

        # Update exit NOI estimate for reno
        reno_annual = float(reno_rent) * beds_count * 12
        reno_egi = reno_annual * (1 - vacancy_rate)
        reno_noi = reno_egi - fixed_expenses - (reno_egi * 0.08)
        exit_noi = reno_noi
        exit_price = round(exit_noi / exit_cap, 0) if exit_cap > 0 else 0

    # ── Phase 3: Full Development (strategy 3 only) ──
    if p.strategy == "buy_renovate_develop" and p.dev_units and p.dev_beds_per_unit:
        dev_beds = p.dev_units * p.dev_beds_per_unit
        dev_rent = D(str(p.dev_rent_per_bed or 850))
        dev_sqft = D(str(p.dev_units * 750))
        dev_cost = D(str(p.dev_construction_cost or p.dev_units * 250000))

        plan_dev = DevelopmentPlan(
            property_id=PID, version=2,
            plan_name=f"Full Development {p.dev_units}-Unit/{dev_beds}-Bed",
            status=DevelopmentPlanStatus.draft,
            planned_units=p.dev_units, planned_beds=dev_beds,
            planned_sqft=dev_sqft, estimated_construction_cost=dev_cost,
            hard_costs=D(str(round(float(dev_cost) * 0.70))),
            soft_costs=D(str(round(float(dev_cost) * 0.15))),
            site_costs=D(str(round(float(dev_cost) * 0.08))),
            financing_costs=D(str(round(float(dev_cost) * 0.04))),
            contingency_percent=D("10"),
            construction_duration_months=12,
            lease_up_months=6,
        )
        db.add(plan_dev)
        db.flush()
        dev_plan_id = plan_dev.plan_id

        # Create dev units
        beds_per = p.dev_beds_per_unit
        br_count = max(2, beds_per - 1)
        utype = "3br" if br_count >= 3 else "2br"
        for ui in range(1, p.dev_units + 1):
            u = Unit(
                property_id=PID, unit_number=f"Unit {100 + ui}",
                unit_type=UnitType(utype), bed_count=beds_per,
                bedroom_count=br_count, sqft=D("750"),
                floor="Ground" if ui <= p.dev_units // 2 else "Upper",
                is_occupied=False, renovation_phase=RenovationPhase.post_renovation,
                development_plan_id=dev_plan_id,
            )
            db.add(u)
            db.flush()
            for bi in range(1, beds_per + 1):
                db.add(Bed(
                    unit_id=u.unit_id, bed_label=f"Unit {100+ui}-B{bi}",
                    monthly_rent=dev_rent, rent_type="private_pay",
                    status=BedStatus.available, bedroom_number=min(bi, br_count),
                    is_post_renovation=True,
                ))

        # Dev ancillary
        dev_ancillary = [
            ("parking", "Parking", dev_beds // 2, 85, D("75")),
            ("storage", "Storage", dev_beds // 3, 75, D("50")),
            ("laundry", "Laundry", max(1, p.dev_units // 3), 100, D("150")),
            ("pet_fee", "Pet Fee", p.dev_units, 100, D("50")),
        ]
        for st, desc, cnt, util, rate in dev_ancillary:
            db.add(AncillaryRevenueStream(
                property_id=PID, development_plan_id=dev_plan_id,
                stream_type=st, description=desc,
                total_count=cnt, utilization_pct=D(str(util)), monthly_rate=rate,
            ))

        # Dev expenses (scaled)
        dev_expenses = [
            ("property_tax", "Property Tax", "fixed", round(float(dev_cost) * 0.01)),
            ("insurance", "Insurance", "fixed", round(p.dev_units * 1400)),
            ("utilities", "Utilities", "fixed", round(dev_beds * 100 * 12)),
            ("repairs_maintenance", "Maintenance", "fixed", round(dev_beds * 400)),
            ("management_fee", "Management Fee (8% EGI)", "pct_egi", 8),
            ("other", "Common Area Maintenance", "fixed", round(p.dev_units * 1000)),
            ("reserves", "Capital Reserves", "fixed", round(dev_beds * 300)),
        ]
        for cat, desc, method, amt in dev_expenses:
            db.add(OperatingExpenseLineItem(
                property_id=PID, development_plan_id=dev_plan_id,
                category=cat, description=desc,
                calc_method=ExpenseCalcMethod(method), base_amount=D(str(amt)),
            ))

        # Update exit NOI for dev
        dev_annual = float(dev_rent) * dev_beds * 12
        dev_egi = dev_annual * (1 - vacancy_rate)
        dev_fixed = sum(amt for _, _, method, amt in dev_expenses if method == "fixed")
        dev_noi = dev_egi - dev_fixed - (dev_egi * 0.08)
        exit_noi = dev_noi
        exit_price = round(exit_noi / exit_cap, 0) if exit_cap > 0 else 0

    # ── Acquisition Baseline ──
    db.add(AcquisitionBaseline(
        property_id=PID, purchase_price=purchase, purchase_date=purchase_date,
        closing_costs=D(str(round(float(purchase) * 0.03))),
        total_acquisition_cost=D(str(round(float(purchase) * 1.03))),
        initial_equity=equity, initial_debt=mortgage_amt,
        acquisition_noi=D(str(round(baseline_noi))),
        acquisition_cap_rate=D(str(round(baseline_noi / float(purchase) * 100, 2))) if float(purchase) > 0 else None,
        target_hold_years=p.target_hold_years,
        target_sale_year=sale_year,
        original_exit_cap_rate=D(str(p.exit_cap_rate)),
        original_exit_noi=D(str(round(exit_noi))),
        original_sale_price=D(str(exit_price)),
        target_irr=D(str(p.target_irr)) if p.target_irr else None,
        target_equity_multiple=D(str(p.target_equity_multiple)) if p.target_equity_multiple else None,
        intended_disposition_type="stabilized_sale",
        created_by=current_user.user_id,
    ))

    # ── Exit Forecast (same as baseline initially) ──
    selling_costs = round(exit_price * 0.05)
    debt_payoff = float(mortgage_amt)
    net_proceeds = exit_price - selling_costs - debt_payoff

    db.add(ExitForecast(
        property_id=PID, sale_status="planned",
        forecast_sale_year=sale_year,
        forecast_exit_noi=D(str(round(exit_noi))),
        forecast_exit_cap_rate=D(str(p.exit_cap_rate)),
        forecast_sale_price=D(str(exit_price)),
        forecast_selling_cost_pct=D("5.0"),
        forecast_selling_costs=D(str(selling_costs)),
        forecast_debt_payoff=D(str(round(debt_payoff))),
        forecast_net_proceeds=D(str(round(net_proceeds))),
        planned_disposition_type="stabilized_sale",
        min_occupancy_threshold_pct=D("90"),
        required_trailing_months=12,
        updated_by=current_user.user_id,
    ))

    db.commit()

    return {
        "property_id": PID,
        "address": p.address,
        "strategy": p.strategy,
        "purchase_price": float(purchase),
        "baseline_beds": beds_count,
        "baseline_monthly_rent": float(monthly_rent),
        "baseline_noi": round(baseline_noi),
        "mortgage_amount": float(mortgage_amt),
        "exit_year": sale_year,
        "exit_price": exit_price,
        "message": f"Property created with {p.strategy.replace('_', ' ')} strategy",
    }
