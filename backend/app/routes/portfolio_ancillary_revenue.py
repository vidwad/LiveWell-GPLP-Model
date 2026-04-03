"""
Portfolio Ancillary Revenue routes: CRUD for ancillary revenue streams
(parking, pet fees, storage, bikes, laundry, etc.) attached to a property.
"""
from decimal import Decimal
from typing import List as _List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_gp_or_ops, require_investor_or_above
from app.db.models import AncillaryRevenueStream, Property, User
from app.db.session import get_db
from app.schemas.portfolio import (
    AncillaryRevenueStreamCreate,
    AncillaryRevenueStreamOut,
    AncillaryRevenueStreamUpdate,
)

router = APIRouter()


def _stream_to_out(s: AncillaryRevenueStream) -> AncillaryRevenueStreamOut:
    """Convert ORM object to output schema with computed revenue fields."""
    utilization = float(s.utilization_pct or 100) / 100.0
    monthly = float(s.monthly_rate or 0) * (s.total_count or 0) * utilization
    annual = monthly * 12
    return AncillaryRevenueStreamOut(
        stream_id=s.stream_id,
        property_id=s.property_id,
        development_plan_id=s.development_plan_id,
        stream_type=s.stream_type,
        description=s.description,
        total_count=s.total_count,
        utilization_pct=s.utilization_pct,
        monthly_rate=s.monthly_rate,
        annual_escalation_pct=s.annual_escalation_pct,
        notes=s.notes,
        monthly_revenue=Decimal(str(round(monthly, 2))),
        annual_revenue=Decimal(str(round(annual, 2))),
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


# ---------------------------------------------------------------------------
# List ancillary revenue streams for a property
# ---------------------------------------------------------------------------

@router.get(
    "/properties/{property_id}/ancillary-revenue",
    response_model=_List[AncillaryRevenueStreamOut],
)
def list_ancillary_revenue(
    property_id: int,
    plan_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_investor_or_above),
):
    """List all ancillary revenue streams for a property.

    Optional ``plan_id`` query param filters to streams linked to a specific
    development plan.  If omitted, returns all streams (baseline + plan-specific).
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    q = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.property_id == property_id
    )
    if plan_id is not None:
        q = q.filter(AncillaryRevenueStream.development_plan_id == plan_id)

    streams = q.order_by(AncillaryRevenueStream.stream_type).all()
    return [_stream_to_out(s) for s in streams]


# ---------------------------------------------------------------------------
# Create a new ancillary revenue stream
# ---------------------------------------------------------------------------

@router.post(
    "/properties/{property_id}/ancillary-revenue",
    response_model=AncillaryRevenueStreamOut,
    status_code=status.HTTP_201_CREATED,
)
def create_ancillary_revenue(
    property_id: int,
    payload: AncillaryRevenueStreamCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_or_ops),
):
    """Create a new ancillary revenue stream for a property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    stream = AncillaryRevenueStream(
        property_id=property_id,
        development_plan_id=payload.development_plan_id,
        stream_type=payload.stream_type,
        description=payload.description,
        total_count=payload.total_count,
        utilization_pct=payload.utilization_pct,
        monthly_rate=payload.monthly_rate,
        annual_escalation_pct=payload.annual_escalation_pct,
        notes=payload.notes,
    )
    db.add(stream)
    db.commit()
    db.refresh(stream)
    return _stream_to_out(stream)


# ---------------------------------------------------------------------------
# Update an ancillary revenue stream
# ---------------------------------------------------------------------------

@router.patch(
    "/ancillary-revenue/{stream_id}",
    response_model=AncillaryRevenueStreamOut,
)
def update_ancillary_revenue(
    stream_id: int,
    payload: AncillaryRevenueStreamUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_or_ops),
):
    """Update an existing ancillary revenue stream."""
    stream = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.stream_id == stream_id
    ).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Ancillary revenue stream not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(stream, field, value)

    db.commit()
    db.refresh(stream)
    return _stream_to_out(stream)


# ---------------------------------------------------------------------------
# Delete an ancillary revenue stream
# ---------------------------------------------------------------------------

@router.delete(
    "/ancillary-revenue/{stream_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_ancillary_revenue(
    stream_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_or_ops),
):
    """Delete an ancillary revenue stream."""
    stream = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.stream_id == stream_id
    ).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Ancillary revenue stream not found")

    db.delete(stream)
    db.commit()


# ---------------------------------------------------------------------------
# Summary: total ancillary revenue for a property
# ---------------------------------------------------------------------------

@router.get(
    "/properties/{property_id}/ancillary-revenue/summary",
)
def ancillary_revenue_summary(
    property_id: int,
    plan_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_investor_or_above),
):
    """Compute total ancillary revenue summary for a property.

    Returns per-stream breakdown plus totals.  If ``plan_id`` is provided,
    only includes streams linked to that development plan.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    q = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.property_id == property_id
    )
    if plan_id is not None:
        q = q.filter(AncillaryRevenueStream.development_plan_id == plan_id)

    streams = q.order_by(AncillaryRevenueStream.stream_type).all()

    total_monthly = 0.0
    total_annual = 0.0
    breakdown = []

    for s in streams:
        utilization = float(s.utilization_pct or 100) / 100.0
        monthly = float(s.monthly_rate or 0) * (s.total_count or 0) * utilization
        annual = monthly * 12
        total_monthly += monthly
        total_annual += annual
        breakdown.append({
            "stream_id": s.stream_id,
            "stream_type": s.stream_type,
            "description": s.description,
            "total_count": s.total_count,
            "utilization_pct": float(s.utilization_pct or 100),
            "monthly_rate": float(s.monthly_rate or 0),
            "monthly_revenue": round(monthly, 2),
            "annual_revenue": round(annual, 2),
        })

    return {
        "property_id": property_id,
        "plan_id": plan_id,
        "stream_count": len(streams),
        "total_monthly_revenue": round(total_monthly, 2),
        "total_annual_revenue": round(total_annual, 2),
        "streams": breakdown,
    }
