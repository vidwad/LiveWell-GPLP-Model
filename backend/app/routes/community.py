import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_ops_pm, require_gp_or_ops
from app.db.models import (
    Bed, BedStatus, Community, MaintenanceRequest, MaintenanceStatus, Resident,
    RentPayment, PaymentStatus, Unit, User,
)
from app.db.session import get_db
from app.schemas.community import (
    BedCreate, BedOut,
    CommunityCreate, CommunityOut,
    MaintenanceRequestCreate, MaintenanceRequestOut, MaintenanceRequestUpdate,
    RentPaymentCreate, RentPaymentOut,
    ResidentCreate, ResidentOut,
    UnitCreate, UnitOut,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Communities
# ---------------------------------------------------------------------------

@router.get("/communities", response_model=list[CommunityOut])
def list_communities(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Community).all()


@router.post("/communities", response_model=CommunityOut, status_code=status.HTTP_201_CREATED)
def create_community(
    payload: CommunityCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    community = Community(**payload.model_dump())
    db.add(community)
    db.commit()
    db.refresh(community)
    return community


@router.get("/communities/{community_id}", response_model=CommunityOut)
def get_community(
    community_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    community = db.query(Community).filter(Community.community_id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community


# ---------------------------------------------------------------------------
# Units
# ---------------------------------------------------------------------------

@router.get("/communities/{community_id}/units", response_model=list[UnitOut])
def list_units(
    community_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    community = db.query(Community).filter(Community.community_id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community.units


@router.post(
    "/communities/{community_id}/units",
    response_model=UnitOut,
    status_code=status.HTTP_201_CREATED,
)
def add_unit(
    community_id: int,
    payload: UnitCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    if not db.query(Community).filter(Community.community_id == community_id).first():
        raise HTTPException(status_code=404, detail="Community not found")
    unit = Unit(community_id=community_id, **payload.model_dump())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


# ---------------------------------------------------------------------------
# Beds
# ---------------------------------------------------------------------------

@router.get("/units/{unit_id}/beds", response_model=list[BedOut])
def list_beds(
    unit_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    unit = db.query(Unit).filter(Unit.unit_id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit.beds


@router.post(
    "/units/{unit_id}/beds",
    response_model=BedOut,
    status_code=status.HTTP_201_CREATED,
)
def add_bed(
    unit_id: int,
    payload: BedCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    unit = db.query(Unit).filter(Unit.unit_id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    bed = Bed(unit_id=unit_id, bed_label=payload.bed_label,
              monthly_rent=payload.monthly_rent, rent_type=payload.rent_type)
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@router.patch("/beds/{bed_id}/status")
def update_bed_status(
    bed_id: int,
    new_status: BedStatus,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    bed = db.query(Bed).filter(Bed.bed_id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    bed.status = new_status
    db.commit()
    return {"bed_id": bed_id, "status": new_status.value}


# ---------------------------------------------------------------------------
# Residents
# ---------------------------------------------------------------------------

@router.get("/communities/{community_id}/residents", response_model=list[ResidentOut])
def list_residents(
    community_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    community = db.query(Community).filter(Community.community_id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community.residents


@router.post(
    "/communities/{community_id}/residents",
    response_model=ResidentOut,
    status_code=status.HTTP_201_CREATED,
)
def add_resident(
    community_id: int,
    payload: ResidentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    community = db.query(Community).filter(Community.community_id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    unit = db.query(Unit).filter(
        Unit.unit_id == payload.unit_id, Unit.community_id == community_id
    ).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found in this community")
    resident = Resident(community_id=community_id, **payload.model_dump())
    unit.is_occupied = True
    db.add(resident)
    db.commit()
    db.refresh(resident)
    return resident


@router.delete("/residents/{resident_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    resident = db.query(Resident).filter(Resident.resident_id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    unit = db.query(Unit).filter(Unit.unit_id == resident.unit_id).first()
    if unit:
        remaining = db.query(Resident).filter(
            Resident.unit_id == unit.unit_id,
            Resident.resident_id != resident_id,
        ).count()
        if remaining == 0:
            unit.is_occupied = False
    db.delete(resident)
    db.commit()


# ---------------------------------------------------------------------------
# Rent Payments
# ---------------------------------------------------------------------------

@router.get("/residents/{resident_id}/payments", response_model=list[RentPaymentOut])
def list_payments(
    resident_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    if not db.query(Resident).filter(Resident.resident_id == resident_id).first():
        raise HTTPException(status_code=404, detail="Resident not found")
    return db.query(RentPayment).filter(RentPayment.resident_id == resident_id).all()


@router.post(
    "/residents/{resident_id}/payments",
    response_model=RentPaymentOut,
    status_code=status.HTTP_201_CREATED,
)
def record_payment(
    resident_id: int,
    payload: RentPaymentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    if not db.query(Resident).filter(Resident.resident_id == resident_id).first():
        raise HTTPException(status_code=404, detail="Resident not found")
    payment = RentPayment(
        resident_id=resident_id,
        status=PaymentStatus.paid,
        **payload.model_dump(),
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


# ---------------------------------------------------------------------------
# Maintenance Requests
# ---------------------------------------------------------------------------

@router.get("/maintenance", response_model=list[MaintenanceRequestOut])
def list_maintenance(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    return db.query(MaintenanceRequest).all()


@router.post(
    "/maintenance",
    response_model=MaintenanceRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def create_maintenance_request(
    payload: MaintenanceRequestCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    req = MaintenanceRequest(
        created_at=datetime.datetime.utcnow(),
        **payload.model_dump(),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.patch("/maintenance/{request_id}", response_model=MaintenanceRequestOut)
def update_maintenance(
    request_id: int,
    payload: MaintenanceRequestUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    req = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.request_id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    req.status = payload.status
    if payload.status == MaintenanceStatus.resolved and payload.resolved_at:
        req.resolved_at = payload.resolved_at
    elif payload.status == MaintenanceStatus.resolved:
        req.resolved_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(req)
    return req
