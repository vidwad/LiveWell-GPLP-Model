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
    get_user_entity_ids,
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
    current_user: User = Depends(get_current_user),
):
    """
    GP_ADMIN / OPERATIONS_MANAGER / PROPERTY_MANAGER: see all properties.
    INVESTOR: see only properties belonging to LPs they have subscriptions in.
    """
    from app.db.models import Property, LPEntity, Subscription, Investor

    if current_user.role in ("GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER"):
        props = db.query(Property).all()
    elif current_user.role == "INVESTOR":
        # Find the Investor record linked to this user
        investor = db.query(Investor).filter(Investor.user_id == current_user.user_id).first()
        if not investor:
            return []
        # Find LP IDs this investor has subscriptions in
        lp_ids = (
            db.query(Subscription.lp_id)
            .filter(Subscription.investor_id == investor.investor_id)
            .distinct()
            .all()
        )
        lp_id_list = [lp_id for (lp_id,) in lp_ids]
        props = db.query(Property).filter(Property.lp_id.in_(lp_id_list)).all()
    else:
        props = []

    results = []
    for p in props:
        data = PropertyOut.model_validate(p)
        if p.lp:
            data.lp_name = p.lp.name
        results.append(data)
    return results


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
    _: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
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
    _: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
):
    construction_costs = calculate_construction_costs(
        payload.unit_count, payload.avg_cost_per_unit
    )
    noi = calculate_noi(payload.rent_income, payload.other_income, payload.operating_expenses)
    cap_rate = calculate_cap_rate(noi, payload.market_value)
    irr = calculate_irr(payload.cash_flows)
    return ModelingResult(
        construction_costs=construction_costs,
        noi=noi,
        cap_rate=cap_rate,
        irr=irr,
    )


# ---------------------------------------------------------------------------
# Property Clusters
# ---------------------------------------------------------------------------

@router.get("/clusters", response_model=list[PropertyClusterOut])
def list_clusters(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
            if h.funded_amount and h.funded_date:
                fd = h.funded_date.date() if hasattr(h.funded_date, "date") else h.funded_date
                cash_flows.append(-float(h.funded_amount))
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
