"""
Database Backup & Restore API
==============================
Developer-only endpoints for the two-layer backup system. See
app/services/backup_service.py for the underlying implementation.
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_developer
from app.db.session import get_db
from app.db.models import User, DatabaseBackup
from app.services import backup_service

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateBackupRequest(BaseModel):
    backup_type: str  # 'logical' or 'physical'
    description: str | None = None


class RestoreRequest(BaseModel):
    dry_run: bool = True  # default to safe preview
    confirm: bool = False  # required when dry_run=False


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/")
def list_all_backups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """List every backup currently stored, newest first."""
    return backup_service.list_backups(db)


@router.post("/")
def create_backup(
    payload: CreateBackupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """Create a new logical OR physical backup. Auto-rotates the oldest of
    the same type if >= 3 already exist."""
    if payload.backup_type not in ("logical", "physical"):
        raise HTTPException(400, "backup_type must be 'logical' or 'physical'")
    try:
        if payload.backup_type == "logical":
            backup = backup_service.create_logical_backup(db, current_user, payload.description)
        else:
            backup = backup_service.create_physical_backup(db, current_user, payload.description)
    except NotImplementedError as e:
        raise HTTPException(501, str(e))
    except Exception as e:
        import traceback
        raise HTTPException(500, f"{type(e).__name__}: {e}\n{traceback.format_exc()[:500]}")

    return {
        "backup_id": backup.backup_id,
        "backup_type": backup.backup_type,
        "filename": backup.filename,
        "size_bytes": backup.size_bytes,
        "created_at": backup.created_at.isoformat() if backup.created_at else None,
    }


@router.get("/{backup_id}/download")
def download_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """Download the backup file for off-site storage."""
    fp = backup_service.get_backup_file_path(db, backup_id)
    if not fp:
        raise HTTPException(404, "Backup file not found")
    return FileResponse(
        path=str(fp),
        media_type="application/octet-stream",
        filename=fp.name,
    )


@router.post("/upload")
async def upload_backup(
    backup_type: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """Upload a previously-downloaded backup file (e.g. restoring from
    off-site storage). Records it as a new backup row."""
    if backup_type not in ("logical", "physical"):
        raise HTTPException(400, "backup_type must be 'logical' or 'physical'")

    backup_service._enforce_rotation(db, backup_type)

    from datetime import datetime
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    if backup_type == "logical":
        suffix = ".json.gz" if file.filename.endswith(".gz") else ".json"
    else:
        suffix = ".sqlite"
    filename = f"{backup_type}_uploaded_{timestamp}{suffix}"
    file_path = backup_service.BACKUP_ROOT / filename
    contents = await file.read()
    file_path.write_bytes(contents)

    backup = DatabaseBackup(
        backup_type=backup_type,
        filename=filename,
        file_path=str(file_path),
        size_bytes=len(contents),
        description=f"[Uploaded] {description}" if description else "[Uploaded]",
        created_by=current_user.user_id,
    )
    db.add(backup)
    db.commit()
    db.refresh(backup)
    return {"backup_id": backup.backup_id, "filename": filename, "size_bytes": len(contents)}


@router.post("/{backup_id}/restore")
def restore_backup(
    backup_id: int,
    payload: RestoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """Restore a backup. Two-phase by default:
       1. Call with dry_run=true to preview the diff
       2. Call again with dry_run=false AND confirm=true to commit
    """
    backup = db.query(DatabaseBackup).filter(DatabaseBackup.backup_id == backup_id).first()
    if not backup:
        raise HTTPException(404, "Backup not found")

    if backup.backup_type == "logical":
        if not payload.dry_run and not payload.confirm:
            raise HTTPException(
                400,
                "Live restore requires confirm=true. Run with dry_run=true first to preview the diff.",
            )
        try:
            report = backup_service.restore_logical_backup(db, backup_id, dry_run=payload.dry_run)
            return report
        except Exception as e:
            import traceback
            raise HTTPException(500, f"{type(e).__name__}: {e}\n{traceback.format_exc()[:500]}")

    elif backup.backup_type == "physical":
        if payload.dry_run:
            # No dry-run for physical — return a "what would happen" summary
            import json as _json
            try:
                fp_data = _json.loads(backup.schema_fingerprint or "{}")
                rc_data = _json.loads(backup.row_counts or "{}")
            except Exception:
                fp_data, rc_data = {}, {}
            return {
                "backup_id": backup_id,
                "dry_run": True,
                "warning": "Physical restore replaces the entire database file. There is no per-row diff.",
                "backup_table_count": len(fp_data.get("table_names") or []),
                "backup_row_counts": rc_data,
                "summary": {
                    "tables_processed": len(fp_data.get("table_names") or []),
                    "rows_inserted": 0,
                    "rows_updated": sum(v for v in rc_data.values() if isinstance(v, int) and v > 0),
                    "rows_skipped_orphan": 0,
                    "warnings": ["Physical restore is destructive — all current data is replaced."],
                },
            }
        if not payload.confirm:
            raise HTTPException(
                400,
                "Physical restore requires confirm=true. THIS WILL REPLACE THE ENTIRE DATABASE.",
            )
        try:
            result = backup_service.restore_physical_backup(db, backup_id)
            return result
        except Exception as e:
            raise HTTPException(500, f"{type(e).__name__}: {e}")
    else:
        raise HTTPException(400, f"Unknown backup type: {backup.backup_type}")


@router.delete("/{backup_id}", status_code=204)
def delete_backup_endpoint(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """Delete a backup row and its on-disk file."""
    ok = backup_service.delete_backup(db, backup_id)
    if not ok:
        raise HTTPException(404, "Backup not found")
    return None
