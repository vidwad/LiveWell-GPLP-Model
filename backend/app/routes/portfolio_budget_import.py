"""
Construction Budget PDF Import
================================
Extracts construction expense line items from uploaded budget documents
(contractor quotes, cost estimates, spreadsheet exports) using OpenAI.
"""
import json
import re
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import ConstructionExpense, PlatformSetting, User
from app.core.deps import require_gp_or_ops

router = APIRouter()


@router.post("/properties/{property_id}/import-budget-pdf")
async def import_budget_pdf(
    property_id: int,
    plan_id: int = Query(..., description="Development plan ID"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Extract construction expense line items from an uploaded PDF.

    Returns extracted items for user review before saving.
    Call /confirm-budget-import to actually save them.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")

    # Get API key
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

    # Extract text from PDF
    text_content = ""
    try:
        import pypdf
        reader = pypdf.PdfReader(BytesIO(content))
        for page in reader.pages:
            text_content += (page.extract_text() or "") + "\n"
    except Exception:
        pass

    # Check readability
    common_words = ["cost", "budget", "total", "amount", "item", "description", "contractor", "estimate"]
    word_matches = sum(1 for w in common_words if w in text_content.lower())
    is_readable = len(text_content.strip()) > 50 and word_matches >= 2

    if not is_readable:
        # Try web search with filename
        name_hint = file.filename.replace(".pdf", "").replace("_", " ").replace("-", " ")
        text_content = (
            f"Budget document filename: {file.filename}\n"
            f"Could not extract readable text. Filename hints: {name_hint}\n"
            f"Raw content (may be garbled): {text_content[:3000]}"
        )

    prompt = f"""You are a construction cost estimation expert. Extract ALL expense line items from this construction budget document.

DOCUMENT CONTENT:
{text_content[:6000]}

Return ONLY a valid JSON array of expense items. Each item must have:
- "category": one of "hard_cost", "soft_cost", "site_cost", "financing_cost", "contingency"
- "description": specific expense item name
- "budgeted_amount": estimated cost in dollars (number, no formatting)
- "vendor": vendor/contractor name if mentioned (null if not)
- "notes": any additional details

Categories:
- hard_cost: demolition, framing, roofing, windows, plumbing, electrical, HVAC, drywall, flooring, painting, fixtures, cabinets, countertops, appliances
- soft_cost: architectural fees, engineering, permits, legal, insurance, project management, inspections
- site_cost: excavation, foundation, landscaping, paving, utilities connections
- financing_cost: loan fees, interest reserves, appraisal costs
- contingency: contingency reserves

Extract EVERY line item with its amount. If amounts are shown as ranges, use the midpoint.
Return ONLY the JSON array, no markdown or explanation."""

    try:
        response = client.chat.completions.create(
            model="gpt-5.4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_completion_tokens=3000,
        )
        result_text = response.choices[0].message.content or "[]"
        result_text = re.sub(r'^```(?:json)?\s*', '', result_text.strip())
        result_text = re.sub(r'\s*```$', '', result_text.strip())

        items = json.loads(result_text)
        if not isinstance(items, list):
            raise ValueError("Expected array")

    except json.JSONDecodeError:
        raise HTTPException(500, "AI returned invalid JSON — try a clearer document")
    except Exception as e:
        raise HTTPException(500, f"Budget extraction failed: {str(e)[:200]}")

    # Compute totals
    total = sum(i.get("budgeted_amount", 0) for i in items)
    by_category = {}
    for i in items:
        cat = i.get("category", "hard_cost")
        by_category[cat] = by_category.get(cat, 0) + i.get("budgeted_amount", 0)

    return {
        "items": items,
        "total": round(total, 2),
        "by_category": {k: round(v, 2) for k, v in by_category.items()},
        "item_count": len(items),
        "plan_id": plan_id,
        "filename": file.filename,
    }


@router.post("/properties/{property_id}/confirm-budget-import")
def confirm_budget_import(
    property_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Save previously extracted budget items to the database."""
    plan_id = payload.get("plan_id")
    items = payload.get("items", [])

    if not plan_id or not items:
        raise HTTPException(400, "plan_id and items are required")

    created = 0
    for item in items:
        expense = ConstructionExpense(
            property_id=property_id,
            plan_id=plan_id,
            category=item.get("category", "hard_cost"),
            description=item.get("description", ""),
            budgeted_amount=Decimal(str(item.get("budgeted_amount", 0))),
            actual_amount=Decimal("0"),
            vendor=item.get("vendor"),
            notes=item.get("notes", ""),
        )
        db.add(expense)
        created += 1

    db.commit()
    return {"created": created, "plan_id": plan_id}
