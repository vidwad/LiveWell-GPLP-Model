"""
API routes for the Portfolio domain: Properties, Clusters,
Development Plans, and Financial Modeling.
"""
import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.core.deps import (
    get_current_user, require_gp_ops_pm, require_gp_or_ops,
    require_investor_or_above, get_user_entity_ids,
    filter_by_lp_scope, filter_by_property_scope,
)
from app.db.models import (
    DevelopmentPlan, LPEntity, Property, PropertyCluster, User, UserRole,
    ScopeEntityType,
)
from app.db.session import get_db
from app.schemas.portfolio import (
    CostEstimateInput, CostEstimateResult,
    DebtFacilityCreate, DebtFacilityOut,
    DevelopmentPlanCreate, DevelopmentPlanOut,
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

@router.get("/properties", response_model=list[PropertyOut])
def list_properties(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """List properties filtered by the user's scope."""
    query = db.query(Property)
    query = filter_by_lp_scope(query, current_user, db, Property.lp_id)
    props = query.all()
    return [_property_to_out(p) for p in props]


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
    prop = Property(**payload.model_dump())
    db.add(prop)
    db.commit()
    db.refresh(prop)
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
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prop, field, value)
    db.commit()
    db.refresh(prop)
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
    db.commit()


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
    db.commit()
    db.refresh(plan)
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
    db.commit()


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
    db.commit()
    db.refresh(cluster)
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
    db.commit()
    db.refresh(facility)
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
    db.commit()
    db.refresh(facility)
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
    gross_revenue: float
    vacancy_loss: float
    effective_gross_income: float
    operating_expenses: float
    noi: float
    annual_debt_service: float
    cash_flow: float
    cumulative_cash_flow: float


class _ProjectionInput(_BaseModel):
    # Simplified inputs (from frontend)
    planned_units: int | None = None
    monthly_rent_per_unit: float | None = None
    annual_expense_ratio: float | None = None  # 0.35 = 35%
    vacancy_rate_stabilized: float | None = None  # 0.05 = 5%
    construction_start_date: str | None = None  # ISO date string
    construction_months: int = 18
    lease_up_months: int = 12
    annual_debt_service: float | None = None
    exit_cap_rate: float | None = None  # 0.055 = 5.5%
    # Advanced inputs (original schema, used as overrides)
    stabilized_annual_revenue: float | None = None
    stabilized_operating_expenses: float | None = None
    construction_start_year: int | None = None
    construction_duration_years: int | None = None
    lease_up_start_occupancy: float = 0.20
    stabilized_occupancy: float | None = None
    interim_revenue: float = 0.0
    interim_expenses: float = 0.0
    carrying_cost_annual: float = 0.0
    projection_years: int = 10
    expense_growth_rate: float = 0.03
    revenue_growth_rate: float = 0.025
    # Debt params for embedded debt service calculation
    debt_outstanding_balance: float = 0.0
    debt_annual_rate: float = 0.0
    debt_amortization_months: int = 0
    debt_io_months: int = 0


@router.post("/properties/{property_id}/projection", response_model=_List[_YearProjectionOut])
def run_projection(
    property_id: int,
    payload: _ProjectionInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """
    Run a time-phased annual projection for a property.
    If debt params are provided they override any stored debt facility data.
    """
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")

    # Determine annual debt service
    ads = 0.0
    if payload.debt_outstanding_balance > 0 and payload.debt_annual_rate > 0:
        engine = _MortgageEngine(
            outstanding_balance=payload.debt_outstanding_balance,
            annual_interest_rate=payload.debt_annual_rate / 100,
            amortization_months=payload.debt_amortization_months,
            io_period_months=payload.debt_io_months,
        )
        ads = engine.annual_debt_service(year=1)
    else:
        # Use active debt facilities from DB
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

    # Derive stabilized revenue/expenses from simplified inputs if not provided directly
    if payload.stabilized_annual_revenue is not None:
        stab_revenue = payload.stabilized_annual_revenue
    elif payload.planned_units and payload.monthly_rent_per_unit:
        stab_revenue = payload.planned_units * payload.monthly_rent_per_unit * 12
    else:
        stab_revenue = 0.0

    if payload.stabilized_operating_expenses is not None:
        stab_expenses = payload.stabilized_operating_expenses
    elif payload.annual_expense_ratio is not None and stab_revenue > 0:
        stab_expenses = stab_revenue * payload.annual_expense_ratio
    else:
        stab_expenses = 0.0

    # Derive construction_start_year as a RELATIVE year (1-based projection year)
    # The engine treats this as "construction begins in projection year N"
    construction_start_year = payload.construction_start_year
    if construction_start_year is None and payload.construction_start_date:
        try:
            from datetime import date as _date
            start_date = _date.fromisoformat(payload.construction_start_date)
            current_year = _date.today().year
            # Convert calendar year to relative projection year (1-based)
            # If construction starts this year or in the past, it's year 1
            relative_year = max(1, start_date.year - current_year + 1)
            construction_start_year = relative_year
        except (ValueError, IndexError):
            construction_start_year = 1  # Default: construction starts immediately

    # Derive construction_duration_years from months
    construction_duration_years = payload.construction_duration_years
    if construction_duration_years is None:
        construction_duration_years = max(1, round(payload.construction_months / 12))

    # Use vacancy_rate_stabilized to compute stabilized_occupancy
    stabilized_occupancy = payload.stabilized_occupancy
    if stabilized_occupancy is None:
        if payload.vacancy_rate_stabilized is not None:
            stabilized_occupancy = 1.0 - payload.vacancy_rate_stabilized
        else:
            stabilized_occupancy = 0.93

    # Override annual_debt_service from simplified input if provided
    if payload.annual_debt_service is not None and payload.annual_debt_service > 0:
        ads = payload.annual_debt_service

    proj_engine = LifecycleProjectionEngine(
        stabilized_annual_revenue=stab_revenue,
        stabilized_operating_expenses=stab_expenses,
        annual_debt_service=ads,
        construction_start_year=construction_start_year,
        construction_duration_years=construction_duration_years,
        lease_up_months=payload.lease_up_months,
        lease_up_start_occupancy=payload.lease_up_start_occupancy,
        stabilized_occupancy=stabilized_occupancy,
        interim_revenue=payload.interim_revenue,
        interim_expenses=payload.interim_expenses,
        carrying_cost_annual=payload.carrying_cost_annual,
        projection_years=payload.projection_years,
        expense_growth_rate=payload.expense_growth_rate,
        revenue_growth_rate=payload.revenue_growth_rate,
    )

    return [
        _YearProjectionOut(
            year=y.year, phase=y.phase, rentable_months=y.rentable_months,
            occupancy_rate=y.occupancy_rate, gross_revenue=y.gross_revenue,
            vacancy_loss=y.vacancy_loss, effective_gross_income=y.effective_gross_income,
            operating_expenses=y.operating_expenses, noi=y.noi,
            annual_debt_service=y.annual_debt_service, cash_flow=y.cash_flow,
            cumulative_cash_flow=y.cumulative_cash_flow,
        )
        for y in proj_engine.project()
    ]


# ---------------------------------------------------------------------------
# Cost Estimation Engine
# ---------------------------------------------------------------------------

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


def _calc_refinance(scenario: RefinanceScenario) -> RefinanceScenarioOut:
    new_loan = round(float(scenario.assumed_new_valuation) * float(scenario.new_ltv_percent) / 100, 2)
    debt_payout = float(scenario.existing_debt_payout or 0)
    closing = float(scenario.closing_costs or 0)
    net_proceeds = round(new_loan - debt_payout - closing, 2)
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
    )


def _calc_sale(scenario: SaleScenario) -> SaleScenarioOut:
    price = float(scenario.assumed_sale_price)
    selling_costs = round(price * float(scenario.selling_costs_percent) / 100, 2)
    debt_payout = float(scenario.debt_payout or 0)
    reserves = float(scenario.capital_gains_reserve or 0)
    net_proceeds = round(price - selling_costs - debt_payout - reserves, 2)
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
    )


@router.get("/properties/{property_id}/refinance-scenarios", response_model=_List[RefinanceScenarioOut])
def list_refinance_scenarios(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    return [_calc_refinance(s) for s in db.query(RefinanceScenario).filter(RefinanceScenario.property_id == property_id).all()]


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
    db.commit()
    db.refresh(scenario)
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
    db.commit()


@router.get("/properties/{property_id}/sale-scenarios", response_model=_List[SaleScenarioOut])
def list_sale_scenarios(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    return [_calc_sale(s) for s in db.query(SaleScenario).filter(SaleScenario.property_id == property_id).all()]


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
    db.commit()
    db.refresh(scenario)
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
    db.commit()


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
    db.commit()
    db.refresh(val)
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
    db.commit()


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
    db.commit()
    db.refresh(val)
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
    db.commit()
    db.refresh(expense)
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
    db.commit()
    db.refresh(expense)
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
    db.commit()


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
    db.commit()
    db.refresh(draw)
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
    db.commit()
    db.refresh(draw)
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
    db.commit()
