"""
LP Documents API
=================
LP-level template documents (Information Package, Partnership Agreement,
Banking Information, Subscription Agreement template, T5013 template, etc.).

GP-Admin upload, list, download, replace, delete. Investor read-only access
is available via the same list/download endpoints — gated to investors who
hold a position in the LP via the existing scope check elsewhere.
"""
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_gp_admin, require_investor_or_above
from app.db.models import LPDocument, LPEntity, User
from app.services.storage import LocalStorageBackend

router = APIRouter()

# ── Document type registry ──────────────────────────────────────────────────
# Single source of truth for the 10 document slots. Adding a new slot is just
# appending to this list — both backend validation and the frontend display
# read from this exact set (frontend has its own copy mirrored).

DOCUMENT_TYPES: dict[str, dict] = {
    "information_package": {
        "label": "Information Package",
        "description": "Offering memorandum / investor information package describing the LP, properties, strategy, and terms.",
        "required": True,
    },
    "indication_of_interest": {
        "label": "Indication of Interest",
        "description": "Blank IOI form for prospects to express interest before subscription.",
        "required": True,
    },
    "photo_id_kyc": {
        "label": "Photo ID (KYC)",
        "description": "Photo ID requirements / blank form for KYC compliance.",
        "required": True,
    },
    "proof_of_address": {
        "label": "Proof of Address",
        "description": "Proof of address requirements / blank form for KYC compliance.",
        "required": True,
    },
    "accreditation_certificate": {
        "label": "Accreditation Certificate",
        "description": "Accredited investor certificate template (e.g. NI 45-106 Form 45-106F9).",
        "required": True,
    },
    "aml_kyc_report": {
        "label": "AML/KYC Report",
        "description": "AML/KYC report template or compliance documentation.",
        "required": True,
    },
    "subscription_agreement": {
        "label": "Subscription Agreement",
        "description": "Blank subscription agreement template the investor signs to commit capital.",
        "required": True,
    },
    "partnership_agreement": {
        "label": "Partnership Agreement",
        "description": "Limited Partnership Agreement (LPA) governing the fund.",
        "required": True,
    },
    "banking_information": {
        "label": "Banking Information",
        "description": "Wire instructions and banking details for capital contributions.",
        "required": True,
    },
    "tax_form": {
        "label": "Tax Form (T5013 / W-8BEN)",
        "description": "Blank Canadian (T5013) or US (W-8BEN) tax form template.",
        "required": True,
    },
}


def _serialize(doc: LPDocument) -> dict:
    type_meta = DOCUMENT_TYPES.get(doc.document_type, {})
    return {
        "lp_document_id": doc.lp_document_id,
        "lp_id": doc.lp_id,
        "document_type": doc.document_type,
        "display_name": doc.display_name or type_meta.get("label", doc.document_type),
        "description": doc.description or type_meta.get("description"),
        "filename": doc.filename,
        "file_url": doc.file_url,
        "file_size": doc.file_size,
        "content_type": doc.content_type,
        "version": doc.version,
        "is_active": doc.is_active,
        "uploaded_by": doc.uploaded_by,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/lp/{lp_id}/documents/types")
def list_document_types(
    lp_id: int,
    current_user: User = Depends(require_investor_or_above),
):
    """Return the canonical document type registry. Used by the frontend
    to render an empty slot for every type even if no document is uploaded."""
    return {
        "types": [
            {"key": k, **v}
            for k, v in DOCUMENT_TYPES.items()
        ]
    }


@router.get("/lp/{lp_id}/documents")
def list_lp_documents(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """List all active documents for an LP."""
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(404, "LP not found")
    docs = (
        db.query(LPDocument)
        .filter(LPDocument.lp_id == lp_id, LPDocument.is_active == True)
        .order_by(LPDocument.document_type, LPDocument.version.desc())
        .all()
    )
    return [_serialize(d) for d in docs]


@router.post("/lp/{lp_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_lp_document(
    lp_id: int,
    document_type: str = Form(...),
    description: str = Form(""),
    display_name: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Upload a new document or new version of an existing document.

    If a document of the same type already exists for this LP, the new upload
    becomes a new version (version number increments) and the previous
    version is marked is_active=False (kept for audit but hidden from list).
    """
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(400, f"Unknown document_type. Must be one of: {list(DOCUMENT_TYPES.keys())}")

    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(404, "LP not found")

    # Save the file via the storage backend
    storage = LocalStorageBackend()
    file_url = await storage.save(file, subfolder=f"lp_documents/{lp_id}")

    # Determine the version: latest active doc of same type + 1
    latest = (
        db.query(LPDocument)
        .filter(LPDocument.lp_id == lp_id, LPDocument.document_type == document_type)
        .order_by(LPDocument.version.desc())
        .first()
    )
    next_version = (latest.version + 1) if latest else 1

    # Mark older versions inactive
    if latest:
        db.query(LPDocument).filter(
            LPDocument.lp_id == lp_id,
            LPDocument.document_type == document_type,
            LPDocument.is_active == True,
        ).update({LPDocument.is_active: False})

    doc = LPDocument(
        lp_id=lp_id,
        document_type=document_type,
        display_name=display_name or DOCUMENT_TYPES[document_type]["label"],
        description=description or DOCUMENT_TYPES[document_type]["description"],
        filename=file.filename,
        file_url=file_url,
        file_size=getattr(file, "size", 0) or 0,
        content_type=file.content_type,
        version=next_version,
        is_active=True,
        uploaded_by=current_user.user_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _serialize(doc)


@router.get("/lp-documents/{doc_id}/download")
def download_lp_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Stream the document file as an attachment download."""
    doc = db.query(LPDocument).filter(LPDocument.lp_document_id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    storage = LocalStorageBackend()
    fp = storage.get_path(doc.file_url)
    if not fp.exists():
        raise HTTPException(404, "File missing on disk")
    return FileResponse(
        path=str(fp),
        media_type=doc.content_type or "application/octet-stream",
        filename=doc.filename,
    )


@router.patch("/lp-documents/{doc_id}")
def update_lp_document_metadata(
    doc_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Update document metadata (display name, description, is_active).
    Does NOT replace the file — use the upload endpoint for a new version."""
    doc = db.query(LPDocument).filter(LPDocument.lp_document_id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    for k in ("display_name", "description", "is_active"):
        if k in payload:
            setattr(doc, k, payload[k])
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return _serialize(doc)


@router.post("/lp-documents/{doc_id}/email")
def email_lp_document(
    doc_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Email an LP document directly to a contact (typically an investor or
    prospect). The recipient address is provided in the payload — typically
    pulled from the investor record on the calling page."""
    doc = db.query(LPDocument).filter(LPDocument.lp_document_id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    storage = LocalStorageBackend()
    fp = storage.get_path(doc.file_url)
    if not fp.exists():
        raise HTTPException(404, "File missing on disk")

    to_email = (payload or {}).get("to_email")
    recipient_name = (payload or {}).get("recipient_name") or ""
    custom_message = (payload or {}).get("message") or ""
    if not to_email:
        raise HTTPException(400, "to_email is required")

    # Resolve LP name for the email subject
    lp = db.query(LPEntity).filter(LPEntity.lp_id == doc.lp_id).first()
    lp_name = lp.name if lp else f"LP {doc.lp_id}"
    doc_label = doc.display_name or doc.document_type

    try:
        from app.services.email import _get_resend_config
        api_key, from_email = _get_resend_config()
        if not api_key:
            raise HTTPException(500, "Resend API key not configured (set RESEND_API_KEY in Settings)")
        try:
            import resend
        except ImportError:
            raise HTTPException(500, "resend package not installed")
        import base64
        resend.api_key = api_key

        pdf_bytes = fp.read_bytes()
        attachment_b64 = base64.b64encode(pdf_bytes).decode("ascii")

        greeting = f"Hi {recipient_name}," if recipient_name else "Hi,"
        message_block = ""
        if custom_message:
            message_block = (
                f'<div style="background:#f8f9fa;border-left:4px solid #6366f1;'
                f'padding:14px;margin:18px 0;border-radius:4px;">'
                f'<p style="margin:0;color:#4b5563;font-style:italic;">{custom_message}</p>'
                f"</div>"
            )

        params = {
            "from": from_email,
            "to": [to_email],
            "subject": f"{doc_label} — {lp_name}",
            "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                  <p>{greeting}</p>
                  <p>Please find attached the <strong>{doc_label}</strong> for our
                  <strong>{lp_name}</strong> offering.</p>
                  {message_block}
                  <p>If you have any questions, please reply to this email.</p>
                  <p>— Living Well Communities</p>
                </div>
            """,
            "attachments": [
                {
                    "filename": doc.filename,
                    "content": attachment_b64,
                }
            ],
        }
        resend.Emails.send(params)
        return {"ok": True, "delivered_to": to_email, "document": doc_label, "lp": lp_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Email delivery failed: {type(e).__name__}: {e}")


@router.delete("/lp-documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lp_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Hard-delete a document and remove the file from disk."""
    doc = db.query(LPDocument).filter(LPDocument.lp_document_id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    storage = LocalStorageBackend()
    try:
        fp = storage.get_path(doc.file_url)
        if fp.exists():
            fp.unlink()
    except Exception:
        pass
    db.delete(doc)
    db.commit()
    return None
