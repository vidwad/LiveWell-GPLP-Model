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
    RefinanceScenarioCreate, RefinanceScenarioOut,
    SaleScenarioCreate, SaleScenarioOut,
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
    if prop.lp_id and current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
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
    facility = DebtFacility(**payload.model_dump())
    db.add(facility)
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
    for k, v in payload.items():
        if hasattr(facility, k):
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
# Advanced Returns Metrics  (XIRR + Equity Multiple)
# ---------------------------------------------------------------------------

from pydantic import BaseModel as _BaseModel
from app.db.models import Holding, DistributionAllocation, Subscription


class FundReturnsResult(_BaseModel):
    lp_id: int
    lp_name: str
    total_invested_capital: float
    total_distributions: float
    equity_multiple: float | None
    xirr_percent: float | None
    investor_count: int


class PortfolioReturnsResult(_BaseModel):
    funds: list[FundReturnsResult]
    portfolio_equity_multiple: float | None
    portfolio_xirr_percent: float | None


@router.get("/metrics/returns", response_model=PortfolioReturnsResult)
def portfolio_returns_metrics(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """
    Compute XIRR and equity multiple for each LP fund and the overall portfolio.
    Uses Holding (funded_date + funded_amount) and DistributionAllocation as cash flows.
    """
    from app.services.calculations import calculate_xirr, calculate_equity_multiple

    lps = db.query(LPEntity).all()
    fund_results = []

    portfolio_total_invested = 0.0
    portfolio_total_distributions = 0.0
    portfolio_cash_flows: list[float] = []
    portfolio_dates: list[datetime.date] = []

    for lp in lps:
        holdings = (
            db.query(Holding)
            .join(Subscription, Holding.subscription_id == Subscription.subscription_id)
            .filter(Subscription.lp_id == lp.lp_id)
            .all()
        )

        if not holdings:
            continue

        investor_ids = {h.investor_id for h in holdings}
        holding_ids = [h.holding_id for h in holdings]

        cash_flows: list[float] = []
        dates: list[datetime.date] = []

        for h in holdings:
            # funded_amount and funded_date live on the Subscription, not the Holding
            sub = h.subscription
            if sub and sub.funded_amount and sub.funded_date:
                fd = sub.funded_date if isinstance(sub.funded_date, datetime.date) else sub.funded_date.date()
                cash_flows.append(-float(sub.funded_amount))
                dates.append(fd)
            elif h.cost_basis:
                # Fallback: use cost_basis as the invested amount with a synthetic date
                cash_flows.append(-float(h.cost_basis))
                # Use subscription accepted_date or a default
                fallback_date = (sub.accepted_date or sub.submitted_date) if sub else None
                if fallback_date:
                    fd = fallback_date if isinstance(fallback_date, datetime.date) else fallback_date.date()
                else:
                    fd = datetime.date(2025, 1, 1)  # default for seed data
                dates.append(fd)

        allocations = (
            db.query(DistributionAllocation)
            .filter(DistributionAllocation.holding_id.in_(holding_ids))
            .all()
        )
        total_distributions = 0.0
        for alloc in allocations:
            amount = float(alloc.amount or 0)
            if amount > 0:
                event = alloc.event
                alloc_date = None
                if event:
                    raw_dt = event.paid_date or event.approved_date or event.created_date
                    if raw_dt:
                        alloc_date = raw_dt.date() if hasattr(raw_dt, "date") else raw_dt
                if alloc_date:
                    cash_flows.append(amount)
                    dates.append(alloc_date)
                total_distributions += amount

        total_invested = sum(-cf for cf in cash_flows if cf < 0)

        xirr_result = calculate_xirr(cash_flows, dates) if len(cash_flows) >= 2 else None
        em = calculate_equity_multiple(total_distributions, total_invested)

        fund_results.append(FundReturnsResult(
            lp_id=lp.lp_id,
            lp_name=lp.name,
            total_invested_capital=round(total_invested, 2),
            total_distributions=round(total_distributions, 2),
            equity_multiple=em,
            xirr_percent=round(xirr_result * 100, 2) if xirr_result is not None else None,
            investor_count=len(investor_ids),
        ))

        portfolio_total_invested += total_invested
        portfolio_total_distributions += total_distributions
        portfolio_cash_flows.extend(cash_flows)
        portfolio_dates.extend(dates)

    portfolio_em = calculate_equity_multiple(portfolio_total_distributions, portfolio_total_invested)
    portfolio_xirr = None
    if len(portfolio_cash_flows) >= 2:
        combined = sorted(zip(portfolio_dates, portfolio_cash_flows))
        p_dates = [d for d, _ in combined]
        p_cfs = [cf for _, cf in combined]
        raw = calculate_xirr(p_cfs, p_dates)
        portfolio_xirr = round(raw * 100, 2) if raw is not None else None

    return PortfolioReturnsResult(
        funds=fund_results,
        portfolio_equity_multiple=portfolio_em,
        portfolio_xirr_percent=portfolio_xirr,
    )


# ---------------------------------------------------------------------------
# Phase 5: Refinance & Sale Scenarios
# ---------------------------------------------------------------------------

from app.db.models import RefinanceScenario, SaleScenario
from sqlalchemy.orm import joinedload as _joinedload


def _calc_refinance(scenario: RefinanceScenario) -> RefinanceScenarioOut:
    new_loan = round(float(scenario.assumed_new_valuation) * float(scenario.new_ltv_percent) / 100, 2)
    debt_payout = float(scenario.existing_debt_payout or 0)
    closing = float(scenario.closing_costs or 0)
    net_proceeds = round(new_loan - debt_payout - closing, 2)

    # ROI calculations
    equity = float(scenario.total_equity_invested or 0)
    noi = float(scenario.annual_noi_at_refi or 0)
    hold_months = scenario.hold_period_months

    equity_multiple = None
    cash_on_cash = None
    annualized_roi = None

    if equity > 0:
        equity_multiple = round((net_proceeds + equity) / equity, 2)
        if noi > 0:
            cash_on_cash = round(noi / equity * 100, 2)
        if hold_months and hold_months > 0:
            hold_years = hold_months / 12
            total_gain = net_proceeds  # cash freed from refi
            annualized_roi = round(((1 + total_gain / equity) ** (1 / hold_years) - 1) * 100, 2) if total_gain > -equity else None

    # Linked milestone title
    milestone_title = None
    if scenario.linked_milestone:
        milestone_title = scenario.linked_milestone.title

    return RefinanceScenarioOut(
        scenario_id=scenario.scenario_id,
        property_id=scenario.property_id,
        label=scenario.label,
        assumed_new_valuation=float(scenario.assumed_new_valuation),
        new_ltv_percent=float(scenario.new_ltv_percent),
        new_interest_rate=float(scenario.new_interest_rate) if scenario.new_interest_rate else None,
        new_amortization_months=scenario.new_amortization_months,
        existing_debt_payout=debt_payout,
        closing_costs=closing,
        notes=scenario.notes,
        new_loan_amount=new_loan,
        net_proceeds=net_proceeds,
        created_at=scenario.created_at,
        expected_date=scenario.expected_date,
        linked_milestone_id=scenario.linked_milestone_id,
        linked_event=scenario.linked_event,
        total_equity_invested=equity if equity else None,
        annual_noi_at_refi=noi if noi else None,
        hold_period_months=hold_months,
        equity_multiple=equity_multiple,
        cash_on_cash_return=cash_on_cash,
        annualized_roi=annualized_roi,
        linked_milestone_title=milestone_title,
    )


def _calc_sale(scenario: SaleScenario) -> SaleScenarioOut:
    price = float(scenario.assumed_sale_price)
    selling_costs = round(price * float(scenario.selling_costs_percent) / 100, 2)
    debt_payout = float(scenario.debt_payout or 0)
    reserves = float(scenario.capital_gains_reserve or 0)
    net_proceeds = round(price - selling_costs - debt_payout - reserves, 2)

    # ROI calculations
    equity = float(scenario.total_equity_invested or 0)
    noi = float(scenario.annual_noi_at_sale or 0)
    hold_months = scenario.hold_period_months
    annual_cf = float(scenario.annual_cash_flow or 0)

    total_return = None
    equity_multiple = None
    irr_estimate = None
    cash_on_cash = None
    cap_rate_val = None

    if equity > 0:
        hold_years = (hold_months / 12) if hold_months and hold_months > 0 else 0
        cumulative_cf = annual_cf * hold_years if hold_years > 0 else 0
        total_return = round(net_proceeds + cumulative_cf - equity, 2)
        equity_multiple = round((net_proceeds + cumulative_cf) / equity, 2)
        if annual_cf > 0:
            cash_on_cash = round(annual_cf / equity * 100, 2)
        if hold_years > 0 and total_return > -equity:
            irr_estimate = round(((1 + (net_proceeds + cumulative_cf - equity) / equity) ** (1 / hold_years) - 1) * 100, 2)

    if price > 0 and noi > 0:
        cap_rate_val = round(noi / price * 100, 2)

    # Linked milestone title
    milestone_title = None
    if scenario.linked_milestone:
        milestone_title = scenario.linked_milestone.title

    return SaleScenarioOut(
        scenario_id=scenario.scenario_id,
        property_id=scenario.property_id,
        label=scenario.label,
        assumed_sale_price=price,
        selling_costs_percent=float(scenario.selling_costs_percent),
        debt_payout=debt_payout,
        capital_gains_reserve=reserves,
        notes=scenario.notes,
        selling_costs=selling_costs,
        net_proceeds=net_proceeds,
        created_at=scenario.created_at,
        expected_date=scenario.expected_date,
        linked_milestone_id=scenario.linked_milestone_id,
        linked_event=scenario.linked_event,
        total_equity_invested=equity if equity else None,
        annual_noi_at_sale=noi if noi else None,
        hold_period_months=hold_months,
        annual_cash_flow=annual_cf if annual_cf else None,
        total_return=total_return,
        equity_multiple=equity_multiple,
        irr_estimate=irr_estimate,
        cash_on_cash_return=cash_on_cash,
        cap_rate=cap_rate_val,
        linked_milestone_title=milestone_title,
    )


@router.get("/properties/{property_id}/refinance-scenarios", response_model=_List[RefinanceScenarioOut])
def list_refinance_scenarios(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    return [_calc_refinance(s) for s in db.query(RefinanceScenario).options(_joinedload(RefinanceScenario.linked_milestone)).filter(RefinanceScenario.property_id == property_id).all()]


@router.post("/properties/{property_id}/refinance-scenarios", response_model=RefinanceScenarioOut, status_code=status.HTTP_201_CREATED)
def create_refinance_scenario(
    property_id: int,
    payload: RefinanceScenarioCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    scenario = RefinanceScenario(property_id=property_id, **payload.model_dump())
    db.add(scenario)
    try:
        db.commit()
        db.refresh(scenario)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return _calc_refinance(scenario)


@router.delete("/refinance-scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_refinance_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    s = db.query(RefinanceScenario).filter(RefinanceScenario.scenario_id == scenario_id).first()
    if not s:
        raise HTTPException(404, "Scenario not found")
    db.delete(s)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/properties/{property_id}/sale-scenarios", response_model=_List[SaleScenarioOut])
def list_sale_scenarios(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    return [_calc_sale(s) for s in db.query(SaleScenario).options(_joinedload(SaleScenario.linked_milestone)).filter(SaleScenario.property_id == property_id).all()]


@router.post("/properties/{property_id}/sale-scenarios", response_model=SaleScenarioOut, status_code=status.HTTP_201_CREATED)
def create_sale_scenario(
    property_id: int,
    payload: SaleScenarioCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    scenario = SaleScenario(property_id=property_id, **payload.model_dump())
    db.add(scenario)
    try:
        db.commit()
        db.refresh(scenario)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return _calc_sale(scenario)


@router.delete("/sale-scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    s = db.query(SaleScenario).filter(SaleScenario.scenario_id == scenario_id).first()
    if not s:
        raise HTTPException(404, "Scenario not found")
    db.delete(s)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Phase 5: Redevelopment Scenario Comparison
# ---------------------------------------------------------------------------

@router.get("/properties/{property_id}/plans/compare")
def compare_development_plans(
    property_id: int,
    plan_ids: str,   # comma-separated list of plan IDs e.g. "1,2,3"
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """
    Side-by-side comparison of multiple DevelopmentPlan versions for a property.
    Pass ?plan_ids=1,2,3 (comma-separated).
    Returns cost breakdown, NOI, debt impact, and projected valuation for each plan.
    """
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")

    try:
        ids = [int(i.strip()) for i in plan_ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(400, "plan_ids must be comma-separated integers")

    plans = (
        db.query(DevelopmentPlan)
        .filter(
            DevelopmentPlan.plan_id.in_(ids),
            DevelopmentPlan.property_id == property_id,
        )
        .all()
    )

    if not plans:
        raise HTTPException(404, "No plans found for this property with the given IDs")

    comparison = []
    for plan in plans:
        total_cost = float(plan.estimated_construction_cost or 0)
        noi = float(plan.projected_annual_noi or 0)
        revenue = float(plan.projected_annual_revenue or 0)

        # Implied cap rate valuation at 5.5% cap rate
        implied_valuation = round(noi / 0.055, 2) if noi > 0 else None

        # Debt impact: estimate 65% LTV on implied valuation
        estimated_debt = round(implied_valuation * 0.65, 2) if implied_valuation else None
        equity_required = round(total_cost - (estimated_debt or 0), 2) if total_cost > 0 else None

        comparison.append({
            "plan_id": plan.plan_id,
            "version": plan.version,
            "status": plan.status.value,
            "planned_units": plan.planned_units,
            "planned_beds": plan.planned_beds,
            "planned_sqft": float(plan.planned_sqft or 0),
            "cost_breakdown": {
                "hard_costs": float(plan.hard_costs or 0),
                "soft_costs": float(plan.soft_costs or 0),
                "site_costs": float(plan.site_costs or 0),
                "financing_costs": float(plan.financing_costs or 0),
                "total_estimated_cost": total_cost,
                "cost_per_sqft": float(plan.cost_per_sqft or 0),
            },
            "income": {
                "projected_annual_revenue": revenue,
                "projected_annual_noi": noi,
                "noi_margin_percent": round(noi / revenue * 100, 1) if revenue > 0 else None,
            },
            "valuation": {
                "implied_valuation_at_5_5_cap": implied_valuation,
                "estimated_debt_at_65_ltv": estimated_debt,
                "estimated_equity_required": equity_required,
            },
            "timeline": {
                "development_start_date": str(plan.development_start_date) if plan.development_start_date else None,
                "estimated_completion_date": str(plan.estimated_completion_date) if plan.estimated_completion_date else None,
                "estimated_stabilization_date": str(plan.estimated_stabilization_date) if plan.estimated_stabilization_date else None,
                "construction_duration_days": plan.construction_duration_days,
            },
        })

    return {"property_id": property_id, "plans_compared": len(comparison), "comparison": comparison}


# ---------------------------------------------------------------------------
# Phase 6: Valuation History
# ---------------------------------------------------------------------------

from app.db.models import ValuationHistory
from app.schemas.portfolio import ValuationCreate, ValuationOut


@router.get("/properties/{property_id}/valuations", response_model=_List[ValuationOut])
def list_valuations(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """List all valuation records for a property, newest first."""
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    return (
        db.query(ValuationHistory)
        .filter(ValuationHistory.property_id == property_id)
        .order_by(ValuationHistory.valuation_date.desc())
        .all()
    )


@router.post(
    "/properties/{property_id}/valuations",
    response_model=ValuationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_valuation(
    property_id: int,
    payload: ValuationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Record a new valuation for a property and optionally update current_market_value."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    val = ValuationHistory(
        property_id=property_id,
        created_by=current_user.user_id,
        **payload.model_dump(),
    )
    db.add(val)

    # Also update the property's current_market_value to the latest valuation
    prop.current_market_value = payload.value
    try:
        db.commit()
        db.refresh(val)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return val


@router.delete("/valuations/{valuation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_valuation(
    valuation_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    v = db.query(ValuationHistory).filter(ValuationHistory.valuation_id == valuation_id).first()
    if not v:
        raise HTTPException(404, "Valuation not found")
    db.delete(v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Task 1: Cap Rate / Income Approach Valuation Calculator
# ---------------------------------------------------------------------------

from app.schemas.portfolio import CapRateValuationInput, CapRateValuationResult


@router.post("/properties/{property_id}/valuations/cap-rate", response_model=CapRateValuationResult)
def calculate_cap_rate_valuation(
    property_id: int,
    payload: CapRateValuationInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Calculate property value using the income approach (NOI / Cap Rate).

    Optionally auto-creates a valuation record and updates the property's current_market_value.
    """
    from decimal import Decimal, ROUND_HALF_UP

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    if payload.cap_rate <= 0:
        raise HTTPException(400, "Cap rate must be greater than 0")

    noi = Decimal(str(payload.noi))
    cap_rate_pct = Decimal(str(payload.cap_rate))
    cap_rate_decimal = cap_rate_pct / Decimal("100")
    estimated_value = (noi / cap_rate_decimal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Value per unit and per sqft from active development plan
    plan = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.property_id == property_id)
        .order_by(DevelopmentPlan.plan_id.desc())
        .first()
    )
    value_per_unit = None
    value_per_sqft = None
    if plan:
        if plan.planned_units and plan.planned_units > 0:
            value_per_unit = (estimated_value / Decimal(str(plan.planned_units))).quantize(Decimal("0.01"))
        if plan.planned_sqft and plan.planned_sqft > 0:
            value_per_sqft = (estimated_value / Decimal(str(plan.planned_sqft))).quantize(Decimal("0.01"))

    return CapRateValuationResult(
        noi=noi,
        cap_rate=cap_rate_pct,
        estimated_value=estimated_value,
        value_per_unit=value_per_unit,
        value_per_sqft=value_per_sqft,
    )


@router.post("/properties/{property_id}/valuations/cap-rate/save", response_model=ValuationOut, status_code=status.HTTP_201_CREATED)
def save_cap_rate_valuation(
    property_id: int,
    payload: CapRateValuationInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Calculate cap rate valuation AND save it as a valuation record."""
    from decimal import Decimal, ROUND_HALF_UP
    import datetime as _dt

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    if payload.cap_rate <= 0:
        raise HTTPException(400, "Cap rate must be greater than 0")

    noi = Decimal(str(payload.noi))
    cap_rate_decimal = Decimal(str(payload.cap_rate)) / Decimal("100")
    estimated_value = (noi / cap_rate_decimal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    val = ValuationHistory(
        property_id=property_id,
        valuation_date=_dt.date.today(),
        value=estimated_value,
        method="cap_rate",
        notes=f"Income approach: NOI ${noi:,.2f} / Cap Rate {payload.cap_rate}%",
        created_by=current_user.user_id,
    )
    db.add(val)
    prop.current_market_value = estimated_value
    try:
        db.commit()
        db.refresh(val)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return val


# ---------------------------------------------------------------------------
# Task 2: Construction Budget vs Actual Tracking
# ---------------------------------------------------------------------------

from app.db.models import ConstructionExpense
from app.schemas.portfolio import ConstructionExpenseCreate, ConstructionExpenseOut, ConstructionBudgetSummary


@router.get("/properties/{property_id}/construction-expenses", response_model=_List[ConstructionExpenseOut])
def list_construction_expenses(
    property_id: int,
    plan_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    query = db.query(ConstructionExpense).filter(ConstructionExpense.property_id == property_id)
    if plan_id:
        query = query.filter(ConstructionExpense.plan_id == plan_id)
    return query.order_by(ConstructionExpense.expense_id).all()


@router.post("/properties/{property_id}/construction-expenses", response_model=ConstructionExpenseOut, status_code=status.HTTP_201_CREATED)
def create_construction_expense(
    property_id: int,
    payload: ConstructionExpenseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    if not db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == payload.plan_id).first():
        raise HTTPException(404, "Development plan not found")
    expense = ConstructionExpense(property_id=property_id, **payload.model_dump())
    db.add(expense)
    try:
        db.commit()
        db.refresh(expense)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return expense


@router.patch("/construction-expenses/{expense_id}", response_model=ConstructionExpenseOut)
def update_construction_expense(
    expense_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    expense = db.query(ConstructionExpense).filter(ConstructionExpense.expense_id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Construction expense not found")
    for k, v in payload.items():
        if k == "expense_date" and isinstance(v, str):
            from datetime import date as _date
            v = _date.fromisoformat(v)
        if hasattr(expense, k):
            setattr(expense, k, v)
    try:
        db.commit()
        db.refresh(expense)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return expense


@router.delete("/construction-expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_construction_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    expense = db.query(ConstructionExpense).filter(ConstructionExpense.expense_id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Construction expense not found")
    db.delete(expense)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/properties/{property_id}/construction-budget-summary", response_model=ConstructionBudgetSummary)
def get_construction_budget_summary(
    property_id: int,
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """Get budget vs actual summary for a development plan."""
    from decimal import Decimal

    expenses = (
        db.query(ConstructionExpense)
        .filter(ConstructionExpense.property_id == property_id, ConstructionExpense.plan_id == plan_id)
        .all()
    )

    total_budgeted = sum(Decimal(str(e.budgeted_amount or 0)) for e in expenses)
    total_actual = sum(Decimal(str(e.actual_amount or 0)) for e in expenses)

    by_category: dict[str, dict] = {}
    for e in expenses:
        cat = e.category
        if cat not in by_category:
            by_category[cat] = {"budgeted": Decimal("0"), "actual": Decimal("0"), "variance": Decimal("0")}
        by_category[cat]["budgeted"] += Decimal(str(e.budgeted_amount or 0))
        by_category[cat]["actual"] += Decimal(str(e.actual_amount or 0))
    for cat in by_category:
        by_category[cat]["variance"] = by_category[cat]["budgeted"] - by_category[cat]["actual"]
        by_category[cat] = {k: float(v) for k, v in by_category[cat].items()}

    return ConstructionBudgetSummary(
        property_id=property_id,
        plan_id=plan_id,
        line_items=expenses,
        total_budgeted=total_budgeted,
        total_actual=total_actual,
        total_variance=total_budgeted - total_actual,
        by_category=by_category,
    )


# ---------------------------------------------------------------------------
# Task 3: Construction Draw Schedule
# ---------------------------------------------------------------------------

from app.db.models import ConstructionDraw, ConstructionDrawStatus
from app.schemas.portfolio import ConstructionDrawCreate, ConstructionDrawOut


@router.get("/properties/{property_id}/construction-draws", response_model=_List[ConstructionDrawOut])
def list_construction_draws(
    property_id: int,
    debt_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    query = db.query(ConstructionDraw).filter(ConstructionDraw.property_id == property_id)
    if debt_id:
        query = query.filter(ConstructionDraw.debt_id == debt_id)
    return query.order_by(ConstructionDraw.draw_number).all()


@router.post("/properties/{property_id}/construction-draws", response_model=ConstructionDrawOut, status_code=status.HTTP_201_CREATED)
def create_construction_draw(
    property_id: int,
    payload: ConstructionDrawCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    facility = db.query(DebtFacility).filter(
        DebtFacility.debt_id == payload.debt_id,
        DebtFacility.property_id == property_id,
    ).first()
    if not facility:
        raise HTTPException(404, "Debt facility not found for this property")

    draw = ConstructionDraw(
        property_id=property_id,
        **payload.model_dump(),
    )
    db.add(draw)
    try:
        db.commit()
        db.refresh(draw)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return draw


@router.patch("/construction-draws/{draw_id}", response_model=ConstructionDrawOut)
def update_construction_draw(
    draw_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    draw = db.query(ConstructionDraw).filter(ConstructionDraw.draw_id == draw_id).first()
    if not draw:
        raise HTTPException(404, "Construction draw not found")
    date_fields = {"requested_date", "approved_date", "funded_date"}
    for k, v in payload.items():
        if k == "status" and v:
            v = ConstructionDrawStatus(v)
        if k in date_fields and isinstance(v, str):
            from datetime import date as _date
            v = _date.fromisoformat(v)
        if hasattr(draw, k):
            setattr(draw, k, v)
    # When a draw is funded, update the debt facility's drawn_amount
    if draw.status == ConstructionDrawStatus.funded and draw.approved_amount:
        from sqlalchemy import func as sa_func
        db.flush()  # ensure this draw's status is visible to the sum query
        facility = db.query(DebtFacility).filter(DebtFacility.debt_id == draw.debt_id).first()
        if facility:
            funded_total = (
                db.query(sa_func.coalesce(sa_func.sum(ConstructionDraw.approved_amount), 0))
                .filter(
                    ConstructionDraw.debt_id == draw.debt_id,
                    ConstructionDraw.status == ConstructionDrawStatus.funded,
                )
                .scalar()
            )
            facility.drawn_amount = float(funded_total or 0)
            facility.outstanding_balance = float(funded_total or 0)
    try:
        db.commit()
        db.refresh(draw)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return draw


@router.delete("/construction-draws/{draw_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_construction_draw(
    draw_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    draw = db.query(ConstructionDraw).filter(ConstructionDraw.draw_id == draw_id).first()
    if not draw:
        raise HTTPException(404, "Construction draw not found")
    db.delete(draw)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


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
    response_model=list[UnitWithBedsOut],
)
def list_property_units(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List all units (with nested beds) for a property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")
    return prop.units


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

    baseline_projection = _build_projection(baseline_summary, baseline_annual_increase)

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

        plan_projection = _build_projection(plan_summary, plan_increase) if plan_summary else None

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
# Stabilized Pro Forma
# ---------------------------------------------------------------------------

from app.db.models import ProForma, ProFormaStatus
from app.services.proforma_service import generate_proforma


class _ProFormaGenerateInput(_BaseModel):
    plan_id: int | None = None
    vacancy_rate: float = 5.0
    management_fee_rate: float = 4.0
    replacement_reserve_pct: float = 2.0
    cap_rate_assumption: float = 5.5
    label: str | None = None


@router.post("/properties/{property_id}/pro-forma/generate")
def generate_property_proforma(
    property_id: int,
    payload: _ProFormaGenerateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Generate a stabilized pro forma from current property data.

    Pulls rent roll, expenses, debt service, and development plan
    to build a complete NOI → DSCR → valuation analysis.
    Returns preview — call /save to persist.
    """
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")

    result = generate_proforma(
        db, property_id,
        plan_id=payload.plan_id,
        vacancy_rate=payload.vacancy_rate,
        management_fee_rate=payload.management_fee_rate,
        replacement_reserve_pct=payload.replacement_reserve_pct,
        cap_rate_assumption=payload.cap_rate_assumption,
        label=payload.label,
    )
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.post("/properties/{property_id}/pro-forma/save", status_code=status.HTTP_201_CREATED)
def save_property_proforma(
    property_id: int,
    payload: _ProFormaGenerateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Generate AND save a pro forma as a persistent record."""
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")

    data = generate_proforma(
        db, property_id,
        plan_id=payload.plan_id,
        vacancy_rate=payload.vacancy_rate,
        management_fee_rate=payload.management_fee_rate,
        replacement_reserve_pct=payload.replacement_reserve_pct,
        cap_rate_assumption=payload.cap_rate_assumption,
        label=payload.label,
    )
    if "error" in data:
        raise HTTPException(404, data["error"])

    pf = ProForma(created_by=current_user.user_id)
    for k, v in data.items():
        if hasattr(pf, k):
            setattr(pf, k, v)

    db.add(pf)
    try:
        db.commit()
        db.refresh(pf)
    except Exception:
        db.rollback()
        raise HTTPException(500, "Failed to save pro forma")

    return {**data, "proforma_id": pf.proforma_id, "saved": True}


@router.get("/properties/{property_id}/pro-formas")
def list_property_proformas(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """List all saved pro formas for a property."""
    pfs = (
        db.query(ProForma)
        .filter(ProForma.property_id == property_id)
        .order_by(ProForma.created_at.desc())
        .all()
    )
    results = []
    for pf in pfs:
        row = {
            "proforma_id": pf.proforma_id,
            "property_id": pf.property_id,
            "plan_id": pf.plan_id,
            "label": pf.label,
            "status": pf.status.value if pf.status else "draft",
            "noi": float(pf.noi) if pf.noi else None,
            "cap_rate": float(pf.cap_rate) if pf.cap_rate else None,
            "dscr": float(pf.dscr) if pf.dscr else None,
            "cash_on_cash": float(pf.cash_on_cash) if pf.cash_on_cash else None,
            "property_value": float(pf.property_value) if pf.property_value else None,
            "total_units": pf.total_units,
            "total_beds": pf.total_beds,
            "created_at": str(pf.created_at) if pf.created_at else None,
        }
        results.append(row)
    return results


@router.get("/pro-formas/{proforma_id}")
def get_proforma(
    proforma_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """Get a saved pro forma by ID (full detail)."""
    pf = db.query(ProForma).filter(ProForma.proforma_id == proforma_id).first()
    if not pf:
        raise HTTPException(404, "Pro forma not found")

    from decimal import Decimal
    # Return all fields
    result = {}
    for col in ProForma.__table__.columns:
        val = getattr(pf, col.name)
        if hasattr(val, 'value'):  # enum
            val = val.value
        elif isinstance(val, Decimal):
            val = float(val)
        result[col.name] = val
    return result


@router.delete("/pro-formas/{proforma_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_proforma(
    proforma_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    pf = db.query(ProForma).filter(ProForma.proforma_id == proforma_id).first()
    if not pf:
        raise HTTPException(404, "Pro forma not found")
    db.delete(pf)
    db.commit()


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

    created_units = 0
    created_beds = 0
    errors = []
    row_num = 1

    # Group rows by unit_number so multiple beds can share a unit
    unit_cache: dict[str, Unit] = {}

    for row in reader:
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
