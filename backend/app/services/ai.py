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
    # Enriched context
    rent_roll_summary: Optional[dict] = None,
    community_occupancy: Optional[dict] = None,
    debt_facilities: Optional[list] = None,
    development_plan: Optional[dict] = None,
    property_details: Optional[dict] = None,
) -> dict:
    """Comprehensive risk analysis with full financial context."""
    context_parts = [
        f"Property: {address}",
        f"Purchase Price: ${purchase_price:,.0f}",
        f"Zoning: {zoning}",
        f"Development Stage: {development_stage}",
    ]
    if property_details:
        if property_details.get("year_built"):
            context_parts.append(f"Year Built: {property_details['year_built']}")
        if property_details.get("property_type"):
            context_parts.append(f"Property Type: {property_details['property_type']}")
        if property_details.get("building_sqft"):
            context_parts.append(f"Building Size: {property_details['building_sqft']:,.0f} sqft")
        if property_details.get("neighbourhood"):
            context_parts.append(f"Neighbourhood: {property_details['neighbourhood']}")
        if property_details.get("assessment_class"):
            context_parts.append(f"Assessment Class: {property_details['assessment_class']}")
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
    max_rounds = 8  # allow complex multi-tool queries

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


# ── Grant & Funding Research ─────────────────────────────────────────────

def research_funding_opportunities(
    community_type: str,
    city: str,
    province: str = "Alberta",
    property_count: int = 0,
    bed_count: int = 0,
    current_programs: Optional[list] = None,
) -> dict:
    """Use Claude to research government and institutional funding opportunities.

    Searches Claude's knowledge for relevant Canadian/Alberta programs for:
    - Affordable housing grants
    - Supportive housing funding
    - Community development programs
    - Energy efficiency / green building incentives
    - Municipal development incentives

    Returns structured list of opportunities with eligibility, amounts, and deadlines.
    """
    current_str = ""
    if current_programs:
        current_str = f"\n\nWe already have/applied for:\n" + "\n".join(f"- {p}" for p in current_programs)

    prompt = f"""Research government and institutional funding opportunities for a shared-living
community development company in {city}, {province}, Canada.

Our profile:
- Community type: {community_type} ({"sober living / addiction recovery" if community_type == "RecoverWell" else "student housing" if community_type == "StudyWell" else "seniors housing / assisted living"})
- Location: {city}, {province}
- Properties: {property_count} (converting single-family homes to multi-unit shared living)
- Total beds: {bed_count}
- Business model: LP-funded real estate syndication, bed-level rent, community operations
{current_str}

Research and return JSON with these exact keys:
- opportunities (array of objects, each with):
  - program_name (string — official program name)
  - funding_source (string — government body or institution, e.g. "CMHC", "Government of Alberta", "City of Calgary")
  - program_type (string — "grant", "loan", "tax_incentive", "development_incentive", "operating_subsidy")
  - description (string — 2-3 sentences about the program)
  - estimated_amount (string — typical funding range, e.g. "$50,000 - $500,000 per project")
  - eligibility_summary (string — key eligibility criteria)
  - application_notes (string — how to apply, typical timeline)
  - relevance_score (int 1-10 — how relevant this is for our specific situation)
  - url_hint (string — where to find more info, e.g. "cmhc-schl.gc.ca" or "alberta.ca/affordable-housing")
- summary (string — 2-3 sentence overview of the funding landscape)
- total_potential (string — estimated total potential funding across all opportunities)
- recommended_priority (array of strings — top 3 programs to apply for first)

Focus on REAL Canadian programs. Include federal (CMHC, CMHC Rapid Housing Initiative, National Housing Strategy),
provincial (Alberta Affordable Housing, Alberta Seniors Housing), and municipal programs.
For {community_type} specifically, look for addiction recovery funding, mental health housing,
student housing grants, or seniors care programs as applicable.
Return 6-10 opportunities ranked by relevance."""

    result = _call_claude_json(prompt, max_tokens=4000)
    if result and "opportunities" in result:
        return result

    # Fallback with known real programs
    return {
        "opportunities": [
            {
                "program_name": "CMHC Rapid Housing Initiative",
                "funding_source": "CMHC (Federal)",
                "program_type": "grant",
                "description": "Capital funding for new affordable housing units. Covers up to 100% of eligible costs for rapid construction or conversion projects.",
                "estimated_amount": "$200,000 - $500,000 per project",
                "eligibility_summary": "Must create affordable units for vulnerable populations. Priority for supportive housing.",
                "application_notes": "Rounds announced periodically. Check cmhc-schl.gc.ca for current intake.",
                "relevance_score": 9,
                "url_hint": "cmhc-schl.gc.ca/rapid-housing",
            },
            {
                "program_name": "National Housing Co-Investment Fund",
                "funding_source": "CMHC (Federal)",
                "program_type": "loan",
                "description": "Low-interest loans and contributions for new construction and major renovation of community/affordable housing.",
                "estimated_amount": "Up to $4M loan + $1M contribution per project",
                "eligibility_summary": "Must achieve energy efficiency, accessibility, and affordability targets.",
                "application_notes": "Rolling intake. Requires detailed project plan and financial pro forma.",
                "relevance_score": 8,
                "url_hint": "cmhc-schl.gc.ca/nhcf",
            },
            {
                "program_name": "Alberta Affordable Housing Partnership Program",
                "funding_source": "Government of Alberta",
                "program_type": "grant",
                "description": "Provincial funding to increase affordable housing supply through partnerships with private and non-profit developers.",
                "estimated_amount": "$100,000 - $300,000 per project",
                "eligibility_summary": "Projects must serve households below median income. Supportive housing eligible.",
                "application_notes": "Contact Alberta Seniors, Community and Social Services for current intake.",
                "relevance_score": 7,
                "url_hint": "alberta.ca/affordable-housing",
            },
        ],
        "summary": f"Multiple federal and provincial programs support {community_type} housing in Alberta. Configure ANTHROPIC_API_KEY for comprehensive AI-powered research.",
        "total_potential": "$500,000 - $2,000,000+",
        "recommended_priority": ["CMHC Rapid Housing Initiative", "National Housing Co-Investment Fund", "Alberta Affordable Housing Partnership Program"],
    }


# ── Investor Communication Drafts ────────────────────────────────────────

COMM_TYPES = {
    "distribution_notice": {
        "label": "Distribution Notice",
        "description": "Notify an investor about an upcoming or completed distribution payment.",
        "tone": "Professional and clear. Include the exact amount, period, payment method, and breakdown by tier if available.",
    },
    "quarterly_update": {
        "label": "Quarterly Update",
        "description": "Personalized quarterly portfolio update for an investor.",
        "tone": "Warm but professional. Highlight their specific holdings, any distributions received, property milestones relevant to their fund, and forward outlook.",
    },
    "welcome_letter": {
        "label": "Welcome Letter",
        "description": "Welcome a new investor after their subscription is funded.",
        "tone": "Warm and welcoming. Introduce the team, explain what to expect (quarterly reports, distributions, portal access), and thank them for their trust.",
    },
    "capital_confirmation": {
        "label": "Capital Receipt Confirmation",
        "description": "Confirm receipt of an investor's capital contribution.",
        "tone": "Formal and precise. Confirm the exact amount, unit price, units issued, and subscription details.",
    },
    "year_end_summary": {
        "label": "Year-End Summary",
        "description": "Annual summary of an investor's position, distributions received, and tax information.",
        "tone": "Comprehensive and clear. Summarize the year's activity: total distributions, current holdings value, capital account changes, and note that T5013 will follow.",
    },
    "milestone_update": {
        "label": "Property Milestone Update",
        "description": "Inform an investor about a significant property milestone (construction complete, occupancy target reached, refinance, etc.).",
        "tone": "Enthusiastic but factual. Explain the milestone, its impact on the fund, and what comes next.",
    },
    "custom": {
        "label": "Custom Communication",
        "description": "Free-form investor communication with AI assistance.",
        "tone": "Match the tone specified in the additional context.",
    },
}


def draft_investor_communication(
    comm_type: str,
    investor_data: dict,
    holdings_data: Optional[list] = None,
    distribution_data: Optional[dict] = None,
    lp_data: Optional[dict] = None,
    milestones: Optional[list] = None,
    additional_context: Optional[str] = None,
) -> dict:
    """Draft a personalized investor communication.

    Returns: {"subject": str, "body": str, "comm_type": str}
    """
    type_info = COMM_TYPES.get(comm_type, COMM_TYPES["custom"])

    context_parts = [
        f"Communication Type: {type_info['label']}",
        f"Purpose: {type_info['description']}",
        f"Tone: {type_info['tone']}",
        f"\nInvestor Details:\n{json.dumps(investor_data, indent=2, default=str)}",
    ]

    if holdings_data:
        context_parts.append(f"\nHoldings:\n{json.dumps(holdings_data, indent=2, default=str)}")
    if distribution_data:
        context_parts.append(f"\nDistribution Details:\n{json.dumps(distribution_data, indent=2, default=str)}")
    if lp_data:
        context_parts.append(f"\nLP Fund Info:\n{json.dumps(lp_data, indent=2, default=str)}")
    if milestones:
        context_parts.append(f"\nRecent Milestones:\n{json.dumps(milestones, indent=2, default=str)}")
    if additional_context:
        context_parts.append(f"\nAdditional Context: {additional_context}")

    context = "\n".join(context_parts)

    prompt = f"""Draft a professional investor communication for Living Well Communities.

{context}

Return JSON with these exact keys:
- subject (string — email subject line, concise and clear)
- body (string — full email body in plain text, with proper greeting and sign-off)

The communication should be from "Living Well Communities GP" signed by "The Living Well Team".
Address the investor by their first name.
Include specific dollar amounts, dates, and percentages from the data provided.
Do NOT use markdown formatting in the body — use plain text with line breaks."""

    result = _call_claude_json(prompt, max_tokens=2000)
    if result and "subject" in result:
        result["comm_type"] = comm_type
        return result

    # Fallback
    name = investor_data.get("name", "Investor")
    first_name = name.split()[0] if name else "Investor"
    return {
        "subject": f"{type_info['label']} — Living Well Communities",
        "body": (
            f"Dear {first_name},\n\n"
            f"This is a {type_info['label'].lower()} from Living Well Communities.\n\n"
            f"Configure ANTHROPIC_API_KEY for AI-generated personalized communications.\n\n"
            f"Regards,\nThe Living Well Team"
        ),
        "comm_type": comm_type,
    }


# ── Area Research ────────────────────────────────────────────────────────

def research_property_area(
    address: str,
    city: str,
    province: str = "Alberta",
    radius_miles: float = 2.0,
    zoning: Optional[str] = None,
    property_type: Optional[str] = None,
    additional_context: Optional[str] = None,
    subject_lat: Optional[float] = None,
    subject_lng: Optional[float] = None,
) -> dict:
    """AI-powered area research for real estate due diligence.

    Generates a comprehensive research report covering comparable sales,
    active listings, zoning, rents, demographics, and development activity
    within the specified radius of the property.
    """
    context_parts = [
        f"Property Address: {address}",
        f"City: {city}, {province}, Canada",
        f"Search Radius: {radius_miles} miles",
    ]
    if subject_lat and subject_lng:
        context_parts.append(f"EXACT Subject Property Coordinates: lat={subject_lat}, lng={subject_lng}")
        context_parts.append(f"USE THESE EXACT COORDINATES as the center point. All nearby properties must be within {radius_miles} miles of this point.")
    if zoning:
        context_parts.append(f"Current Zoning: {zoning}")
    if property_type:
        context_parts.append(f"Property Type: {property_type}")
    if additional_context:
        context_parts.append(f"Additional Context: {additional_context}")

    context = "\n".join(context_parts)

    prompt = f"""Conduct a comprehensive area research report for a real estate investment opportunity.

{context}

You are an expert Alberta real estate analyst. Based on your knowledge of this area, provide a detailed
research report. Use realistic, current data points and ranges typical for this specific neighbourhood.

Return JSON with these exact keys:

1. "summary" (string) — 3-4 sentence executive summary of the area as an investment location

2. "subject_location" (object) — the approximate lat/lng of the subject property:
   - lat (number — latitude, e.g. 51.0447)
   - lng (number — longitude, e.g. -114.0719)

3. "comparable_sales" (array of objects) — 4-6 recent comparable property sales within the radius, each with:
   - address (string — realistic street name in the area)
   - lat (number — approximate latitude)
   - lng (number — approximate longitude)
   - sale_price (number)
   - sale_date (string — within last 12 months, YYYY-MM format)
   - property_type (string — e.g. "Single Family", "Duplex", "Multi-Family")
   - bedrooms (number)
   - lot_size_sqft (number)
   - price_per_sqft (number)
   - notes (string — brief detail like "Renovated" or "Estate sale")

4. "active_listings" (array of objects) — 3-5 currently listed properties nearby, each with:
   - address (string)
   - lat (number — approximate latitude)
   - lng (number — approximate longitude)
   - list_price (number)
   - property_type (string)
   - bedrooms (number)
   - days_on_market (number)
   - status (string — "Active", "Pending", "Price Reduced")

5. "zoning_info" (object) with:
   - current_zoning (string — the zoning code)
   - zoning_description (string — what the zoning allows)
   - max_density (string — e.g. "Up to 4 units per lot")
   - max_height (string)
   - setback_requirements (string)
   - parking_requirements (string)
   - permitted_uses (array of strings)
   - discretionary_uses (array of strings)

6. "rezoning_activity" (array of objects) — 2-4 recent or pending rezoning applications nearby, each with:
   - location (string — approximate address or intersection)
   - lat (number — approximate latitude)
   - lng (number — approximate longitude)
   - from_zone (string)
   - to_zone (string)
   - status (string — "Approved", "Pending", "Under Review")
   - application_date (string — YYYY-MM format)
   - description (string — what the developer is proposing)

7. "rental_market" (object) with:
   - average_rent_1br (number — monthly)
   - average_rent_2br (number)
   - average_rent_3br (number)
   - average_rent_per_bed (number — for shared living / SRO)
   - vacancy_rate_pct (number)
   - rent_trend (string — "increasing", "stable", "decreasing")
   - rent_growth_annual_pct (number)
   - notes (string — market commentary)

8. "demographics" (object) with:
   - population (number — area population)
   - median_household_income (number)
   - median_age (number)
   - population_growth_pct (number — annual)
   - major_employers (array of strings — top 3-5 nearby employers)
   - transit_access (string — description of transit options)
   - walk_score_estimate (number — 0-100)

9. "development_activity" (array of objects) — 3-5 notable development projects nearby, each with:
   - project_name (string)
   - location (string)
   - lat (number — approximate latitude)
   - lng (number — approximate longitude)
   - type (string — e.g. "Residential", "Mixed-Use", "Commercial")
   - units (number or null)
   - status (string — "Proposed", "Under Construction", "Completed")
   - estimated_completion (string — YYYY or YYYY-QN format)
   - description (string)

10. "market_insights" (object) with:
   - median_home_price (number)
   - price_trend (string — "appreciating", "stable", "declining")
   - price_growth_annual_pct (number)
   - avg_days_on_market (number)
   - absorption_rate (string — e.g. "2.5 months of inventory")
   - investment_grade (string — "A", "B+", "B", "B-", "C+", "C")
   - opportunity_score (number — 1-10, 10 being highest opportunity)

11. "risks_and_considerations" (array of objects) — 3-5 items, each with:
    - category (string — "Environmental", "Market", "Regulatory", "Infrastructure", "Social")
    - description (string)
    - severity (string — "Low", "Medium", "High")
    - mitigation (string)

12. "redevelopment_potential" (object) with:
    - score (number — 1-10)
    - rationale (string — 2-3 sentences)
    - best_use_recommendation (string — e.g. "4-plex conversion" or "8-unit multiplex")
    - estimated_arv (number — after-renovation value estimate)
    - key_considerations (array of strings)

CRITICAL COORDINATE RULES:
- The subject property is at approximately {address}, {city}. Look up its actual coordinates.
- ALL comparable sales, active listings, rezoning activity, and development projects MUST have lat/lng coordinates that are WITHIN {radius_miles} miles of the subject property.
- For {city}, typical coordinates are: Calgary ~51.04 lat, -114.07 lng; Edmonton ~53.54 lat, -113.49 lng.
- Vary coordinates by small amounts (0.001-0.01 degrees) to place properties on nearby streets, NOT across the city.
- A {radius_miles}-mile radius is approximately {radius_miles * 0.015:.4f} degrees of latitude/longitude variation.

Be specific with numbers. Use realistic values for {city}, {province}. Do not use placeholder text."""

    result = _call_claude_json(prompt, max_tokens=4096)
    if result and "summary" in result:
        result["address"] = address
        result["city"] = city
        result["radius_miles"] = radius_miles
        # Override subject_location with real coordinates if available
        if subject_lat and subject_lng:
            result["subject_location"] = {"lat": subject_lat, "lng": subject_lng}
        return result

    # Fallback with structured mock data
    return _area_research_fallback(address, city, radius_miles, zoning)


# Default city coordinates for fallback
_CITY_COORDS = {
    "calgary": (51.0447, -114.0719),
    "edmonton": (53.5461, -113.4937),
    "red deer": (52.2681, -113.8112),
    "lethbridge": (49.6935, -112.8418),
    "medicine hat": (50.0405, -110.6764),
}


def _area_research_fallback(
    address: str, city: str, radius_miles: float, zoning: Optional[str] = None,
) -> dict:
    """Return structured fallback area research when Claude is unavailable."""
    base_lat, base_lng = _CITY_COORDS.get(city.lower(), (51.0447, -114.0719))
    return {
        "address": address,
        "city": city,
        "radius_miles": radius_miles,
        "subject_location": {"lat": base_lat, "lng": base_lng},
        "summary": (
            f"Area research for {address}, {city}. "
            "Configure ANTHROPIC_API_KEY for AI-powered comprehensive area analysis "
            "including real comparable sales, zoning details, rental market data, "
            "and development activity."
        ),
        "comparable_sales": [
            {
                "address": f"Nearby Property 1, {city}",
                "lat": base_lat + 0.005,
                "lng": base_lng + 0.003,
                "sale_price": 525000,
                "sale_date": "2025-11",
                "property_type": "Single Family",
                "bedrooms": 4,
                "lot_size_sqft": 5500,
                "price_per_sqft": 295,
                "notes": "Standard sale — sample data",
            },
            {
                "address": f"Nearby Property 2, {city}",
                "lat": base_lat - 0.004,
                "lng": base_lng - 0.006,
                "sale_price": 480000,
                "sale_date": "2025-09",
                "property_type": "Single Family",
                "bedrooms": 3,
                "lot_size_sqft": 5000,
                "price_per_sqft": 280,
                "notes": "Standard sale — sample data",
            },
        ],
        "active_listings": [
            {
                "address": f"Listed Property 1, {city}",
                "lat": base_lat + 0.003,
                "lng": base_lng - 0.004,
                "list_price": 549000,
                "property_type": "Single Family",
                "bedrooms": 4,
                "days_on_market": 21,
                "status": "Active",
            },
        ],
        "zoning_info": {
            "current_zoning": zoning or "R-CG",
            "zoning_description": f"{'Contextual Grade-Oriented' if zoning == 'R-CG' else zoning or 'Residential'} district",
            "max_density": "Up to 4 units per lot",
            "max_height": "11 metres",
            "setback_requirements": "Front: 3m, Side: 1.2m, Rear: 7.5m",
            "parking_requirements": "1 stall per unit (may be relaxed near transit)",
            "permitted_uses": ["Single detached", "Semi-detached", "Rowhouse", "Townhouse"],
            "discretionary_uses": ["Secondary suite", "Backyard suite", "Home occupation"],
        },
        "rezoning_activity": [
            {
                "location": f"Near {address}",
                "lat": base_lat + 0.002,
                "lng": base_lng + 0.005,
                "from_zone": "R-C1",
                "to_zone": "R-CG",
                "status": "Approved",
                "application_date": "2025-06",
                "description": "Rezoned to allow grade-oriented infill development — sample data",
            },
        ],
        "rental_market": {
            "average_rent_1br": 1350,
            "average_rent_2br": 1650,
            "average_rent_3br": 2100,
            "average_rent_per_bed": 950,
            "vacancy_rate_pct": 3.2,
            "rent_trend": "increasing",
            "rent_growth_annual_pct": 4.5,
            "notes": "Sample rental data. Enable AI for neighbourhood-specific analysis.",
        },
        "demographics": {
            "population": 45000,
            "median_household_income": 78000,
            "median_age": 36,
            "population_growth_pct": 2.1,
            "major_employers": ["Local Hospital", "University", "City of " + city],
            "transit_access": "Bus routes within walking distance. LRT accessible.",
            "walk_score_estimate": 62,
        },
        "development_activity": [
            {
                "project_name": "Sample Development",
                "location": f"Near {address}",
                "lat": base_lat - 0.006,
                "lng": base_lng + 0.004,
                "type": "Residential",
                "units": 24,
                "status": "Under Construction",
                "estimated_completion": "2026-Q4",
                "description": "Multi-family residential development — sample data",
            },
        ],
        "market_insights": {
            "median_home_price": 510000,
            "price_trend": "appreciating",
            "price_growth_annual_pct": 5.2,
            "avg_days_on_market": 28,
            "absorption_rate": "2.8 months of inventory",
            "investment_grade": "B+",
            "opportunity_score": 7,
        },
        "risks_and_considerations": [
            {
                "category": "Market",
                "description": "Interest rate environment may impact valuations",
                "severity": "Medium",
                "mitigation": "Lock in fixed-rate financing where possible",
            },
            {
                "category": "Regulatory",
                "description": "Municipal permitting timelines can vary",
                "severity": "Low",
                "mitigation": "Engage experienced local planners early",
            },
        ],
        "redevelopment_potential": {
            "score": 7,
            "rationale": (
                "Area shows strong rental demand and zoning supports densification. "
                "Sample assessment — enable AI for detailed analysis."
            ),
            "best_use_recommendation": "4-plex rowhouse conversion",
            "estimated_arv": 1200000,
            "key_considerations": [
                "Zoning supports multi-unit development",
                "Strong rental demand in area",
                "Enable ANTHROPIC_API_KEY for detailed analysis",
            ],
        },
    }


# ── AI Staffing Schedule Generation ──────────────────────────────────────

def generate_staffing_schedule(
    community_name: str,
    community_type: str,
    occupancy_rate: float,
    staff_list: list[dict],
    week_start: str,
    budget_weekly: Optional[float] = None,
    existing_shifts: Optional[list[dict]] = None,
) -> dict:
    """Generate an optimized weekly staffing schedule using AI."""
    context = f"""Community: {community_name}
Type: {community_type}
Occupancy: {occupancy_rate:.0%}
Week starting: {week_start}
Weekly budget: ${budget_weekly:,.0f}

Available staff:
{json.dumps(staff_list, indent=2, default=str)}"""

    if existing_shifts:
        context += f"\n\nExisting shifts already scheduled:\n{json.dumps(existing_shifts, indent=2, default=str)}"

    if budget_weekly:
        context += f"\n\nWeekly labour budget: ${budget_weekly:,.2f}"

    prompt = f"""Generate an optimized weekly staffing schedule for this Living Well community.

{context}

Coverage requirements by community type:
- RecoverWell: 24/7 support worker coverage, house manager during business hours, security overnight
- LiveWell: House manager during business hours, support worker evenings/weekends
- StudyWell: House manager during business hours, support worker evenings, lighter weekends
- WorkWell: Minimal staffing — house manager weekdays, on-call evenings

Consider:
1. Staff roles and hourly rates
2. Fair distribution of hours across staff
3. No single staff member should exceed 40 hours/week
4. Ensure coverage gaps are minimized for the community type
5. Stay within budget if specified
6. Higher occupancy = more coverage needed

Return JSON with:
- schedule (array of shift objects, each with: staff_id, staff_name, role, day (Monday-Sunday), start_time (HH:MM), end_time (HH:MM), hours)
- total_hours (float)
- total_cost (float)
- coverage_summary (object with day names as keys, each having: covered_hours, gap_hours, staff_count)
- optimization_notes (array of 3-5 strings with scheduling rationale)
- warnings (array of strings for any concerns — understaffing, budget overrun, etc.)"""

    result = _call_claude_json(prompt, max_tokens=4000)
    if result and "schedule" in result:
        return result

    # Fallback: basic schedule
    shifts = []
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for staff in staff_list[:3]:
        for day in day_names[:5]:  # Weekdays only
            shifts.append({
                "staff_id": staff.get("staff_id"),
                "staff_name": f"{staff.get('first_name', '')} {staff.get('last_name', '')}",
                "role": staff.get("role", "support_worker"),
                "day": day,
                "start_time": "09:00",
                "end_time": "17:00",
                "hours": 8.0,
            })

    return {
        "schedule": shifts,
        "total_hours": len(shifts) * 8.0,
        "total_cost": sum(float(s.get("hourly_rate", 20)) * 40 for s in staff_list[:3]),
        "coverage_summary": {d: {"covered_hours": 8 if d in day_names[:5] else 0, "gap_hours": 16 if d in day_names[:5] else 24, "staff_count": min(3, len(staff_list))} for d in day_names},
        "optimization_notes": ["Default schedule — configure ANTHROPIC_API_KEY for AI-optimized scheduling."],
        "warnings": ["This is a fallback schedule. Enable AI for optimized coverage."],
    }


# ── Scenario Comparison Engine ───────────────────────────────────────────

def compare_scenarios(
    property_name: str,
    scenarios: list[dict],
    current_financials: Optional[dict] = None,
) -> dict:
    """Compare 2-3 pro forma scenarios with AI commentary."""
    prompt = f"""Compare these investment scenarios for {property_name}:

{json.dumps(scenarios, indent=2, default=str)}"""

    if current_financials:
        prompt += f"\n\nCurrent financials:\n{json.dumps(current_financials, indent=2, default=str)}"

    prompt += """

Return JSON with:
- comparison_table (array of objects, one per scenario, each with: scenario_name, noi, cash_on_cash, dscr, irr, cap_rate, total_return)
- best_scenario (string — name of the recommended scenario)
- narrative (string — 4-6 sentence comparison highlighting the key drivers of difference between scenarios)
- key_drivers (array of strings — 3-4 factors that most impact the outcome differences)
- sensitivity_notes (string — 2-3 sentences on which assumptions matter most)
- risk_ranking (array of objects with: scenario_name, risk_level (low/medium/high), rationale)"""

    result = _call_claude_json(prompt, max_tokens=3000)
    if result and "narrative" in result:
        return result

    return {
        "comparison_table": [{"scenario_name": s.get("name", f"Scenario {i+1}")} for i, s in enumerate(scenarios)],
        "best_scenario": scenarios[0].get("name", "Scenario 1") if scenarios else "N/A",
        "narrative": "Configure ANTHROPIC_API_KEY for AI-powered scenario comparison.",
        "key_drivers": ["Vacancy rate", "Rent growth", "Expense growth"],
        "sensitivity_notes": "Enable AI for sensitivity analysis.",
        "risk_ranking": [],
    }


# ── Predictive Occupancy Risk Scoring ────────────────────────────────────

def predict_occupancy_risk(
    community_name: str,
    community_type: str,
    current_occupancy: float,
    trend_data: list[dict],
    lease_expirations: Optional[list[dict]] = None,
    arrears_data: Optional[list[dict]] = None,
) -> dict:
    """Predict occupancy risk using AI analysis of trends and resident data."""
    context = f"""Community: {community_name}
Type: {community_type}
Current Occupancy: {current_occupancy:.1%}

Occupancy/Revenue Trend (last 6+ months):
{json.dumps(trend_data[-12:], indent=2, default=str)}"""

    if lease_expirations:
        context += f"\n\nUpcoming lease expirations (next 90 days):\n{json.dumps(lease_expirations, indent=2, default=str)}"
    if arrears_data:
        context += f"\n\nCurrent arrears:\n{json.dumps(arrears_data, indent=2, default=str)}"

    prompt = f"""Analyze occupancy risk for this Living Well community.

{context}

Consider:
- Seasonal patterns (StudyWell: academic year cycles, RecoverWell: stable year-round)
- Arrears progression (90+ day arrears often precede vacancy)
- Lease expiration clustering
- Trend direction and velocity

Return JSON with:
- risk_score (int 1-100, higher = more risk of occupancy decline)
- risk_level (string: "low", "moderate", "elevated", "high", "critical")
- predicted_occupancy_30d (float — predicted occupancy in 30 days)
- predicted_occupancy_90d (float — predicted occupancy in 90 days)
- risk_factors (array of objects with: factor, impact (high/medium/low), description)
- at_risk_beds (int — estimated beds at risk of vacancy in next 90 days)
- revenue_at_risk (float — estimated monthly revenue at risk)
- recommendations (array of strings — 3-5 actionable retention/marketing strategies)
- seasonal_outlook (string — 2-3 sentences on seasonal expectations)"""

    result = _call_claude_json(prompt, max_tokens=2500)
    if result and "risk_score" in result:
        return result

    # Fallback
    risk = 30 if current_occupancy > 0.9 else 60 if current_occupancy > 0.75 else 80
    return {
        "risk_score": risk,
        "risk_level": "low" if risk < 40 else "moderate" if risk < 60 else "high",
        "predicted_occupancy_30d": current_occupancy,
        "predicted_occupancy_90d": current_occupancy - 0.02,
        "risk_factors": [{"factor": "Current occupancy level", "impact": "medium", "description": f"Occupancy at {current_occupancy:.0%}"}],
        "at_risk_beds": 0,
        "revenue_at_risk": 0,
        "recommendations": ["Configure ANTHROPIC_API_KEY for AI-powered occupancy risk prediction."],
        "seasonal_outlook": "Enable AI for seasonal analysis.",
    }


# ── Executive Briefing Generator ─────────────────────────────────────────

def generate_executive_briefing(report_type: str, report_data: dict) -> dict:
    """Generate a 3-5 sentence executive briefing from structured report data."""
    prompt = f"""Summarize this {report_type} report in 3-5 concise sentences for an executive audience.
Focus on what requires attention, key metrics, and actionable takeaways.

Report data:
{json.dumps(report_data, indent=2, default=str)[:6000]}

Return JSON with:
- briefing (string — 3-5 sentences)
- attention_items (array of strings — 0-3 items needing immediate attention)
- key_metrics (array of objects with: metric, value, status (good/warning/critical))"""

    result = _call_claude_json(prompt, max_tokens=1000)
    if result and "briefing" in result:
        return result

    return {
        "briefing": f"{report_type.replace('_', ' ').title()} report generated. Configure ANTHROPIC_API_KEY for AI briefings.",
        "attention_items": [],
        "key_metrics": [],
    }


# ── Arrears Collection Strategy ──────────────────────────────────────────

def suggest_arrears_strategy(
    resident_name: str,
    community_type: str,
    days_overdue: int,
    amount_overdue: float,
    arrears_history: Optional[list[dict]] = None,
    current_follow_up: Optional[str] = None,
) -> dict:
    """Suggest an arrears collection strategy based on resident context."""
    context = f"""Resident: {resident_name}
Community Type: {community_type}
Days Overdue: {days_overdue}
Amount Overdue: ${amount_overdue:,.2f}
Current Follow-Up: {current_follow_up or 'None'}"""

    if arrears_history:
        context += f"\n\nArrears History:\n{json.dumps(arrears_history, indent=2, default=str)}"

    prompt = f"""Recommend an arrears collection strategy for this Living Well community resident.

{context}

Consider:
- Community type sensitivity (RecoverWell residents may need more compassionate approach)
- Escalation appropriateness based on days overdue
- Alberta Residential Tenancies Act requirements
- Balance between revenue recovery and resident welfare
- Historical payment patterns

Return JSON with:
- recommended_action (string — specific next step)
- escalation_level (string: "gentle_reminder", "formal_notice", "payment_plan", "final_warning", "legal_referral")
- communication_template (string — brief message to send to resident)
- timeline (string — when to take next action if no response)
- alternative_actions (array of strings — 2-3 other approaches)
- risk_assessment (string — likelihood of payment vs vacancy)
- notes (string — any special considerations)"""

    result = _call_claude_json(prompt, max_tokens=1500)
    if result and "recommended_action" in result:
        return result

    # Fallback escalation ladder
    if days_overdue <= 7:
        action, level = "Send friendly payment reminder", "gentle_reminder"
    elif days_overdue <= 30:
        action, level = "Send formal written notice", "formal_notice"
    elif days_overdue <= 60:
        action, level = "Propose payment plan", "payment_plan"
    elif days_overdue <= 90:
        action, level = "Issue final warning before legal action", "final_warning"
    else:
        action, level = "Refer to legal counsel", "legal_referral"

    return {
        "recommended_action": action,
        "escalation_level": level,
        "communication_template": f"Dear {resident_name}, your account has a balance of ${amount_overdue:,.2f} that is {days_overdue} days overdue.",
        "timeline": "Follow up in 7 days if no response",
        "alternative_actions": ["Offer payment plan", "Schedule in-person meeting"],
        "risk_assessment": "Configure ANTHROPIC_API_KEY for AI-powered assessment.",
        "notes": "Default strategy based on days overdue.",
    }


# ── Distribution Timing Advisor ──────────────────────────────────────────

def advise_distribution_timing(
    lp_name: str,
    lp_financials: dict,
    waterfall_result: Optional[dict] = None,
    debt_maturities: Optional[list[dict]] = None,
    cash_reserves: Optional[float] = None,
) -> dict:
    """Advise on distribution timing and amount."""
    context = f"""LP Fund: {lp_name}

Financial Summary:
{json.dumps(lp_financials, indent=2, default=str)}"""

    if waterfall_result:
        context += f"\n\nWaterfall Calculation:\n{json.dumps(waterfall_result, indent=2, default=str)}"
    if debt_maturities:
        context += f"\n\nUpcoming Debt Maturities:\n{json.dumps(debt_maturities, indent=2, default=str)}"
    if cash_reserves is not None:
        context += f"\n\nCurrent Cash Reserves: ${cash_reserves:,.2f}"

    prompt = f"""Advise on distribution timing for this LP fund.

{context}

Consider:
- Preferred return accrual and unpaid balances
- Upcoming debt maturities and refinancing needs
- Cash reserve requirements (typically 3-6 months operating expenses)
- LP investor expectations and communication impact
- Tax timing implications (year-end vs quarterly)

Return JSON with:
- recommendation (string: "distribute_full", "distribute_partial", "defer", "accumulate_reserve")
- recommended_amount (float — suggested distribution amount)
- max_safe_amount (float — maximum distributable while maintaining reserves)
- rationale (string — 3-5 sentences explaining the recommendation)
- risk_factors (array of strings — 2-4 risks to consider)
- timing_suggestion (string — when to distribute)
- reserve_after_distribution (float — projected cash reserve after recommended distribution)"""

    result = _call_claude_json(prompt, max_tokens=2000)
    if result and "recommendation" in result:
        return result

    return {
        "recommendation": "distribute_partial",
        "recommended_amount": 0,
        "max_safe_amount": 0,
        "rationale": "Configure ANTHROPIC_API_KEY for AI-powered distribution advice.",
        "risk_factors": ["Unable to assess without AI integration"],
        "timing_suggestion": "Review financials before distributing",
        "reserve_after_distribution": cash_reserves or 0,
    }


# ── Rent Roll CSV Validation ────────────────────────────────────────────

def validate_rent_roll(
    csv_rows: list[dict],
    property_address: str,
    city: str,
    existing_units: Optional[list[dict]] = None,
) -> dict:
    """Validate rent roll CSV data using AI for semantic checks."""
    prompt = f"""Validate this rent roll data for a property at {property_address}, {city}, Alberta.

Rent roll rows:
{json.dumps(csv_rows[:50], indent=2, default=str)}"""

    if existing_units:
        prompt += f"\n\nExisting units on record:\n{json.dumps(existing_units[:20], indent=2, default=str)}"

    prompt += """

Check for:
1. Unrealistic rents (too high or too low for the Alberta market — typical range $800-$2000/bed/month)
2. Duplicate unit numbers
3. Missing or malformed data
4. Inconsistent formatting
5. Rents that are outliers compared to other units in the same building
6. Market comparison — are these rents competitive for the area?

Return JSON with:
- is_valid (boolean — true if no critical issues)
- total_rows (int)
- issues (array of objects with: row_number, field, issue_type (error/warning/info), description, suggested_fix)
- market_comparison (object with: avg_rent_in_file, estimated_market_rent, assessment (below_market/at_market/above_market))
- summary (string — 2-3 sentence overall assessment)"""

    result = _call_claude_json(prompt, max_tokens=2500)
    if result and "issues" in result:
        return result

    return {
        "is_valid": True,
        "total_rows": len(csv_rows),
        "issues": [],
        "market_comparison": {"avg_rent_in_file": 0, "estimated_market_rent": 0, "assessment": "unknown"},
        "summary": "Configure ANTHROPIC_API_KEY for AI-powered rent roll validation.",
    }
