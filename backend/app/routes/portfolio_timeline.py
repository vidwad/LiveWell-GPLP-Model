"""
Portfolio Timeline — Property lifecycle Gantt data
====================================================
Returns timeline bars for each property showing acquisition, construction,
lease-up, stabilized hold, and planned exit.
"""
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    Property, DevelopmentPlan, DevelopmentStage,
    AcquisitionBaseline, ExitForecast,
    LPEntity, User,
)
from app.core.deps import require_investor_or_above

router = APIRouter()


def _f(val) -> float:
    if val is None:
        return 0.0
    return float(val)


@router.get("/portfolio/timeline")
def get_portfolio_timeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Return timeline data for all properties for a Gantt-style view."""
    properties = db.query(Property).order_by(Property.property_id).all()
    today = date.today()

    # Preload LP names for grouping
    lp_names: dict[int, str] = {
        lp.lp_id: lp.name for lp in db.query(LPEntity).all()
    }

    rows = []
    alerts = []

    for prop in properties:
        pid = prop.property_id
        stage = prop.development_stage.value if prop.development_stage else "prospect"

        # Get acquisition baseline
        baseline = db.query(AcquisitionBaseline).filter(
            AcquisitionBaseline.property_id == pid
        ).first()

        # Get exit forecast
        forecast = db.query(ExitForecast).filter(
            ExitForecast.property_id == pid
        ).first()

        # Get development plans sorted by start date
        plans = db.query(DevelopmentPlan).filter(
            DevelopmentPlan.property_id == pid
        ).order_by(DevelopmentPlan.plan_id).all()

        # Acquisition date
        acq_date = prop.purchase_date
        if not acq_date and baseline:
            acq_date = baseline.purchase_date

        # Hold mandate
        hold_years = int(baseline.target_hold_years) if baseline and baseline.target_hold_years else 7
        exit_year = None
        if forecast and forecast.forecast_sale_year:
            exit_year = int(forecast.forecast_sale_year)
        elif baseline and baseline.target_sale_year:
            exit_year = int(baseline.target_sale_year)
        elif acq_date:
            exit_year = acq_date.year + hold_years

        earliest_sale = None
        latest_sale = None
        if baseline:
            earliest_sale = str(baseline.earliest_sale_date) if baseline.earliest_sale_date else None
            latest_sale = str(baseline.latest_sale_date) if baseline.latest_sale_date else None

        # Build timeline bars
        bars = []

        if acq_date:
            # Interim operation: from acquisition to first plan start (or to exit if no plans)
            first_plan_start = None
            for p in plans:
                if p.development_start_date:
                    first_plan_start = p.development_start_date
                    break

            interim_end = first_plan_start or (date(exit_year, 6, 30) if exit_year else acq_date + timedelta(days=365 * hold_years))
            if acq_date < interim_end:
                bars.append({
                    "type": "interim",
                    "label": "Interim Operations",
                    "start": str(acq_date),
                    "end": str(interim_end),
                    "color": "#3b82f6",  # blue
                })

        # Construction and lease-up bars for each plan
        last_stabilization = None
        for plan in plans:
            start = plan.development_start_date
            if not start:
                continue

            # Construction bar
            duration_days = plan.construction_duration_days or 0
            duration_months = plan.construction_duration_months or 0
            if duration_months > 0 and duration_days == 0:
                duration_days = duration_months * 30

            if duration_days > 0:
                construction_end = plan.estimated_completion_date
                if not construction_end:
                    construction_end = start + timedelta(days=duration_days)

                bars.append({
                    "type": "construction",
                    "label": plan.plan_name or "Construction",
                    "start": str(start),
                    "end": str(construction_end),
                    "color": "#f97316",  # orange
                    "plan_id": plan.plan_id,
                })

                # Lease-up bar
                lease_up_months = plan.lease_up_months or 6
                lease_up_end = plan.estimated_stabilization_date
                if not lease_up_end:
                    lease_up_end = construction_end + timedelta(days=lease_up_months * 30)

                bars.append({
                    "type": "lease_up",
                    "label": "Lease-Up",
                    "start": str(construction_end),
                    "end": str(lease_up_end),
                    "color": "#eab308",  # yellow
                    "plan_id": plan.plan_id,
                })

                last_stabilization = lease_up_end

        # Stabilized hold bar
        if last_stabilization and exit_year:
            exit_date = date(exit_year, 6, 30)
            if last_stabilization < exit_date:
                bars.append({
                    "type": "stabilized",
                    "label": "Stabilized Hold",
                    "start": str(last_stabilization),
                    "end": str(exit_date),
                    "color": "#22c55e",  # green
                })
        elif acq_date and not plans and exit_year:
            # No plans = hold as-is from acquisition to exit
            exit_date = date(exit_year, 6, 30)
            if len(bars) > 0:
                # Already have interim bar, extend it
                pass
            else:
                bars.append({
                    "type": "stabilized",
                    "label": "Hold As-Is",
                    "start": str(acq_date),
                    "end": str(exit_date),
                    "color": "#22c55e",
                })

        # Status determination
        status = "on_track"
        status_label = "On Track"
        for plan in plans:
            if plan.estimated_completion_date and isinstance(plan.estimated_completion_date, date):
                if plan.estimated_completion_date < today and stage in ("construction", "planning"):
                    status = "delayed"
                    status_label = "Behind Schedule"
                    alerts.append({
                        "property": prop.address,
                        "message": f"Construction was due {plan.estimated_completion_date} but property is still in {stage}",
                        "severity": "warning",
                    })

        # Exit proximity alert
        if exit_year and exit_year - today.year <= 1 and stage not in ("exit_planned", "exit_marketed", "exit_under_contract", "exit_closed"):
            alerts.append({
                "property": prop.address,
                "message": f"Exit planned for {exit_year} but property is in {stage} stage",
                "severity": "warning",
            })

        # Same-quarter exit alert (check against other properties)
        # Will be computed after the loop

        sale_status = forecast.sale_status.value if forecast and forecast.sale_status else None

        rows.append({
            "property_id": pid,
            "address": prop.address,
            "city": prop.city,
            "lp_id": prop.lp_id,
            "lp_name": lp_names.get(prop.lp_id) if prop.lp_id else None,
            "stage": stage,
            "status": status,
            "status_label": status_label,
            "sale_status": sale_status,
            "acquisition_date": str(acq_date) if acq_date else None,
            "exit_year": exit_year,
            "earliest_sale": earliest_sale,
            "latest_sale": latest_sale,
            "hold_years": hold_years,
            "plans_count": len(plans),
            "bars": bars,
            "noi": _f(prop.annual_revenue) - _f(prop.annual_expenses) if prop.annual_revenue else None,
            "purchase_price": _f(prop.purchase_price),
        })

    # Check for same-quarter exits
    exit_quarters: dict[str, list[str]] = {}
    for r in rows:
        if r["exit_year"]:
            q = f"{r['exit_year']}-Q3"  # assume mid-year exits
            exit_quarters.setdefault(q, []).append(r["address"])
    for q, props in exit_quarters.items():
        if len(props) > 1:
            alerts.append({
                "property": ", ".join(props),
                "message": f"{len(props)} properties planned to exit in {q}",
                "severity": "info",
            })

    # Summary
    stages = {}
    for r in rows:
        s = r["stage"]
        stages[s] = stages.get(s, 0) + 1

    return {
        "properties": rows,
        "summary": {
            "total": len(rows),
            "by_stage": stages,
        },
        "alerts": alerts,
        "timeline_range": {
            "start": min((r["acquisition_date"] for r in rows if r["acquisition_date"]), default=str(today)),
            "end": str(date(max((r["exit_year"] for r in rows if r["exit_year"]), default=today.year + 7) + 1, 1, 1)),
        },
    }
