"""
API routes for the Portfolio domain: Properties, Clusters,
Development Plans, and Financial Modeling.
"""
import datetime

import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from dateutil.relativedelta import relativedelta
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import (
    get_current_user, require_gp_ops_pm, require_gp_or_ops,
    require_investor_or_above, get_user_entity_ids,
    filter_by_lp_scope, filter_by_property_scope,
    PaginationParams,
)
from app.db.models import (
    DevelopmentPlan, LPEntity, Property, PropertyCluster, User, UserRole,
    ScopeEntityType, Unit, Bed, BedStatus, UnitType, RenovationPhase,
)
from app.db.session import get_db
from app.schemas.portfolio import (
    CostEstimateInput, CostEstimateResult,
    DebtFacilityCreate, DebtFacilityOut,
    DevelopmentPlanCreate, DevelopmentPlanOut, DevelopmentPlanUpdate,
    ModelingInput, ModelingResult,
    PropertyClusterCreate, PropertyClusterOut,
    PropertyCreate, PropertyOut, PropertyUpdate,
)
from app.services.modeling import (
    calculate_cap_rate, calculate_construction_costs, calculate_irr, calculate_noi,
    CostEstimator,
)

router = APIRouter()


def _property_to_out(prop: Property) -> PropertyOut:
    """Helper to convert a Property ORM object to PropertyOut with lp_name."""
    return PropertyOut(
        property_id=prop.property_id,
        address=prop.address,
        city=prop.city,
        province=prop.province,
        lp_id=prop.lp_id,
        lp_name=prop.lp.name if prop.lp else None,
        cluster_id=prop.cluster_id,
        community_id=prop.community_id,
        community_name=prop.community.name if prop.community else None,
        pm_id=prop.pm_id,
        pm_name=prop.property_manager.name if prop.property_manager else None,
        purchase_date=prop.purchase_date,
        purchase_price=prop.purchase_price,
        assessed_value=prop.assessed_value,
        current_market_value=prop.current_market_value,
        lot_size=prop.lot_size,
        zoning=prop.zoning,
        max_buildable_area=prop.max_buildable_area,
        floor_area_ratio=prop.floor_area_ratio,
        development_stage=prop.development_stage,
        rent_pricing_mode=prop.rent_pricing_mode,
        annual_rent_increase_pct=prop.annual_rent_increase_pct,
        annual_revenue=prop.annual_revenue,
        annual_expenses=prop.annual_expenses,
        annual_other_income=prop.annual_other_income,
        year_built=prop.year_built,
        property_type=prop.property_type,
        building_sqft=prop.building_sqft,
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        property_style=prop.property_style,
        garage=prop.garage,
        storeys=prop.storeys,
        building_type=prop.building_type,
        total_finished_area=prop.total_finished_area,
        foundation_type=prop.foundation_type,
        construction_material=prop.construction_material,
        exterior_finish=prop.exterior_finish,
        basement_type=prop.basement_type,
        heating_type=prop.heating_type,
        cooling_type=prop.cooling_type,
        flooring_types=prop.flooring_types,
        title_type=prop.title_type,
        postal_code=prop.postal_code,
        parking_type=prop.parking_type,
        parking_spaces=prop.parking_spaces,
        frontage_m=prop.frontage_m,
        land_depth_m=prop.land_depth_m,
        walk_score=prop.walk_score,
        transit_score=prop.transit_score,
        bike_score=prop.bike_score,
        listing_description=prop.listing_description,
        appliances=prop.appliances,
        structures=prop.structures,
        has_fencing=prop.has_fencing,
        room_dimensions=prop.room_dimensions,
        neighbourhood=prop.neighbourhood,
        ward=prop.ward,
        legal_description=prop.legal_description,
        latitude=prop.latitude,
        longitude=prop.longitude,
        roll_number=prop.roll_number,
        assessment_class=prop.assessment_class,
        tax_amount=prop.tax_amount,
        tax_year=prop.tax_year,
        mls_number=prop.mls_number,
        list_price=prop.list_price,
        last_sold_price=prop.last_sold_price,
        last_sold_date=prop.last_sold_date,
    )


# ---------------------------------------------------------------------------
# Properties
# ---------------------------------------------------------------------------

@router.get("/properties")
def list_properties(
    lp_id: int | None = None,
    pg: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """List properties filtered by the user's scope. Optionally filter by lp_id."""
    query = db.query(Property)
    query = filter_by_lp_scope(query, current_user, db, Property.lp_id)
    if lp_id is not None:
        query = query.filter(Property.lp_id == lp_id)
    return pg.paginate(query, transform=_property_to_out)


@router.post("/properties", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
def create_property(
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if payload.lp_id:
        lp = db.query(LPEntity).filter(LPEntity.lp_id == payload.lp_id).first()
        if not lp:
            raise HTTPException(status_code=404, detail="LP entity not found")
    # Enforce LP purpose_type ↔ community type match
    from app.services.validation_service import validate_property_lp_community_match
    validate_property_lp_community_match(db, payload.lp_id, payload.community_id)

    prop = Property(**payload.model_dump())
    db.add(prop)
    try:
        db.commit()
        db.refresh(prop)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return _property_to_out(prop)


@router.get("/properties/{property_id}", response_model=PropertyOut)
def get_property(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    # Scope check: verify user has access to this property's LP
    if prop.lp_id and current_user.role not in (UserRole.DEVELOPER, UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        from app.core.deps import check_entity_access
        if not check_entity_access(current_user, db, ScopeEntityType.lp, prop.lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
    return _property_to_out(prop)


@router.patch("/properties/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: int,
    payload: PropertyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    data = payload.model_dump(exclude_unset=True)

    # Validate LP ↔ community type match if either is changing
    from app.services.validation_service import validate_property_lp_community_match
    new_lp = data.get("lp_id", prop.lp_id)
    new_comm = data.get("community_id", prop.community_id)
    validate_property_lp_community_match(db, new_lp, new_comm)

    for field, value in data.items():
        setattr(prop, field, value)
    try:
        db.commit()
        db.refresh(prop)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return _property_to_out(prop)


@router.delete("/properties/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    db.delete(prop)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Development Plans
# ---------------------------------------------------------------------------

@router.get("/properties/{property_id}/plans", response_model=list[DevelopmentPlanOut])
def list_plans(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop.development_plans


@router.post(
    "/properties/{property_id}/plans",
    response_model=DevelopmentPlanOut,
    status_code=status.HTTP_201_CREATED,
)
def create_plan(
    property_id: int,
    payload: DevelopmentPlanCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(status_code=404, detail="Property not found")
    plan = DevelopmentPlan(property_id=property_id, **payload.model_dump())
    db.add(plan)
    try:
        db.commit()
        db.refresh(plan)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return plan


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    plan = db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.delete(plan)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch("/plans/{plan_id}", response_model=DevelopmentPlanOut)
def update_plan(
    plan_id: int,
    payload: DevelopmentPlanUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """Partial update of a development plan — only supplied fields are changed."""
    plan = db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(plan, key, value)

    # Check for overlapping plans
    from datetime import timedelta
    start = plan.development_start_date
    if isinstance(start, str):
        from datetime import date as _d2
        try:
            start = _d2.fromisoformat(start)
        except ValueError:
            start = None
    if start:
        dur = plan.construction_duration_days or (plan.construction_duration_months * 30 if plan.construction_duration_months else 0)
        end = start + timedelta(days=dur) if dur > 0 else start
        other_plans = db.query(DevelopmentPlan).filter(
            DevelopmentPlan.property_id == plan.property_id,
            DevelopmentPlan.plan_id != plan.plan_id,
        ).all()
        for other in other_plans:
            o_start = other.development_start_date
            if not o_start:
                continue
            o_dur = other.construction_duration_days or (other.construction_duration_months * 30 if other.construction_duration_months else 0)
            o_end = o_start + timedelta(days=o_dur) if o_dur > 0 else o_start
            # Check overlap: plan starts before other ends AND plan ends after other starts
            if start < o_end and end > o_start:
                raise HTTPException(
                    status_code=400,
                    detail=f"Timeline overlaps with '{other.plan_name or 'Plan ' + str(other.plan_id)}' ({o_start} to {o_end}). Development plans cannot overlap.",
                )

    # Auto-calculate completion and stabilization dates from start + duration + lease-up
    if plan.development_start_date:
        start = plan.development_start_date
        if isinstance(start, str):
            from datetime import date as _d
            try:
                start = _d.fromisoformat(start)
            except ValueError:
                start = None
        if start:
            duration_days = plan.construction_duration_days or 0
            if duration_days == 0 and plan.construction_duration_months:
                duration_days = plan.construction_duration_months * 30
            if duration_days > 0:
                plan.estimated_completion_date = start + timedelta(days=duration_days)
                lease_up = plan.lease_up_months or 0
                plan.estimated_stabilization_date = plan.estimated_completion_date + timedelta(days=lease_up * 30)

    try:
        db.commit()
        db.refresh(plan)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return plan


# ---------------------------------------------------------------------------
# Financial Modeling
# ---------------------------------------------------------------------------

@router.post("/model", response_model=ModelingResult)
def run_model(
    payload: ModelingInput,
    _: User = Depends(require_gp_ops_pm),
):
    from decimal import Decimal, ROUND_HALF_UP
    # Total project cost = land + construction
    construction_costs = payload.purchase_price + payload.construction_cost
    # NOI = revenue - expenses
    noi = payload.annual_revenue - payload.annual_expenses
    # Cap rate = NOI / total cost
    if construction_costs > 0:
        cap_rate = (noi / construction_costs) * Decimal("100")
    else:
        cap_rate = Decimal("0")
    # IRR via simplified cash flow: initial outlay + annual NOI + terminal sale
    hold = payload.hold_period_years
    exit_cap = payload.exit_cap_rate if payload.exit_cap_rate > 0 else Decimal("0.05")
    terminal_value = noi / exit_cap  # sale price at exit cap rate
    # Build cash flows: year 0 = -cost, years 1..N-1 = NOI, year N = NOI + terminal_value
    cash_flows = [-float(construction_costs)]
    for yr in range(1, hold + 1):
        cf = float(noi)
        if yr == hold:
            cf += float(terminal_value)
        cash_flows.append(cf)
    # Newton-Raphson IRR
    irr_val = Decimal("0")
    try:
        guess = 0.10
        for _ in range(200):
            npv = sum(cf / (1 + guess) ** t for t, cf in enumerate(cash_flows))
            dnpv = sum(-t * cf / (1 + guess) ** (t + 1) for t, cf in enumerate(cash_flows))
            if abs(dnpv) < 1e-12:
                break
            guess = guess - npv / dnpv
        irr_val = Decimal(str(guess * 100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        irr_val = Decimal("0")
    return ModelingResult(
        construction_costs=construction_costs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        noi=noi.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        cap_rate=cap_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        irr=irr_val,
    )


# ---------------------------------------------------------------------------
# Property Clusters
# ---------------------------------------------------------------------------

@router.get("/clusters", response_model=list[PropertyClusterOut])
def list_clusters(
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    clusters = db.query(PropertyCluster).all()
    result = []
    for c in clusters:
        out = PropertyClusterOut(
            cluster_id=c.cluster_id,
            name=c.name,
            city=c.city,
            has_commercial_kitchen=c.has_commercial_kitchen,
            kitchen_capacity_meals_per_day=c.kitchen_capacity_meals_per_day,
            notes=c.notes,
            property_count=len(c.properties) if c.properties else 0,
        )
        result.append(out)
    return result


@router.post("/clusters", response_model=PropertyClusterOut, status_code=status.HTTP_201_CREATED)
def create_cluster(
    payload: PropertyClusterCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    cluster = PropertyCluster(**payload.model_dump())
    db.add(cluster)
    try:
        db.commit()
        db.refresh(cluster)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return PropertyClusterOut(
        cluster_id=cluster.cluster_id,
        name=cluster.name,
        city=cluster.city,
        has_commercial_kitchen=cluster.has_commercial_kitchen,
        kitchen_capacity_meals_per_day=cluster.kitchen_capacity_meals_per_day,
        notes=cluster.notes,
        property_count=0,
    )


@router.get("/clusters/{cluster_id}", response_model=PropertyClusterOut)
def get_cluster(
    cluster_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    cluster = db.query(PropertyCluster).filter(PropertyCluster.cluster_id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return PropertyClusterOut(
        cluster_id=cluster.cluster_id,
        name=cluster.name,
        city=cluster.city,
        has_commercial_kitchen=cluster.has_commercial_kitchen,
        kitchen_capacity_meals_per_day=cluster.kitchen_capacity_meals_per_day,
        notes=cluster.notes,
        property_count=len(cluster.properties) if cluster.properties else 0,
    )


# ---------------------------------------------------------------------------
# Cost Estimation Engine
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Debt Facilities
# ---------------------------------------------------------------------------

from app.db.models import DebtFacility

@router.post("/debt-facilities", response_model=DebtFacilityOut)
def create_debt_facility(
    payload: DebtFacilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    data = payload.model_dump()

    # Auto-compute CMHC insurance premium and lender fees
    commitment = float(data.get("commitment_amount", 0))
    if data.get("is_cmhc_insured") and data.get("cmhc_insurance_premium_pct"):
        premium = commitment * float(data["cmhc_insurance_premium_pct"]) / 100
        data["cmhc_insurance_premium_amount"] = round(premium, 2)
    else:
        data.setdefault("cmhc_insurance_premium_amount", None)

    if data.get("lender_fee_pct"):
        lender_fee = commitment * float(data["lender_fee_pct"]) / 100
        data["lender_fee_amount"] = round(lender_fee, 2)
    else:
        data.setdefault("lender_fee_amount", None)

    # Capitalized fees = CMHC premium + lender fee (rolled into loan balance)
    cap_fees = float(data.get("cmhc_insurance_premium_amount") or 0) + float(data.get("lender_fee_amount") or 0)
    data["capitalized_fees"] = round(cap_fees, 2)

    # If CMHC insured, auto-set outstanding balance to include capitalized fees
    if cap_fees > 0 and float(data.get("outstanding_balance", 0)) == 0:
        data["outstanding_balance"] = round(commitment + cap_fees, 2)
        data["drawn_amount"] = round(commitment + cap_fees, 2)

    # Auto-set debt_purpose based on debt_type if not explicitly set
    if not data.get("debt_purpose") or data["debt_purpose"] == "acquisition":
        debt_type = data.get("debt_type", "")
        if debt_type == "construction_loan":
            data["debt_purpose"] = "construction"
        elif data.get("development_plan_id") and debt_type == "permanent_mortgage":
            data["debt_purpose"] = "refinancing"

    # Auto-detect replaces_debt_id if not set
    if not data.get("replaces_debt_id") and data.get("property_id"):
        prop_id = data["property_id"]
        plan_id = data.get("development_plan_id")
        debt_type = data.get("debt_type", "")

        if debt_type == "construction_loan" and plan_id:
            # Construction loan replaces the existing baseline mortgage
            baseline_mortgage = db.query(DebtFacility).filter(
                DebtFacility.property_id == prop_id,
                DebtFacility.development_plan_id.is_(None),
                DebtFacility.debt_type == "permanent_mortgage",
            ).first()
            if baseline_mortgage:
                data["replaces_debt_id"] = baseline_mortgage.debt_id

        elif debt_type == "permanent_mortgage" and plan_id:
            # Permanent mortgage replaces the construction loan for same plan
            construction_loan = db.query(DebtFacility).filter(
                DebtFacility.property_id == prop_id,
                DebtFacility.development_plan_id == plan_id,
                DebtFacility.debt_type == "construction_loan",
            ).first()
            if construction_loan:
                data["replaces_debt_id"] = construction_loan.debt_id

    # Auto-calculate maturity from origination + term
    if data.get("origination_date") and data.get("term_months") and not data.get("maturity_date"):
        from dateutil.relativedelta import relativedelta as _rd
        orig = data["origination_date"]
        if isinstance(orig, str):
            orig = datetime.date.fromisoformat(orig)
        data["maturity_date"] = orig + _rd(months=int(data["term_months"]))

    # Convert date strings to Python date objects for SQLite compatibility
    for date_field in ('origination_date', 'maturity_date'):
        val = data.get(date_field)
        if isinstance(val, str):
            data[date_field] = datetime.date.fromisoformat(val)
    facility = DebtFacility(**data)
    db.add(facility)
    try:
        db.commit()
        db.refresh(facility)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
    return facility

@router.get("/properties/{property_id}/debt", response_model=list[DebtFacilityOut])
def list_debt_facilities(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    return db.query(DebtFacility).filter(DebtFacility.property_id == property_id).all()

@router.patch("/debt-facilities/{debt_id}", response_model=DebtFacilityOut)
def update_debt_facility(
    debt_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    facility = db.query(DebtFacility).filter(DebtFacility.debt_id == debt_id).first()
    if not facility:
        raise HTTPException(404, "Debt facility not found")
    from datetime import date as _date
    date_fields = {"origination_date", "maturity_date"}
    for k, v in payload.items():
        if hasattr(facility, k):
            if k in date_fields and isinstance(v, str) and v:
                try:
                    v = _date.fromisoformat(v)
                except ValueError:
                    continue
            elif k in date_fields and not v:
                v = None
            setattr(facility, k, v)
    try:
        db.commit()
        db.refresh(facility)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return facility


# ---------------------------------------------------------------------------
# Mortgage Amortization Schedule
# ---------------------------------------------------------------------------

from typing import List as _List
from pydantic import BaseModel as _BaseModel
from app.services.debt import MortgageEngine


class _AmortizationPeriodOut(_BaseModel):
    period: int
    payment: float
    interest: float
    principal: float
    balance: float


class _AnnualDebtSummaryOut(_BaseModel):
    year: int
    total_payment: float
    total_interest: float
    total_principal: float
    closing_balance: float
    is_io_year: bool


class _AmortizationScheduleOut(_BaseModel):
    debt_id: int
    lender_name: str
    outstanding_balance: float
    annual_interest_rate: float
    amortization_months: int
    io_period_months: int
    monthly_schedule: _List[_AmortizationPeriodOut]
    annual_schedule: _List[_AnnualDebtSummaryOut]


@router.get(
    "/properties/{property_id}/debt/{debt_id}/amortization",
    response_model=_AmortizationScheduleOut,
)
def get_amortization_schedule(
    property_id: int,
    debt_id: int,
    years: int = 10,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """
    Return a full amortization schedule (monthly + annual) for a debt facility.
    Query param ?years= controls how many years to project (default 10, max 30).
    """
    facility = (
        db.query(DebtFacility)
        .filter(
            DebtFacility.debt_id == debt_id,
            DebtFacility.property_id == property_id,
        )
        .first()
    )
    if not facility:
        raise HTTPException(404, "Debt facility not found")

    years = min(max(years, 1), 30)
    balance = float(facility.outstanding_balance or facility.commitment_amount or 0)
    rate = float(facility.interest_rate or 0) / 100  # stored as percentage
    amort_months = facility.amortization_months or 0
    io_months = facility.io_period_months or 0

    engine = MortgageEngine(
        outstanding_balance=balance,
        annual_interest_rate=rate,
        amortization_months=amort_months,
        io_period_months=io_months,
    )

    monthly = [
        _AmortizationPeriodOut(
            period=p.period,
            payment=p.payment,
            interest=p.interest,
            principal=p.principal,
            balance=p.balance,
        )
        for p in engine.monthly_schedule(periods=years * 12)
    ]

    annual = [
        _AnnualDebtSummaryOut(
            year=a.year,
            total_payment=a.total_payment,
            total_interest=a.total_interest,
            total_principal=a.total_principal,
            closing_balance=a.closing_balance,
            is_io_year=a.is_io_year,
        )
        for a in engine.annual_schedule(years=years)
    ]

    return _AmortizationScheduleOut(
        debt_id=facility.debt_id,
        lender_name=facility.lender_name,
        outstanding_balance=balance,
        annual_interest_rate=float(facility.interest_rate or 0),
        amortization_months=amort_months,
        io_period_months=io_months,
        monthly_schedule=monthly,
        annual_schedule=annual,
    )


# ---------------------------------------------------------------------------
# Time-Phased Annual Projection
# ---------------------------------------------------------------------------

from app.services.projections import LifecycleProjectionEngine
from app.services.debt import MortgageEngine as _MortgageEngine


class _YearProjectionOut(_BaseModel):
    year: int
    phase: str
    rentable_months: int
    occupancy_rate: float
    gross_potential_rent: float
    vacancy_loss: float
    effective_gross_income: float
    management_fee: float = 0.0
    operating_expenses: float
    total_expenses: float = 0.0
    noi: float
    construction_mgmt_fee: float = 0.0
    annual_debt_service: float
    cash_flow: float
    cumulative_cash_flow: float
    implied_cap_rate: float = 0.0
    implied_value: float = 0.0


class _FeesSummaryOut(_BaseModel):
    total_management_fees: float = 0.0
    total_construction_mgmt_fees: float = 0.0
    selling_commission: float = 0.0
    offering_cost: float = 0.0
    acquisition_fee: float = 0.0
    refinancing_fee: float = 0.0
    turnover_replacement_fee: float = 0.0
    total_upfront_fees: float = 0.0
    total_ongoing_fees: float = 0.0
    total_all_fees: float = 0.0
    net_deployable_capital: float = 0.0


class _ProjectionSummaryOut(_BaseModel):
    total_cash_flow: float
    exit_noi: float
    exit_cap_rate: float
    terminal_value: float
    disposition_costs: float
    net_exit_proceeds: float
    total_return: float
    total_equity_invested: float
    equity_multiple: float | None = None
    irr_estimate: float | None = None
    cash_on_cash_avg: float | None = None
    annualized_roi: float | None = None
    fees: _FeesSummaryOut | None = None
    lp_share_of_profits: float | None = None
    gp_share_of_profits: float | None = None


class _ProjectionResultOut(_BaseModel):
    projections: list[_YearProjectionOut]
    summary: _ProjectionSummaryOut


class _ProjectionInput(_BaseModel):
    # ── Core inputs (from frontend) ──
    # Revenue sources
    baseline_annual_revenue: float | None = None   # current as-is income
    baseline_annual_expenses: float | None = None   # current as-is expenses
    stabilized_annual_revenue: float | None = None  # projected plan income
    # Simplified revenue calc (fallback)
    planned_units: int | None = None
    monthly_rent_per_unit: float | None = None
    # Expense & vacancy assumptions
    annual_expense_ratio: float | None = None  # 0.35 = 35%
    vacancy_rate: float | None = None          # 0.05 = 5%
    annual_rent_increase: float | None = None  # 0.03 = 3%
    expense_growth_rate: float = 0.02
    # Construction timeline
    construction_start_date: str | None = None  # ISO date string
    construction_months: int = 18
    lease_up_months: int = 6
    carrying_cost_annual: float = 0.0
    # Debt service
    annual_debt_service: float | None = None
    # Exit assumptions
    exit_cap_rate: float | None = None         # 0.055 = 5.5%
    disposition_cost_pct: float = 0.02         # 2% selling costs
    # Equity & debt for return calcs
    total_equity_invested: float = 0.0
    debt_balance_at_exit: float = 0.0
    # Projection horizon
    projection_years: int = 10
    # ── Legacy / advanced overrides ──
    construction_start_year: int | None = None
    construction_duration_years: int | None = None
    stabilized_operating_expenses: float | None = None
    vacancy_rate_stabilized: float | None = None  # legacy alias
    lease_up_start_occupancy: float = 0.0
    stabilized_occupancy: float | None = None
    interim_revenue: float = 0.0
    interim_expenses: float = 0.0
    revenue_growth_rate: float | None = None
    # Debt params for embedded debt service calculation
    debt_outstanding_balance: float = 0.0
    debt_annual_rate: float = 0.0
    debt_amortization_months: int = 0
    debt_io_months: int = 0
    # LP Fee parameters
    management_fee_rate: float = 0.025       # 2.5% of gross revenues
    construction_mgmt_fee_rate: float = 0.015 # 1.5% of construction budget
    construction_budget: float = 0.0          # total construction cost
    selling_commission_rate: float = 0.10     # 10% of gross raise
    offering_cost: float = 250000.0           # fixed $250K
    acquisition_fee_rate: float = 0.02        # 2% of acquisition cost
    acquisition_cost: float = 0.0             # total acquisition cost
    gross_raise: float = 0.0                  # total capital raised
    refinancing_fee_rate: float = 0.025       # 2.5% of refinance amount
    refinance_amount: float = 0.0             # refinance loan amount
    turnover_fee_rate: float = 0.02           # 2% of FMV
    property_fmv_at_turnover: float = 0.0     # FMV at turnover
    lp_profit_share: float = 0.70             # 70% to LP
    gp_profit_share: float = 0.30             # 30% to GP
    # Variable cap rate curve: {"1": 0.06, "5": 0.055, "10": 0.05}
    cap_rate_curve: dict | None = None


@router.post("/properties/{property_id}/projection", response_model=_ProjectionResultOut)
def run_projection(
    property_id: int,
    payload: _ProjectionInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """
    Run a time-phased annual projection for a property.
    Returns year-by-year cash flows AND summary return metrics.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    from sqlalchemy.orm import joinedload as _jl

    # ── 1. Auto-populate baseline revenue from rent roll ──
    baseline_revenue = payload.baseline_annual_revenue or 0.0
    baseline_expenses = payload.baseline_annual_expenses or 0.0
    if baseline_revenue == 0:
        baseline_units = (
            db.query(Unit)
            .filter(Unit.property_id == property_id, Unit.development_plan_id.is_(None))
            .options(_jl(Unit.beds))
            .all()
        )
        if baseline_units:
            baseline_revenue = sum(
                float(b.monthly_rent or 0) * 12
                for u in baseline_units for b in u.beds
            )

    # ── 2. Auto-populate stabilized revenue from plan rent roll ──
    stab_revenue = payload.stabilized_annual_revenue or 0.0
    if stab_revenue == 0 and payload.planned_units and payload.monthly_rent_per_unit:
        stab_revenue = payload.planned_units * payload.monthly_rent_per_unit * 12
    if stab_revenue == 0:
        # Try to pull from active development plan units
        plan_units = (
            db.query(Unit)
            .filter(Unit.property_id == property_id, Unit.development_plan_id.isnot(None))
            .options(_jl(Unit.beds))
            .all()
        )
        if plan_units:
            stab_revenue = sum(
                float(b.monthly_rent or 0) * 12
                for u in plan_units for b in u.beds
            )
    if stab_revenue == 0:
        # Final fallback: use all units
        all_units = (
            db.query(Unit)
            .filter(Unit.property_id == property_id)
            .options(_jl(Unit.beds))
            .all()
        )
        if all_units:
            stab_revenue = sum(
                float(b.monthly_rent or 0) * 12
                for u in all_units for b in u.beds
            )

    # ── 3. Determine annual debt service ──
    ads = 0.0
    if payload.annual_debt_service is not None and payload.annual_debt_service > 0:
        ads = payload.annual_debt_service
    elif payload.debt_outstanding_balance > 0 and payload.debt_annual_rate > 0:
        engine = _MortgageEngine(
            outstanding_balance=payload.debt_outstanding_balance,
            annual_interest_rate=payload.debt_annual_rate / 100,
            amortization_months=payload.debt_amortization_months,
            io_period_months=payload.debt_io_months,
        )
        ads = engine.annual_debt_service(year=1)
    else:
        from app.services.calculations import calculate_annual_debt_service
        debts = (
            db.query(DebtFacility)
            .filter(DebtFacility.property_id == property_id, DebtFacility.status == "active")
            .all()
        )
        for d in debts:
            if d.outstanding_balance and d.interest_rate:
                ads += calculate_annual_debt_service(
                    float(d.outstanding_balance),
                    float(d.interest_rate),
                    d.amortization_months or 0,
                    d.io_period_months or 0,
                )

    # ── 4. Derive construction timeline ──
    construction_start_year = payload.construction_start_year
    if construction_start_year is None and payload.construction_start_date:
        try:
            from datetime import date as _date
            start_date = _date.fromisoformat(payload.construction_start_date)
            current_year = _date.today().year
            relative_year = max(1, start_date.year - current_year + 1)
            construction_start_year = relative_year
        except (ValueError, IndexError):
            construction_start_year = 1

    construction_duration_years = payload.construction_duration_years
    if construction_duration_years is None:
        construction_duration_years = max(1, round(payload.construction_months / 12))

    # ── 5. Resolve vacancy rate ──
    vacancy_rate = payload.vacancy_rate
    if vacancy_rate is None:
        if payload.vacancy_rate_stabilized is not None:
            vacancy_rate = payload.vacancy_rate_stabilized
        elif payload.stabilized_occupancy is not None:
            vacancy_rate = 1.0 - payload.stabilized_occupancy
        else:
            vacancy_rate = 0.05  # default 5%

    # ── 6. Resolve expense ratio ──
    expense_ratio = payload.annual_expense_ratio or 0.35
    if payload.stabilized_operating_expenses and stab_revenue > 0:
        expense_ratio = payload.stabilized_operating_expenses / stab_revenue

    # ── 7. Resolve rent escalation ──
    rent_increase = payload.annual_rent_increase
    if rent_increase is None:
        rent_increase = payload.revenue_growth_rate or 0.03

    # ── 8. Exit cap rate ──
    exit_cap = payload.exit_cap_rate or 0.055

    # ── 9. Auto-populate construction budget from plan ──
    construction_budget = payload.construction_budget
    if construction_budget == 0:
        active_plan = (
            db.query(DevelopmentPlan)
            .filter(DevelopmentPlan.property_id == property_id, DevelopmentPlan.status == "active")
            .first()
        )
        if active_plan and active_plan.estimated_construction_cost:
            construction_budget = float(active_plan.estimated_construction_cost)

    # ── 10. Build and run engine ──
    proj_engine = LifecycleProjectionEngine(
        baseline_annual_revenue=baseline_revenue,
        baseline_annual_expenses=baseline_expenses,
        stabilized_annual_revenue=stab_revenue,
        annual_expense_ratio=expense_ratio,
        annual_debt_service=ads,
        vacancy_rate=vacancy_rate,
        annual_rent_increase=rent_increase,
        expense_growth_rate=payload.expense_growth_rate,
        construction_start_year=construction_start_year,
        construction_duration_years=construction_duration_years,
        lease_up_months=payload.lease_up_months,
        carrying_cost_annual=payload.carrying_cost_annual,
        exit_cap_rate=exit_cap,
        disposition_cost_pct=payload.disposition_cost_pct,
        total_equity_invested=payload.total_equity_invested,
        debt_balance_at_exit=payload.debt_balance_at_exit,
        projection_years=payload.projection_years,
        # LP Fee parameters
        management_fee_rate=payload.management_fee_rate,
        construction_mgmt_fee_rate=payload.construction_mgmt_fee_rate,
        construction_budget=construction_budget,
        selling_commission_rate=payload.selling_commission_rate,
        offering_cost=payload.offering_cost,
        acquisition_fee_rate=payload.acquisition_fee_rate,
        acquisition_cost=payload.acquisition_cost,
        gross_raise=payload.gross_raise,
        refinancing_fee_rate=payload.refinancing_fee_rate,
        refinance_amount=payload.refinance_amount,
        turnover_fee_rate=payload.turnover_fee_rate,
        property_fmv_at_turnover=payload.property_fmv_at_turnover,
        lp_profit_share=payload.lp_profit_share,
        gp_profit_share=payload.gp_profit_share,
        cap_rate_curve=payload.cap_rate_curve,
    )

    projections = proj_engine.project()
    summary = proj_engine.compute_summary(projections)

    # Build fees summary output
    fees_out = None
    if summary.fees:
        fees_out = _FeesSummaryOut(
            total_management_fees=summary.fees.total_management_fees,
            total_construction_mgmt_fees=summary.fees.total_construction_mgmt_fees,
            selling_commission=summary.fees.selling_commission,
            offering_cost=summary.fees.offering_cost,
            acquisition_fee=summary.fees.acquisition_fee,
            refinancing_fee=summary.fees.refinancing_fee,
            turnover_replacement_fee=summary.fees.turnover_replacement_fee,
            total_upfront_fees=summary.fees.total_upfront_fees,
            total_ongoing_fees=summary.fees.total_ongoing_fees,
            total_all_fees=summary.fees.total_all_fees,
            net_deployable_capital=summary.fees.net_deployable_capital,
        )

    return _ProjectionResultOut(
        projections=[
            _YearProjectionOut(
                year=y.year, phase=y.phase, rentable_months=y.rentable_months,
                occupancy_rate=y.occupancy_rate,
                gross_potential_rent=y.gross_potential_rent,
                vacancy_loss=y.vacancy_loss,
                effective_gross_income=y.effective_gross_income,
                management_fee=y.management_fee,
                operating_expenses=y.operating_expenses,
                total_expenses=y.total_expenses,
                noi=y.noi,
                construction_mgmt_fee=y.construction_mgmt_fee,
                annual_debt_service=y.annual_debt_service,
                cash_flow=y.cash_flow,
                cumulative_cash_flow=y.cumulative_cash_flow,
                implied_cap_rate=y.implied_cap_rate,
                implied_value=y.implied_value,
            )
            for y in projections
        ],
        summary=_ProjectionSummaryOut(
            total_cash_flow=summary.total_cash_flow,
            exit_noi=summary.exit_noi,
            exit_cap_rate=summary.exit_cap_rate,
            terminal_value=summary.terminal_value,
            disposition_costs=summary.disposition_costs,
            net_exit_proceeds=summary.net_exit_proceeds,
            total_return=summary.total_return,
            total_equity_invested=summary.total_equity_invested,
            equity_multiple=summary.equity_multiple,
            irr_estimate=summary.irr_estimate,
            cash_on_cash_avg=summary.cash_on_cash_avg,
            annualized_roi=summary.annualized_roi,
            fees=fees_out,
            lp_share_of_profits=summary.lp_share_of_profits,
            gp_share_of_profits=summary.gp_share_of_profits,
        ),
    )


# ---------------------------------------------------------------------------
# Cost Estimation Engine
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Property Data Lookup (External Sources)
# ---------------------------------------------------------------------------

from pydantic import BaseModel as _BaseModel
from typing import Optional as _Opt


@router.get("/properties/{property_id}/investment-summary")
def get_investment_summary(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Unified investment summary — key returns metrics computed from all data sources.

    Pulls from: property, units/beds, rent roll, debt facilities, development plans,
    operating expenses, ancillary revenue. Returns a single snapshot for deal evaluation.
    """
    from decimal import Decimal as D
    from app.db.models import AncillaryRevenueStream

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # ── Gather all data ──
    all_units = db.query(Unit).filter(Unit.property_id == property_id).all()
    baseline_units = [u for u in all_units if u.development_plan_id is None]
    all_debt = db.query(DebtFacility).filter(DebtFacility.property_id == property_id).all()
    baseline_debt = [d for d in all_debt if d.development_plan_id is None]
    all_plans = db.query(DevelopmentPlan).filter(DevelopmentPlan.property_id == property_id).order_by(DevelopmentPlan.version).all()
    active_plan = next((p for p in all_plans if p.status and p.status.value == "active"), all_plans[0] if all_plans else None)

    # ── Baseline rent roll ──
    total_beds_baseline = sum(u.bed_count or 0 for u in baseline_units)
    baseline_monthly_rent = 0.0
    for u in baseline_units:
        for bed in u.beds:
            baseline_monthly_rent += float(bed.monthly_rent or 0)
    baseline_annual_gpr = baseline_monthly_rent * 12

    # Ancillary revenue (baseline)
    ancillary_streams = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.property_id == property_id,
        AncillaryRevenueStream.development_plan_id == None,
    ).all()
    annual_ancillary = sum(
        float(s.monthly_rate or 0) * (s.count or 1) * (float(s.utilization_pct or 100) / 100) * 12
        for s in ancillary_streams
    )

    # Operating expenses (baseline)
    try:
        from app.db.models import OperatingExpenseLineItem
        opex_items = db.query(OperatingExpenseLineItem).filter(
            OperatingExpenseLineItem.property_id == property_id,
            OperatingExpenseLineItem.development_plan_id == None,
        ).all()
        total_opex = 0.0
        for item in opex_items:
            base = float(item.base_amount or 0)
            method = item.calc_method.value if hasattr(item.calc_method, "value") else str(item.calc_method or "fixed")
            if method == "per_unit":
                total_opex += base * len(baseline_units)
            elif method == "pct_egi":
                total_opex += (baseline_annual_gpr + annual_ancillary) * (base / 100)
            else:
                total_opex += base
    except Exception:
        total_opex = 0.0

    # ── Computed metrics ──
    vacancy_rate = 5.0  # Default assumption
    egi = (baseline_annual_gpr + annual_ancillary) * (1 - vacancy_rate / 100)
    noi = egi - total_opex

    # Debt service
    total_debt_outstanding = sum(float(d.outstanding_balance or 0) for d in baseline_debt)
    total_debt_commitment = sum(float(d.commitment_amount or 0) for d in baseline_debt)
    annual_debt_service = 0.0
    for d in baseline_debt:
        if d.outstanding_balance and d.interest_rate:
            rate = float(d.interest_rate) / 100
            bal = float(d.outstanding_balance)
            if d.amortization_months and d.amortization_months > 0:
                # Canadian semi-annual compounding
                mr = rate / 12
                n = d.amortization_months
                if mr > 0:
                    pmt = bal * (mr * (1 + mr) ** n) / ((1 + mr) ** n - 1)
                else:
                    pmt = bal / n
                annual_debt_service += pmt * 12
            else:
                annual_debt_service += bal * rate

    cash_flow_after_debt = noi - annual_debt_service

    # Purchase/equity
    purchase_price = float(prop.purchase_price or 0)
    market_value = float(prop.current_market_value or prop.assessed_value or purchase_price or 0)
    total_equity = purchase_price - total_debt_outstanding if purchase_price > 0 else 0

    # Ratios
    dscr = round(noi / annual_debt_service, 2) if annual_debt_service > 0 else None
    ltv = round(total_debt_outstanding / market_value * 100, 1) if market_value > 0 else None
    cap_rate = round(noi / market_value * 100, 2) if market_value > 0 else None
    cash_on_cash = round(cash_flow_after_debt / total_equity * 100, 1) if total_equity > 0 else None
    debt_yield = round(noi / total_debt_outstanding * 100, 1) if total_debt_outstanding > 0 else None
    expense_ratio = round(total_opex / egi * 100, 1) if egi > 0 else None
    breakeven_occ = round((total_opex + annual_debt_service) / baseline_annual_gpr * 100, 1) if baseline_annual_gpr > 0 else None

    # Development metrics
    dev_total_cost = float(active_plan.estimated_construction_cost or 0) if active_plan else 0
    dev_planned_units = active_plan.planned_units if active_plan else 0
    dev_planned_beds = active_plan.planned_beds if active_plan else 0

    # Projected stabilized rent for development plan
    dev_units = [u for u in all_units if active_plan and u.development_plan_id == active_plan.plan_id] if active_plan else []
    dev_monthly_rent = 0.0
    dev_beds = 0
    for u in dev_units:
        for bed in u.beds:
            dev_monthly_rent += float(bed.monthly_rent or 0)
            dev_beds += 1
    dev_annual_gpr = dev_monthly_rent * 12
    projected_stabilized_noi = float(active_plan.projected_annual_noi or 0) if active_plan else 0

    # Yield on cost
    total_investment = purchase_price + dev_total_cost
    yield_on_cost = round(projected_stabilized_noi / total_investment * 100, 2) if total_investment > 0 and projected_stabilized_noi > 0 else None

    # LTC (loan to cost) for construction
    construction_debt = [d for d in all_debt if d.debt_type and d.debt_type.value == "construction_loan"]
    total_construction_debt = sum(float(d.commitment_amount or 0) for d in construction_debt)
    ltc = round(total_construction_debt / dev_total_cost * 100, 1) if dev_total_cost > 0 and total_construction_debt > 0 else None

    # Risk flags
    risk_flags = []
    if dscr and dscr < 1.2:
        risk_flags.append({"type": "covenant", "severity": "high", "message": f"DSCR is {dscr}x — below typical 1.2x covenant"})
    if ltv and ltv > 80:
        risk_flags.append({"type": "leverage", "severity": "medium", "message": f"LTV is {ltv}% — high leverage"})
    if breakeven_occ and breakeven_occ > 85:
        risk_flags.append({"type": "occupancy", "severity": "medium", "message": f"Break-even occupancy is {breakeven_occ}% — limited margin"})
    for d in all_debt:
        if d.maturity_date:
            import datetime
            days_to_maturity = (d.maturity_date - datetime.date.today()).days
            if 0 < days_to_maturity < 365:
                risk_flags.append({"type": "maturity", "severity": "high", "message": f"{d.lender_name} matures in {days_to_maturity} days ({d.maturity_date})"})
            elif days_to_maturity <= 0:
                risk_flags.append({"type": "maturity", "severity": "critical", "message": f"{d.lender_name} matured on {d.maturity_date} — needs refinancing"})
    if total_opex == 0 and len(baseline_units) > 0:
        risk_flags.append({"type": "data", "severity": "low", "message": "No operating expenses entered — NOI may be overstated"})

    return {
        # Property basics
        "property_id": property_id,
        "address": prop.address,
        "purchase_price": purchase_price,
        "market_value": market_value,
        "appreciation_pct": round((market_value - purchase_price) / purchase_price * 100, 1) if purchase_price > 0 else None,

        # Revenue
        "baseline_units": len(baseline_units),
        "baseline_beds": total_beds_baseline,
        "baseline_monthly_rent": round(baseline_monthly_rent, 2),
        "baseline_annual_gpr": round(baseline_annual_gpr, 2),
        "annual_ancillary": round(annual_ancillary, 2),
        "egi": round(egi, 2),

        # Expenses
        "total_opex": round(total_opex, 2),
        "expense_ratio": expense_ratio,

        # Returns
        "noi": round(noi, 2),
        "annual_debt_service": round(annual_debt_service, 2),
        "cash_flow_after_debt": round(cash_flow_after_debt, 2),

        # Ratios
        "dscr": dscr,
        "ltv": ltv,
        "cap_rate": cap_rate,
        "cash_on_cash": cash_on_cash,
        "debt_yield": debt_yield,
        "breakeven_occupancy": breakeven_occ,

        # Capital stack
        "total_debt_outstanding": round(total_debt_outstanding, 2),
        "total_equity": round(total_equity, 2),

        # Development
        "has_development_plan": active_plan is not None,
        "dev_total_cost": dev_total_cost,
        "dev_planned_units": dev_planned_units,
        "dev_planned_beds": dev_planned_beds,
        "dev_annual_gpr": round(dev_annual_gpr, 2),
        "projected_stabilized_noi": projected_stabilized_noi,
        "yield_on_cost": yield_on_cost,
        "total_investment": round(total_investment, 2),
        "ltc": ltc,

        # Risk
        "risk_flags": risk_flags,
        "risk_count": len(risk_flags),
    }


class PropertyLookupRequest(_BaseModel):
    address: str
    city: str = "Calgary"
    province: str = "Alberta"


@router.post("/lookup")
def lookup_property_data(
    payload: PropertyLookupRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Look up property data from external sources.

    Checks municipal open data (Calgary/Edmonton), MLS via Repliers API
    (if configured), and AI enrichment to auto-populate property fields.
    Returns all discovered data — the frontend decides what to apply.
    """
    from app.services.property_lookup import lookup_property
    from app.db.models import PlatformSetting

    # Check for Repliers API key in settings
    repliers_key = None
    repliers_setting = db.query(PlatformSetting).filter(
        PlatformSetting.key == "REPLIERS_API_KEY"
    ).first()
    if repliers_setting and repliers_setting.value:
        repliers_key = repliers_setting.value

    return lookup_property(
        address=payload.address,
        city=payload.city,
        province=payload.province,
        repliers_api_key=repliers_key,
    )


class ListingURLRequest(_BaseModel):
    url: str


@router.post("/extract-listing")
def extract_listing_data(
    payload: ListingURLRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Extract property data from a real estate listing URL (Realtor.ca, Zillow, etc.)
    using OpenAI web search to read the listing page and return structured data."""
    from app.db.models import PlatformSetting

    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured")

    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")

    client = _OpenAI(api_key=api_key)

    prompt = (
        f"Visit this real estate listing URL and extract all available property details:\n"
        f"URL: {payload.url}\n\n"
        f"Return ONLY a JSON object with these fields (use null for unavailable data):\n"
        f'{{"address": "full street address", "city": "city name", "province": "province/state code (e.g. AB, BC, ON)", '
        f'"postal_code": "postal code", '
        f'"list_price": number, "bedrooms": number, "bathrooms": number, "building_sqft": number, '
        f'"total_finished_area": number (total livable sqft including basement), '
        f'"lot_size": number (in sqft), "year_built": number, '
        f'"property_type": "string (e.g. Single Family, Condo, Duplex, Multiplex)", '
        f'"building_type": "string (e.g. House, Townhouse, Apartment)", '
        f'"property_style": "string (e.g. 2 Storey, Bungalow, Split Level)", '
        f'"storeys": number, '
        f'"garage": "string (e.g. Double Attached, Single Detached, None)", '
        f'"neighbourhood": "neighbourhood name", "zoning": "zoning code if available", '
        f'"mls_number": "MLS number if shown", "tax_amount": number (annual property tax), "tax_year": number, '
        f'"assessed_value": number (assessed/appraised value), '
        f'"title_type": "string (e.g. Freehold, Condominium)", '
        f'"foundation_type": "string (e.g. Poured Concrete, Block)", '
        f'"construction_material": "string (e.g. Wood frame, Concrete)", '
        f'"exterior_finish": "string (e.g. Vinyl siding, Stucco, Brick)", '
        f'"basement_type": "string (e.g. Full Finished, Full Unfinished, Crawl Space, None)", '
        f'"heating_type": "string (e.g. Forced air Natural gas, Boiler)", '
        f'"cooling_type": "string (e.g. Central air, Wall unit, None)", '
        f'"flooring_types": "string (e.g. Carpeted, Laminate, Hardwood)", '
        f'"parking_type": "string (e.g. Double Attached Garage, Parking Pad)", '
        f'"parking_spaces": number, '
        f'"frontage_m": number (lot frontage in metres), '
        f'"land_depth_m": number (lot depth in metres), '
        f'"appliances": "comma-separated list of included appliances", '
        f'"structures": "string (e.g. Shed, Deck, Fence)", '
        f'"has_fencing": boolean, '
        f'"walk_score": number (0-100 if available), '
        f'"transit_score": number (0-100 if available), '
        f'"latitude": number, "longitude": number, '
        f'"listing_description": "full property description from the listing", '
        f'"room_dimensions": [{{"level":"Main","room":"Living Room","width_ft":11.42,"length_ft":10.75}}], '
        f'"image_urls": ["array of any property photo URLs found"]}}\n\n'
        f"Extract as much data as possible from the listing page. "
        f"For Canadian properties, province should be the 2-letter code (AB, BC, ON, etc.). "
        f"Include any property photo/image URLs you can find from the listing. "
        f"For room_dimensions, extract every room with its level, name, and dimensions in feet."
    )

    import json, re

    try:
        # Step 1: Use web search to fetch listing data
        # Parse address hints from URL for better search results
        import urllib.parse
        url_path = urllib.parse.urlparse(payload.url).path
        url_parts = url_path.strip("/").split("/")
        address_hint = " ".join(url_parts[-1].replace("-", " ").split()) if url_parts else ""

        search_response = client.responses.create(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input=(
                f"Search for this property listing and extract ALL available details:\n"
                f"URL: {payload.url}\n"
                f"Address hint: {address_hint}\n\n"
                f"Search for this property on realtor.ca, zillow, redfin, Google, and any other "
                f"real estate or municipal data sources. Find: address, listing price, bedrooms, "
                f"bathrooms, square footage, lot size, year built, property type (Single Family, "
                f"Duplex, etc.), style (Bungalow, 2 Storey, etc.), garage type, neighbourhood, "
                f"zoning, MLS number, annual property taxes, assessed value, and a brief description. "
                f"Include as many specific details as possible."
            ),
        )
        listing_text = search_response.output_text.strip()

        # Step 2: Convert the extracted text to structured JSON
        json_prompt = (
            f"Convert the following real estate listing data into a JSON object.\n\n"
            f"Listing data:\n{listing_text}\n\n"
            f"Return ONLY a valid JSON object (no markdown, no explanation) with these fields "
            f"(use null for unavailable data):\n"
            f'{{"address": "street address only", "city": "city", "province": "2-letter code (AB, BC, ON)", '
            f'"list_price": number, "bedrooms": number, "bathrooms": number, "building_sqft": number, '
            f'"lot_size": number_sqft, "year_built": number, '
            f'"property_type": "Single Family/Condo/Duplex/Multiplex/etc", '
            f'"property_style": "2 Storey/Bungalow/Split Level/etc", '
            f'"garage": "Double Attached/Single Detached/None/etc", '
            f'"neighbourhood": "name", "zoning": "code", "mls_number": "number", '
            f'"tax_amount": number, "tax_year": number, "assessed_value": number, '
            f'"latitude": number, "longitude": number, '
            f'"description": "brief description"}}'
        )

        json_response = client.responses.create(
            model="gpt-4o",
            input=json_prompt,
        )
        text = json_response.output_text.strip()

        # Parse JSON (handle code fences)
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

        data = {}
        if text.startswith("{"):
            data = json.loads(text)
        else:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(text[start:end])

        return {
            "extracted": data,
            "source_url": payload.url,
            "raw_response": listing_text[:300] if not data else None,
        }
    except json.JSONDecodeError:
        return {
            "extracted": {},
            "source_url": payload.url,
            "raw_response": text[:500] if "text" in dir() else None,
            "error": "Failed to parse property data from listing",
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to extract listing data: {str(e)}")


@router.get("/properties/{property_id}/ai-assessment")
def get_property_assessment(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get the saved AI property assessment."""
    import json as _json
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    if not prop.ai_assessment:
        return None

    missing_fields = []
    if prop.ai_assessment_missing_fields:
        try:
            missing_fields = _json.loads(prop.ai_assessment_missing_fields)
        except Exception:
            pass

    return {
        "property_id": property_id,
        "community_type": prop.ai_assessment_community_type,
        "assessment": prop.ai_assessment,
        "data_available": prop.ai_assessment_data_available,
        "data_missing": prop.ai_assessment_data_missing,
        "missing_fields": missing_fields,
        "generated_at": prop.ai_assessment_updated_at.isoformat() if prop.ai_assessment_updated_at else None,
    }


@router.post("/properties/{property_id}/ai-assessment")
def generate_property_assessment(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Generate an AI preliminary property assessment based on all available data.

    Analyzes the property for suitability as sober living (RecoverWell),
    student housing (StudyWell), or retirement housing (RetireWell) based
    on the community type. Covers: property overview, suitability assessment,
    current structure usability, renovation opportunities, and development potential.
    """
    from app.db.models import PlatformSetting, Community

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Determine community type
    community_type = "general housing"
    community_name = ""
    if prop.community_id:
        community = db.query(Community).filter(Community.community_id == prop.community_id).first()
        if community:
            community_name = community.name or ""
    # Also check LP focus
    lp_focus = ""
    if prop.lp_id and prop.lp:
        lp_focus = prop.lp.community_focus or prop.lp.purpose_type or ""

    focus = (community_name + " " + lp_focus).lower()
    if "recover" in focus or "sober" in focus:
        community_type = "sober living (RecoverWell)"
        operator_role = "an expert operator of sober living and addiction recovery housing"
    elif "study" in focus or "student" in focus:
        community_type = "student housing (StudyWell)"
        operator_role = "an expert operator of student housing near universities and colleges"
    elif "retire" in focus or "senior" in focus:
        community_type = "retirement housing (RetireWell)"
        operator_role = "an expert operator of retirement and senior living communities"
    else:
        operator_role = "an expert real estate operator specializing in shared living communities"

    # Gather all property data
    import datetime
    data_points = {
        "Address": prop.address,
        "City": prop.city,
        "Province": prop.province,
        "Property Type": prop.property_type,
        "Property Style": prop.property_style,
        "Year Built": prop.year_built,
        "Building Sqft": float(prop.building_sqft) if prop.building_sqft else None,
        "Lot Size Sqft": float(prop.lot_size) if prop.lot_size else None,
        "Bedrooms": prop.bedrooms,
        "Bathrooms": prop.bathrooms,
        "Garage": prop.garage,
        "Zoning": prop.zoning,
        "Max Buildable Area": float(prop.max_buildable_area) if prop.max_buildable_area else None,
        "Floor Area Ratio": float(prop.floor_area_ratio) if prop.floor_area_ratio else None,
        "Neighbourhood": prop.neighbourhood,
        "List Price": float(prop.list_price) if prop.list_price else None,
        "Purchase Price": float(prop.purchase_price) if prop.purchase_price else None,
        "Assessed Value": float(prop.assessed_value) if prop.assessed_value else None,
        "Current Market Value": float(prop.current_market_value) if prop.current_market_value else None,
        "Tax Amount": float(prop.tax_amount) if prop.tax_amount else None,
        "Tax Year": prop.tax_year,
        "MLS Number": prop.mls_number,
        "Development Stage": prop.development_stage.value if prop.development_stage else None,
        "Community Type": community_type,
    }

    # Count available vs missing data
    available = {k: v for k, v in data_points.items() if v is not None}
    missing = [k for k, v in data_points.items() if v is None]

    data_summary = "\n".join([f"- {k}: {v}" for k, v in available.items()])
    missing_summary = ", ".join(missing) if missing else "None"

    # Get OpenAI key
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured")

    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")

    client = _OpenAI(api_key=api_key)

    prompt = (
        f"You are {operator_role}. Today's date is {datetime.date.today().isoformat()}.\n\n"
        f"Analyze this property for use as {community_type}. "
        f"Provide a preliminary assessment covering the following sections:\n\n"
        f"## 1. Property Overview\n"
        f"Brief summary of the property based on available data.\n\n"
        f"## 2. Suitability Assessment for {community_type.split('(')[0].strip()}\n"
        f"How well does this property suit the intended use? Consider layout, "
        f"location, size, bedroom count, accessibility, and neighbourhood.\n\n"
        f"## 3. Strengths & Advantages\n"
        f"What are the positive aspects of this property for this use?\n\n"
        f"## 4. Challenges & Concerns\n"
        f"What problems or obstacles exist? Zoning issues, structural limitations, "
        f"neighbourhood concerns, regulatory requirements.\n\n"
        f"## 5. Current Structure Usability\n"
        f"Can the property be used as-is or with minimal changes? What works "
        f"and what doesn't in the current layout?\n\n"
        f"## 6. Immediate Renovation Opportunities\n"
        f"What quick renovations would improve the property for this use? "
        f"Estimated impact and rough cost range.\n\n"
        f"## 7. Development Potential\n"
        f"Based on lot size, zoning, and buildable area, what development "
        f"opportunities exist? Could a larger building be built? Secondary suites? "
        f"Additions?\n\n"
        f"## 8. Data Completeness Note\n"
        f"Comment on the completeness of data available for this assessment.\n\n"
        f"Available Property Data:\n{data_summary}\n\n"
        f"Missing Data: {missing_summary}\n\n"
        f"Provide specific, actionable insights. Use numbers where possible. "
        f"If data is insufficient for a section, explicitly state what additional "
        f"information would be needed."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
        )
        assessment = response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(500, f"AI assessment failed: {str(e)}")

    # Store assessment in database
    import json as _json
    now = datetime.datetime.utcnow()
    prop.ai_assessment = assessment
    prop.ai_assessment_community_type = community_type
    prop.ai_assessment_data_available = len(available)
    prop.ai_assessment_data_missing = len(missing)
    prop.ai_assessment_missing_fields = _json.dumps(missing)
    prop.ai_assessment_updated_at = now
    db.commit()

    return {
        "property_id": property_id,
        "community_type": community_type,
        "assessment": assessment,
        "data_available": len(available),
        "data_missing": len(missing),
        "missing_fields": missing,
        "generated_at": now.isoformat(),
    }


@router.post("/modeling/estimate-costs", response_model=CostEstimateResult)
def estimate_construction_costs(
    payload: CostEstimateInput,
    _: User = Depends(require_gp_or_ops),
):
    months_to_start = 0
    if payload.target_start_date:
        today = datetime.date.today()
        if payload.target_start_date > today:
            rd = relativedelta(payload.target_start_date, today)
            months_to_start = rd.years * 12 + rd.months

    result = CostEstimator.calculate_total_costs(
        planned_sqft=payload.planned_sqft,
        building_type=payload.building_type,
        include_commercial_kitchen=payload.include_commercial_kitchen,
        soft_cost_percent=payload.soft_cost_percent,
        site_cost_flat=payload.site_cost_flat,
        financing_cost_percent=payload.financing_cost_percent,
        contingency_percent=payload.contingency_percent,
        escalation_percent_per_year=payload.escalation_percent_per_year,
        months_to_start=months_to_start,
    )

    return result



# ---------------------------------------------------------------------------
# Include split sub-routers (valuation, construction, pro forma)
# ---------------------------------------------------------------------------
from app.routes.portfolio_valuation import router as valuation_router
from app.routes.portfolio_construction import router as construction_router
from app.routes.portfolio_proforma import router as proforma_router
from app.routes.portfolio_ancillary_revenue import router as ancillary_revenue_router
from app.routes.portfolio_operating_expenses import router as operating_expenses_router
from app.routes.portfolio_underwriting import router as underwriting_router
from app.routes.portfolio_lifecycle import router as lifecycle_router
from app.routes.portfolio_setup import router as setup_router
from app.routes.portfolio_lending import router as lending_router
from app.routes.portfolio_ai_budget import router as ai_budget_router
from app.routes.portfolio_import import router as import_router
from app.routes.portfolio_performance import router as performance_router
from app.routes.portfolio_phase_cashflow import router as phase_cashflow_router
from app.routes.portfolio_budget_import import router as budget_import_router
from app.routes.valuation_reports import router as valuation_reports_router

router.include_router(valuation_router)
router.include_router(construction_router)
router.include_router(proforma_router)
router.include_router(ancillary_revenue_router)
router.include_router(operating_expenses_router)
router.include_router(underwriting_router)
router.include_router(lifecycle_router)
router.include_router(setup_router)
router.include_router(lending_router)
router.include_router(ai_budget_router)
router.include_router(import_router)
router.include_router(performance_router)
router.include_router(phase_cashflow_router)
router.include_router(budget_import_router)
router.include_router(valuation_reports_router)

# ===========================================================================
# PROPERTY UNITS & BEDS
# ===========================================================================

from app.schemas.community import (
    UnitCreate, UnitUpdate, UnitOut, UnitWithBedsOut,
    BedCreate, BedOut,
)
from app.db.models import BedStatus


@router.get(
    "/properties/{property_id}/units",
)
def list_property_units(
    property_id: int,
    plan_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List units (with nested beds) for a property, optionally filtered by plan_id.

    plan_id=None (omitted): returns ALL units
    plan_id=0 or plan_id=null: returns baseline units (development_plan_id IS NULL)
    plan_id=N: returns units for that specific plan
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    from fastapi.encoders import jsonable_encoder
    from sqlalchemy.orm import joinedload as _jl

    query = db.query(Unit).filter(Unit.property_id == property_id).options(_jl(Unit.beds))

    if plan_id is not None:
        if plan_id == 0:
            query = query.filter(Unit.development_plan_id.is_(None))
        else:
            query = query.filter(Unit.development_plan_id == plan_id)

    units = query.all()

    # Return with nested beds
    result = []
    for u in units:
        unit_dict = {
            "unit_id": u.unit_id,
            "property_id": u.property_id,
            "unit_number": u.unit_number,
            "unit_type": u.unit_type.value if hasattr(u.unit_type, 'value') else u.unit_type,
            "bed_count": u.bed_count,
            "bedroom_count": u.bedroom_count,
            "sqft": str(u.sqft) if u.sqft else "0",
            "floor": u.floor,
            "is_legal_suite": u.is_legal_suite,
            "is_occupied": u.is_occupied,
            "monthly_rent": str(u.monthly_rent) if u.monthly_rent else None,
            "renovation_phase": u.renovation_phase.value if u.renovation_phase and hasattr(u.renovation_phase, 'value') else u.renovation_phase,
            "development_plan_id": u.development_plan_id,
            "notes": u.notes,
            "beds": [
                {
                    "bed_id": b.bed_id,
                    "unit_id": b.unit_id,
                    "bed_label": b.bed_label,
                    "monthly_rent": str(b.monthly_rent) if b.monthly_rent else "0",
                    "rent_type": b.rent_type.value if hasattr(b.rent_type, 'value') else (b.rent_type or "private_pay"),
                    "status": b.status.value if hasattr(b.status, 'value') else (b.status or "available"),
                    "bedroom_number": b.bedroom_number,
                    "is_post_renovation": b.is_post_renovation,
                }
                for b in (u.beds or [])
            ],
        }
        result.append(unit_dict)

    return result


@router.post(
    "/properties/{property_id}/units",
    response_model=UnitOut,
    status_code=status.HTTP_201_CREATED,
)
def create_property_unit(
    property_id: int,
    payload: UnitCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """Add a unit to a property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")
    data = payload.model_dump()
    # If community_id not provided, inherit from property
    if data.get("community_id") is None and prop.community_id:
        data["community_id"] = prop.community_id
    unit = Unit(property_id=property_id, **data)
    db.add(unit)
    try:
        db.commit()
        db.refresh(unit)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    # Auto-create beds based on bed_count
    for b in range(1, unit.bed_count + 1):
        bed = Bed(
            unit_id=unit.unit_id,
            bed_label=f"{unit.unit_number}-B{b}",
            monthly_rent=0,  # to be set later
            rent_type="private_pay",
            status=BedStatus.available,
        )
        db.add(bed)
    try:
        db.commit()
        db.refresh(unit)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return unit


@router.post("/properties/{property_id}/initialize-units")
def initialize_units_from_lookup(
    property_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """Create baseline unit structure from property lookup data.

    Accepts: { bedrooms: 3, bathrooms: 2, building_sqft: 1200, estimated_monthly_rent: 2800 }
    Creates a single baseline unit with beds matching the bedroom count.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Check if units already exist
    existing = db.query(Unit).filter(Unit.property_id == property_id).count()
    if existing > 0:
        raise HTTPException(400, f"Property already has {existing} units. Delete them first or add manually.")

    bedrooms = payload.get("bedrooms") or 3
    bathrooms = payload.get("bathrooms") or 1
    building_sqft = payload.get("building_sqft") or 0
    estimated_rent = payload.get("estimated_monthly_rent") or 0
    rent_per_bed = estimated_rent / bedrooms if bedrooms > 0 and estimated_rent > 0 else 800

    # For whole-property baseline, use 'house' type
    unit_type = "house"

    # Create a single baseline unit representing the existing house
    unit = Unit(
        property_id=property_id,
        community_id=prop.community_id,
        unit_number="Main",
        unit_type=unit_type,
        bed_count=bedrooms,
        bedroom_count=bedrooms,
        sqft=building_sqft,
        floor="Main",
        is_occupied=False,
        is_legal_suite=False,
        renovation_phase="pre_renovation",
    )
    db.add(unit)
    db.flush()

    # Create beds
    beds_created = []
    for b in range(1, bedrooms + 1):
        bed = Bed(
            unit_id=unit.unit_id,
            bed_label=f"Main-B{b}",
            bedroom_number=b,
            monthly_rent=round(rent_per_bed, 2),
            rent_type="private_pay",
            status=BedStatus.available,
        )
        db.add(bed)
        beds_created.append(bed)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(500, "Failed to initialize units")

    return {
        "property_id": property_id,
        "units_created": 1,
        "beds_created": len(beds_created),
        "unit_number": "Main",
        "bedrooms": bedrooms,
        "rent_per_bed": round(rent_per_bed, 2),
        "total_monthly_rent": round(rent_per_bed * bedrooms, 2),
    }


@router.patch(
    "/properties/{property_id}/units/{unit_id}",
    response_model=UnitOut,
)
def update_property_unit(
    property_id: int,
    unit_id: int,
    payload: UnitUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """Update a unit on a property."""
    unit = db.query(Unit).filter(
        Unit.unit_id == unit_id,
        Unit.property_id == property_id,
    ).first()
    if not unit:
        raise HTTPException(404, "Unit not found for this property")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(unit, k, v)
    try:
        db.commit()
        db.refresh(unit)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return unit


@router.delete(
    "/properties/{property_id}/units/{unit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_property_unit(
    property_id: int,
    unit_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Delete a unit and its beds from a property."""
    unit = db.query(Unit).filter(
        Unit.unit_id == unit_id,
        Unit.property_id == property_id,
    ).first()
    if not unit:
        raise HTTPException(404, "Unit not found for this property")
    db.delete(unit)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/properties/{property_id}/units/{unit_id}/beds",
    response_model=list[BedOut],
)
def list_unit_beds(
    property_id: int,
    unit_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List beds within a unit."""
    unit = db.query(Unit).filter(
        Unit.unit_id == unit_id,
        Unit.property_id == property_id,
    ).first()
    if not unit:
        raise HTTPException(404, "Unit not found for this property")
    return unit.beds


@router.post(
    "/properties/{property_id}/units/{unit_id}/beds",
    response_model=BedOut,
    status_code=status.HTTP_201_CREATED,
)
def create_bed(
    property_id: int,
    unit_id: int,
    payload: BedCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """Add a bed to a unit."""
    unit = db.query(Unit).filter(
        Unit.unit_id == unit_id,
        Unit.property_id == property_id,
    ).first()
    if not unit:
        raise HTTPException(404, "Unit not found for this property")
    bed = Bed(
        unit_id=unit_id,
        bed_label=payload.bed_label,
        monthly_rent=payload.monthly_rent,
        rent_type=payload.rent_type,
        bedroom_number=payload.bedroom_number,
        is_post_renovation=payload.is_post_renovation,
    )
    db.add(bed)
    try:
        db.commit()
        db.refresh(bed)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    # Update unit bed_count to reflect actual count
    actual_count = db.query(Bed).filter(Bed.unit_id == unit_id).count()
    unit.bed_count = actual_count
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return bed


@router.patch(
    "/beds/{bed_id}",
    response_model=BedOut,
)
def update_bed(
    bed_id: int,
    monthly_rent: float | None = None,
    new_status: BedStatus | None = None,
    rent_type: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """Update a bed's rent, status, or rent type."""
    bed = db.query(Bed).filter(Bed.bed_id == bed_id).first()
    if not bed:
        raise HTTPException(404, "Bed not found")
    if monthly_rent is not None:
        bed.monthly_rent = monthly_rent
    if new_status is not None:
        bed.status = new_status
    if rent_type is not None:
        bed.rent_type = rent_type
    try:
        db.commit()
        db.refresh(bed)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return bed


@router.delete(
    "/beds/{bed_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_bed(
    bed_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """Delete a bed from a unit. Also decrements the parent unit's bed_count."""
    bed = db.query(Bed).filter(Bed.bed_id == bed_id).first()
    if not bed:
        raise HTTPException(404, "Bed not found")
    unit_id = bed.unit_id
    unit = db.query(Unit).filter(Unit.unit_id == unit_id).first()
    db.delete(bed)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    # Update unit bed_count to reflect actual count
    if unit:
        actual_count = db.query(Bed).filter(Bed.unit_id == unit_id).count()
        unit.bed_count = actual_count
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
        except Exception:
            db.rollback()
            raise HTTPException(status_code=500, detail="Internal server error")


def _compute_unit_phase_summary(unit_list):
    """Compute summary stats for a list of units (shared helper)."""
    total_units = len(unit_list)
    total_beds = sum(u.bed_count for u in unit_list)
    total_sqft = float(sum(u.sqft for u in unit_list))
    legal_suites = sum(1 for u in unit_list if u.is_legal_suite)

    all_beds = []
    for u in unit_list:
        all_beds.extend(u.beds)

    occupied_beds = sum(1 for b in all_beds if b.status == BedStatus.occupied)
    available_beds = sum(1 for b in all_beds if b.status == BedStatus.available)
    maintenance_beds = sum(1 for b in all_beds if b.status == BedStatus.maintenance)
    potential_monthly_rent = float(sum(b.monthly_rent for b in all_beds))
    actual_monthly_rent = float(
        sum(b.monthly_rent for b in all_beds if b.status == BedStatus.occupied)
    )
    vacancy_rate = (
        round((1 - occupied_beds / len(all_beds)) * 100, 1)
        if all_beds else 0
    )

    unit_mix = {}
    for u in unit_list:
        key = u.unit_type.value if hasattr(u.unit_type, 'value') else str(u.unit_type)
        if key not in unit_mix:
            unit_mix[key] = {"count": 0, "beds": 0, "sqft": 0}
        unit_mix[key]["count"] += 1
        unit_mix[key]["beds"] += u.bed_count
        unit_mix[key]["sqft"] += float(u.sqft)

    floor_breakdown = {}
    for u in unit_list:
        floor = u.floor or "Unspecified"
        if floor not in floor_breakdown:
            floor_breakdown[floor] = {"units": 0, "beds": 0}
        floor_breakdown[floor]["units"] += 1
        floor_breakdown[floor]["beds"] += u.bed_count

    return {
        "total_units": total_units,
        "total_beds": total_beds,
        "total_sqft": total_sqft,
        "legal_suites": legal_suites,
        "occupied_beds": occupied_beds,
        "available_beds": available_beds,
        "maintenance_beds": maintenance_beds,
        "vacancy_rate": vacancy_rate,
        "potential_monthly_rent": potential_monthly_rent,
        "actual_monthly_rent": actual_monthly_rent,
        "unit_mix": unit_mix,
        "floor_breakdown": floor_breakdown,
    }


@router.get(
    "/properties/{property_id}/unit-summary",
)
def get_property_unit_summary(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Phased summary of units and beds for a property.
    Returns separate stats for baseline (current operations) and
    redevelopment (planned) units, plus combined totals.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    all_units = prop.units
    baseline_units = [u for u in all_units if u.development_plan_id is None]
    redev_units = [u for u in all_units if u.development_plan_id is not None]

    # Build redevelopment groups keyed by plan
    redev_by_plan = {}
    for u in redev_units:
        pid = u.development_plan_id
        if pid not in redev_by_plan:
            redev_by_plan[pid] = []
        redev_by_plan[pid].append(u)

    redev_phases = []
    for plan_id, plan_units in redev_by_plan.items():
        plan = db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == plan_id).first()
        phase_summary = _compute_unit_phase_summary(plan_units)
        phase_summary["plan_id"] = plan_id
        phase_summary["plan_name"] = plan.plan_name if plan else f"Plan {plan_id}"
        phase_summary["plan_status"] = plan.status.value if plan and hasattr(plan.status, 'value') else (plan.status if plan else "unknown")
        phase_summary["start_date"] = str(plan.development_start_date) if plan and plan.development_start_date else None
        phase_summary["completion_date"] = str(plan.estimated_completion_date) if plan and plan.estimated_completion_date else None
        redev_phases.append(phase_summary)

    baseline_summary = _compute_unit_phase_summary(baseline_units)
    combined_summary = _compute_unit_phase_summary(all_units)

    # ── Net Impact of Redevelopment ──
    # Baseline units will be REPLACED by redevelopment units, not added.
    # Compute the delta and valuation impact.
    net_impact = None
    if redev_phases:
        # Aggregate all redevelopment phases
        redev_total_units = sum(p["total_units"] for p in redev_phases)
        redev_total_beds = sum(p["total_beds"] for p in redev_phases)
        redev_total_sqft = sum(p["total_sqft"] for p in redev_phases)
        redev_monthly_rent = sum(p["potential_monthly_rent"] for p in redev_phases)

        bl_units = baseline_summary["total_units"]
        bl_beds = baseline_summary["total_beds"]
        bl_sqft = baseline_summary["total_sqft"]
        bl_monthly_rent = baseline_summary["potential_monthly_rent"]

        delta_units = redev_total_units - bl_units
        delta_beds = redev_total_beds - bl_beds
        delta_sqft = redev_total_sqft - bl_sqft
        delta_monthly_rent = redev_monthly_rent - bl_monthly_rent
        delta_annual_rent = delta_monthly_rent * 12

        # Baseline annual revenue from bed rents
        bl_annual_revenue = bl_monthly_rent * 12
        redev_annual_revenue = redev_monthly_rent * 12

        # Use dev plan's projected_annual_noi if available, else estimate with 30% expense ratio
        first_plan = db.query(DevelopmentPlan).filter(
            DevelopmentPlan.plan_id == redev_phases[0]["plan_id"]
        ).first()
        redev_annual_noi = float(first_plan.projected_annual_noi) if first_plan and first_plan.projected_annual_noi else redev_annual_revenue * 0.70
        construction_cost = float(first_plan.estimated_construction_cost) if first_plan and first_plan.estimated_construction_cost else 0

        # Baseline NOI estimate: use property annual_revenue/expenses if available, else 30% expense ratio
        if prop.annual_revenue and prop.annual_expenses:
            bl_annual_noi = float(prop.annual_revenue) - float(prop.annual_expenses)
        else:
            bl_annual_noi = bl_annual_revenue * 0.70  # assume 30% expense ratio

        delta_annual_noi = redev_annual_noi - bl_annual_noi

        # Valuation scenarios using cap rates
        cap_rates = [0.05, 0.06, 0.07]  # 5%, 6%, 7%
        valuation_scenarios = []
        for cr in cap_rates:
            bl_val = bl_annual_noi / cr if cr > 0 else 0
            redev_val = redev_annual_noi / cr if cr > 0 else 0
            delta_val = redev_val - bl_val
            valuation_scenarios.append({
                "cap_rate": round(cr * 100, 1),
                "baseline_value": round(bl_val),
                "post_redev_value": round(redev_val),
                "value_increase": round(delta_val),
                "value_increase_pct": round((delta_val / bl_val * 100) if bl_val > 0 else 0, 1),
            })

        net_impact = {
            "delta_units": delta_units,
            "delta_beds": delta_beds,
            "delta_sqft": delta_sqft,
            "delta_monthly_rent": delta_monthly_rent,
            "delta_annual_rent": delta_annual_rent,
            "baseline_annual_revenue": bl_annual_revenue,
            "redev_annual_revenue": redev_annual_revenue,
            "baseline_annual_noi": round(bl_annual_noi),
            "redev_annual_noi": round(redev_annual_noi),
            "delta_annual_noi": round(delta_annual_noi),
            "construction_cost": round(construction_cost),
            "valuation_scenarios": valuation_scenarios,
            "post_redev_units": redev_total_units,
            "post_redev_beds": redev_total_beds,
            "post_redev_sqft": redev_total_sqft,
            "post_redev_monthly_rent": redev_monthly_rent,
        }

    return {
        "property_id": property_id,
        # Combined totals (backward-compatible)
        **combined_summary,
        # Phased breakdowns
        "baseline": baseline_summary,
        "redevelopment_phases": redev_phases,
        "has_redevelopment": len(redev_units) > 0,
        "net_impact": net_impact,
    }


# ---------------------------------------------------------------------------
# Rent Roll Summary
# ---------------------------------------------------------------------------

def _calc_phase_summary(units_list, pricing_mode, is_projection=False):
    """Helper: calculate rent roll summary for a list of units.
    When is_projection=True, treat all beds as occupied (stabilized projection)."""
    rent_roll_units = []
    total_potential_monthly = 0.0
    total_actual_monthly = 0.0
    total_beds = 0
    occupied_beds = 0
    vacant_beds = 0

    for u in units_list:
        unit_data = {
            "unit_id": u.unit_id,
            "unit_number": u.unit_number,
            "unit_type": u.unit_type.value if hasattr(u.unit_type, 'value') else str(u.unit_type),
            "bed_count": u.bed_count,
            "bedroom_count": u.bedroom_count,
            "sqft": float(u.sqft),
            "floor": u.floor,
            "is_legal_suite": u.is_legal_suite,
            "is_occupied": u.is_occupied,
            "renovation_phase": u.renovation_phase.value if hasattr(u.renovation_phase, 'value') else str(u.renovation_phase),
            "monthly_rent": float(u.monthly_rent) if u.monthly_rent else None,
            "beds": [],
            "bedrooms": {},
            "unit_potential_monthly": 0.0,
            "unit_actual_monthly": 0.0,
            "unit_vacancy_count": 0,
        }

        for bed in u.beds:
            bed_data = {
                "bed_id": bed.bed_id,
                "bed_label": bed.bed_label,
                "monthly_rent": float(bed.monthly_rent),
                "rent_type": bed.rent_type.value if hasattr(bed.rent_type, 'value') else str(bed.rent_type),
                "status": bed.status.value if hasattr(bed.status, 'value') else str(bed.status),
                "bedroom_number": bed.bedroom_number,
                "is_post_renovation": bed.is_post_renovation,
            }
            unit_data["beds"].append(bed_data)

            br_num = bed.bedroom_number or 0
            if br_num not in unit_data["bedrooms"]:
                unit_data["bedrooms"][br_num] = {
                    "bedroom_number": br_num,
                    "beds": [],
                    "total_rent": 0.0,
                }
            unit_data["bedrooms"][br_num]["beds"].append(bed_data)
            unit_data["bedrooms"][br_num]["total_rent"] += float(bed.monthly_rent)

            total_beds += 1
            unit_data["unit_potential_monthly"] += float(bed.monthly_rent)
            bed_status = bed.status.value if hasattr(bed.status, 'value') else bed.status
            if is_projection or bed_status == "occupied":
                unit_data["unit_actual_monthly"] += float(bed.monthly_rent)
                occupied_beds += 1
            else:
                unit_data["unit_vacancy_count"] += 1
                if bed_status in ("available", "reserved"):
                    vacant_beds += 1

        unit_data["bedrooms"] = list(unit_data["bedrooms"].values())

        if pricing_mode == "by_unit" and u.monthly_rent:
            unit_data["unit_potential_monthly"] = float(u.monthly_rent)
            if u.is_occupied:
                unit_data["unit_actual_monthly"] = float(u.monthly_rent)
            else:
                unit_data["unit_actual_monthly"] = 0.0

        total_potential_monthly += unit_data["unit_potential_monthly"]
        total_actual_monthly += unit_data["unit_actual_monthly"]
        rent_roll_units.append(unit_data)

    vacancy_rate = round((1 - occupied_beds / total_beds) * 100, 1) if total_beds > 0 else 0.0
    vacancy_loss_monthly = total_potential_monthly - total_actual_monthly

    return {
        "total_units": len(units_list),
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "vacant_beds": vacant_beds,
        "vacancy_rate": vacancy_rate,
        "potential_monthly_rent": round(total_potential_monthly, 2),
        "actual_monthly_rent": round(total_actual_monthly, 2),
        "vacancy_loss_monthly": round(vacancy_loss_monthly, 2),
        "potential_annual_rent": round(total_potential_monthly * 12, 2),
        "actual_annual_rent": round(total_actual_monthly * 12, 2),
        "vacancy_loss_annual": round(vacancy_loss_monthly * 12, 2),
        "units": rent_roll_units,
    }


@router.get("/properties/{property_id}/rent-roll")
def get_rent_roll(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Comprehensive rent roll for a property.
    Groups units by development_plan_id:
      - NULL = Baseline (as-acquired, operate as-is)
      - plan_id = X = Projected state after Development Plan X
    Each phase gets its own independent rent roll summary, debt summary,
    and rent escalation projection.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    from app.db.models import RentPricingMode, DevelopmentPlan as DP

    baseline_pricing_mode = prop.rent_pricing_mode or "by_bed"
    baseline_annual_increase = float(prop.annual_rent_increase_pct or 0)

    all_units = db.query(Unit).filter(Unit.property_id == property_id).all()
    all_debt = db.query(DebtFacility).filter(DebtFacility.property_id == property_id).all()
    all_plans = db.query(DP).filter(DP.property_id == property_id).order_by(DP.version).all()

    # Group units and debt by development_plan_id
    baseline_units = [u for u in all_units if u.development_plan_id is None]
    baseline_debt = [d for d in all_debt if d.development_plan_id is None]

    baseline_summary = _calc_phase_summary(baseline_units, baseline_pricing_mode)

    # Calculate baseline debt service
    baseline_annual_debt_service = 0.0
    for d in baseline_debt:
        if d.outstanding_balance and d.outstanding_balance > 0 and d.interest_rate:
            rate = float(d.interest_rate) / 100
            balance = float(d.outstanding_balance)
            if d.amortization_months and d.amortization_months > 0:
                mr = rate / 12
                n = d.amortization_months
                if mr > 0:
                    pmt = balance * (mr * (1 + mr) ** n) / ((1 + mr) ** n - 1)
                else:
                    pmt = balance / n
                baseline_annual_debt_service += pmt * 12
            else:
                baseline_annual_debt_service += balance * rate

    def _build_projection(summary, increase_pct, years=10):
        if not summary or summary["total_units"] == 0:
            return None
        rows = []
        for yr in range(years + 1):
            factor = (1 + increase_pct / 100) ** yr
            gross = round(summary["potential_annual_rent"] * factor, 2)
            effective = round(summary["actual_annual_rent"] * factor, 2)
            rows.append({
                "year": yr,
                "gross_annual": gross,
                "effective_annual": effective,
                "monthly": round(gross / 12, 2),
            })
        return rows

    # Calculate baseline projection years (until first plan starts or exit)
    from datetime import date as _date_type
    purchase_date = prop.purchase_date or _date_type.today()
    sorted_all_plans = sorted(all_plans, key=lambda p: p.development_start_date or _date_type(9999, 1, 1))
    first_plan_start = sorted_all_plans[0].development_start_date if sorted_all_plans and sorted_all_plans[0].development_start_date else None
    baseline_years = 10
    if first_plan_start:
        baseline_years = max(1, (first_plan_start - purchase_date).days // 365)

    baseline_projection = _build_projection(baseline_summary, baseline_annual_increase, baseline_years)

    # Build plan phases
    plan_phases = []
    prev_summary = baseline_summary
    for plan in all_plans:
        plan_units = [u for u in all_units if u.development_plan_id == plan.plan_id]
        plan_debt = [d for d in all_debt if d.development_plan_id == plan.plan_id]
        plan_pricing = plan.rent_pricing_mode.value if plan.rent_pricing_mode and hasattr(plan.rent_pricing_mode, 'value') else (plan.rent_pricing_mode or baseline_pricing_mode)
        plan_increase = float(plan.annual_rent_increase_pct or baseline_annual_increase)

        plan_summary = _calc_phase_summary(plan_units, plan_pricing, is_projection=True) if plan_units else None

        # Plan debt service
        plan_annual_debt_service = 0.0
        for d in plan_debt:
            if d.outstanding_balance and d.outstanding_balance > 0 and d.interest_rate:
                rate = float(d.interest_rate) / 100
                balance = float(d.outstanding_balance)
                if d.amortization_months and d.amortization_months > 0:
                    mr = rate / 12
                    n = d.amortization_months
                    if mr > 0:
                        pmt = balance * (mr * (1 + mr) ** n) / ((1 + mr) ** n - 1)
                    else:
                        pmt = balance / n
                    plan_annual_debt_service += pmt * 12
                else:
                    plan_annual_debt_service += balance * rate

        # Comparison vs previous phase
        comparison = None
        if plan_summary and prev_summary and prev_summary["total_units"] > 0:
            pre_pot = prev_summary["potential_monthly_rent"]
            post_pot = plan_summary["potential_monthly_rent"]
            delta_monthly = post_pot - pre_pot
            pct_change = round((delta_monthly / pre_pot) * 100, 1) if pre_pot > 0 else 0.0
            comparison = {
                "prev_monthly": pre_pot,
                "plan_monthly": post_pot,
                "delta_monthly": round(delta_monthly, 2),
                "delta_annual": round(delta_monthly * 12, 2),
                "pct_change": pct_change,
                "prev_units": prev_summary["total_units"],
                "plan_units": plan_summary["total_units"] if plan_summary else 0,
                "prev_beds": prev_summary["total_beds"],
                "plan_beds": plan_summary["total_beds"] if plan_summary else 0,
            }

        # Calculate projection years for this plan (until next plan starts or exit)
        plan_stab = plan.estimated_stabilization_date or plan.estimated_completion_date
        plan_proj_years = 10
        plan_idx = next((i for i, p in enumerate(sorted_all_plans) if p.plan_id == plan.plan_id), -1)
        if plan_idx >= 0 and plan_idx < len(sorted_all_plans) - 1:
            next_plan = sorted_all_plans[plan_idx + 1]
            if next_plan.development_start_date and plan_stab:
                plan_proj_years = max(1, (next_plan.development_start_date - plan_stab).days // 365)
        elif plan_stab:
            # Last plan — project until exit
            from app.db.models import AcquisitionBaseline as _AcqBL
            acq_bl = db.query(_AcqBL).filter(_AcqBL.property_id == property_id).first()
            hold_years = int(acq_bl.target_hold_years) if acq_bl and acq_bl.target_hold_years else 7
            exit_date = _date_type(purchase_date.year + hold_years, purchase_date.month, purchase_date.day)
            plan_proj_years = max(1, (exit_date - plan_stab).days // 365)

        plan_projection = _build_projection(plan_summary, plan_increase, plan_proj_years) if plan_summary else None

        plan_phases.append({
            "plan_id": plan.plan_id,
            "plan_version": plan.version,
            "plan_status": plan.status.value if hasattr(plan.status, 'value') else str(plan.status),
            "plan_label": plan.plan_name or f"Plan v{plan.version}",
            "pricing_mode": plan_pricing,
            "annual_rent_increase_pct": plan_increase,
            "development_start_date": plan.development_start_date.isoformat() if plan.development_start_date else None,
            "estimated_completion_date": plan.estimated_completion_date.isoformat() if plan.estimated_completion_date else None,
            "estimated_stabilization_date": plan.estimated_stabilization_date.isoformat() if plan.estimated_stabilization_date else None,
            "construction_duration_days": plan.construction_duration_days,
            "rent_roll": plan_summary,
            "debt_count": len(plan_debt),
            "annual_debt_service": round(plan_annual_debt_service, 2),
            "comparison_vs_previous": comparison,
            "escalation_projection": plan_projection,
        })

        if plan_summary:
            prev_summary = plan_summary

    return {
        "property_id": property_id,
        "baseline": {
            "pricing_mode": baseline_pricing_mode,
            "annual_rent_increase_pct": baseline_annual_increase,
            "rent_roll": baseline_summary,
            "debt_count": len(baseline_debt),
            "annual_debt_service": round(baseline_annual_debt_service, 2),
            "escalation_projection": baseline_projection,
        },
        "plan_phases": plan_phases,
        "total_plans": len(plan_phases),
    }


@router.patch("/properties/{property_id}/rent-pricing-mode")
def update_rent_pricing_mode(
    property_id: int,
    mode: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Update the rent pricing mode for a property."""
    from app.db.models import RentPricingMode
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")
    if mode not in [m.value for m in RentPricingMode]:
        raise HTTPException(400, f"Invalid pricing mode: {mode}")
    prop.rent_pricing_mode = mode
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return {"property_id": property_id, "rent_pricing_mode": mode}


@router.post("/properties/{property_id}/units/bulk-beds")
def bulk_create_beds(
    property_id: int,
    unit_id: int,
    beds: list[dict],
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """Bulk create beds for a unit (used when setting up bedroom/bed rents)."""
    unit = db.query(Unit).filter(
        Unit.unit_id == unit_id,
        Unit.property_id == property_id,
    ).first()
    if not unit:
        raise HTTPException(404, "Unit not found for this property")

    created = []
    for bed_data in beds:
        bed = Bed(
            unit_id=unit_id,
            bed_label=bed_data.get("bed_label", f"Bed {len(created) + 1}"),
            monthly_rent=bed_data.get("monthly_rent", 0),
            rent_type=bed_data.get("rent_type", "private_pay"),
            bedroom_number=bed_data.get("bedroom_number"),
            is_post_renovation=bed_data.get("is_post_renovation", False),
        )
        db.add(bed)
        created.append(bed)

    try:
        db.commit()
        for b in created:
            db.refresh(b)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    return [
        {
            "bed_id": b.bed_id,
            "unit_id": b.unit_id,
            "bed_label": b.bed_label,
            "monthly_rent": float(b.monthly_rent),
            "bedroom_number": b.bedroom_number,
        }
        for b in created
    ]


# ---------------------------------------------------------------------------
# Bulk Rent Roll Import (CSV)
# ---------------------------------------------------------------------------

VALID_UNIT_TYPES = {t.value for t in UnitType}

@router.post("/properties/{property_id}/import-rent-roll")
async def import_rent_roll_csv(
    property_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """
    Bulk import units and beds from a CSV file.

    Expected CSV columns:
      unit_number (required), unit_type, bed_count, sqft, floor,
      monthly_rent, bed_label, bed_rent, bed_status, bedroom_count,
      is_legal_suite, development_plan_id

    Each row creates a unit. If bed_count > 0, beds are auto-created.
    If bed_label and bed_rent are provided, beds use those values.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "File must be a .csv file")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handles BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    csv_rows = list(reader)

    # AI validation (best-effort, non-blocking)
    ai_validation = None
    try:
        from app.services.ai import validate_rent_roll
        existing_units = db.query(Unit).filter(Unit.property_id == property_id).all()
        existing = [{"unit_number": u.unit_number, "bed_count": u.bed_count} for u in existing_units]
        ai_validation = validate_rent_roll(
            csv_rows=[{k: v for k, v in row.items()} for row in csv_rows[:50]],
            property_address=prop.address,
            city=prop.city,
            existing_units=existing if existing else None,
        )
    except Exception:
        pass

    created_units = 0
    created_beds = 0
    errors = []
    row_num = 1

    # Group rows by unit_number so multiple beds can share a unit
    unit_cache: dict[str, Unit] = {}

    for row in csv_rows:
        row_num += 1
        unit_number = (row.get("unit_number") or "").strip()
        if not unit_number:
            errors.append(f"Row {row_num}: missing unit_number")
            continue

        # Get or create unit
        if unit_number not in unit_cache:
            # Parse unit fields
            unit_type_raw = (row.get("unit_type") or "shared").strip().lower()
            if unit_type_raw not in VALID_UNIT_TYPES:
                unit_type_raw = "shared"

            try:
                bed_count = int(row.get("bed_count") or 1)
            except ValueError:
                bed_count = 1

            try:
                sqft = float(row.get("sqft") or 0)
            except ValueError:
                sqft = 0

            floor = (row.get("floor") or "").strip() or None
            is_legal_suite = (row.get("is_legal_suite") or "").strip().lower() in ("true", "1", "yes")

            try:
                bedroom_count = int(row.get("bedroom_count") or 0) or None
            except ValueError:
                bedroom_count = None

            plan_id = None
            if row.get("development_plan_id"):
                try:
                    plan_id = int(row["development_plan_id"])
                except ValueError:
                    pass

            try:
                monthly_rent_val = float(row.get("monthly_rent") or 0)
            except ValueError:
                monthly_rent_val = 0

            unit = Unit(
                property_id=property_id,
                community_id=prop.community_id,
                unit_number=unit_number,
                unit_type=unit_type_raw,
                bed_count=bed_count,
                sqft=sqft,
                floor=floor,
                is_legal_suite=is_legal_suite,
                bedroom_count=bedroom_count,
                development_plan_id=plan_id,
                monthly_rent=monthly_rent_val if monthly_rent_val > 0 else None,
            )
            db.add(unit)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                errors.append(f"Row {row_num}: duplicate unit '{unit_number}'")
                continue

            unit_cache[unit_number] = unit
            created_units += 1

            # Auto-create beds if no explicit bed_label provided
            bed_label = (row.get("bed_label") or "").strip()
            if not bed_label:
                for b in range(1, bed_count + 1):
                    try:
                        bed_rent = float(row.get("bed_rent") or row.get("monthly_rent") or 0)
                    except ValueError:
                        bed_rent = 0
                    bed = Bed(
                        unit_id=unit.unit_id,
                        bed_label=f"{unit_number}-B{b}",
                        monthly_rent=bed_rent,
                        rent_type="private_pay",
                        status=BedStatus.available,
                    )
                    db.add(bed)
                    created_beds += 1
            else:
                # Create the explicit bed from this row
                try:
                    bed_rent = float(row.get("bed_rent") or row.get("monthly_rent") or 0)
                except ValueError:
                    bed_rent = 0
                bed_status_raw = (row.get("bed_status") or "available").strip().lower()
                if bed_status_raw not in {s.value for s in BedStatus}:
                    bed_status_raw = "available"
                bed = Bed(
                    unit_id=unit.unit_id,
                    bed_label=bed_label,
                    monthly_rent=bed_rent,
                    rent_type="private_pay",
                    status=bed_status_raw,
                )
                db.add(bed)
                created_beds += 1
        else:
            # Unit already exists — add a bed to it
            existing_unit = unit_cache[unit_number]
            bed_label = (row.get("bed_label") or "").strip()
            if not bed_label:
                bed_label = f"{unit_number}-B{existing_unit.bed_count + 1}"
                existing_unit.bed_count += 1

            try:
                bed_rent = float(row.get("bed_rent") or row.get("monthly_rent") or 0)
            except ValueError:
                bed_rent = 0
            bed_status_raw = (row.get("bed_status") or "available").strip().lower()
            if bed_status_raw not in {s.value for s in BedStatus}:
                bed_status_raw = "available"
            bed = Bed(
                unit_id=existing_unit.unit_id,
                bed_label=bed_label,
                monthly_rent=bed_rent,
                rent_type="private_pay",
                status=bed_status_raw,
            )
            db.add(bed)
            created_beds += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to save: {str(e)}")

    return {
        "success": True,
        "created_units": created_units,
        "created_beds": created_beds,
        "errors": errors,
        "total_rows_processed": row_num - 1,
        **({"ai_validation": ai_validation} if ai_validation else {}),
    }


@router.get("/properties/{property_id}/rent-roll-template")
def get_rent_roll_template(
    property_id: int,
    _: User = Depends(require_gp_or_ops),
):
    """Returns the CSV template headers for rent roll import."""
    return {
        "columns": [
            "unit_number",
            "unit_type",
            "bed_count",
            "sqft",
            "floor",
            "monthly_rent",
            "bed_label",
            "bed_rent",
            "bed_status",
            "bedroom_count",
            "is_legal_suite",
            "development_plan_id",
        ],
        "unit_type_values": list(VALID_UNIT_TYPES),
        "bed_status_values": [s.value for s in BedStatus],
        "example_rows": [
            {
                "unit_number": "101",
                "unit_type": "2br",
                "bed_count": "3",
                "sqft": "850",
                "floor": "1",
                "monthly_rent": "0",
                "bed_label": "101-B1",
                "bed_rent": "750",
                "bed_status": "occupied",
                "bedroom_count": "2",
                "is_legal_suite": "false",
                "development_plan_id": "",
            },
        ],
    }


# ===========================================================================
# Property Images
# ===========================================================================

from app.db.models import PropertyImage


@router.get("/properties/{property_id}/images")
def list_property_images(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List all images for a property (uploaded + listing reference URLs)."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    images = db.query(PropertyImage).filter(
        PropertyImage.property_id == property_id
    ).order_by(PropertyImage.sort_order).all()

    listing_photos = []
    if prop.listing_photo_urls:
        import json
        try:
            listing_photos = json.loads(prop.listing_photo_urls)
        except Exception:
            pass

    return {
        "uploaded": [
            {
                "image_id": img.image_id,
                "file_url": img.file_url,
                "caption": img.caption,
                "category": img.category,
                "is_primary": img.is_primary,
                "sort_order": img.sort_order,
            }
            for img in images
        ],
        "listing_url": prop.listing_url,
        "listing_photos": listing_photos,
    }


@router.post("/properties/{property_id}/images")
def upload_property_image(
    property_id: int,
    file: UploadFile = File(...),
    caption: str = "",
    category: str = "exterior",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Upload a property photo."""
    from pathlib import Path as _Path
    import uuid

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    uploads_dir = _Path(__file__).resolve().parent.parent.parent / "uploads" / "property-images"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"prop_{property_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = uploads_dir / filename

    with open(filepath, "wb") as f:
        content = file.file.read()
        f.write(content)

    file_url = f"/uploads/property-images/{filename}"

    # Check if this is the first image
    existing_count = db.query(PropertyImage).filter(PropertyImage.property_id == property_id).count()

    image = PropertyImage(
        property_id=property_id,
        file_url=file_url,
        caption=caption,
        category=category,
        is_primary=existing_count == 0,
        sort_order=existing_count,
        uploaded_by=current_user.user_id,
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    return {
        "image_id": image.image_id,
        "file_url": image.file_url,
        "caption": image.caption,
        "category": image.category,
        "is_primary": image.is_primary,
    }


@router.delete("/properties/images/{image_id}")
def delete_property_image(
    image_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Delete a property image."""
    image = db.query(PropertyImage).filter(PropertyImage.image_id == image_id).first()
    if not image:
        raise HTTPException(404, "Image not found")
    db.delete(image)
    db.commit()
    return {"status": "deleted"}


@router.post("/properties/{property_id}/listing-photos")
def save_listing_photos(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
    listing_url: str = "",
    photo_urls: list[str] = [],
):
    """Save reference photo URLs from a listing."""
    import json

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    if listing_url:
        prop.listing_url = listing_url
    if photo_urls:
        prop.listing_photo_urls = json.dumps(photo_urls)

    db.commit()
    return {"status": "saved", "listing_url": prop.listing_url, "photo_count": len(photo_urls)}
