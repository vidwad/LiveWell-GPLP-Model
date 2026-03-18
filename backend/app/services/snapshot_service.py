"""
Snapshot Service
================
Captures and queries periodic snapshots for trend analysis.

Usage:
  - capture_community_snapshot(db, community_id, year, month)
  - capture_lp_snapshot(db, lp_id, year, month)
  - capture_all_snapshots(db, year, month) — bulk capture
  - get_trend(db, entity_type, entity_id, metric, months=12)
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import models as m


def capture_community_snapshot(
    db: Session, community_id: int, year: int, month: int
) -> m.PeriodicSnapshot:
    """Capture a point-in-time snapshot for a community."""
    from app.services.operations_service import (
        compute_occupancy, compute_revenue, compute_expenses,
    )

    # Check if snapshot already exists
    existing = db.query(m.PeriodicSnapshot).filter(
        m.PeriodicSnapshot.entity_type == m.SnapshotEntityType.community,
        m.PeriodicSnapshot.entity_id == community_id,
        m.PeriodicSnapshot.year == year,
        m.PeriodicSnapshot.month == month,
    ).first()
    if existing:
        # Update in place
        snap = existing
    else:
        snap = m.PeriodicSnapshot(
            entity_type=m.SnapshotEntityType.community,
            entity_id=community_id,
            year=year,
            month=month,
        )
        db.add(snap)

    occ = compute_occupancy(db, community_id)
    rev = compute_revenue(db, community_id, year, month)
    exp = compute_expenses(db, community_id, year, month)

    snap.total_beds = occ.get("total_beds", 0)
    snap.occupied_beds = occ.get("occupied", 0)
    snap.occupancy_rate = Decimal(str(occ.get("occupancy_rate", 0)))
    snap.gross_revenue = Decimal(str(rev.get("total_billed", 0)))
    snap.collected_revenue = Decimal(str(rev.get("collected", 0)))
    snap.total_expenses = Decimal(str(exp.get("total_expenses", 0)))
    snap.noi = Decimal(str(rev.get("collected", 0))) - Decimal(str(exp.get("total_expenses", 0)))
    snap.captured_at = datetime.utcnow()

    db.flush()
    return snap


def capture_lp_snapshot(
    db: Session, lp_id: int, year: int, month: int
) -> m.PeriodicSnapshot:
    """Capture a point-in-time snapshot for an LP."""
    from app.services.investment_service import compute_lp_summary, compute_lp_nav

    existing = db.query(m.PeriodicSnapshot).filter(
        m.PeriodicSnapshot.entity_type == m.SnapshotEntityType.lp,
        m.PeriodicSnapshot.entity_id == lp_id,
        m.PeriodicSnapshot.year == year,
        m.PeriodicSnapshot.month == month,
    ).first()
    if existing:
        snap = existing
    else:
        snap = m.PeriodicSnapshot(
            entity_type=m.SnapshotEntityType.lp,
            entity_id=lp_id,
            year=year,
            month=month,
        )
        db.add(snap)

    summary = compute_lp_summary(db, lp_id)
    nav_data = compute_lp_nav(db, lp_id)

    snap.total_funded = Decimal(str(summary.get("total_funded", 0)))
    snap.capital_deployed = Decimal(str(summary.get("capital_deployed", 0)))
    snap.property_count = summary.get("property_count", 0)
    snap.investor_count = summary.get("investor_count", 0)

    if "nav" in nav_data and "error" not in nav_data:
        snap.nav = Decimal(str(nav_data["nav"]))
        snap.nav_per_unit = Decimal(str(nav_data.get("nav_per_unit", 0)))
        snap.total_debt = Decimal(str(nav_data.get("components", {}).get("total_outstanding_debt", 0)))
        prop_value = Decimal(str(nav_data.get("components", {}).get("total_property_value", 0)))
        if prop_value > 0 and snap.total_debt:
            snap.portfolio_ltv = (snap.total_debt / prop_value * Decimal("100")).quantize(Decimal("0.01"))

    # Total distributions
    total_dist = db.query(func.coalesce(func.sum(m.DistributionEvent.total_distributable), 0)).filter(
        m.DistributionEvent.lp_id == lp_id,
        m.DistributionEvent.status == m.DistributionEventStatus.paid,
    ).scalar()
    snap.total_distributions = Decimal(str(total_dist or 0))

    snap.captured_at = datetime.utcnow()
    db.flush()
    return snap


def capture_all_snapshots(db: Session, year: int, month: int) -> dict:
    """Capture snapshots for all communities and LPs."""
    communities = db.query(m.Community).all()
    lps = db.query(m.LPEntity).all()

    comm_count = 0
    for c in communities:
        capture_community_snapshot(db, c.community_id, year, month)
        comm_count += 1

    lp_count = 0
    for lp in lps:
        capture_lp_snapshot(db, lp.lp_id, year, month)
        lp_count += 1

    db.commit()
    return {
        "year": year,
        "month": month,
        "communities_captured": comm_count,
        "lps_captured": lp_count,
    }


def get_trend(
    db: Session,
    entity_type: str,
    entity_id: int,
    months: int = 12,
) -> list[dict]:
    """Get time-series snapshots for an entity, most recent first."""
    snaps = (
        db.query(m.PeriodicSnapshot)
        .filter(
            m.PeriodicSnapshot.entity_type == m.SnapshotEntityType(entity_type),
            m.PeriodicSnapshot.entity_id == entity_id,
        )
        .order_by(m.PeriodicSnapshot.year.desc(), m.PeriodicSnapshot.month.desc())
        .limit(months)
        .all()
    )

    # Return oldest first for charting
    results = []
    for s in reversed(snaps):
        row = {
            "year": s.year,
            "month": s.month,
            "period": f"{s.year}-{s.month:02d}",
        }
        # Include all non-null numeric fields
        for field in (
            "total_beds", "occupied_beds", "occupancy_rate",
            "gross_revenue", "collected_revenue", "total_expenses", "noi",
            "total_funded", "capital_deployed", "nav", "nav_per_unit",
            "total_distributions", "total_debt", "portfolio_ltv",
            "property_count", "investor_count",
        ):
            val = getattr(s, field, None)
            if val is not None:
                row[field] = float(val) if isinstance(val, Decimal) else val
        results.append(row)

    return results
