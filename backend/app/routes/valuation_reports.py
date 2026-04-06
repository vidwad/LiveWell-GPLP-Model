"""
Valuation Reports API
=====================
Endpoints for the AI-assisted Management Appraisal Report pipeline.

POST   /api/portfolio/properties/{property_id}/valuation-reports        — start a new job
GET    /api/portfolio/properties/{property_id}/valuation-reports        — list jobs for a property
GET    /api/portfolio/valuation-reports/{job_id}                        — fetch a single job
GET    /api/portfolio/valuation-reports/{job_id}/download               — download the PDF
PATCH  /api/portfolio/valuation-reports/{job_id}                        — reviewer notes / status
"""
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_gp_or_ops, require_investor_or_above
from app.db.session import get_db
from app.db.models import ValuationReportJob, Property, User
from app.services.valuation_report import start_job_in_background

router = APIRouter()


class StartReportRequest(BaseModel):
    effective_date: date | None = None
    deliver_to_email: str | None = None


class ValuationReportJobOut(BaseModel):
    id: int
    property_id: int
    status: str
    error: str | None = None
    effective_date: date | None = None
    draft_version: int
    public_research_response_id: str | None = None
    synthesis_response_id: str | None = None
    property_vector_store_id: str | None = None
    has_pdf: bool = False
    has_research: bool = False
    reviewer_status: str
    reviewer_notes: str | None = None
    issued_at: datetime | None = None
    deliver_to_email: str | None = None
    delivered_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def _to_out(job: ValuationReportJob) -> ValuationReportJobOut:
    return ValuationReportJobOut(
        id=job.id,
        property_id=job.property_id,
        status=job.status,
        error=job.error,
        effective_date=job.effective_date,
        draft_version=job.draft_version,
        public_research_response_id=job.public_research_response_id,
        synthesis_response_id=job.synthesis_response_id,
        property_vector_store_id=job.property_vector_store_id,
        has_pdf=bool(job.report_artifact_path and Path(job.report_artifact_path).exists()),
        has_research=bool(job.research_artifact_path and Path(job.research_artifact_path).exists()),
        reviewer_status=job.reviewer_status,
        reviewer_notes=job.reviewer_notes,
        issued_at=job.issued_at,
        deliver_to_email=job.deliver_to_email,
        delivered_at=job.delivered_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.post("/properties/{property_id}/valuation-reports", response_model=ValuationReportJobOut, status_code=status.HTTP_201_CREATED)
def start_valuation_report(
    property_id: int,
    payload: StartReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Kick off a new AI-assisted valuation report draft. Runs in background."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Default delivery to the requesting user's email if none provided
    deliver_to = payload.deliver_to_email or getattr(current_user, "email", None)

    # Determine next draft version for this property
    last = (
        db.query(ValuationReportJob)
        .filter(ValuationReportJob.property_id == property_id)
        .order_by(ValuationReportJob.draft_version.desc())
        .first()
    )
    next_version = (last.draft_version + 1) if last else 1

    job = ValuationReportJob(
        property_id=property_id,
        status="pending",
        effective_date=payload.effective_date or date.today(),
        draft_version=next_version,
        deliver_to_email=deliver_to,
        created_by=current_user.user_id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    start_job_in_background(job.id)
    return _to_out(job)


@router.get("/properties/{property_id}/valuation-reports", response_model=list[ValuationReportJobOut])
def list_valuation_reports(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    rows = (
        db.query(ValuationReportJob)
        .filter(ValuationReportJob.property_id == property_id)
        .order_by(ValuationReportJob.created_at.desc())
        .all()
    )
    return [_to_out(j) for j in rows]


@router.get("/valuation-reports/{job_id}", response_model=ValuationReportJobOut)
def get_valuation_report(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    job = db.query(ValuationReportJob).filter(ValuationReportJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return _to_out(job)


@router.get("/valuation-reports/{job_id}/download")
def download_valuation_report(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    job = db.query(ValuationReportJob).filter(ValuationReportJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if not job.report_artifact_path:
        raise HTTPException(404, "Report not yet rendered")
    pdf_path = Path(job.report_artifact_path)
    if not pdf_path.exists():
        raise HTTPException(404, "PDF artifact missing on disk")
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=pdf_path.name,
    )


class ReviewUpdate(BaseModel):
    reviewer_status: str | None = None  # draft, in_review, approved, issued
    reviewer_notes: str | None = None


@router.delete("/valuation-reports/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_valuation_report(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Delete a report job and its on-disk artifacts (PDF, markdown, JSON)."""
    job = db.query(ValuationReportJob).filter(ValuationReportJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    # Best-effort cleanup of artifacts. We delete the entire per-job directory
    # so we don't leak files when the schema evolves.
    import shutil
    artifact_paths = [
        job.subject_package_path,
        job.research_artifact_path,
        job.synthesis_markdown_path,
        job.report_artifact_path,
        job.source_log_path,
    ]
    job_dirs = set()
    for p in artifact_paths:
        if not p:
            continue
        try:
            path = Path(p)
            if path.exists():
                # Track parent directory; remove the whole thing once
                if path.parent.name.startswith(f"job-{job.id}"):
                    job_dirs.add(path.parent)
                else:
                    path.unlink(missing_ok=True)
        except Exception:
            pass
    for d in job_dirs:
        try:
            shutil.rmtree(d, ignore_errors=True)
        except Exception:
            pass

    db.delete(job)
    db.commit()
    return None


@router.patch("/valuation-reports/{job_id}", response_model=ValuationReportJobOut)
def update_review(
    job_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    job = db.query(ValuationReportJob).filter(ValuationReportJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if payload.reviewer_status is not None:
        job.reviewer_status = payload.reviewer_status
        if payload.reviewer_status == "issued" and not job.issued_at:
            job.issued_at = datetime.utcnow()
    if payload.reviewer_notes is not None:
        job.reviewer_notes = payload.reviewer_notes
    job.reviewed_by = current_user.user_id
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return _to_out(job)
