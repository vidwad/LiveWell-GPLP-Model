"""
AI Service — Claude-Powered Intelligence Layer
================================================
Uses Claude API for deep real estate analysis with full platform context.
Falls back to structured mock responses when API key is not configured.

Functions:
  - suggest_property_defaults: Zoning-aware property recommendations
  - analyze_property_risk: Comprehensive risk analysis with financials
  - analyze_underwriting: Full acquisition underwriting memo
  - generate_report_narrative: Quarterly report narrative from data
  - detect_anomalies: Identify issues in trend data
  - chat_with_context: Multi-turn conversation with platform data
"""
import json
import logging
from typing import Optional

from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Claude Client ─────────────────────────────────────────────────────────

_client = None
_HAS_CLAUDE = False

try:
    import anthropic
    if settings.ANTHROPIC_API_KEY:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        _HAS_CLAUDE = True
        logger.info("Claude API initialized (model: %s)", settings.CLAUDE_MODEL)
    else:
        logger.warning("ANTHROPIC_API_KEY not set — AI will use fallback responses")
except ImportError:
    logger.warning("anthropic package not installed — AI will use fallback responses")


SYSTEM_PROMPT = """You are an expert real estate investment analyst and advisor for Living Well Communities,
a Canadian GP/LP platform that acquires, renovates, and operates shared-living communities
(RecoverWell for sober living, StudyWell for students, RetireWell for seniors) in Alberta.

Key context about the business model:
- Properties are acquired as single-family homes, operated with bed-level rent for 6-18 months,
  then redeveloped into 6-10 unit multiplexes with 12-20 beds
- LPs are funded upfront (no capital calls) with tranche-based closings
- Revenue is bed-level rent ($800-$1,800/month per bed depending on type)
- Target returns: 8% preferred return, 80/20 LP/GP split, European-style waterfall
- Key markets: Calgary, Edmonton, Red Deer, Lethbridge, Medicine Hat
- Typical acquisition: $450K-$750K purchase, $1.5M-$2.5M all-in construction cost
- Target cap rates: 5-7% stabilized

When analyzing data, be specific with numbers. Reference actual figures provided.
When giving recommendations, consider the LP investors' interests alongside GP goals.
Always caveat financial projections as estimates requiring professional verification."""


def _call_claude(
    user_message: str,
    system: str = SYSTEM_PROMPT,
    max_tokens: int = 2048,
) -> str:
    """Call Claude API and return the text response."""
    if not _HAS_CLAUDE:
        return ""

    try:
        response = _client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text
    except Exception as e:
        logger.error("Claude API error: %s", e)
        return ""


def _call_claude_json(
    user_message: str,
    system: str = SYSTEM_PROMPT,
    max_tokens: int = 2048,
) -> dict:
    """Call Claude and parse the response as JSON."""
    raw = _call_claude(
        user_message + "\n\nRespond with valid JSON only, no markdown fences.",
        system=system,
        max_tokens=max_tokens,
    )
    if not raw:
        return {}
    # Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse Claude JSON response: %s", text[:200])
        return {}


# ── Structured Output Schemas ─────────────────────────────────────────────

class PropertyDefaultsSuggestion(BaseModel):
    estimated_lot_size: float = Field(description="Estimated lot size in sq ft")
    max_buildable_area: float = Field(description="Maximum buildable area in sq ft based on zoning")
    recommended_units: int = Field(description="Recommended number of units for this zoning")
    estimated_cost_per_sqft: float = Field(description="Estimated construction cost per sq ft in CAD")
    reasoning: str = Field(description="Brief explanation of how these numbers were derived")


class RiskItem(BaseModel):
    category: str = Field(description="Risk category: Financial, Regulatory, Market, or Operational")
    severity: str = Field(description="Severity: Low, Medium, High, or Critical")
    description: str = Field(description="Clear description of the risk")
    mitigation: str = Field(description="Suggested mitigation strategy")


class PropertyRiskAnalysis(BaseModel):
    overall_risk_score: int = Field(description="Overall risk score 1-100 (lower is better)")
    summary: str = Field(description="Executive summary of the risk profile")
    risks: list[RiskItem] = Field(description="List of identified risks")


# ── Service Functions ─────────────────────────────────────────────────────

def suggest_property_defaults(address: str, zoning: str, city: str = "Calgary") -> dict:
    """Use Claude to suggest default values for a new property."""
    prompt = f"""Analyze this property and suggest development defaults:
- Address: {address}
- Zoning: {zoning}
- City: {city}, Alberta

Return JSON with these exact keys:
- estimated_lot_size (float, sq ft)
- max_buildable_area (float, sq ft based on zoning FAR)
- recommended_units (int, based on zoning allowance)
- estimated_cost_per_sqft (float, CAD construction cost)
- reasoning (string, 2-3 sentences explaining your estimates)

Consider Alberta municipal zoning rules:
- R-CG: Contextual Grade-Oriented (up to 4 units, rowhouses)
- R-G: Grade-Oriented (up to 8 units)
- R-MH: Multi-Residential Housing (up to 12+ units)
- R-2: Low Density Residential (up to duplex)"""

    result = _call_claude_json(prompt)
    if result and "estimated_lot_size" in result:
        return result

    # Fallback
    zoning_defaults = {
        "R-CG": (5500, 4400, 4, 310),
        "R-G": (6000, 5400, 8, 295),
        "R-MH": (7000, 6300, 10, 280),
        "R-2": (5000, 3000, 2, 325),
    }
    lot, area, units, cost = zoning_defaults.get(zoning, (5000, 4000, 4, 300))
    return {
        "estimated_lot_size": lot,
        "max_buildable_area": area,
        "recommended_units": units,
        "estimated_cost_per_sqft": cost,
        "reasoning": f"Default estimates for {zoning} zoning in {city}. Configure ANTHROPIC_API_KEY for AI-powered analysis.",
    }


def analyze_property_risk(
    address: str,
    purchase_price: float,
    zoning: str,
    development_stage: str,
    noi: Optional[float] = None,
    debt_balance: Optional[float] = None,
    # NEW: enriched context
    rent_roll_summary: Optional[dict] = None,
    community_occupancy: Optional[dict] = None,
    debt_facilities: Optional[list] = None,
    development_plan: Optional[dict] = None,
) -> dict:
    """Comprehensive risk analysis with full financial context."""
    context_parts = [
        f"Property: {address}",
        f"Purchase Price: ${purchase_price:,.0f}",
        f"Zoning: {zoning}",
        f"Development Stage: {development_stage}",
    ]
    if noi:
        context_parts.append(f"Estimated NOI: ${noi:,.0f}")
    if debt_balance:
        context_parts.append(f"Total Debt: ${debt_balance:,.0f}")
        ltv = (debt_balance / purchase_price * 100) if purchase_price > 0 else 0
        context_parts.append(f"LTV: {ltv:.1f}%")
        if noi and debt_balance > 0:
            # Rough DSCR estimate
            est_ads = debt_balance * 0.065  # ~6.5% blended rate
            dscr = noi / est_ads if est_ads > 0 else 0
            context_parts.append(f"Estimated DSCR: {dscr:.2f}x")

    if rent_roll_summary:
        context_parts.append(f"\nRent Roll: {json.dumps(rent_roll_summary, indent=2)}")
    if community_occupancy:
        context_parts.append(f"\nCommunity Occupancy: {json.dumps(community_occupancy, indent=2)}")
    if debt_facilities:
        context_parts.append(f"\nDebt Facilities: {json.dumps(debt_facilities, indent=2)}")
    if development_plan:
        context_parts.append(f"\nDevelopment Plan: {json.dumps(development_plan, indent=2)}")

    context = "\n".join(context_parts)

    prompt = f"""Perform a comprehensive risk analysis for this real estate investment:

{context}

Return JSON with these exact keys:
- overall_risk_score (int, 1-100, lower is better)
- summary (string, 3-5 sentence executive summary)
- risks (array of objects, each with: category, severity, description, mitigation)

Categories: Financial, Regulatory, Market, Operational
Severity levels: Low, Medium, High, Critical

Include at least 4-6 specific risks based on the actual data provided.
Reference specific numbers (LTV, DSCR, occupancy, etc.) in your analysis."""

    result = _call_claude_json(prompt, max_tokens=3000)
    if result and "overall_risk_score" in result:
        return result

    # Fallback
    risks = []
    score = 40

    if debt_balance and purchase_price > 0:
        ltv = debt_balance / purchase_price * 100
        if ltv > 75:
            risks.append({"category": "Financial", "severity": "High",
                         "description": f"High leverage — LTV of {ltv:.0f}% exceeds typical 65-75% range.",
                         "mitigation": "Consider partial debt paydown or refinancing at lower LTV."})
            score += 15
        elif ltv > 65:
            risks.append({"category": "Financial", "severity": "Medium",
                         "description": f"Moderate leverage — LTV of {ltv:.0f}%.",
                         "mitigation": "Monitor covenant compliance and maintain reserves."})

    if development_stage in ("construction", "planning"):
        risks.append({"category": "Operational", "severity": "Medium",
                     "description": "Construction phase carries timeline and cost overrun risk.",
                     "mitigation": "Track budget vs actual spending; maintain 10% contingency reserve."})
        score += 10

    risks.append({"category": "Regulatory", "severity": "Low",
                 "description": f"Zoning {zoning} may require discretionary development permit.",
                 "mitigation": "Engage planning consultant early in the process."})

    risks.append({"category": "Market", "severity": "Low",
                 "description": "Alberta rental market subject to economic cycle risk.",
                 "mitigation": "Diversify across community types (RecoverWell, StudyWell, RetireWell)."})

    return {
        "overall_risk_score": min(score, 100),
        "summary": f"Analysis for {address}. Configure ANTHROPIC_API_KEY for AI-powered risk assessment.",
        "risks": risks,
    }


def analyze_underwriting(
    property_data: dict,
    lp_data: Optional[dict] = None,
    comparable_properties: Optional[list] = None,
) -> dict:
    """Full acquisition underwriting memo.

    Returns a structured underwriting analysis with go/no-go recommendation.
    """
    context = f"""Property Under Evaluation:
{json.dumps(property_data, indent=2, default=str)}"""

    if lp_data:
        context += f"\n\nLP Fund Context:\n{json.dumps(lp_data, indent=2, default=str)}"
    if comparable_properties:
        context += f"\n\nComparable Properties:\n{json.dumps(comparable_properties, indent=2, default=str)}"

    prompt = f"""You are underwriting a property acquisition for Living Well Communities.

{context}

Produce a comprehensive underwriting memo as JSON with these keys:
- recommendation (string: "strong_buy", "buy", "hold", "pass")
- confidence (int, 1-100)
- executive_summary (string, 3-5 sentences)
- strengths (array of strings, 3-5 key strengths)
- concerns (array of strings, 3-5 key concerns)
- financial_analysis (object with: projected_noi, projected_cap_rate, projected_irr, equity_multiple_estimate)
- sensitivity (object with: downside_noi, base_noi, upside_noi, break_even_occupancy)
- conditions (array of strings — conditions that must be met before proceeding)
- comparable_analysis (string — how this compares to similar properties)"""

    result = _call_claude_json(prompt, max_tokens=3000)
    if result and "recommendation" in result:
        return result

    # Fallback
    price = property_data.get("purchase_price", 0)
    return {
        "recommendation": "hold",
        "confidence": 50,
        "executive_summary": f"Preliminary analysis for {property_data.get('address', 'N/A')}. Configure ANTHROPIC_API_KEY for AI-powered underwriting.",
        "strengths": ["Located in target market", "Zoning supports intended use"],
        "concerns": ["Detailed analysis requires AI integration"],
        "financial_analysis": {
            "projected_noi": None,
            "projected_cap_rate": None,
            "projected_irr": None,
            "equity_multiple_estimate": None,
        },
        "sensitivity": {},
        "conditions": ["Complete due diligence", "Obtain development permit"],
        "comparable_analysis": "Comparable analysis not available without AI integration.",
    }


def generate_report_narrative(
    lp_name: str,
    period: str,
    financial_data: dict,
    occupancy_data: Optional[dict] = None,
    milestones: Optional[list] = None,
    trend_data: Optional[list] = None,
) -> dict:
    """Generate quarterly report narrative sections from data."""
    context = f"""LP Fund: {lp_name}
Period: {period}

Financial Summary:
{json.dumps(financial_data, indent=2, default=str)}"""

    if occupancy_data:
        context += f"\n\nOccupancy Data:\n{json.dumps(occupancy_data, indent=2, default=str)}"
    if milestones:
        context += f"\n\nRecent Milestones:\n{json.dumps(milestones, indent=2, default=str)}"
    if trend_data:
        context += f"\n\nTrend Data (last 6 months):\n{json.dumps(trend_data[-6:], indent=2, default=str)}"

    prompt = f"""Generate professional quarterly report narrative sections for this LP fund.

{context}

Return JSON with these keys:
- executive_summary (string, 4-6 sentences — highlight key metrics, trends, and outlook)
- property_updates (string, 3-5 sentences per property — construction progress, occupancy changes, maintenance)
- market_commentary (string, 3-4 sentences — Alberta rental market conditions, interest rates, outlook)
- investor_outlook (string, 2-3 sentences — forward-looking guidance for investors)

Write in a professional but accessible tone suitable for LP investors.
Reference specific numbers from the data provided."""

    result = _call_claude_json(prompt, max_tokens=3000)
    if result and "executive_summary" in result:
        return result

    return {
        "executive_summary": f"Q{period} report for {lp_name}. Configure ANTHROPIC_API_KEY for AI-generated narratives.",
        "property_updates": "Property updates not available without AI integration.",
        "market_commentary": "Market commentary not available without AI integration.",
        "investor_outlook": "Investor outlook not available without AI integration.",
    }


def detect_anomalies(trend_data: list, entity_name: str) -> dict:
    """Analyze trend data for anomalies and generate alerts."""
    if not trend_data or len(trend_data) < 3:
        return {"anomalies": [], "summary": "Insufficient data for anomaly detection."}

    prompt = f"""Analyze this time-series data for {entity_name} and identify any anomalies,
concerning trends, or items requiring attention:

{json.dumps(trend_data, indent=2, default=str)}

Return JSON with:
- summary (string, 2-3 sentence overview of the data health)
- anomalies (array of objects, each with: metric, period, description, severity, recommendation)
  severity: "info", "warning", "critical"
- trends (array of objects, each with: metric, direction ("improving", "stable", "declining"), description)

Focus on: occupancy drops, revenue declines, expense spikes, NOI deterioration,
LTV increases, collection rate drops."""

    result = _call_claude_json(prompt, max_tokens=2000)
    if result and "anomalies" in result:
        return result

    # Basic fallback anomaly detection
    anomalies = []
    if len(trend_data) >= 2:
        last = trend_data[-1]
        prev = trend_data[-2]
        if last.get("occupancy_rate") and prev.get("occupancy_rate"):
            drop = prev["occupancy_rate"] - last["occupancy_rate"]
            if drop > 5:
                anomalies.append({
                    "metric": "occupancy_rate",
                    "period": last.get("period", "latest"),
                    "description": f"Occupancy dropped {drop:.1f}pp from {prev['occupancy_rate']}% to {last['occupancy_rate']}%",
                    "severity": "warning" if drop < 10 else "critical",
                    "recommendation": "Review vacancy causes and accelerate marketing.",
                })
        if last.get("noi") and prev.get("noi") and prev["noi"] > 0:
            noi_change = (last["noi"] - prev["noi"]) / abs(prev["noi"]) * 100
            if noi_change < -10:
                anomalies.append({
                    "metric": "noi",
                    "period": last.get("period", "latest"),
                    "description": f"NOI declined {abs(noi_change):.1f}% month-over-month",
                    "severity": "warning",
                    "recommendation": "Investigate revenue decline or expense increase.",
                })

    return {
        "summary": f"Basic trend analysis for {entity_name}. Configure ANTHROPIC_API_KEY for intelligent anomaly detection.",
        "anomalies": anomalies,
        "trends": [],
    }


def chat_with_context(
    user_message: str,
    conversation_history: list,
    platform_context: Optional[str] = None,
    db=None,
) -> dict:
    """Multi-turn conversation with tool use.

    When db is provided, Claude can call platform tools to fetch live data.
    Returns {"response": str, "tools_used": list[str]}.
    """
    from app.services.ai_tools import get_tool_definitions, execute_tool

    system = SYSTEM_PROMPT
    if platform_context:
        system += f"\n\nCurrent Platform Data:\n{platform_context}"

    if not _HAS_CLAUDE:
        return {
            "response": (
                "Claude AI is not configured. Set ANTHROPIC_API_KEY in your environment "
                "to enable intelligent analysis. In the meantime, you can explore the "
                "platform's built-in analytics: Portfolio Analytics, LP P&L, NAV calculations, "
                "Pro Forma builder, and Trend Data."
            ),
            "tools_used": [],
        }

    messages = list(conversation_history)
    messages.append({"role": "user", "content": user_message})

    tools = get_tool_definitions() if db else []
    tools_used = []
    max_rounds = 5  # prevent infinite tool loops

    try:
        for _ in range(max_rounds):
            kwargs = {
                "model": settings.CLAUDE_MODEL,
                "max_tokens": 4096,
                "system": system,
                "messages": messages,
            }
            if tools:
                kwargs["tools"] = tools

            response = _client.messages.create(**kwargs)

            # Check if Claude wants to use tools
            if response.stop_reason == "tool_use":
                # Build the assistant message with all content blocks
                assistant_content = []
                for block in response.content:
                    if block.type == "text":
                        assistant_content.append({"type": "text", "text": block.text})
                    elif block.type == "tool_use":
                        assistant_content.append({
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        })

                messages.append({"role": "assistant", "content": assistant_content})

                # Execute each tool call and add results
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        logger.info("Tool call: %s(%s)", block.name, json.dumps(block.input)[:100])
                        tools_used.append(block.name)
                        result_str = execute_tool(db, block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result_str,
                        })

                messages.append({"role": "user", "content": tool_results})
                continue  # Let Claude process the tool results

            # No tool use — extract text response
            text = ""
            for block in response.content:
                if block.type == "text":
                    text += block.text
            return {"response": text, "tools_used": tools_used}

        # Exhausted max rounds
        return {
            "response": "I needed to look up a lot of data to answer that. Here's what I found so far — could you try a more specific question?",
            "tools_used": tools_used,
        }

    except Exception as e:
        logger.error("Claude chat error: %s", e)
        return {
            "response": f"I encountered an error processing your request. Please try again. ({type(e).__name__})",
            "tools_used": tools_used,
        }
