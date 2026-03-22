"""
Document Data Extraction Service
=================================
Uses Claude AI to extract structured data from uploaded documents (PDFs, images).
Extracts relevant fields based on document category and can auto-update
property records or create expense records.
"""
import json
import logging
from decimal import Decimal
from typing import Optional

logger = logging.getLogger(__name__)


def extract_document_data(
    file_bytes: bytes,
    content_type: str,
    category: str,
    property_address: str = "",
    city: str = "",
) -> Optional[dict]:
    """Extract structured data from a document using Claude AI.

    Returns a dict with:
      - extracted_fields: dict of field name -> value (category-dependent)
      - confidence: float 0-1
      - summary: str description of what was found
    """
    from app.services.ai import _call_claude_json, _HAS_CLAUDE

    if not _HAS_CLAUDE:
        return None

    # Only process PDFs and images
    if content_type not in (
        "application/pdf",
        "image/jpeg",
        "image/png",
    ):
        return None

    extraction_prompts = {
        "appraisal": """Extract appraisal data from this document:
Return JSON with:
- appraised_value (float, CAD)
- effective_date (string, YYYY-MM-DD)
- cap_rate (float, percentage like 5.5)
- comparable_sales (array of {address, sale_price, sale_date})
- land_value (float, CAD, if available)
- improvement_value (float, CAD, if available)
- appraiser_name (string)
- summary (string, 2-3 sentence summary of the appraisal)
Use null for any fields not found.""",

        "lease": """Extract lease data from this document:
Return JSON with:
- tenant_name (string)
- unit_number (string)
- lease_start (string, YYYY-MM-DD)
- lease_end (string, YYYY-MM-DD)
- monthly_rent (float, CAD)
- rent_escalation (string, e.g. "3% annually")
- security_deposit (float, CAD)
- lease_type (string, e.g. "gross", "net", "modified gross")
- summary (string, 2-3 sentence summary)
Use null for any fields not found.""",

        "insurance": """Extract insurance policy data from this document:
Return JSON with:
- insurer (string)
- policy_number (string)
- coverage_amount (float, CAD)
- annual_premium (float, CAD)
- effective_date (string, YYYY-MM-DD)
- expiry_date (string, YYYY-MM-DD)
- coverage_type (string, e.g. "property", "liability", "comprehensive")
- deductible (float, CAD)
- summary (string, 2-3 sentence summary)
Use null for any fields not found.""",

        "tax_assessment": """Extract property tax assessment data:
Return JSON with:
- assessed_value (float, CAD)
- assessment_year (int)
- tax_amount (float, CAD)
- tax_year (int)
- property_class (string)
- land_value (float, CAD)
- improvement_value (float, CAD)
- summary (string, 2-3 sentence summary)
Use null for any fields not found.""",

        "purchase_agreement": """Extract purchase agreement data:
Return JSON with:
- purchase_price (float, CAD)
- closing_date (string, YYYY-MM-DD)
- deposit_amount (float, CAD)
- seller_name (string)
- buyer_name (string)
- conditions (array of strings)
- summary (string, 2-3 sentence summary)
Use null for any fields not found.""",

        "mortgage": """Extract mortgage/loan data:
Return JSON with:
- lender (string)
- principal_amount (float, CAD)
- interest_rate (float, percentage)
- term_years (int)
- amortization_years (int)
- maturity_date (string, YYYY-MM-DD)
- monthly_payment (float, CAD)
- loan_type (string, e.g. "fixed", "variable", "hybrid")
- summary (string, 2-3 sentence summary)
Use null for any fields not found.""",

        "inspection": """Extract inspection report data:
Return JSON with:
- inspector_name (string)
- inspection_date (string, YYYY-MM-DD)
- overall_condition (string, e.g. "good", "fair", "poor")
- major_issues (array of strings)
- estimated_repair_cost (float, CAD)
- recommendations (array of strings)
- summary (string, 2-3 sentence summary)
Use null for any fields not found.""",

        "environmental": """Extract environmental assessment data:
Return JSON with:
- assessment_type (string, e.g. "Phase I", "Phase II")
- assessment_date (string, YYYY-MM-DD)
- consultant (string)
- findings (array of strings)
- contamination_found (boolean)
- remediation_required (boolean)
- estimated_remediation_cost (float, CAD, if applicable)
- summary (string, 2-3 sentence summary)
Use null for any fields not found.""",
    }

    prompt_suffix = extraction_prompts.get(category)
    if not prompt_suffix:
        # Generic extraction for other document types
        prompt_suffix = """Extract key data from this document:
Return JSON with:
- document_date (string, YYYY-MM-DD if found)
- key_amounts (array of {description, amount} for any monetary values found)
- parties (array of strings for any people/companies mentioned)
- key_dates (array of {description, date} for any important dates)
- summary (string, 2-3 sentence summary of the document)
Use null for any fields not found."""

    prompt = f"""You are analyzing a {category} document for a property at {property_address}, {city}.

{prompt_suffix}

Also include a "confidence" field (float 0.0-1.0) indicating how confident you are in the extraction accuracy.

IMPORTANT: Only extract information that is clearly stated in the document. Do not guess or infer values."""

    # For now, we describe the document rather than passing raw bytes
    # (Claude API text mode — vision/PDF support would use base64 encoding)
    # We'll pass what we can extract as text context
    text_content = _extract_text_from_bytes(file_bytes, content_type)

    if text_content:
        prompt += f"\n\nDocument text content:\n{text_content[:8000]}"
    else:
        prompt += "\n\n[Could not extract text from document. Provide a skeleton response with null values and confidence 0.1]"

    result = _call_claude_json(prompt, max_tokens=2000)
    if result:
        confidence = result.pop("confidence", 0.5)
        summary = result.pop("summary", "Document processed.")
        return {
            "extracted_fields": result,
            "confidence": confidence,
            "summary": summary,
            "category": category,
        }

    return None


def _extract_text_from_bytes(file_bytes: bytes, content_type: str) -> Optional[str]:
    """Try to extract text content from file bytes."""
    if content_type == "application/pdf":
        try:
            import io
            # Try PyPDF2/pypdf first
            try:
                from pypdf import PdfReader
            except ImportError:
                try:
                    from PyPDF2 import PdfReader
                except ImportError:
                    logger.info("No PDF reader library available (pypdf or PyPDF2)")
                    return None

            reader = PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for page in reader.pages[:20]:  # Limit to 20 pages
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            return "\n\n".join(text_parts) if text_parts else None
        except Exception as e:
            logger.warning("PDF text extraction failed: %s", e)
            return None

    # For images, we can't extract text without OCR
    # Return None and let the AI handle with low confidence
    return None


def apply_extraction_to_property(
    db,
    property_id: int,
    category: str,
    extracted_fields: dict,
    confidence: float,
) -> dict:
    """Apply extracted data to a property record if confidence is high enough.

    Returns a dict describing what was updated.
    """
    from app.db.models import Property

    if confidence < 0.6:
        return {"applied": False, "reason": "Confidence too low", "confidence": confidence}

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        return {"applied": False, "reason": "Property not found"}

    updates = {}

    if category == "appraisal":
        if extracted_fields.get("appraised_value") and not prop.current_market_value:
            prop.current_market_value = Decimal(str(extracted_fields["appraised_value"]))
            updates["current_market_value"] = float(prop.current_market_value)

    elif category == "tax_assessment":
        if extracted_fields.get("assessed_value") and not prop.assessed_value:
            prop.assessed_value = Decimal(str(extracted_fields["assessed_value"]))
            updates["assessed_value"] = float(prop.assessed_value)

    elif category == "purchase_agreement":
        if extracted_fields.get("purchase_price") and not prop.purchase_price:
            prop.purchase_price = Decimal(str(extracted_fields["purchase_price"]))
            updates["purchase_price"] = float(prop.purchase_price)

    if updates:
        db.commit()

    return {
        "applied": bool(updates),
        "updates": updates,
        "confidence": confidence,
    }
