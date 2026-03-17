import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_ops_pm, require_gp_or_ops
from app.db.models import (
    Bed, BedStatus, Community, MaintenanceRequest, MaintenanceStatus, Property, Resident,
    RentPayment, PaymentStatus, RenovationPhase, Unit, User,
)
from app.db.session import get_db
from app.schemas.community import (
    BedCreate, BedOut,
    CommunityCreate, CommunityOut, CommunityUpdate,
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
    try:
        db.commit()
        db.refresh(community)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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


@router.patch("/communities/{community_id}", response_model=CommunityOut)
def update_community(
    community_id: int,
    payload: CommunityUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    community = db.query(Community).filter(Community.community_id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(community, k, v)
    try:
        db.commit()
        db.refresh(community)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return community


# ---------------------------------------------------------------------------
# Community Properties (aggregated view)
# ---------------------------------------------------------------------------

@router.get("/communities/{community_id}/properties")
def list_community_properties(
    community_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    community = db.query(Community).filter(Community.community_id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    results = []
    for prop in community.properties:
        # Only count baseline (pre-renovation) units for occupancy —
        # post-renovation units are planned/projected and not yet leasable.
        units = [u for u in prop.units if u.renovation_phase != RenovationPhase.post_renovation]
        total_units = len(units)
        total_beds = sum(u.bed_count for u in units)
        occupied_beds = sum(
            1 for u in units for b in u.beds if b.status == BedStatus.occupied
        )
        vacant_beds = total_beds - occupied_beds
        monthly_rent = float(sum(
            b.monthly_rent for u in units for b in u.beds if b.monthly_rent
        ))
        results.append({
            "property_id": prop.property_id,
            "address": prop.address,
            "city": prop.city,
            "development_stage": prop.development_stage.value if prop.development_stage else None,
            "total_units": total_units,
            "total_beds": total_beds,
            "occupied_beds": occupied_beds,
            "vacant_beds": vacant_beds,
            "occupancy_rate": round(occupied_beds / total_beds * 100, 1) if total_beds > 0 else 0,
            "monthly_rent": monthly_rent,
        })
    return results


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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    try:
        db.commit()
        db.refresh(resident)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


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
    try:
        db.commit()
        db.refresh(payment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    try:
        db.commit()
        db.refresh(req)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    try:
        db.commit()
        db.refresh(req)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return req


# ---------------------------------------------------------------------------
# Interim Operations P&L Dashboard
# ---------------------------------------------------------------------------

from app.services.operations_service import (
    compute_community_pnl,
    compute_occupancy,
    compute_portfolio_operations_summary,
)


@router.get("/communities/{community_id}/pnl")
def get_community_pnl(
    community_id: int,
    year: int = 2026,
    month: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Full P&L summary for a community: occupancy, revenue, expenses, NOI, budget comparison."""
    result = compute_community_pnl(db, community_id, year, month)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/communities/{community_id}/occupancy")
def get_community_occupancy(
    community_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Real-time bed occupancy snapshot for a community."""
    comm = db.query(Community).filter(Community.community_id == community_id).first()
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    return compute_occupancy(db, community_id)


@router.get("/operations/portfolio-summary")
def get_portfolio_operations_summary(
    year: int = 2026,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Aggregate P&L across all communities for the operations dashboard."""
    return compute_portfolio_operations_summary(db, year)


# ---------------------------------------------------------------------------
# Task 6: Vacancy Tracking and Alerts
# ---------------------------------------------------------------------------

@router.get("/operations/vacancy-alerts")
def get_vacancy_alerts(
    threshold_days: int = 14,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """Identify beds/units that have been vacant beyond a threshold.

    Returns vacancy alerts across all communities, grouped by community.
    """
    from datetime import date, timedelta

    communities = db.query(Community).all()
    alerts = []
    summary = {"total_vacant_beds": 0, "alerts_count": 0, "communities_affected": 0}

    for comm in communities:
        community_alerts = []
        units = db.query(Unit).filter(Unit.community_id == comm.community_id).all()

        for unit in units:
            beds = db.query(Bed).filter(Bed.unit_id == unit.unit_id).all()
            for bed in beds:
                if bed.status == BedStatus.available:
                    # Check when this bed was last occupied by looking at move_out_date of last resident
                    last_resident = (
                        db.query(Resident)
                        .filter(Resident.bed_id == bed.bed_id)
                        .order_by(Resident.move_out_date.desc().nullslast())
                        .first()
                    )
                    vacant_since = None
                    days_vacant = 0
                    if last_resident and last_resident.move_out_date:
                        vacant_since = last_resident.move_out_date
                        if isinstance(vacant_since, str):
                            vacant_since = date.fromisoformat(vacant_since)
                        days_vacant = (date.today() - vacant_since).days
                    else:
                        # Bed has never been occupied or no move_out recorded
                        days_vacant = 999  # flag as long-term vacant

                    if days_vacant >= threshold_days:
                        lost_monthly = float(bed.monthly_rent or 0)
                        community_alerts.append({
                            "bed_id": bed.bed_id,
                            "bed_label": bed.bed_label,
                            "unit_id": unit.unit_id,
                            "unit_number": unit.unit_number,
                            "monthly_rent": lost_monthly,
                            "vacant_since": str(vacant_since) if vacant_since else None,
                            "days_vacant": days_vacant if days_vacant < 999 else None,
                            "estimated_monthly_loss": lost_monthly,
                            "severity": "critical" if days_vacant >= 60 else "warning" if days_vacant >= 30 else "info",
                        })

                elif bed.status == BedStatus.maintenance:
                    community_alerts.append({
                        "bed_id": bed.bed_id,
                        "bed_label": bed.bed_label,
                        "unit_id": unit.unit_id,
                        "unit_number": unit.unit_number,
                        "monthly_rent": float(bed.monthly_rent or 0),
                        "vacant_since": None,
                        "days_vacant": None,
                        "estimated_monthly_loss": float(bed.monthly_rent or 0),
                        "severity": "maintenance",
                    })

        if community_alerts:
            summary["communities_affected"] += 1
            summary["alerts_count"] += len(community_alerts)
            summary["total_vacant_beds"] += len(community_alerts)
            total_lost = sum(a["estimated_monthly_loss"] for a in community_alerts)
            alerts.append({
                "community_id": comm.community_id,
                "community_name": comm.name,
                "city": comm.city,
                "alert_count": len(community_alerts),
                "monthly_revenue_at_risk": round(total_lost, 2),
                "beds": community_alerts,
            })

    summary["total_monthly_revenue_at_risk"] = round(
        sum(a["monthly_revenue_at_risk"] for a in alerts), 2
    )

    return {
        "threshold_days": threshold_days,
        "summary": summary,
        "communities": alerts,
    }
