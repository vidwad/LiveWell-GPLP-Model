"""
Decision Memory Service
========================
Stores and retrieves institutional knowledge — past decisions with
context, outcomes, and lessons learned. Used by the AI assistant
to provide experience-informed recommendations.

Functions:
  - log_decision: Store a new decision
  - search_decisions: Find relevant past decisions by category/entity/tags
  - get_decision_context_for_ai: Format decisions as AI context
"""
import json
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db import models as m

logger = logging.getLogger(__name__)


def log_decision(
    db: Session,
    category: str,
    title: str,
    description: str,
    decision_date: date,
    decision_maker_id: Optional[int] = None,
    property_id: Optional[int] = None,
    lp_id: Optional[int] = None,
    investor_id: Optional[int] = None,
    amount: Optional[float] = None,
    context_snapshot: Optional[dict] = None,
    outcome: str = "pending",
    outcome_notes: Optional[str] = None,
    lessons_learned: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> m.DecisionLog:
    """Log a business decision to institutional memory."""
    decision = m.DecisionLog(
        category=m.DecisionCategory(category),
        title=title,
        description=description,
        decision_date=decision_date,
        decision_maker=decision_maker_id,
        property_id=property_id,
        lp_id=lp_id,
        investor_id=investor_id,
        amount=Decimal(str(amount)) if amount else None,
        context_snapshot=json.dumps(context_snapshot, default=str) if context_snapshot else None,
        outcome=m.DecisionOutcome(outcome),
        outcome_notes=outcome_notes,
        lessons_learned=lessons_learned,
        tags=",".join(tags) if tags else None,
    )
    db.add(decision)
    db.flush()
    return decision


def search_decisions(
    db: Session,
    category: Optional[str] = None,
    property_id: Optional[int] = None,
    lp_id: Optional[int] = None,
    investor_id: Optional[int] = None,
    tags: Optional[list[str]] = None,
    city: Optional[str] = None,
    limit: int = 10,
) -> list[dict]:
    """Search past decisions by various criteria."""
    query = db.query(m.DecisionLog).order_by(m.DecisionLog.decision_date.desc())

    if category:
        query = query.filter(m.DecisionLog.category == m.DecisionCategory(category))
    if property_id:
        query = query.filter(m.DecisionLog.property_id == property_id)
    if lp_id:
        query = query.filter(m.DecisionLog.lp_id == lp_id)
    if investor_id:
        query = query.filter(m.DecisionLog.investor_id == investor_id)
    if tags:
        # Match any of the provided tags
        tag_filters = [m.DecisionLog.tags.contains(t) for t in tags]
        query = query.filter(or_(*tag_filters))
    if city:
        # Search in context_snapshot or join through property
        query = query.join(
            m.Property, m.DecisionLog.property_id == m.Property.property_id, isouter=True
        ).filter(
            or_(
                m.Property.city.ilike(f"%{city}%"),
                m.DecisionLog.description.ilike(f"%{city}%"),
            )
        )

    decisions = query.limit(limit).all()

    results = []
    for d in decisions:
        results.append({
            "decision_id": d.decision_id,
            "category": d.category.value if d.category else None,
            "title": d.title,
            "description": d.description,
            "decision_date": str(d.decision_date) if d.decision_date else None,
            "amount": float(d.amount) if d.amount else None,
            "outcome": d.outcome.value if d.outcome else "pending",
            "outcome_notes": d.outcome_notes,
            "lessons_learned": d.lessons_learned,
            "tags": d.tags.split(",") if d.tags else [],
            "property_address": d.property.address if d.property else None,
            "property_city": d.property.city if d.property else None,
            "lp_name": d.lp.name if d.lp else None,
            "investor_name": d.investor.name if d.investor else None,
        })

    return results


def get_decision_context_for_ai(
    db: Session,
    category: Optional[str] = None,
    property_id: Optional[int] = None,
    lp_id: Optional[int] = None,
    city: Optional[str] = None,
    limit: int = 5,
) -> str:
    """Format relevant past decisions as a context string for AI prompts.

    Returns a concise summary of relevant decisions that Claude can
    reference when advising on similar situations.
    """
    decisions = search_decisions(
        db, category=category, property_id=property_id,
        lp_id=lp_id, city=city, limit=limit,
    )

    if not decisions:
        return ""

    lines = ["INSTITUTIONAL MEMORY — Relevant Past Decisions:"]
    for d in decisions:
        line = f"- [{d['decision_date']}] {d['title']}"
        if d.get("amount"):
            line += f" (${d['amount']:,.0f})"
        if d.get("outcome") and d["outcome"] != "pending":
            line += f" → Outcome: {d['outcome']}"
        lines.append(line)
        if d.get("lessons_learned"):
            lines.append(f"  Lesson: {d['lessons_learned']}")
        elif d.get("outcome_notes"):
            lines.append(f"  Note: {d['outcome_notes']}")

    return "\n".join(lines)
