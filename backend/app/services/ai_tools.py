"""
AI Tool Definitions & Executor
================================
Defines tools that Claude can call during conversation to fetch
live platform data. Each tool maps to an existing service function.

Usage:
    tools = get_tool_definitions()
    result = execute_tool(db, tool_name, tool_input)
"""
import json
import logging
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ── Tool Definitions (Claude format) ──────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "get_lp_summary",
        "description": "Get summary of an LP fund including total committed, funded, deployed capital, investor count, and property count. Use when user asks about a specific fund's status or capital position.",
        "input_schema": {
            "type": "object",
            "properties": {
                "lp_id": {"type": "integer", "description": "LP fund ID (1 or 2)"}
            },
            "required": ["lp_id"],
        },
    },
    {
        "name": "get_lp_nav",
        "description": "Get Net Asset Value for an LP fund. Returns NAV, NAV per unit, property values, debt, and premium/discount to original unit price.",
        "input_schema": {
            "type": "object",
            "properties": {
                "lp_id": {"type": "integer", "description": "LP fund ID"}
            },
            "required": ["lp_id"],
        },
    },
    {
        "name": "get_property_detail",
        "description": "Get details of a specific property including address, city, stage, purchase price, market value, LP, community, and development plan.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {"type": "integer", "description": "Property ID"}
            },
            "required": ["property_id"],
        },
    },
    {
        "name": "list_properties",
        "description": "List all properties in the portfolio, optionally filtered by LP fund. Returns address, city, stage, purchase price for each.",
        "input_schema": {
            "type": "object",
            "properties": {
                "lp_id": {"type": "integer", "description": "Optional: filter by LP fund ID"}
            },
            "required": [],
        },
    },
    {
        "name": "get_investor_holdings",
        "description": "Get an investor's holdings across all LPs — units held, capital contributed, unreturned capital, ownership percentage.",
        "input_schema": {
            "type": "object",
            "properties": {
                "investor_id": {"type": "integer", "description": "Investor ID"}
            },
            "required": ["investor_id"],
        },
    },
    {
        "name": "list_investors",
        "description": "List all investors with their names and IDs. Use to find an investor ID before looking up their holdings.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_community_occupancy",
        "description": "Get real-time bed occupancy for a community — total beds, occupied, available, maintenance, occupancy rate, monthly rent potential.",
        "input_schema": {
            "type": "object",
            "properties": {
                "community_id": {"type": "integer", "description": "Community ID"}
            },
            "required": ["community_id"],
        },
    },
    {
        "name": "list_communities",
        "description": "List all communities with their IDs, names, cities, and types.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_community_pnl",
        "description": "Get P&L summary for a community — revenue, expenses, NOI, collection rate, budget vs actual.",
        "input_schema": {
            "type": "object",
            "properties": {
                "community_id": {"type": "integer", "description": "Community ID"},
                "year": {"type": "integer", "description": "Year (default 2025)"},
            },
            "required": ["community_id"],
        },
    },
    {
        "name": "run_waterfall",
        "description": "Simulate a distribution waterfall for an LP fund. Shows how a given amount would be split across holders by tier (return of capital, preferred return, GP catch-up, carried interest).",
        "input_schema": {
            "type": "object",
            "properties": {
                "lp_id": {"type": "integer", "description": "LP fund ID"},
                "distributable_amount": {"type": "number", "description": "Amount to distribute in dollars"},
            },
            "required": ["lp_id", "distributable_amount"],
        },
    },
    {
        "name": "get_proforma",
        "description": "Generate a stabilized pro forma for a property — NOI, DSCR, cap rate, cash-on-cash, valuation. All computed from current rent roll and debt.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {"type": "integer", "description": "Property ID"},
                "vacancy_rate": {"type": "number", "description": "Vacancy rate percentage (default 5.0)"},
                "cap_rate_assumption": {"type": "number", "description": "Cap rate for implied valuation (default 5.5)"},
            },
            "required": ["property_id"],
        },
    },
    {
        "name": "get_trend_data",
        "description": "Get time-series trend data (occupancy, revenue, NOI, NAV) for a community or LP fund. Useful for spotting trends over months.",
        "input_schema": {
            "type": "object",
            "properties": {
                "entity_type": {"type": "string", "enum": ["community", "lp"], "description": "Type of entity"},
                "entity_id": {"type": "integer", "description": "Community ID or LP ID"},
                "months": {"type": "integer", "description": "Number of months of history (default 12)"},
            },
            "required": ["entity_type", "entity_id"],
        },
    },
    {
        "name": "get_vacancy_alerts",
        "description": "Get vacancy alerts across all communities — beds vacant beyond threshold, revenue at risk, severity levels.",
        "input_schema": {
            "type": "object",
            "properties": {
                "threshold_days": {"type": "integer", "description": "Days vacant threshold (default 14)"},
            },
            "required": [],
        },
    },
    {
        "name": "get_portfolio_analytics",
        "description": "Get cross-LP portfolio analytics — total AUM, funded capital, NAV, deployment ratio, investor count. Use for big-picture portfolio questions.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_debt_facilities",
        "description": "Get all debt facilities for a property — lender, type, balance, interest rate, status, amortization.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {"type": "integer", "description": "Property ID"}
            },
            "required": ["property_id"],
        },
    },
    {
        "name": "recall_past_decisions",
        "description": "Search institutional memory for relevant past decisions. Use when the user asks about past experiences, precedents, or 'what happened last time'. Returns decisions with outcomes and lessons learned.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["acquisition", "disposition", "distribution", "refinancing", "construction", "subscription", "stage_transition", "operational", "strategic"],
                    "description": "Decision category to search",
                },
                "city": {"type": "string", "description": "Filter by city name (e.g. 'Red Deer', 'Calgary')"},
                "lp_id": {"type": "integer", "description": "Filter by LP fund ID"},
                "property_id": {"type": "integer", "description": "Filter by property ID"},
                "limit": {"type": "integer", "description": "Max results (default 5)"},
            },
            "required": [],
        },
    },
    {
        "name": "log_decision",
        "description": "Record a business decision to institutional memory. Use when the user says 'remember this', 'log this decision', or wants to record an outcome or lesson learned.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["acquisition", "disposition", "distribution", "refinancing", "construction", "subscription", "stage_transition", "operational", "strategic", "other"],
                    "description": "Decision category",
                },
                "title": {"type": "string", "description": "Short title for the decision"},
                "description": {"type": "string", "description": "Detailed description of the decision and reasoning"},
                "property_id": {"type": "integer", "description": "Related property ID (if applicable)"},
                "lp_id": {"type": "integer", "description": "Related LP fund ID (if applicable)"},
                "amount": {"type": "number", "description": "Dollar amount involved (if applicable)"},
                "outcome": {"type": "string", "enum": ["positive", "neutral", "negative", "pending"], "description": "Decision outcome"},
                "lessons_learned": {"type": "string", "description": "Key lessons or takeaways"},
                "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags for future retrieval (e.g. ['red_deer', 'over_budget'])"},
            },
            "required": ["category", "title", "description"],
        },
    },
]


def get_tool_definitions() -> list[dict]:
    return TOOL_DEFINITIONS


# ── Tool Executor ─────────────────────────────────────────────────────────

def _json_safe(obj: Any) -> Any:
    """Convert Decimal and other non-serializable types to JSON-safe values."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(i) for i in obj]
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return obj


def execute_tool(db: Session, tool_name: str, tool_input: dict) -> str:
    """Execute a tool call and return the result as a JSON string."""
    try:
        result = _dispatch_tool(db, tool_name, tool_input)
        return json.dumps(_json_safe(result), default=str)
    except Exception as e:
        logger.error("Tool execution error (%s): %s", tool_name, e)
        return json.dumps({"error": str(e)})


def _dispatch_tool(db: Session, name: str, inp: dict) -> Any:
    """Route a tool call to the appropriate service function."""

    if name == "get_lp_summary":
        from app.services.investment_service import compute_lp_summary
        from app.db.models import LPEntity
        lp = db.query(LPEntity).filter(LPEntity.lp_id == inp["lp_id"]).first()
        summary = compute_lp_summary(db, inp["lp_id"])
        summary["name"] = lp.name if lp else "Unknown"
        summary["status"] = lp.status.value if lp and lp.status else "unknown"
        return summary

    elif name == "get_lp_nav":
        from app.services.investment_service import compute_lp_nav
        return compute_lp_nav(db, inp["lp_id"])

    elif name == "get_property_detail":
        from app.db.models import Property, DebtFacility, DevelopmentPlan
        prop = db.query(Property).filter(Property.property_id == inp["property_id"]).first()
        if not prop:
            return {"error": "Property not found"}
        plan = db.query(DevelopmentPlan).filter(DevelopmentPlan.property_id == prop.property_id).first()
        debts = db.query(DebtFacility).filter(DebtFacility.property_id == prop.property_id).all()
        return {
            "property_id": prop.property_id,
            "address": prop.address,
            "city": prop.city,
            "province": prop.province,
            "development_stage": prop.development_stage.value if prop.development_stage else None,
            "purchase_price": prop.purchase_price,
            "current_market_value": prop.current_market_value,
            "assessed_value": prop.assessed_value,
            "zoning": prop.zoning,
            "lp_name": prop.lp.name if prop.lp else None,
            "community_name": prop.community.name if prop.community else None,
            "plan": {
                "planned_units": plan.planned_units,
                "planned_beds": plan.planned_beds,
                "estimated_cost": plan.estimated_construction_cost,
                "projected_noi": plan.projected_annual_noi,
            } if plan else None,
            "total_debt": sum(float(d.outstanding_balance or 0) for d in debts),
            "debt_count": len(debts),
        }

    elif name == "list_properties":
        from app.db.models import Property
        query = db.query(Property)
        if inp.get("lp_id"):
            query = query.filter(Property.lp_id == inp["lp_id"])
        props = query.all()
        return [{
            "property_id": p.property_id,
            "address": p.address,
            "city": p.city,
            "stage": p.development_stage.value if p.development_stage else None,
            "purchase_price": p.purchase_price,
            "lp_name": p.lp.name if p.lp else None,
        } for p in props]

    elif name == "get_investor_holdings":
        from app.db.models import Investor, Holding
        inv = db.query(Investor).filter(Investor.investor_id == inp["investor_id"]).first()
        if not inv:
            return {"error": "Investor not found"}
        holdings = db.query(Holding).filter(Holding.investor_id == inp["investor_id"]).all()
        return {
            "investor_name": inv.name,
            "holdings": [{
                "lp_name": h.lp.name if h.lp else None,
                "units_held": h.units_held,
                "total_capital": h.total_capital_contributed,
                "unreturned_capital": h.unreturned_capital,
                "is_gp": h.is_gp,
                "status": h.status,
            } for h in holdings],
            "total_capital": sum(float(h.total_capital_contributed or 0) for h in holdings),
        }

    elif name == "list_investors":
        from app.db.models import Investor
        investors = db.query(Investor).order_by(Investor.name).all()
        return [{"investor_id": i.investor_id, "name": i.name, "email": i.email} for i in investors]

    elif name == "get_community_occupancy":
        from app.services.operations_service import compute_occupancy
        return compute_occupancy(db, inp["community_id"])

    elif name == "list_communities":
        from app.db.models import Community
        comms = db.query(Community).all()
        return [{"community_id": c.community_id, "name": c.name, "city": c.city,
                 "type": c.community_type.value if c.community_type else None} for c in comms]

    elif name == "get_community_pnl":
        from app.services.operations_service import compute_community_pnl
        year = inp.get("year", 2025)
        return compute_community_pnl(db, inp["community_id"], year)

    elif name == "run_waterfall":
        from app.services.investment_service import compute_waterfall
        return compute_waterfall(db, inp["lp_id"], Decimal(str(inp["distributable_amount"])))

    elif name == "get_proforma":
        from app.services.proforma_service import generate_proforma
        return generate_proforma(
            db, inp["property_id"],
            vacancy_rate=inp.get("vacancy_rate", 5.0),
            cap_rate_assumption=inp.get("cap_rate_assumption", 5.5),
        )

    elif name == "get_trend_data":
        from app.services.snapshot_service import get_trend
        return get_trend(db, inp["entity_type"], inp["entity_id"], inp.get("months", 12))

    elif name == "get_vacancy_alerts":
        # Simplified — call the service directly
        from app.db.models import Community, Unit, Bed, BedStatus
        comms = db.query(Community).all()
        total_vacant = 0
        total_risk = 0.0
        for c in comms:
            units = db.query(Unit).filter(Unit.community_id == c.community_id).all()
            for u in units:
                for b in u.beds:
                    if b.status == BedStatus.available:
                        total_vacant += 1
                        total_risk += float(b.monthly_rent or 0)
        return {"total_vacant_beds": total_vacant, "monthly_revenue_at_risk": round(total_risk, 2)}

    elif name == "get_portfolio_analytics":
        from app.services.investment_service import compute_lp_summary, compute_lp_nav
        from app.db.models import LPEntity
        lps = db.query(LPEntity).all()
        funds = []
        for lp in lps:
            s = compute_lp_summary(db, lp.lp_id)
            funds.append({
                "name": lp.name,
                "status": lp.status.value if lp.status else "draft",
                "funded": s.get("total_funded", 0),
                "deployed": s.get("capital_deployed", 0),
                "properties": s.get("property_count", 0),
                "investors": s.get("investor_count", 0),
            })
        return {"fund_count": len(funds), "funds": funds}

    elif name == "get_debt_facilities":
        from app.db.models import DebtFacility
        debts = db.query(DebtFacility).filter(DebtFacility.property_id == inp["property_id"]).all()
        return [{
            "lender": d.lender_name,
            "type": d.debt_type.value if d.debt_type else None,
            "status": d.status.value if d.status else None,
            "balance": d.outstanding_balance,
            "rate": d.interest_rate,
            "amort_months": d.amortization_months,
            "io_months": d.io_period_months,
        } for d in debts]

    elif name == "recall_past_decisions":
        from app.services.decision_memory import search_decisions
        return search_decisions(
            db,
            category=inp.get("category"),
            property_id=inp.get("property_id"),
            lp_id=inp.get("lp_id"),
            city=inp.get("city"),
            limit=inp.get("limit", 5),
        )

    elif name == "log_decision":
        from app.services.decision_memory import log_decision
        from datetime import date
        d = log_decision(
            db,
            category=inp["category"],
            title=inp["title"],
            description=inp["description"],
            decision_date=date.today(),
            property_id=inp.get("property_id"),
            lp_id=inp.get("lp_id"),
            amount=inp.get("amount"),
            outcome=inp.get("outcome", "pending"),
            lessons_learned=inp.get("lessons_learned"),
            tags=inp.get("tags"),
        )
        db.commit()
        return {"decision_id": d.decision_id, "title": d.title, "message": "Decision logged to institutional memory."}

    else:
        return {"error": f"Unknown tool: {name}"}
