"""
Interim Operations Service
===========================
Aggregates bed occupancy, rent revenue, operating expenses, and
computes a P&L summary for a community or across all communities.
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, and_, extract
from sqlalchemy.orm import Session

from app.db.models import (
    Bed, BedStatus, Community, OperatingExpense, OperatorBudget,
    RentPayment, Resident, Unit, PaymentStatus,
)


def _d(val) -> float:
    """Convert Decimal/None to float."""
    if val is None:
        return 0.0
    return float(val)


def compute_occupancy(db: Session, community_id: int) -> dict:
    """Compute bed-level occupancy for a community."""
    beds = (
        db.query(Bed)
        .join(Unit, Unit.unit_id == Bed.unit_id)
        .filter(Unit.community_id == community_id)
        .all()
    )
    total_beds = len(beds)
    occupied = sum(1 for b in beds if b.status == BedStatus.occupied)
    available = sum(1 for b in beds if b.status == BedStatus.available)
    maintenance = sum(1 for b in beds if b.status == BedStatus.maintenance)
    reserved = sum(1 for b in beds if b.status == BedStatus.reserved)

    occupancy_rate = (occupied / total_beds * 100) if total_beds > 0 else 0.0
    total_potential_rent = sum(_d(b.monthly_rent) for b in beds)
    occupied_rent = sum(_d(b.monthly_rent) for b in beds if b.status == BedStatus.occupied)

    return {
        "total_beds": total_beds,
        "occupied": occupied,
        "available": available,
        "maintenance": maintenance,
        "reserved": reserved,
        "occupancy_rate": round(occupancy_rate, 1),
        "monthly_potential_rent": round(total_potential_rent, 2),
        "monthly_occupied_rent": round(occupied_rent, 2),
    }


def compute_revenue(
    db: Session, community_id: int,
    year: int, month: Optional[int] = None,
) -> dict:
    """Compute rent revenue for a community for a given year (and optionally month)."""
    query = (
        db.query(RentPayment)
        .join(Resident, Resident.resident_id == RentPayment.resident_id)
        .filter(
            Resident.community_id == community_id,
            RentPayment.period_year == year,
        )
    )
    if month:
        query = query.filter(RentPayment.period_month == month)

    payments = query.all()

    total_billed = sum(_d(p.amount) for p in payments)
    collected = sum(_d(p.amount) for p in payments if p.status == PaymentStatus.paid)
    pending = sum(_d(p.amount) for p in payments if p.status == PaymentStatus.pending)
    overdue = sum(_d(p.amount) for p in payments if p.status == PaymentStatus.overdue)
    meal_plan_revenue = sum(
        _d(p.amount) for p in payments
        if p.includes_meal_plan and p.status == PaymentStatus.paid
    )

    return {
        "total_billed": round(total_billed, 2),
        "collected": round(collected, 2),
        "pending": round(pending, 2),
        "overdue": round(overdue, 2),
        "meal_plan_revenue": round(meal_plan_revenue, 2),
        "collection_rate": round((collected / total_billed * 100) if total_billed > 0 else 0.0, 1),
        "payment_count": len(payments),
    }


def compute_expenses(
    db: Session, community_id: int,
    year: int, month: Optional[int] = None,
) -> dict:
    """Compute operating expenses by category for a community."""
    query = db.query(OperatingExpense).filter(
        OperatingExpense.community_id == community_id,
        OperatingExpense.period_year == year,
    )
    if month:
        query = query.filter(OperatingExpense.period_month == month)

    expenses = query.all()

    by_category: dict[str, float] = {}
    total = 0.0
    for e in expenses:
        cat = e.category.value if hasattr(e.category, 'value') else str(e.category)
        amt = _d(e.amount)
        by_category[cat] = by_category.get(cat, 0.0) + amt
        total += amt

    return {
        "total_expenses": round(total, 2),
        "by_category": {k: round(v, 2) for k, v in sorted(by_category.items())},
        "expense_count": len(expenses),
    }


def compute_budget_vs_actual(
    db: Session, community_id: int, year: int,
) -> dict:
    """Compare budget vs actual for a community."""
    budget = (
        db.query(OperatorBudget)
        .filter(
            OperatorBudget.community_id == community_id,
            OperatorBudget.year == year,
            OperatorBudget.quarter.is_(None),  # annual budget
        )
        .first()
    )
    if not budget:
        # Try to sum quarterly budgets
        quarterly = (
            db.query(OperatorBudget)
            .filter(
                OperatorBudget.community_id == community_id,
                OperatorBudget.year == year,
                OperatorBudget.quarter.isnot(None),
            )
            .all()
        )
        if quarterly:
            budgeted_revenue = sum(_d(q.budgeted_revenue) for q in quarterly)
            budgeted_expenses = sum(_d(q.budgeted_expenses) for q in quarterly)
            budgeted_noi = sum(_d(q.budgeted_noi) for q in quarterly)
            actual_revenue = sum(_d(q.actual_revenue) for q in quarterly)
            actual_expenses = sum(_d(q.actual_expenses) for q in quarterly)
            actual_noi = sum(_d(q.actual_noi) for q in quarterly)
        else:
            return {"has_budget": False}
    else:
        budgeted_revenue = _d(budget.budgeted_revenue)
        budgeted_expenses = _d(budget.budgeted_expenses)
        budgeted_noi = _d(budget.budgeted_noi)
        actual_revenue = _d(budget.actual_revenue)
        actual_expenses = _d(budget.actual_expenses)
        actual_noi = _d(budget.actual_noi)

    return {
        "has_budget": True,
        "budgeted_revenue": round(budgeted_revenue, 2),
        "budgeted_expenses": round(budgeted_expenses, 2),
        "budgeted_noi": round(budgeted_noi, 2),
        "actual_revenue": round(actual_revenue, 2),
        "actual_expenses": round(actual_expenses, 2),
        "actual_noi": round(actual_noi, 2),
        "revenue_variance": round(actual_revenue - budgeted_revenue, 2),
        "expense_variance": round(actual_expenses - budgeted_expenses, 2),
        "noi_variance": round(actual_noi - budgeted_noi, 2),
    }


def compute_community_pnl(
    db: Session, community_id: int,
    year: int, month: Optional[int] = None,
) -> dict:
    """
    Full P&L summary for a community.
    Combines occupancy, revenue, expenses, and budget comparison.
    """
    community = db.query(Community).filter(Community.community_id == community_id).first()
    if not community:
        return {"error": "Community not found"}

    occupancy = compute_occupancy(db, community_id)
    revenue = compute_revenue(db, community_id, year, month)
    expenses = compute_expenses(db, community_id, year, month)
    budget = compute_budget_vs_actual(db, community_id, year)

    # Compute NOI
    noi = revenue["collected"] - expenses["total_expenses"]

    # Revenue per bed (monthly)
    rev_per_bed = (
        revenue["collected"] / occupancy["occupied"]
        if occupancy["occupied"] > 0 else 0.0
    )

    return {
        "community_id": community_id,
        "community_name": community.name,
        "city": community.city,
        "province": community.province,
        "year": year,
        "month": month,
        "occupancy": occupancy,
        "revenue": revenue,
        "expenses": expenses,
        "budget_comparison": budget,
        "summary": {
            "gross_revenue": revenue["total_billed"],
            "collected_revenue": revenue["collected"],
            "total_expenses": expenses["total_expenses"],
            "noi": round(noi, 2),
            "revenue_per_occupied_bed": round(rev_per_bed, 2),
            "expense_ratio": round(
                (expenses["total_expenses"] / revenue["collected"] * 100)
                if revenue["collected"] > 0 else 0.0, 1
            ),
        },
    }


def compute_portfolio_operations_summary(db: Session, year: int) -> dict:
    """Aggregate P&L across all communities."""
    communities = db.query(Community).all()
    results = []
    totals = {
        "total_beds": 0,
        "occupied_beds": 0,
        "gross_revenue": 0.0,
        "collected_revenue": 0.0,
        "total_expenses": 0.0,
        "noi": 0.0,
    }

    for comm in communities:
        pnl = compute_community_pnl(db, comm.community_id, year)
        if "error" in pnl:
            continue
        results.append(pnl)
        totals["total_beds"] += pnl["occupancy"]["total_beds"]
        totals["occupied_beds"] += pnl["occupancy"]["occupied"]
        totals["gross_revenue"] += pnl["summary"]["gross_revenue"]
        totals["collected_revenue"] += pnl["summary"]["collected_revenue"]
        totals["total_expenses"] += pnl["summary"]["total_expenses"]
        totals["noi"] += pnl["summary"]["noi"]

    totals["occupancy_rate"] = round(
        (totals["occupied_beds"] / totals["total_beds"] * 100)
        if totals["total_beds"] > 0 else 0.0, 1
    )

    return {
        "year": year,
        "community_count": len(results),
        "communities": results,
        "portfolio_totals": {k: round(v, 2) if isinstance(v, float) else v for k, v in totals.items()},
    }
