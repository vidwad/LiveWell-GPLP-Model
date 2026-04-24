"""
Area Report routes — property-scoped PDF report generation.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import require_investor_or_above
from app.db.models import AreaReportJob, Property, User
from app.db.session import get_db
from app.services.area_report import spawn_job

router = APIRouter()


@router.post("/portfolio/{property_id}/area-report/generate")
def generate_area_report(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, detail="Property not found")

    job_id = spawn_job(db, property_id=property_id, user_id=current_user.user_id)
    return {"job_id": job_id, "status": "pending"}


@router.get("/portfolio/{property_id}/area-report/{job_id}")
def get_area_report_status(
    property_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    job = (
        db.query(AreaReportJob)
        .filter(AreaReportJob.id == job_id, AreaReportJob.property_id == property_id)
        .first()
    )
    if not job:
        raise HTTPException(404, detail="Report job not found")

    return {
        "job_id": job.id,
        "property_id": job.property_id,
        "status": job.status,
        "engine": job.engine,
        "error": job.error,
        "has_pdf": bool(job.pdf_file_path),
        "pdf_size": job.pdf_file_size,
        "created_at": str(job.created_at) if job.created_at else None,
        "updated_at": str(job.updated_at) if job.updated_at else None,
    }


@router.get("/portfolio/{property_id}/area-report/{job_id}/pdf")
def download_area_report_pdf(
    property_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    job = (
        db.query(AreaReportJob)
        .filter(AreaReportJob.id == job_id, AreaReportJob.property_id == property_id)
        .first()
    )
    if not job:
        raise HTTPException(404, detail="Report job not found")
    if job.status != "completed" or not job.pdf_file_path:
        raise HTTPException(409, detail=f"PDF not ready (status={job.status})")

    path = Path(job.pdf_file_path)
    if not path.exists():
        raise HTTPException(410, detail="PDF file missing on disk (possibly wiped on redeploy)")

    filename = f"property-{property_id}-area-report.pdf"
    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        filename=filename,
    )
