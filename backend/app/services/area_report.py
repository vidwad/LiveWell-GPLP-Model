"""
Area Report Service
====================
Generate a comprehensive PDF report for a property by:

1. Aggregating all available context (property, dev plans, debt, units,
   valuations, and any cached area research) into a structured prompt.
2. Asking an LLM to synthesize it into professional HTML (Manus primary,
   Claude fallback).
3. Rendering the HTML to PDF via xhtml2pdf.

Runs in a background thread so the HTTP caller returns immediately with a
job_id and polls for completion.
"""
from __future__ import annotations

import io
import logging
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import requests

from app.core.config import settings
from app.db.models import (
    AreaReportJob, Property, LPEntity, AcquisitionBaseline, ExitForecast,
    DevelopmentPlan, DebtFacility, Unit, ValuationHistory, PlatformSetting,
)
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


ARTIFACT_ROOT = Path("uploads/area_reports")
ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)


# ── Context aggregation ─────────────────────────────────────────────────────

def _d(v) -> float | None:
    return float(v) if v is not None else None


def gather_property_context(db, property_id: int) -> dict[str, Any]:
    """Collect everything we know about the property from the DB."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise ValueError(f"Property {property_id} not found")

    lp = db.query(LPEntity).filter(LPEntity.lp_id == prop.lp_id).first() if prop.lp_id else None
    baseline = db.query(AcquisitionBaseline).filter(AcquisitionBaseline.property_id == property_id).first()
    forecast = db.query(ExitForecast).filter(ExitForecast.property_id == property_id).first()
    plans = db.query(DevelopmentPlan).filter(DevelopmentPlan.property_id == property_id).all()
    debt = db.query(DebtFacility).filter(DebtFacility.property_id == property_id).all()
    units = db.query(Unit).filter(Unit.property_id == property_id).all()
    valuations = (
        db.query(ValuationHistory)
        .filter(ValuationHistory.property_id == property_id)
        .order_by(ValuationHistory.valuation_date.desc())
        .limit(5)
        .all()
    )

    return {
        "property": {
            "property_id": prop.property_id,
            "address": prop.address,
            "city": prop.city,
            "province": prop.province,
            "postal_code": prop.postal_code,
            "stage": prop.development_stage.value if prop.development_stage else None,
            "latitude": _d(prop.latitude),
            "longitude": _d(prop.longitude),
            "purchase_price": _d(prop.purchase_price),
            "purchase_date": str(prop.purchase_date) if prop.purchase_date else None,
            "annual_revenue": _d(prop.annual_revenue),
            "annual_expenses": _d(prop.annual_expenses),
            "neighbourhood": getattr(prop, "neighbourhood", None),
            "ward": getattr(prop, "ward", None),
            "year_built": getattr(prop, "year_built", None),
            "building_sqft": getattr(prop, "building_sqft", None),
            "lot_size_sqft": getattr(prop, "lot_size_sqft", None),
            "current_zoning": getattr(prop, "current_zoning", None),
            "notes": getattr(prop, "notes", None),
        },
        "lp": {
            "lp_id": lp.lp_id,
            "name": lp.name,
            "legal_name": lp.legal_name,
            "community_focus": lp.community_focus,
            "status": lp.status.value if lp and lp.status else None,
        } if lp else None,
        "baseline": {
            "purchase_price": _d(baseline.purchase_price) if baseline else None,
            "target_hold_years": baseline.target_hold_years if baseline else None,
            "target_sale_year": baseline.target_sale_year if baseline else None,
        } if baseline else None,
        "forecast": {
            "forecast_sale_year": forecast.forecast_sale_year if forecast else None,
            "forecast_sale_price": _d(forecast.forecast_sale_price) if forecast else None,
            "sale_status": forecast.sale_status.value if forecast and forecast.sale_status else None,
        } if forecast else None,
        "development_plans": [
            {
                "plan_name": p.plan_name,
                "start_date": str(p.development_start_date) if p.development_start_date else None,
                "completion_date": str(p.estimated_completion_date) if p.estimated_completion_date else None,
                "hard_costs": _d(p.hard_costs),
                "soft_costs": _d(p.soft_costs),
                "site_prep_costs": _d(p.site_prep_costs),
                "financing_costs": _d(p.financing_costs),
                "contingency_costs": _d(p.contingency_costs),
            }
            for p in plans
        ],
        "debt": [
            {
                "lender": d.lender_name,
                "debt_type": d.debt_type.value if d.debt_type else None,
                "principal_amount": _d(d.principal_amount),
                "interest_rate": _d(d.interest_rate),
                "term_months": d.term_months,
                "status": d.status.value if d.status else None,
            }
            for d in debt
        ],
        "units": [
            {
                "unit_number": u.unit_number,
                "unit_type": u.unit_type.value if u.unit_type else None,
                "size_sqft": _d(getattr(u, "size_sqft", None)),
                "rent_amount": _d(getattr(u, "rent_amount", None)),
            }
            for u in units
        ],
        "valuations": [
            {
                "date": str(v.valuation_date) if v.valuation_date else None,
                "value": _d(v.value),
                "method": v.method.value if v.method else None,
                "appraiser": v.appraiser,
                "notes": v.notes,
            }
            for v in valuations
        ],
    }


# ── Prompt construction ─────────────────────────────────────────────────────

REPORT_SYSTEM_PROMPT = """You are a senior real estate analyst producing a Property & Area Research Report for a limited partnership (LP) investment memo.

Produce a single self-contained HTML document suitable for PDF rendering. Use semantic HTML only (h1, h2, h3, p, ul, ol, li, table, thead, tbody, tr, th, td, strong, em). Include inline <style> covering fonts, spacing, table borders, and page breaks. Do NOT include <html>, <head>, <body>, <script>, or external resources. Start directly with <style>...</style> followed by the content.

Required sections in this order:
1. Cover: property address, LP name, report date, prepared by LivingWell Communities.
2. Executive Summary: 3-5 bullets on investment thesis.
3. Property Fundamentals: address, city, zoning, lot/building size, year built, stage.
4. LP Context: fund name, strategy, community focus.
5. Acquisition & Hold: purchase price, date, target hold, target sale year.
6. Development Plans: each plan with timeline, cost breakdown, and a cost-summary table.
7. Debt & Capital Stack: table of facilities with lender, type, principal, rate, term, status.
8. Unit Mix: summary table.
9. Valuations: history table of recent valuations.
10. Area & Market Context: narrative commentary based on the city, zoning, and any available area research.
11. Risk & Opportunity: bullets for each.

Use Canadian English. Keep numeric formatting consistent (dollar values with $ and commas, percentages with %). Keep the tone professional and concise. Never invent data that isn't in the context — if a section has no data, state "Not available" explicitly."""


def build_report_prompt(context: dict[str, Any]) -> str:
    """Turn the context dict into the user-message JSON payload for the LLM."""
    import json
    return (
        "Generate the full HTML report for the following property context:\n\n"
        f"```json\n{json.dumps(context, indent=2, default=str)}\n```\n"
    )


# ── Manus client ────────────────────────────────────────────────────────────

MANUS_BASE = "https://api.manus.ai"
MANUS_POLL_INTERVAL = 4
MANUS_POLL_BUDGET_S = 8 * 60  # 8 minutes


def _manus_create_task(system_prompt: str, user_prompt: str, api_key: str) -> str:
    """POST /v2/task.create with a single-turn prompt. Returns the task_id."""
    resp = requests.post(
        f"{MANUS_BASE}/v2/task.create",
        headers={
            "Content-Type": "application/json",
            "x-manus-api-key": api_key,
        },
        json={
            "message": {
                "content": f"{system_prompt}\n\n---\n\n{user_prompt}",
            },
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    task_id = (
        data.get("task_id")
        or data.get("id")
        or (data.get("task") or {}).get("id")
    )
    if not task_id:
        raise RuntimeError(f"Manus task.create returned no task_id: {data}")
    return str(task_id)


def _manus_poll_final_text(task_id: str, api_key: str) -> str:
    """Poll Manus listMessages until agent stops. Return the final assistant text."""
    deadline = time.time() + MANUS_POLL_BUDGET_S
    last_text: str | None = None
    while time.time() < deadline:
        resp = requests.get(
            f"{MANUS_BASE}/v2/task.listMessages",
            headers={"x-manus-api-key": api_key},
            params={"task_id": task_id},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        agent_status = data.get("agent_status") or (data.get("task") or {}).get("agent_status")
        messages = data.get("messages") or data.get("events") or []

        for m in messages:
            role = m.get("role") or m.get("type")
            if role in ("assistant", "assistant_message"):
                content = m.get("content")
                if isinstance(content, list):
                    # Some APIs return content as list of parts
                    parts = [p.get("text") for p in content if isinstance(p, dict)]
                    text = "\n".join([p for p in parts if p])
                elif isinstance(content, str):
                    text = content
                else:
                    text = str(content) if content else ""
                if text:
                    last_text = text

        if agent_status == "stopped" and last_text:
            return last_text
        time.sleep(MANUS_POLL_INTERVAL)

    raise TimeoutError("Manus task did not complete within budget")


def call_manus(system_prompt: str, user_prompt: str, api_key: str) -> str:
    task_id = _manus_create_task(system_prompt, user_prompt, api_key)
    logger.info("Manus task created: %s", task_id)
    return _manus_poll_final_text(task_id, api_key)


# ── Claude fallback ─────────────────────────────────────────────────────────

def call_claude(system_prompt: str, user_prompt: str) -> str:
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    model = getattr(settings, "CLAUDE_MODEL", None) or "claude-opus-4-7"
    resp = client.messages.create(
        model=model,
        max_tokens=8000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    # Concatenate all text blocks
    parts = []
    for block in resp.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
        elif isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "\n".join(parts)


# ── HTML extraction + PDF rendering ────────────────────────────────────────

def _extract_html(raw: str) -> str:
    """LLMs sometimes wrap output in ``` code fences. Strip them."""
    s = raw.strip()
    if s.startswith("```"):
        # Remove the first line (``` or ```html) and any trailing ```
        lines = s.splitlines()
        if lines[0].lstrip("`").strip() in ("html", "HTML", ""):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s


def render_html_to_pdf(html: str, output_path: Path) -> int:
    """Render the HTML document to PDF at output_path. Returns byte size."""
    from xhtml2pdf import pisa  # noqa: WPS433

    # Wrap in a minimal shell so xhtml2pdf always has a body context
    wrapped = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Property Area Report</title></head>
<body>{html}</body>
</html>"""

    buf = io.BytesIO()
    result = pisa.CreatePDF(src=wrapped, dest=buf, encoding="utf-8")
    if result.err:
        raise RuntimeError(f"xhtml2pdf rendering failed with {result.err} errors")

    output_path.write_bytes(buf.getvalue())
    return output_path.stat().st_size


# ── Main pipeline ───────────────────────────────────────────────────────────

def _get_manus_key(db) -> Optional[str]:
    row = db.query(PlatformSetting).filter(PlatformSetting.key == "MANUS_API_KEY").first()
    return row.value if row and row.value else None


def _update_job(db, job_id: int, **fields):
    job = db.query(AreaReportJob).filter(AreaReportJob.id == job_id).first()
    if not job:
        return
    for k, v in fields.items():
        setattr(job, k, v)
    db.commit()


def run_report_job(job_id: int):
    """Background worker — owns its own DB session."""
    db = SessionLocal()
    try:
        job = db.query(AreaReportJob).filter(AreaReportJob.id == job_id).first()
        if not job:
            return
        property_id = job.property_id

        # Stage 1: gather
        _update_job(db, job_id, status="gathering")
        context = gather_property_context(db, property_id)

        # Stage 2: synthesize
        _update_job(db, job_id, status="synthesizing")
        user_prompt = build_report_prompt(context)

        html_raw: Optional[str] = None
        engine_used: Optional[str] = None
        manus_err: Optional[str] = None

        manus_key = _get_manus_key(db)
        if manus_key:
            try:
                html_raw = call_manus(REPORT_SYSTEM_PROMPT, user_prompt, manus_key)
                engine_used = "manus"
            except Exception as e:
                manus_err = f"{type(e).__name__}: {e}"
                logger.warning("Manus failed, falling back to Claude: %s", manus_err)

        if html_raw is None:
            html_raw = call_claude(REPORT_SYSTEM_PROMPT, user_prompt)
            engine_used = "claude"

        html = _extract_html(html_raw)
        _update_job(db, job_id, html_content=html, engine=engine_used)

        # Stage 3: render
        _update_job(db, job_id, status="rendering")
        out = ARTIFACT_ROOT / f"property-{property_id}-report-{job_id}.pdf"
        size = render_html_to_pdf(html, out)

        _update_job(
            db, job_id,
            status="completed",
            pdf_file_path=str(out),
            pdf_file_size=size,
            error=(f"Manus error: {manus_err}" if manus_err else None),
        )
    except Exception as e:
        logger.exception("Area report job %s failed", job_id)
        _update_job(db, job_id, status="failed", error=f"{type(e).__name__}: {e}\n{traceback.format_exc()}")
    finally:
        db.close()


def spawn_job(db, property_id: int, user_id: Optional[int]) -> int:
    job = AreaReportJob(
        property_id=property_id,
        status="pending",
        created_by=user_id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    t = threading.Thread(target=run_report_job, args=(job.id,), daemon=True)
    t.start()
    return job.id
