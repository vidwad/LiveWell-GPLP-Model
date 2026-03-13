"""
Quarterly Report Generation Service
=====================================
Generates quarterly investor reports for LP funds, aggregating financial data
from properties, distributions, and operating metrics.
"""
import json
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import (
    LPEntity, Property, DebtFacility, DevelopmentPlan,
    DistributionEvent, DistributionAllocation, DistributionEventStatus,
    Community, Bed, BedStatus, Resident, RentPayment,
    QuarterlyReport, QuarterlyReportStatus, OperatingExpense,
)


def _quarter_months(quarter: int) -> list[int]:
    """Return the months belonging to a quarter (1-indexed)."""
    return {1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]}[quarter]


def generate_quarterly_report(
    lp_id: int,
    quarter: int,
    year: int,
    db: Session,
    generated_by: Optional[int] = None,
) -> QuarterlyReport:
    """
    Generate a quarterly report for an LP fund.

    Aggregates:
    - Revenue from rent payments across all properties in the LP
    - Operating expenses from communities
    - Distribution totals for the quarter
    - Portfolio valuation and LTV
    - Per-property narrative updates
    """
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise ValueError(f"LP entity {lp_id} not found")

    months = _quarter_months(quarter)
    period_label = f"Q{quarter} {year}"

    properties = db.query(Property).filter(Property.lp_id == lp_id).all()

    # --- Revenue ---
    total_revenue = Decimal("0")
    for prop in properties:
        communities = db.query(Community).filter(
            Community.property_id == prop.property_id
        ).all()
        for comm in communities:
            payments = db.query(RentPayment).join(Resident).filter(
                Resident.community_id == comm.community_id,
                RentPayment.period_year == year,
                RentPayment.period_month.in_(months),
            ).all()
            total_revenue += sum((p.amount for p in payments), Decimal("0"))

    # --- Expenses ---
    total_expenses = Decimal("0")
    for prop in properties:
        communities = db.query(Community).filter(
            Community.property_id == prop.property_id
        ).all()
        for comm in communities:
            expenses = db.query(OperatingExpense).filter(
                OperatingExpense.community_id == comm.community_id,
                OperatingExpense.period_year == year,
                OperatingExpense.period_month.in_(months),
            ).all()
            total_expenses += sum((e.amount for e in expenses), Decimal("0"))

    noi = total_revenue - total_expenses

    # --- Distributions ---
    dist_events = db.query(DistributionEvent).filter(
        DistributionEvent.lp_id == lp_id,
        DistributionEvent.period_label == period_label,
    ).all()
    total_distributions = Decimal("0")
    for event in dist_events:
        total_distributions += event.total_distributable or Decimal("0")

    # --- Portfolio Value & LTV ---
    portfolio_value = Decimal("0")
    total_debt = Decimal("0")
    for prop in properties:
        val = prop.estimated_value or prop.current_market_value or prop.purchase_price or Decimal("0")
        portfolio_value += val
        debts = db.query(DebtFacility).filter(
            DebtFacility.property_id == prop.property_id,
            DebtFacility.status == "active",
        ).all()
        total_debt += sum((d.outstanding_balance or Decimal("0") for d in debts), Decimal("0"))

    portfolio_ltv = (
        (total_debt / portfolio_value * 100) if portfolio_value > 0 else Decimal("0")
    )

    # --- Per-Property Updates ---
    property_updates = []
    for prop in properties:
        communities = db.query(Community).filter(
            Community.property_id == prop.property_id
        ).all()

        total_beds = 0
        occupied_beds = 0
        for comm in communities:
            from app.db.models import Unit
            beds = db.query(Bed).join(Unit).filter(
                Unit.community_id == comm.community_id,
            ).all()
            total_beds += len(beds)
            occupied_beds += sum(1 for b in beds if b.status == BedStatus.occupied)

        occupancy = (occupied_beds / total_beds * 100) if total_beds > 0 else 0

        property_updates.append({
            "property_id": prop.property_id,
            "address": prop.address,
            "city": prop.city,
            "stage": prop.development_stage.value,
            "total_beds": total_beds,
            "occupied_beds": occupied_beds,
            "occupancy_percent": round(occupancy, 1),
            "communities": [c.name for c in communities],
        })

    # --- Create Report ---
    report = QuarterlyReport(
        lp_id=lp_id,
        period_label=period_label,
        quarter=quarter,
        year=year,
        status=QuarterlyReportStatus.draft,
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        net_operating_income=noi,
        total_distributions=total_distributions,
        portfolio_value=portfolio_value,
        portfolio_ltv=portfolio_ltv,
        executive_summary=_generate_executive_summary(
            lp.name, period_label, total_revenue, noi, portfolio_value, portfolio_ltv
        ),
        property_updates=json.dumps(property_updates),
        generated_at=datetime.utcnow(),
        generated_by=generated_by,
    )
    db.add(report)
    db.flush()
    return report


def _generate_executive_summary(
    lp_name: str,
    period_label: str,
    revenue: Decimal,
    noi: Decimal,
    portfolio_value: Decimal,
    ltv: Decimal,
) -> str:
    """Generate a basic executive summary narrative."""
    return (
        f"**{lp_name} — {period_label} Quarterly Report**\n\n"
        f"During {period_label}, the fund generated ${revenue:,.2f} in total revenue "
        f"with a net operating income of ${noi:,.2f}. "
        f"The portfolio is currently valued at ${portfolio_value:,.2f} "
        f"with a loan-to-value ratio of {ltv:.1f}%. "
        f"Management continues to focus on operational efficiency and "
        f"maintaining strong occupancy levels across all communities."
    )
