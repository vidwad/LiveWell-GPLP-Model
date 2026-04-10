"""
AI Construction Budget Estimation
==================================
Uses OpenAI to generate professional construction budget line items
based on development plan details, unit configuration, and property context.
"""
import json
import re
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    Property, DevelopmentPlan, Unit, ConstructionExpense, User,
)
from app.core.deps import require_gp_or_ops

router = APIRouter()


class AIBudgetRequest(BaseModel):
    plan_id: int


@router.post("/properties/{property_id}/ai-construction-budget")
def generate_ai_construction_budget(
    property_id: int,
    payload: AIBudgetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Use OpenAI to generate professional construction budget line items.

    Pulls context from the development plan (description, units, sqft, cost estimate)
    and generates categorized expense line items a professional builder would use.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    plan = db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == payload.plan_id).first()
    if not plan:
        raise HTTPException(404, "Development plan not found")

    # Get plan units for context
    units = db.query(Unit).filter(
        Unit.property_id == property_id,
        Unit.development_plan_id == payload.plan_id,
    ).all()

    total_beds = sum(u.bed_count or 0 for u in units)
    total_sqft = sum(float(u.sqft or 0) for u in units)

    # Get OpenAI API key
    from app.db.models import PlatformSetting
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured")

    try:
        from openai import OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")

    client = OpenAI(api_key=api_key)

    # Build context
    budget_target = float(plan.estimated_construction_cost or 0)
    description = getattr(plan, 'description', None) or plan.plan_name or "Development project"

    prompt = f"""You are a professional construction cost estimator for residential multi-family housing in {prop.city}, {prop.province}, Canada.

Generate a detailed construction budget for the following project:

PROJECT DETAILS:
- Property: {prop.address}, {prop.city}, {prop.province}
- Property Type: {prop.property_type or 'Residential'}
- Year Built: {prop.year_built or 'Unknown'}
- Existing Building: {float(prop.building_sqft or 0):,.0f} sqft
- Plan: {plan.plan_name}
- Description: {description}
- Planned Units: {plan.planned_units}
- Planned Beds: {plan.planned_beds or total_beds}
- Planned Sqft: {float(plan.planned_sqft or total_sqft):,.0f}
- Target Budget: ${budget_target:,.0f}
- Duration: {plan.construction_duration_days or 180} days

Generate a JSON array of construction expense line items. Each item must have:
- "category": one of "hard_cost", "soft_cost", "site_cost", "financing_cost", "contingency"
- "description": specific expense item name
- "budgeted_amount": estimated cost in dollars (number, no formatting)
- "notes": brief explanation

REQUIREMENTS:
1. Hard costs should include: demolition, framing, roofing, exterior, windows/doors, insulation, drywall, flooring, kitchen/bath fixtures, plumbing, electrical, HVAC, painting, fire safety, accessibility
2. Soft costs should include: architectural/design fees, engineering, permits/municipal fees, legal, insurance during construction, project management
3. Site costs should include: excavation, foundation work, landscaping, parking/paving, utilities connections
4. Financing costs should include: construction loan interest reserve, lender fees, appraisal/inspection fees
5. Contingency should be a single line item at 10% of total hard + soft costs
6. Total should approximately equal the target budget of ${budget_target:,.0f}
7. Use realistic Calgary/Alberta pricing for 2024-2026
8. If the project is a renovation (not new build), adjust items accordingly — skip foundation/excavation, reduce structural costs

Return ONLY a valid JSON array. No markdown, no explanation, just the array."""

    try:
        response = client.chat.completions.create(
            model="gpt-5.4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_completion_tokens=3000,
        )
        content = response.choices[0].message.content or "[]"

        # Strip markdown code fences if present
        content = re.sub(r'^```(?:json)?\s*', '', content.strip())
        content = re.sub(r'\s*```$', '', content.strip())

        items = json.loads(content)
        if not isinstance(items, list):
            raise ValueError("Expected array")

    except json.JSONDecodeError:
        raise HTTPException(500, "AI returned invalid JSON")
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {str(e)[:200]}")

    # Save to database
    created = 0
    for item in items:
        expense = ConstructionExpense(
            property_id=property_id,
            plan_id=payload.plan_id,
            category=item.get("category", "hard_cost"),
            description=item.get("description", ""),
            budgeted_amount=Decimal(str(item.get("budgeted_amount", 0))),
            actual_amount=Decimal("0"),
            notes=item.get("notes", ""),
        )
        db.add(expense)
        created += 1

    # Update plan's cost breakdown totals
    hard = sum(i.get("budgeted_amount", 0) for i in items if i.get("category") == "hard_cost")
    soft = sum(i.get("budgeted_amount", 0) for i in items if i.get("category") == "soft_cost")
    site = sum(i.get("budgeted_amount", 0) for i in items if i.get("category") == "site_cost")
    financing = sum(i.get("budgeted_amount", 0) for i in items if i.get("category") == "financing_cost")
    contingency = sum(i.get("budgeted_amount", 0) for i in items if i.get("category") == "contingency")
    total = hard + soft + site + financing + contingency

    plan.hard_costs = Decimal(str(round(hard, 2)))
    plan.soft_costs = Decimal(str(round(soft, 2)))
    plan.site_costs = Decimal(str(round(site, 2)))
    plan.financing_costs = Decimal(str(round(financing, 2)))
    plan.estimated_construction_cost = Decimal(str(round(total, 2)))
    plan.contingency_percent = Decimal(str(round(contingency / (hard + soft) * 100, 1))) if (hard + soft) > 0 else Decimal("10")

    db.commit()

    return {
        "created": created,
        "total_budget": round(total, 2),
        "breakdown": {
            "hard_costs": round(hard, 2),
            "soft_costs": round(soft, 2),
            "site_costs": round(site, 2),
            "financing_costs": round(financing, 2),
            "contingency": round(contingency, 2),
        },
        "items": items,
    }
