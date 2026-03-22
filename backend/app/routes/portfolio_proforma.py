"""
Portfolio Pro Forma routes — stabilized pro forma generation, saving, listing.
Split from portfolio.py for maintainability.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as _BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_gp_or_ops, require_investor_or_above
from app.db.models import Property, ProForma, ProFormaStatus, User
from app.db.session import get_db
from app.services.proforma_service import generate_proforma

router = APIRouter()


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
    to build a complete NOI -> DSCR -> valuation analysis.
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
