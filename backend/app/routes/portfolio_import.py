"""
Property Data Import — PDF and URL extraction
================================================
Extracts property data from uploaded PDFs (MLS listings, appraisals)
using OpenAI vision/text capabilities.
"""
import json
import re
import base64
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, PlatformSetting
from app.core.deps import require_gp_or_ops

router = APIRouter()


def _get_extraction_prompt(doc_context: str = "") -> str:
    return f"""You are a real estate data extraction expert. Extract ALL property details from this MLS listing document.

{doc_context}

Return ONLY a valid JSON object with these fields (use null for unavailable data):
{{
  "address": "full street address",
  "city": "city name",
  "province": "2-letter province code (AB, BC, ON, etc.)",
  "postal_code": "postal code",
  "list_price": number,
  "bedrooms": number (total including basement),
  "bathrooms": number,
  "building_sqft": number (main floor sqft),
  "total_finished_area": number (total livable sqft including basement),
  "lot_size": number (in sqft),
  "year_built": number,
  "property_type": "Single Family / Condo / Duplex / etc.",
  "building_type": "House / Townhouse / etc.",
  "property_style": "Bungalow / 2 Storey / etc.",
  "storeys": number,
  "garage": "type description or null",
  "neighbourhood": "neighbourhood name",
  "zoning": "zoning code",
  "mls_number": "MLS number",
  "tax_amount": number (annual),
  "tax_year": number,
  "assessed_value": number,
  "title_type": "Freehold / Condominium",
  "foundation_type": "Poured Concrete / Block / etc.",
  "construction_material": "Wood frame / Concrete / etc.",
  "exterior_finish": "Vinyl siding / Stucco / etc.",
  "basement_type": "Full Finished / Full Unfinished / Crawl Space / None",
  "heating_type": "Forced air Natural gas / Boiler / etc.",
  "cooling_type": "Central air / Wall unit / None",
  "flooring_types": "Carpeted, Laminate, Hardwood",
  "parking_type": "Double Attached Garage / Parking Pad / etc.",
  "parking_spaces": number,
  "frontage_m": number (lot frontage in metres),
  "land_depth_m": number (lot depth in metres),
  "appliances": "comma-separated list",
  "structures": "Shed, Deck, etc.",
  "has_fencing": boolean,
  "walk_score": number (0-100 if shown),
  "transit_score": number (0-100 if shown),
  "listing_description": "full property description text",
  "room_dimensions": [
    {{"level": "Main", "room": "Living Room", "width_ft": 11.42, "length_ft": 10.75}}
  ]
}}

Extract EVERY piece of data you can find. For room dimensions, include ALL rooms with their level, name, and dimensions in feet."""


@router.post("/extract-pdf")
async def extract_pdf_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Extract property data from an uploaded PDF (MLS listing, appraisal, etc.)
    using OpenAI to read and parse the document content."""

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file")

    # Read file
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
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

    # Try text extraction first, then fall back to image-based extraction
    text_content = ""
    try:
        import pypdf
        reader = pypdf.PdfReader(BytesIO(content))
        for page in reader.pages:
            page_text = page.extract_text() or ""
            text_content += page_text + "\n"
    except Exception:
        pass

    # Check if extracted text is actually readable (not garbled font codes)
    # Look for common English words as a better signal than char ratio
    common_words = ["the", "and", "for", "with", "this", "bedroom", "bathroom", "sqft", "price", "property"]
    text_lower = text_content.lower()
    word_matches = sum(1 for w in common_words if w in text_lower)
    is_readable = len(text_content.strip()) > 100 and word_matches >= 3

    if not is_readable:
        # Text extraction failed or garbled — convert pages to images for vision
        try:
            import subprocess
            import tempfile
            import os

            # Try using pdf2image if available
            try:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(content, first_page=1, last_page=min(7, len(reader.pages) if 'reader' in dir() else 7), dpi=150)
                image_messages = []
                for i, img in enumerate(images[:5]):
                    buf = BytesIO()
                    img.save(buf, format="JPEG", quality=80)
                    b64 = base64.b64encode(buf.getvalue()).decode()
                    image_messages.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "high"},
                    })

                # Use vision model with images
                response = client.chat.completions.create(
                    model="gpt-5.4",
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": _get_extraction_prompt()},
                            *image_messages,
                        ],
                    }],
                    temperature=0.2,
                    max_completion_tokens=3000,
                )
                result_text = response.choices[0].message.content or "{}"
                result_text = re.sub(r'^```(?:json)?\s*', '', result_text.strip())
                result_text = re.sub(r'\s*```$', '', result_text.strip())
                data = json.loads(result_text)
                if isinstance(data.get("room_dimensions"), list):
                    data["room_dimensions"] = json.dumps(data["room_dimensions"])
                return data
            except ImportError:
                pass  # pdf2image not available, continue with text approach

            # Last resort: send filename and ask AI to use web search to find the listing
            text_content = (
                f"I could not extract readable text from this PDF. "
                f"The filename is: {file.filename}\n"
                f"This appears to be a Canadian MLS real estate listing.\n"
                f"Please use any information from the filename to identify the property "
                f"and provide the best data you can. The raw garbled text follows "
                f"(font-encoded characters, try to decode patterns):\n\n"
                f"{text_content[:4000]}"
            )
        except Exception:
            text_content = (
                f"PDF file: {file.filename}, {len(content)} bytes. "
                f"Text extraction failed. Please extract what you can from the filename."
            )

    prompt = _get_extraction_prompt(f"DOCUMENT CONTENT:\n{text_content[:8000]}")

    try:
        # If text is not readable, try web search approach first using the filename
        if not is_readable and file.filename:
            # Extract address hint from filename
            name_parts = file.filename.replace(".pdf", "").replace("_", " ").replace(" - ", " ")
            try:
                search_response = client.responses.create(
                    model="gpt-5.4",
                    tools=[{"type": "web_search_preview"}],
                    input=(
                        f"Search for this Canadian real estate listing and extract ALL property details:\n"
                        f"Property: {name_parts}\n\n"
                        + _get_extraction_prompt()
                    ),
                )
                result_text = search_response.output_text or "{}"
                result_text = re.sub(r'^```(?:json)?\s*', '', result_text.strip())
                result_text = re.sub(r'\s*```$', '', result_text.strip())
                data = json.loads(result_text)
                if isinstance(data.get("room_dimensions"), list):
                    data["room_dimensions"] = json.dumps(data["room_dimensions"])
                return data
            except Exception:
                pass  # Fall through to text-based approach

        response = client.chat.completions.create(
            model="gpt-5.4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_completion_tokens=3000,
        )
        result_text = response.choices[0].message.content or "{}"

        # Strip markdown code fences
        result_text = re.sub(r'^```(?:json)?\s*', '', result_text.strip())
        result_text = re.sub(r'\s*```$', '', result_text.strip())

        data = json.loads(result_text)

        # Convert room_dimensions to JSON string if it's a list
        if isinstance(data.get("room_dimensions"), list):
            data["room_dimensions"] = json.dumps(data["room_dimensions"])

        return data

    except json.JSONDecodeError:
        raise HTTPException(500, "AI returned invalid JSON — try a clearer PDF")
    except Exception as e:
        raise HTTPException(500, f"PDF extraction failed: {str(e)[:200]}")
