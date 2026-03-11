from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_ops_pm, require_gp_or_ops
from app.db.models import DevelopmentPlan, Property, User
from app.db.session import get_db
from app.schemas.portfolio import (
    DevelopmentPlanCreate, DevelopmentPlanOut,
    ModelingInput, ModelingResult,
    PropertyCreate, PropertyOut, PropertyUpdate,
)
from app.services.modeling import (
    calculate_cap_rate, calculate_construction_costs, calculate_irr, calculate_noi,
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
