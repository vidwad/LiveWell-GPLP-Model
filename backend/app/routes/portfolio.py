import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_ops_pm, require_gp_or_ops
from app.db.models import DevelopmentPlan, EconomicEntity, Property, PropertyCluster, User
from app.db.session import get_db
from app.schemas.portfolio import (
    CostEstimateInput, CostEstimateResult,
    DevelopmentPlanCreate, DevelopmentPlanOut,
    EconomicEntityCreate, EconomicEntityOut,
    ModelingInput, ModelingResult,
    PropertyClusterCreate, PropertyClusterOut,
    PropertyCreate, PropertyOut, PropertyUpdate,
)
from app.services.modeling import (
    calculate_cap_rate, calculate_construction_costs, calculate_irr, calculate_noi,
    CostEstimator,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Properties
# ---------------------------------------------------------------------------

@router.get("/properties", response_model=list[PropertyOut])
def list_properties(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Property).all()


@router.post("/properties", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
def create_property(
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    prop = Property(**payload.model_dump())
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


@router.get("/properties/{property_id}", response_model=PropertyOut)
def get_property(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


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
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(prop, field, value)
    db.commit()
    db.refresh(prop)
    return prop


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
    return db.query(PropertyCluster).all()


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
    return cluster


@router.get("/clusters/{cluster_id}", response_model=PropertyClusterOut)
def get_cluster(
    cluster_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cluster = db.query(PropertyCluster).filter(PropertyCluster.cluster_id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return cluster


# ---------------------------------------------------------------------------
# Economic Entities
# ---------------------------------------------------------------------------

@router.get("/properties/{property_id}/entities", response_model=list[EconomicEntityOut])
def list_entities(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop.economic_entities


@router.post(
    "/properties/{property_id}/entities",
    response_model=EconomicEntityOut,
    status_code=status.HTTP_201_CREATED,
)
def create_entity(
    property_id: int,
    payload: EconomicEntityCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(status_code=404, detail="Property not found")
    entity = EconomicEntity(property_id=property_id, **payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


# ---------------------------------------------------------------------------
# Cost Estimation Engine
# ---------------------------------------------------------------------------

@router.post("/modeling/estimate-costs", response_model=CostEstimateResult)
def estimate_construction_costs(
    payload: CostEstimateInput,
    _: User = Depends(require_gp_or_ops),
):
    """
    Calculate detailed construction costs based on Alberta benchmarks.
    """
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
