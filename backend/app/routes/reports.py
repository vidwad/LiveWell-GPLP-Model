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

import datetime as _dt
from typing import Optional
from app.core.deps import get_current_user, require_gp_or_ops
from app.services.reporting import generate_fund_performance_report, generate_management_pack
from app.db.models import (
    Community,
    DebtFacility,
    DevelopmentPlan,
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
from app.services.calculations import calculate_annual_debt_service

router = APIRouter()


@router.get("/fund-performance")
def get_fund_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Get aggregated performance metrics rolled up by LP."""
    return generate_fund_performance_report(db)


@router.get("/management-pack")
def get_management_pack(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """GP monthly management pack: LP summary, property summary, dev update, budget issues."""
    return generate_management_pack(db)


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
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


@router.get("/cash-flow-projection")
def get_cash_flow_projection(
    projection_years: int = 10,
    lp_id: Optional[int] = None,
    rent_growth: float = 3.0,
    expense_growth: float = 2.5,
    vacancy_rate: float = 5.0,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """
    Portfolio-wide cash flow projection.

    Aggregates NOI, debt service, and cash flow for each year across all
    properties (optionally filtered by LP). Uses current rent rolls and debt
    facilities to project forward.
    """
    query = db.query(Property)
    if lp_id:
        query = query.filter(Property.lp_id == lp_id)
    properties = query.all()

    # Build per-property snapshots
    property_snapshots = []
    for prop in properties:
        # Find current NOI from active plan or estimate
        prop_noi = 0.0
        active_plans = [
            p for p in prop.development_plans
            if p.status.value in ("active", "approved")
        ]
        if active_plans:
            plan = active_plans[0]
            if plan.projected_annual_noi:
                prop_noi = float(plan.projected_annual_noi)
            elif plan.projected_annual_revenue:
                prop_noi = float(plan.projected_annual_revenue) * 0.65
        elif prop.purchase_price:
            prop_noi = float(prop.purchase_price) * 0.06

        # Debt service
        debts = (
            db.query(DebtFacility)
            .filter(
                DebtFacility.property_id == prop.property_id,
                DebtFacility.status == "active",
            )
            .all()
        )
        prop_ads = 0.0
        for d in debts:
            if d.outstanding_balance and d.interest_rate:
                prop_ads += calculate_annual_debt_service(
                    float(d.outstanding_balance),
                    float(d.interest_rate),
                    d.amortization_months or 0,
                    d.io_period_months or 0,
                )

        market_value = float(
            prop.current_market_value or prop.purchase_price or 0
        )

        property_snapshots.append({
            "property_id": prop.property_id,
            "address": prop.address,
            "lp_id": prop.lp_id,
            "lp_name": prop.lp_entity.name if prop.lp_entity else None,
            "stage": prop.development_stage.value,
            "current_noi": round(prop_noi, 2),
            "current_ads": round(prop_ads, 2),
            "current_cash_flow": round(prop_noi - prop_ads, 2),
            "market_value": round(market_value, 2),
        })

    # Project forward year by year
    rent_mult = 1 + rent_growth / 100
    expense_mult = 1 + expense_growth / 100
    vacancy_pct = vacancy_rate / 100

    yearly_projections = []
    for year in range(1, projection_years + 1):
        year_total_noi = 0.0
        year_total_ads = 0.0
        year_total_revenue = 0.0
        year_total_expenses = 0.0

        for snap in property_snapshots:
            base_noi = snap["current_noi"]
            base_ads = snap["current_ads"]

            # Revenue grows at rent_growth rate
            # NOI = Revenue * (1 - opex_ratio) where opex_ratio is derived
            if base_noi > 0:
                projected_revenue = (base_noi / 0.65) * (rent_mult ** (year - 1))
                projected_expenses = projected_revenue * 0.35 * (expense_mult ** (year - 1)) / (rent_mult ** (year - 1))
                projected_noi = projected_revenue * (1 - vacancy_pct) - projected_expenses
            else:
                projected_revenue = 0
                projected_expenses = 0
                projected_noi = 0

            year_total_revenue += projected_revenue
            year_total_expenses += projected_expenses
            year_total_noi += projected_noi
            year_total_ads += base_ads  # debt service stays constant

        yearly_projections.append({
            "year": year,
            "gross_revenue": round(year_total_revenue, 2),
            "vacancy_loss": round(year_total_revenue * vacancy_pct, 2),
            "operating_expenses": round(year_total_expenses, 2),
            "noi": round(year_total_noi, 2),
            "debt_service": round(year_total_ads, 2),
            "net_cash_flow": round(year_total_noi - year_total_ads, 2),
            "cumulative_cash_flow": 0.0,  # filled below
        })

    # Compute cumulative
    cumulative = 0.0
    for yp in yearly_projections:
        cumulative += yp["net_cash_flow"]
        yp["cumulative_cash_flow"] = round(cumulative, 2)

    # Summary
    total_current_noi = sum(s["current_noi"] for s in property_snapshots)
    total_current_ads = sum(s["current_ads"] for s in property_snapshots)
    total_market_value = sum(s["market_value"] for s in property_snapshots)

    return {
        "projection_years": projection_years,
        "assumptions": {
            "rent_growth_pct": rent_growth,
            "expense_growth_pct": expense_growth,
            "vacancy_rate_pct": vacancy_rate,
        },
        "current_snapshot": {
            "property_count": len(property_snapshots),
            "total_noi": round(total_current_noi, 2),
            "total_debt_service": round(total_current_ads, 2),
            "total_cash_flow": round(total_current_noi - total_current_ads, 2),
            "total_market_value": round(total_market_value, 2),
        },
        "projections": yearly_projections,
        "properties": property_snapshots,
    }


@router.get("/debt-maturity")
def get_debt_maturity(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """
    Debt maturity calendar — returns all debt facilities with maturity info,
    sorted by maturity date, with urgency classification.
    """
    facilities = (
        db.query(DebtFacility)
        .join(Property, DebtFacility.property_id == Property.property_id)
        .filter(DebtFacility.status == "active")
        .all()
    )

    today = _dt.date.today()
    items = []
    for f in facilities:
        maturity = f.maturity_date
        days_to_maturity = (maturity - today).days if maturity else None
        if days_to_maturity is not None:
            if days_to_maturity < 0:
                urgency = "past_due"
            elif days_to_maturity <= 90:
                urgency = "critical"
            elif days_to_maturity <= 180:
                urgency = "warning"
            elif days_to_maturity <= 365:
                urgency = "upcoming"
            else:
                urgency = "normal"
        else:
            urgency = "unknown"

        items.append({
            "debt_id": f.debt_id,
            "property_id": f.property_id,
            "address": f.property.address if f.property else "Unknown",
            "lp_name": f.property.lp_entity.name if f.property and f.property.lp_entity else None,
            "lender_name": f.lender_name,
            "debt_type": f.debt_type,
            "commitment_amount": float(f.commitment_amount or 0),
            "outstanding_balance": float(f.outstanding_balance or 0),
            "interest_rate": float(f.interest_rate) if f.interest_rate else None,
            "rate_type": f.rate_type,
            "term_months": f.term_months,
            "origination_date": str(f.origination_date) if f.origination_date else None,
            "maturity_date": str(maturity) if maturity else None,
            "days_to_maturity": days_to_maturity,
            "urgency": urgency,
        })

    items.sort(key=lambda x: x["days_to_maturity"] if x["days_to_maturity"] is not None else 99999)

    # Summary stats
    total_outstanding = sum(i["outstanding_balance"] for i in items)
    maturing_12mo = sum(
        i["outstanding_balance"]
        for i in items
        if i["days_to_maturity"] is not None and 0 <= i["days_to_maturity"] <= 365
    )
    maturing_6mo = sum(
        i["outstanding_balance"]
        for i in items
        if i["days_to_maturity"] is not None and 0 <= i["days_to_maturity"] <= 180
    )
    past_due = [i for i in items if i["urgency"] == "past_due"]

    return {
        "summary": {
            "total_facilities": len(items),
            "total_outstanding": round(total_outstanding, 2),
            "maturing_within_6mo": round(maturing_6mo, 2),
            "maturing_within_12mo": round(maturing_12mo, 2),
            "past_due_count": len(past_due),
        },
        "facilities": items,
    }
