"""
Aggregated analytics / reporting endpoint.
Returns a single JSON payload with KPIs and chart data
so the frontend can build the Reports page without N+1 queries.

Phase 1 Foundation — uses the LP-centric entity model:
  Subscription (commitments) and DistributionAllocation (payouts)
  replace the deprecated CapitalContribution and Distribution models.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.models import (
    Community,
    DistributionAllocation,
    DistributionEvent,
    Holding,
    Investor,
    LPEntity,
    MaintenanceRequest,
    Property,
    RentPayment,
    Resident,
    Subscription,
    Unit,
    User,
)
from app.db.session import get_db

router = APIRouter()


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # --- Properties ---
    properties = db.query(Property).all()
    stage_counts: dict[str, int] = {}
    for p in properties:
        stage_counts[p.development_stage] = stage_counts.get(p.development_stage, 0) + 1

    total_land_value = sum(float(p.purchase_price or 0) for p in properties)

    # --- LP Funds ---
    lps = db.query(LPEntity).all()
    total_lps = len(lps)

    # --- Communities / Units ---
    communities = db.query(Community).all()
    community_type_counts: dict[str, int] = {}
    for c in communities:
        community_type_counts[c.community_type] = (
            community_type_counts.get(c.community_type, 0) + 1
        )

    total_units = db.query(func.count(Unit.unit_id)).scalar() or 0
    occupied_units = (
        db.query(func.count(Unit.unit_id)).filter(Unit.is_occupied == True).scalar() or 0
    )
    occupancy_rate = round(occupied_units / total_units * 100, 1) if total_units else 0.0

    # Occupancy per community
    community_occupancy = []
    for c in communities:
        total = db.query(func.count(Unit.unit_id)).filter(Unit.community_id == c.community_id).scalar() or 0
        occ = db.query(func.count(Unit.unit_id)).filter(
            Unit.community_id == c.community_id, Unit.is_occupied == True
        ).scalar() or 0
        community_occupancy.append({
            "name": c.name,
            "total": total,
            "occupied": occ,
            "vacant": total - occ,
            "rate": round(occ / total * 100, 1) if total else 0.0,
        })

    # --- Residents ---
    total_residents = db.query(func.count(Resident.resident_id)).scalar() or 0

    # --- Rent payments ---
    payment_rows = (
        db.query(
            RentPayment.period_year,
            RentPayment.period_month,
            func.sum(RentPayment.amount).label("total"),
        )
        .group_by(RentPayment.period_year, RentPayment.period_month)
        .order_by(RentPayment.period_year, RentPayment.period_month)
        .all()
    )
    monthly_revenue = [
        {
            "month": f"{row.period_year}-{str(row.period_month).zfill(2)}",
            "revenue": float(row.total),
        }
        for row in payment_rows
    ]
    total_rent_collected = sum(r["revenue"] for r in monthly_revenue)

    # --- Maintenance ---
    maint_rows = db.query(MaintenanceRequest).all()
    maint_by_status: dict[str, int] = {}
    for mr in maint_rows:
        maint_by_status[mr.status] = maint_by_status.get(mr.status, 0) + 1

    resolution_rate = 0.0
    if maint_rows:
        resolved = maint_by_status.get("resolved", 0)
        resolution_rate = round(resolved / len(maint_rows) * 100, 1)

    # --- Investors / Capital ---
    total_investors = db.query(func.count(Investor.investor_id)).scalar() or 0

    # Total committed = sum of all subscription commitment_amounts
    total_committed = float(
        db.query(func.sum(Subscription.commitment_amount)).scalar() or 0
    )
    # Total funded = sum of all subscription funded_amounts
    total_funded = float(
        db.query(func.sum(Subscription.funded_amount)).scalar() or 0
    )
    # Total distributed = sum of all distribution allocations
    total_distributed = float(
        db.query(func.sum(DistributionAllocation.amount)).scalar() or 0
    )
    net_invested = total_funded - total_distributed

    # Capital deployment over time (by subscription funded_date)
    contrib_rows = (
        db.query(
            func.strftime("%Y-%m", Subscription.funded_date).label("month"),
            func.sum(Subscription.funded_amount).label("total"),
        )
        .filter(Subscription.funded_date.isnot(None))
        .group_by(func.strftime("%Y-%m", Subscription.funded_date))
        .order_by(func.strftime("%Y-%m", Subscription.funded_date))
        .all()
    )
    capital_timeline = [
        {"month": row.month, "contributed": float(row.total)}
        for row in contrib_rows
        if row.month
    ]

    return {
        # High-level KPIs
        "total_properties": len(properties),
        "total_lps": total_lps,
        "total_communities": len(communities),
        "total_units": total_units,
        "occupied_units": occupied_units,
        "occupancy_rate": occupancy_rate,
        "total_residents": total_residents,
        "total_investors": total_investors,
        "total_land_value": total_land_value,
        "total_rent_collected": total_rent_collected,
        "total_committed": total_committed,
        "total_funded": total_funded,
        "total_distributed": total_distributed,
        "net_invested": net_invested,
        "maintenance_resolution_rate": resolution_rate,
        # Chart data
        "stage_breakdown": [
            {"stage": k, "count": v} for k, v in stage_counts.items()
        ],
        "community_type_breakdown": [
            {"type": k, "count": v} for k, v in community_type_counts.items()
        ],
        "community_occupancy": community_occupancy,
        "monthly_revenue": monthly_revenue,
        "capital_timeline": capital_timeline,
        "maintenance_by_status": [
            {"status": k, "count": v} for k, v in maint_by_status.items()
        ],
    }
