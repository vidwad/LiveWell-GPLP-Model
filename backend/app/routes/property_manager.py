"""CRUD routes for PropertyManagerEntity."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import PropertyManagerEntity, User
from app.db.session import get_db
from app.core.deps import get_current_user, require_gp_or_ops, require_gp_ops_pm
from app.schemas.property_manager import (
    PropertyManagerCreate, PropertyManagerOut, PropertyManagerUpdate,
)

router = APIRouter(prefix="/api/property-managers", tags=["Property Managers"])


@router.get("", response_model=list[PropertyManagerOut])
def list_property_managers(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    pms = db.query(PropertyManagerEntity).all()
    results = []
    for pm in pms:
        out = PropertyManagerOut.model_validate(pm)
        out.property_count = len(pm.properties)
        results.append(out)
    return results


@router.post("", response_model=PropertyManagerOut, status_code=status.HTTP_201_CREATED)
def create_property_manager(
    payload: PropertyManagerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    pm = PropertyManagerEntity(**payload.model_dump(exclude_unset=True))
    db.add(pm)
    db.commit()
    db.refresh(pm)
    out = PropertyManagerOut.model_validate(pm)
    out.property_count = 0
    return out


@router.get("/{pm_id}", response_model=PropertyManagerOut)
def get_property_manager(
    pm_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    pm = db.query(PropertyManagerEntity).filter(PropertyManagerEntity.pm_id == pm_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Property manager not found")
    out = PropertyManagerOut.model_validate(pm)
    out.property_count = len(pm.properties)
    return out


@router.patch("/{pm_id}", response_model=PropertyManagerOut)
def update_property_manager(
    pm_id: int,
    payload: PropertyManagerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    pm = db.query(PropertyManagerEntity).filter(PropertyManagerEntity.pm_id == pm_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Property manager not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(pm, k, v)
    db.commit()
    db.refresh(pm)
    out = PropertyManagerOut.model_validate(pm)
    out.property_count = len(pm.properties)
    return out


@router.delete("/{pm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property_manager(
    pm_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    pm = db.query(PropertyManagerEntity).filter(PropertyManagerEntity.pm_id == pm_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Property manager not found")
    if pm.properties:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete property manager with assigned properties. Reassign properties first.",
        )
    db.delete(pm)
    db.commit()
