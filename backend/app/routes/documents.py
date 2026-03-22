"""
Document Management Routes
===========================
Handles secure file upload, listing, download, and viewed-status tracking
for investor documents (K-1s, subscription agreements, capital call notices, etc.).
"""
import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_or_ops, require_investor_or_above
from app.db.models import (
    DocumentType, Investor, InvestorDocument, Property,
    PropertyDocument, PropertyDocumentCategory, User, UserRole,
)
from app.db.session import get_db
from app.schemas.investor import DocumentOut
from app.services.storage import storage

router = APIRouter()

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
MAX_FILE_SIZE_MB = 20


def _get_doc_or_404(document_id: int, db: Session) -> InvestorDocument:
    doc = db.query(InvestorDocument).filter(
        InvestorDocument.document_id == document_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


def _check_investor_access(investor_id: int, current_user: User, db: Session) -> Investor:
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return inv


# ---------------------------------------------------------------------------
# Upload  (GP Admin / Ops Manager only)
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    investor_id: int = Form(...),
    title: str = Form(...),
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Upload a file and attach it to an investor record."""
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. "
                   f"Accepted: PDF, Word, Excel, JPEG, PNG.",
        )

    file_url = await storage.save(file, subfolder=f"investor_{investor_id}")

    doc = InvestorDocument(
        investor_id=investor_id,
        title=title,
        document_type=document_type,
        file_url=file_url,
        upload_date=datetime.datetime.utcnow(),
        is_viewed=False,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# ---------------------------------------------------------------------------
# List by investor
# ---------------------------------------------------------------------------

@router.get("/investor/{investor_id}", response_model=list[DocumentOut])
def list_investor_documents(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """List all documents for an investor, newest first."""
    _check_investor_access(investor_id, current_user, db)
    docs = (
        db.query(InvestorDocument)
        .filter(InvestorDocument.investor_id == investor_id)
        .order_by(InvestorDocument.upload_date.desc())
        .all()
    )
    return docs


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Stream a document file to the client."""
    doc = _get_doc_or_404(document_id, db)
    _check_investor_access(doc.investor_id, current_user, db)

    file_path = storage.get_path(doc.file_url)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    filename = Path(doc.file_url).name
    return FileResponse(
        path=str(file_path),
        filename=f"{doc.title}_{filename}",
        media_type="application/octet-stream",
    )


# ---------------------------------------------------------------------------
# Mark as viewed
# ---------------------------------------------------------------------------

@router.patch("/{document_id}/viewed", response_model=DocumentOut)
def mark_document_viewed(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Mark a document as viewed by the investor."""
    doc = _get_doc_or_404(document_id, db)
    _check_investor_access(doc.investor_id, current_user, db)

    doc.is_viewed = True
    db.commit()
    db.refresh(doc)
    return doc


# ---------------------------------------------------------------------------
# Property Documents
# ---------------------------------------------------------------------------

@router.get("/property/{property_id}")
def list_property_documents(
    property_id: int,
    category: PropertyDocumentCategory | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """List all documents for a property, optionally filtered by category."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")
    query = db.query(PropertyDocument).filter(PropertyDocument.property_id == property_id)
    if category:
        query = query.filter(PropertyDocument.category == category)
    docs = query.order_by(PropertyDocument.upload_date.desc()).all()

    return [
        {
            "document_id": d.document_id,
            "property_id": d.property_id,
            "title": d.title,
            "category": d.category.value,
            "file_url": d.file_url,
            "file_size_bytes": d.file_size_bytes,
            "expiry_date": str(d.expiry_date) if d.expiry_date else None,
            "notes": d.notes,
            "uploaded_by": d.uploaded_by,
            "upload_date": d.upload_date.isoformat() if d.upload_date else None,
        }
        for d in docs
    ]


@router.post("/property/{property_id}/upload", status_code=201)
async def upload_property_document(
    property_id: int,
    title: str = Form(...),
    category: PropertyDocumentCategory = Form(PropertyDocumentCategory.other),
    expiry_date: str | None = Form(None),
    notes: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Upload a document and attach it to a property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(400, f"File type '{file.content_type}' not allowed.")

    file_url = await storage.save(file, subfolder=f"property_{property_id}")

    # Get file size
    await file.seek(0)
    content = await file.read()
    file_size = len(content)

    parsed_expiry = None
    if expiry_date:
        try:
            parsed_expiry = datetime.datetime.strptime(expiry_date, "%Y-%m-%d").date()
        except ValueError:
            pass

    doc = PropertyDocument(
        property_id=property_id,
        title=title,
        category=category,
        file_url=file_url,
        file_size_bytes=file_size,
        expiry_date=parsed_expiry,
        notes=notes,
        uploaded_by=current_user.user_id,
        upload_date=datetime.datetime.utcnow(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "document_id": doc.document_id,
        "property_id": doc.property_id,
        "title": doc.title,
        "category": doc.category.value,
        "file_url": doc.file_url,
        "file_size_bytes": doc.file_size_bytes,
        "expiry_date": str(doc.expiry_date) if doc.expiry_date else None,
        "notes": doc.notes,
        "upload_date": doc.upload_date.isoformat(),
    }


@router.delete("/property-doc/{document_id}", status_code=204)
def delete_property_document(
    document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Delete a property document."""
    doc = db.query(PropertyDocument).filter(PropertyDocument.document_id == document_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    db.delete(doc)
    db.commit()


@router.get("/property-doc/{document_id}/download")
def download_property_document(
    document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """Download a property document."""
    doc = db.query(PropertyDocument).filter(PropertyDocument.document_id == document_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    file_path = storage.get_path(doc.file_url)
    if not file_path.exists():
        raise HTTPException(404, "File not found on server")

    filename = Path(doc.file_url).name
    return FileResponse(
        path=str(file_path),
        filename=f"{doc.title}_{filename}",
        media_type="application/octet-stream",
    )


@router.get("/all")
def list_all_documents(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """List all documents across all properties for the document hub."""
    prop_docs = (
        db.query(PropertyDocument)
        .join(Property)
        .order_by(PropertyDocument.upload_date.desc())
        .all()
    )

    result = []
    for d in prop_docs:
        result.append({
            "document_id": d.document_id,
            "source": "property",
            "property_id": d.property_id,
            "address": d.property.address if d.property else "Unknown",
            "title": d.title,
            "category": d.category.value,
            "file_url": d.file_url,
            "file_size_bytes": d.file_size_bytes,
            "expiry_date": str(d.expiry_date) if d.expiry_date else None,
            "notes": d.notes,
            "upload_date": d.upload_date.isoformat() if d.upload_date else None,
        })

    # Summary stats
    categories = {}
    for d in result:
        cat = d["category"]
        if cat not in categories:
            categories[cat] = 0
        categories[cat] += 1

    expiring_soon = [
        d for d in result
        if d["expiry_date"] and d["expiry_date"] <= str(
            (datetime.datetime.utcnow() + datetime.timedelta(days=90)).date()
        )
    ]

    return {
        "total_documents": len(result),
        "by_category": categories,
        "expiring_within_90_days": len(expiring_soon),
        "documents": result,
    }
