"""
LP AI Investment Commentary Service
====================================
Uses OpenAI (gpt-5.4) to generate expert real estate investment analyst
commentary on a Limited Partnership's projected performance.

The service gathers all available fund data — LP terms, fee structure,
portfolio cash flow, property-level returns, capital pipeline — and
sends a structured briefing to the model with a senior analyst system
prompt. The resulting commentary is stored on the LP record with a
timestamp.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import LPEntity, Property

logger = logging.getLogger(__name__)

SYNTHESIS_MODEL = os.environ.get("OPENAI_COMMENTARY_MODEL", "gpt-5.4")
FALLBACK_MODEL = os.environ.get("OPENAI_COMMENTARY_FALLBACK", "gpt-5.4-mini")


def _decimal_default(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def _build_data_package(db: Session, lp_id: int, current_user: Any) -> dict:
    """Gather all LP data into a structured dict for the AI prompt."""
    from app.services.investment_service import compute_lp_summary

    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise ValueError("LP not found")

    summary = compute_lp_summary(db, lp_id)

    # Fund terms
    fund = {
        "name": lp.name,
        "legal_name": lp.legal_name,
        "lp_number": lp.lp_number,
        "city_focus": lp.city_focus,
        "community_focus": lp.community_focus,
        "purpose_type": lp.purpose_type.value if lp.purpose_type else None,
        "status": lp.status.value if lp.status else "draft",
        "target_raise": float(lp.target_raise or 0),
        "minimum_raise": float(lp.minimum_raise or 0),
        "maximum_raise": float(lp.maximum_raise or 0),
        "unit_price": float(lp.unit_price or 0),
        "minimum_subscription": float(lp.minimum_subscription or 0),
        "offering_date": str(lp.offering_date) if lp.offering_date else None,
        "closing_date": str(lp.closing_date) if lp.closing_date else None,
        "notes": lp.notes,
    }

    # Fee structure
    fees = {
        "preferred_return_rate": float(lp.preferred_return_rate or 0),
        "gp_promote_percent": float(lp.gp_promote_percent or 0),
        "gp_catchup_percent": float(lp.gp_catchup_percent or 0),
        "reserve_percent": float(lp.reserve_percent or 0),
        "formation_costs": float(lp.formation_costs or 0),
        "offering_costs": float(lp.offering_costs or 0),
        "asset_management_fee_percent": float(lp.asset_management_fee_percent or 0),
        "acquisition_fee_percent": float(lp.acquisition_fee_percent or 0),
        "selling_commission_percent": float(lp.selling_commission_percent or 0),
        "construction_management_fee_percent": float(lp.construction_management_fee_percent or 0),
        "refinancing_fee_percent": float(lp.refinancing_fee_percent or 0),
        "turnover_replacement_fee_percent": float(lp.turnover_replacement_fee_percent or 0),
        "lp_profit_share_percent": float(lp.lp_profit_share_percent or 70),
        "gp_profit_share_percent": float(lp.gp_profit_share_percent or 30),
    }

    # Capital summary from computed fields
    capital = {
        "gross_subscriptions": summary.get("gross_subscriptions"),
        "total_funded": summary.get("total_funded"),
        "total_committed": summary.get("total_committed"),
        "net_deployable_capital": summary.get("net_deployable_capital"),
        "capital_deployed": summary.get("capital_deployed"),
        "capital_available": summary.get("capital_available"),
        "investor_count": summary.get("investor_count"),
        "property_count": summary.get("property_count"),
    }

    # Portfolio cashflow + returns (call the endpoint logic directly)
    portfolio_cashflow = None
    try:
        from app.routes.portfolio_performance import get_lp_portfolio_cashflow
        cf = get_lp_portfolio_cashflow(lp_id=lp_id, db=db, current_user=current_user)
        # Simplify for the prompt — strip months arrays to keep token count manageable
        periods_summary = []
        for p in (cf.get("periods") or []):
            periods_summary.append({
                "period": p.get("period"),
                "type": p.get("type"),
                "revenue": p.get("revenue_budget"),
                "expenses": p.get("expenses_budget"),
                "noi": p.get("noi_budget"),
                "debt_service": p.get("debt_service_budget"),
                "construction_cost": p.get("construction_cost"),
                "net_cashflow": p.get("net_cashflow_budget"),
                "cumulative": p.get("cumulative_budget"),
            })
        portfolio_cashflow = {
            "horizon": cf.get("horizon"),
            "returns": cf.get("returns"),
            "periods": periods_summary,
            "by_property": cf.get("by_property"),
            "errors": cf.get("errors"),
        }
    except Exception as e:
        logger.warning(f"Could not fetch portfolio cashflow for LP {lp_id}: {e}")
        portfolio_cashflow = {"error": str(e)}

    # Properties detail
    properties_data = []
    props = db.query(Property).filter(Property.lp_id == lp_id).all()
    for prop in props:
        properties_data.append({
            "property_id": prop.property_id,
            "address": prop.address,
            "city": prop.city,
            "province": prop.province,
            "property_type": str(prop.property_type or ""),
            "development_stage": prop.development_stage.value if hasattr(prop.development_stage, "value") else str(prop.development_stage or ""),
            "purchase_price": float(prop.purchase_price or 0),
            "purchase_date": str(prop.purchase_date) if prop.purchase_date else None,
            "bedrooms": prop.bedrooms,
            "building_sqft": float(prop.building_sqft or 0),
            "year_built": prop.year_built,
        })

    return {
        "fund": fund,
        "fees": fees,
        "capital": capital,
        "portfolio_cashflow": portfolio_cashflow,
        "properties": properties_data,
        "generated_at": datetime.utcnow().isoformat(),
    }


SYSTEM_PROMPT = """You are a senior real estate investment analyst with 20+ years of experience
analyzing Canadian multi-family and specialty residential limited partnerships (LPs).

You have been given a complete data package for an LP fund. Your task is to write a
detailed investment commentary covering:

1. **Executive Summary** — 2-3 sentence overview of the fund, its strategy, and overall assessment.

2. **Capital Structure & Fundraising** — Analysis of target raise vs funded, investor concentration,
   remaining capacity, and subscription pipeline health.

3. **Portfolio Composition** — Property mix by stage (acquisition, construction, stabilized),
   geographic concentration, and diversification assessment.

4. **Projected Financial Performance** — Cash-on-cash returns (initial, stabilized, hold period),
   equity multiple, annualized ROI. Compare to typical Canadian LP benchmarks
   (8-12% stabilized CoC, 1.5-2.0x EM for value-add, 1.8-2.5x for development).

5. **Fee Structure Assessment** — Whether fees are in-line with market (typical: 1-2% asset mgmt,
   1-3% acquisition, 5-8% selling commission, 20-30% GP promote with 6-8% preferred return).

6. **Risk Factors** — Construction risk, lease-up risk, interest rate sensitivity, concentration risk,
   capital deployment timeline, refinancing risk.

7. **Strengths & Opportunities** — What's working well and potential upside.

8. **Analyst Recommendation** — Overall assessment (Strong Buy / Buy / Hold / Underweight / Sell)
   with supporting rationale.

Format your response in clean Markdown with headers (##), bullet points, and bold text for emphasis.
Be specific — reference actual numbers from the data. Be candid and balanced — highlight both
strengths and concerns. Write as if presenting to an institutional LP allocator committee.

If data is missing or incomplete, note that explicitly rather than guessing.
Keep the total commentary to approximately 800-1200 words."""


def generate_commentary(db: Session, lp_id: int, current_user: Any) -> dict:
    """Generate AI investment commentary for an LP. Returns dict with commentary text + metadata."""
    data_package = _build_data_package(db, lp_id, current_user)

    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not configured")

    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    user_message = (
        "Here is the complete data package for this LP fund. "
        "Please provide your investment commentary.\n\n"
        f"```json\n{json.dumps(data_package, default=_decimal_default, indent=2)}\n```"
    )

    model_used = SYNTHESIS_MODEL
    try:
        resp = client.chat.completions.create(
            model=SYNTHESIS_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.4,
            max_completion_tokens=4096,
        )
        commentary = resp.choices[0].message.content
    except Exception as e:
        logger.warning(f"Primary model {SYNTHESIS_MODEL} failed, trying {FALLBACK_MODEL}: {e}")
        model_used = FALLBACK_MODEL
        try:
            resp = client.chat.completions.create(
                model=FALLBACK_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.4,
                max_completion_tokens=4096,
            )
            commentary = resp.choices[0].message.content
        except Exception as e2:
            raise RuntimeError(f"Both models failed. {SYNTHESIS_MODEL}: {e} | {FALLBACK_MODEL}: {e2}")

    # Persist
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    now = datetime.utcnow()
    lp.ai_commentary = commentary
    lp.ai_commentary_updated_at = now
    lp.ai_commentary_model = model_used
    db.commit()
    db.refresh(lp)

    return {
        "commentary": commentary,
        "model": model_used,
        "generated_at": now.isoformat(),
    }
