"""
Portfolio Operating Expenses routes: CRUD for granular operating expense
line items (property tax, insurance, utilities, salaries, etc.) attached
to a property.
"""
from decimal import Decimal
from typing import List as _List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_gp_or_ops, require_investor_or_above
from app.db.models import (
    AncillaryRevenueStream,
    Bed,
    OperatingExpenseLineItem,
    Property,
    Unit,
    User,
    RenovationPhase,
)
from app.db.session import get_db
from app.schemas.portfolio import (
    OperatingExpenseLineItemCreate,
    OperatingExpenseLineItemOut,
    OperatingExpenseLineItemUpdate,
    OperatingExpenseSummary,
)

router = APIRouter()


def _compute_annual(item: OperatingExpenseLineItem, total_units: int, egi: float) -> float:
    """Compute the annual expense amount for a line item."""
    base = float(item.base_amount or 0)
    method = item.calc_method or "fixed"
    if method == "per_unit":
        return base * total_units
    elif method == "pct_egi":
        return egi * (base / 100.0)
    else:  # fixed
        return base


def _item_to_out(
    item: OperatingExpenseLineItem,
    total_units: int,
    egi: float,
) -> OperatingExpenseLineItemOut:
    """Convert ORM object to output schema with computed annual amount."""
    annual = _compute_annual(item, total_units, egi)
    return OperatingExpenseLineItemOut(
        expense_item_id=item.expense_item_id,
        property_id=item.property_id,
        development_plan_id=item.development_plan_id,
        category=item.category,
        description=item.description,
        calc_method=item.calc_method.value if hasattr(item.calc_method, 'value') else item.calc_method,
        base_amount=item.base_amount,
        annual_escalation_pct=item.annual_escalation_pct,
        notes=item.notes,
        computed_annual_amount=Decimal(str(round(annual, 2))),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _get_property_metrics(db: Session, property_id: int, plan_id: int | None = None):
    """Get total units and EGI for a property to compute expense amounts."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        return 0, 0.0

    # Count units
    q = db.query(Unit).filter(Unit.property_id == property_id)
    if plan_id:
        q = q.filter(Unit.development_plan_id == plan_id)
    else:
        q = q.filter(Unit.development_plan_id.is_(None))
    units = q.all()
    total_units = len(units)

    # Calculate EGI
    beds = []
    for u in units:
        beds.extend(db.query(Bed).filter(Bed.unit_id == u.unit_id).all())
    monthly_rent = sum(float(b.monthly_rent or 0) for b in beds)
    annual_rent = monthly_rent * 12
    if annual_rent <= 0 and prop.annual_revenue:
        annual_rent = float(prop.annual_revenue)

    # Add ancillary revenue
    ancillary_streams = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.property_id == property_id,
        AncillaryRevenueStream.development_plan_id == plan_id,
    ).all()
    ancillary_annual = 0.0
    for s in ancillary_streams:
        utilization = float(s.utilization_pct or 100) / 100.0
        monthly = float(s.monthly_rate or 0) * (s.total_count or 0) * utilization
        ancillary_annual += monthly * 12

    other_income = ancillary_annual if ancillary_annual > 0 else float(prop.annual_other_income or 0)
    gross_potential = annual_rent + other_income

    # Apply vacancy (default 5%)
    vacancy_rate = 0.05
    egi = gross_potential * (1 - vacancy_rate)

    return total_units, egi


# ---------------------------------------------------------------------------
# List operating expense line items
# ---------------------------------------------------------------------------

@router.get(
    "/properties/{property_id}/operating-expenses",
    response_model=_List[OperatingExpenseLineItemOut],
)
def list_operating_expenses(
    property_id: int,
    plan_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_investor_or_above),
):
    """List all operating expense line items for a property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    total_units, egi = _get_property_metrics(db, property_id, plan_id)

    q = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.property_id == property_id,
    )
    if plan_id is not None:
        q = q.filter(OperatingExpenseLineItem.development_plan_id == plan_id)
    else:
        q = q.filter(OperatingExpenseLineItem.development_plan_id.is_(None))

    items = q.order_by(OperatingExpenseLineItem.category).all()
    return [_item_to_out(i, total_units, egi) for i in items]


# ---------------------------------------------------------------------------
# Create a new operating expense line item
# ---------------------------------------------------------------------------

@router.post(
    "/properties/{property_id}/operating-expenses",
    response_model=OperatingExpenseLineItemOut,
    status_code=status.HTTP_201_CREATED,
)
def create_operating_expense(
    property_id: int,
    payload: OperatingExpenseLineItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_or_ops),
):
    """Create a new operating expense line item."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    item = OperatingExpenseLineItem(
        property_id=property_id,
        development_plan_id=payload.development_plan_id,
        category=payload.category,
        description=payload.description,
        calc_method=payload.calc_method,
        base_amount=payload.base_amount,
        annual_escalation_pct=payload.annual_escalation_pct,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    total_units, egi = _get_property_metrics(db, property_id, payload.development_plan_id)
    return _item_to_out(item, total_units, egi)


# ---------------------------------------------------------------------------
# Update an operating expense line item
# ---------------------------------------------------------------------------

@router.patch(
    "/operating-expenses/{expense_item_id}",
    response_model=OperatingExpenseLineItemOut,
)
def update_operating_expense(
    expense_item_id: int,
    payload: OperatingExpenseLineItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_or_ops),
):
    """Update an existing operating expense line item."""
    item = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.expense_item_id == expense_item_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Expense item not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    total_units, egi = _get_property_metrics(db, item.property_id, item.development_plan_id)
    return _item_to_out(item, total_units, egi)


# ---------------------------------------------------------------------------
# Delete an operating expense line item
# ---------------------------------------------------------------------------

@router.delete(
    "/operating-expenses/{expense_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_operating_expense(
    expense_item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_or_ops),
):
    """Delete an operating expense line item."""
    item = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.expense_item_id == expense_item_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Expense item not found")

    db.delete(item)
    db.commit()


# ---------------------------------------------------------------------------
# Summary: total operating expenses for a property
# ---------------------------------------------------------------------------

@router.get(
    "/properties/{property_id}/operating-expenses/summary",
    response_model=OperatingExpenseSummary,
)
def operating_expense_summary(
    property_id: int,
    plan_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_investor_or_above),
):
    """Compute total operating expense summary for a property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    total_units, egi = _get_property_metrics(db, property_id, plan_id)

    q = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.property_id == property_id,
    )
    if plan_id is not None:
        q = q.filter(OperatingExpenseLineItem.development_plan_id == plan_id)
    else:
        q = q.filter(OperatingExpenseLineItem.development_plan_id.is_(None))

    items = q.order_by(OperatingExpenseLineItem.category).all()

    total_annual = 0.0
    item_outs = []
    for item in items:
        annual = _compute_annual(item, total_units, egi)
        total_annual += annual
        item_outs.append(_item_to_out(item, total_units, egi))

    expense_ratio = (total_annual / egi * 100) if egi > 0 else 0.0

    return OperatingExpenseSummary(
        property_id=property_id,
        plan_id=plan_id,
        total_units=total_units,
        egi=Decimal(str(round(egi, 2))),
        total_annual_expenses=Decimal(str(round(total_annual, 2))),
        expense_ratio=Decimal(str(round(expense_ratio, 2))),
        items=item_outs,
    )


# ---------------------------------------------------------------------------
# Initialize default expense line items for a property
# ---------------------------------------------------------------------------

@router.post(
    "/properties/{property_id}/operating-expenses/initialize",
    response_model=_List[OperatingExpenseLineItemOut],
    status_code=status.HTTP_201_CREATED,
)
def initialize_operating_expenses(
    property_id: int,
    plan_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_or_ops),
):
    """Initialize default operating expense line items for a property.

    Creates a standard set of expense categories with typical default values
    for multi-family residential properties.  Will not create duplicates if
    items already exist.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Check if items already exist
    existing = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.property_id == property_id,
        OperatingExpenseLineItem.development_plan_id == plan_id,
    ).count()
    if existing > 0:
        raise HTTPException(
            status_code=409,
            detail="Expense items already exist for this property/plan. Delete them first to re-initialize.",
        )

    defaults = [
        {"category": "property_tax", "description": "Property Taxes", "calc_method": "per_unit", "base_amount": 6125, "annual_escalation_pct": 6},
        {"category": "insurance", "description": "Property Insurance", "calc_method": "per_unit", "base_amount": 938, "annual_escalation_pct": 6},
        {"category": "utilities", "description": "Utilities (Heat, Water, Electric)", "calc_method": "per_unit", "base_amount": 2400, "annual_escalation_pct": 6},
        {"category": "salaries", "description": "Salaries / Caretaker", "calc_method": "per_unit", "base_amount": 500, "annual_escalation_pct": 6},
        {"category": "management_fee", "description": "Property Management Fee", "calc_method": "pct_egi", "base_amount": 7, "annual_escalation_pct": 0},
        {"category": "repairs_maintenance", "description": "Repairs & Maintenance", "calc_method": "per_unit", "base_amount": 1000, "annual_escalation_pct": 6},
        {"category": "miscellaneous", "description": "Miscellaneous", "calc_method": "pct_egi", "base_amount": 2, "annual_escalation_pct": 0},
        {"category": "reserves", "description": "Furniture / Appliance Reserve", "calc_method": "per_unit", "base_amount": 300, "annual_escalation_pct": 6},
        {"category": "elevator", "description": "Elevator Maintenance", "calc_method": "per_unit", "base_amount": 0, "annual_escalation_pct": 6},
        {"category": "premium_services", "description": "Premium Services", "calc_method": "per_unit", "base_amount": 0, "annual_escalation_pct": 6},
    ]

    created = []
    for d in defaults:
        item = OperatingExpenseLineItem(
            property_id=property_id,
            development_plan_id=plan_id,
            category=d["category"],
            description=d["description"],
            calc_method=d["calc_method"],
            base_amount=d["base_amount"],
            annual_escalation_pct=d["annual_escalation_pct"],
        )
        db.add(item)
        created.append(item)

    db.commit()
    for item in created:
        db.refresh(item)

    total_units, egi = _get_property_metrics(db, property_id, plan_id)
    return [_item_to_out(i, total_units, egi) for i in created]
