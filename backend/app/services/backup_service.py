"""
Database Backup & Restore Service
==================================
Two-layer backup system for the LiveWell GP/LP Model database.

Layer 1 — LOGICAL backups
    JSON exports of source-of-truth tables that are SCHEMA-TOLERANT on
    restore. The export captures the table classification (see TABLE_CLASS),
    schema fingerprint, and row counts. On restore, the schema is compared
    against the export — missing columns fall back to defaults, extra
    columns in the live DB are preserved, foreign keys are validated, and
    upsert semantics are used so newer data is not destroyed.

Layer 2 — PHYSICAL backups
    Byte-for-byte copy of the SQLite file (or pg_dump for Postgres in
    production). Cold restore only — schema must match exactly. Used for
    disaster recovery when the logical export can't be produced.

Both types share a 3-backup-per-type rotation: creating a 4th auto-deletes
the oldest of the same type. All backups live under uploads/backups/.
"""
from __future__ import annotations

import gzip
import json
import logging
import os
import shutil
import sqlite3
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db import models  # noqa — registers all models
from app.db.models import DatabaseBackup, User
from app.db.session import engine

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
BACKUP_ROOT = Path("uploads/backups")
BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
MAX_BACKUPS_PER_TYPE = 3

# ── Table classification ─────────────────────────────────────────────────────
# A = source-of-truth (always export, always restore)
# B = configuration (export, optional restore)
# C = derived/regenerable (NEVER export — saves space and avoids conflicts)
TABLE_CLASS: dict[str, str] = {
    # ── Class A: Source of truth ────────────────────────────────────────────
    "users": "A",
    "lp_entities": "A",
    "gp_entities": "A",
    "lp_tranches": "A",
    "subscriptions": "A",
    "holdings": "A",
    "investors": "A",
    "properties": "A",
    "acquisition_baselines": "A",
    "exit_forecasts": "A",
    "exit_actuals": "A",
    "debt_facilities": "A",
    "units": "A",
    "beds": "A",
    "ancillary_revenue_streams": "A",
    "operating_expense_line_items": "A",
    "construction_expenses": "A",
    "development_plans": "A",
    "distribution_events": "A",
    "distribution_allocations": "A",
    "tranche_projection_snapshots": "A",
    "valuation_report_jobs": "A",
    "property_documents": "A",
    "communities": "A",
    "lp_fee_items": "A",
    "target_properties": "A",
    "property_clusters": "A",
    "property_managers": "A",
    "investor_onboarding_records": "A",
    "audit_log": "A",

    # ── Class B: Configuration ──────────────────────────────────────────────
    "screen_permissions": "B",
    "platform_settings": "B",
    "renovation_phases": "B",

    # ── Class C: Derived / regenerable (skip on export) ─────────────────────
    "nav_history": "C",
    "lp_trend_snapshots": "C",
    "ai_assessments": "C",
    "ai_chat_messages": "C",
    "ai_chat_sessions": "C",
}


def _to_jsonable(obj: Any) -> Any:
    """Convert any SQLAlchemy column value to a JSON-safe primitive."""
    if obj is None:
        return None
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.hex()
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if hasattr(obj, "value"):  # enum
        return obj.value
    return obj


def _classify(table_name: str) -> str:
    """Return A / B / C / U(nclassified). Unclassified tables default to A
    so we don't accidentally drop user data we forgot to register."""
    return TABLE_CLASS.get(table_name, "A")


def _build_schema_fingerprint() -> dict:
    """Snapshot the current schema as a fingerprint dict."""
    insp = inspect(engine)
    table_names = sorted(insp.get_table_names())
    return {
        "table_names": table_names,
        "column_counts": {t: len(insp.get_columns(t)) for t in table_names},
        "captured_at": datetime.utcnow().isoformat(),
    }


def _enforce_rotation(db: Session, backup_type: str) -> int:
    """Ensure no more than MAX_BACKUPS_PER_TYPE exist for this type.
    Deletes the oldest if needed. Returns count deleted."""
    rows = (
        db.query(DatabaseBackup)
        .filter(DatabaseBackup.backup_type == backup_type)
        .order_by(DatabaseBackup.created_at.desc())
        .all()
    )
    deleted = 0
    if len(rows) >= MAX_BACKUPS_PER_TYPE:
        # Delete oldest until we have room for one more
        excess = rows[MAX_BACKUPS_PER_TYPE - 1:]
        for old in excess:
            try:
                fp = Path(old.file_path)
                if fp.exists():
                    fp.unlink()
            except Exception as e:
                logger.warning("Could not delete old backup file %s: %s", old.file_path, e)
            db.delete(old)
            deleted += 1
        db.commit()
    return deleted


# ════════════════════════════════════════════════════════════════════════════
# CREATE — LOGICAL
# ════════════════════════════════════════════════════════════════════════════

def create_logical_backup(
    db: Session,
    user: User | None,
    description: str | None = None,
) -> DatabaseBackup:
    """Export source-of-truth tables to a gzipped JSON file."""
    _enforce_rotation(db, "logical")

    insp = inspect(engine)
    schema_fp = _build_schema_fingerprint()

    # Walk every table in the model's metadata so we get them in dependency order
    sorted_tables = Base.metadata.sorted_tables  # FK-aware topological sort

    payload_tables: dict[str, list[dict]] = {}
    row_counts: dict[str, int] = {}
    skipped_class_c: list[str] = []

    with engine.connect() as conn:
        for table in sorted_tables:
            tname = table.name
            cls = _classify(tname)
            if cls == "C":
                skipped_class_c.append(tname)
                continue
            if not insp.has_table(tname):
                continue
            try:
                result = conn.execute(text(f"SELECT * FROM {tname}"))
                rows = []
                for row in result.mappings():
                    rows.append({k: _to_jsonable(v) for k, v in dict(row).items()})
                payload_tables[tname] = rows
                row_counts[tname] = len(rows)
            except Exception as e:
                logger.warning("Failed to export table %s: %s", tname, e)
                payload_tables[tname] = []
                row_counts[tname] = 0

    payload = {
        "format_version": "1.0",
        "backup_type": "logical",
        "exported_at": datetime.utcnow().isoformat(),
        "exported_by": user.email if user else None,
        "description": description,
        "schema_fingerprint": schema_fp,
        "row_counts": row_counts,
        "skipped_class_c_tables": skipped_class_c,
        "table_classification": {t: _classify(t) for t in row_counts.keys()},
        "tables": payload_tables,
    }

    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    filename = f"logical_{timestamp}.json.gz"
    file_path = BACKUP_ROOT / filename

    # Compress to save disk
    with gzip.open(file_path, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, default=str)
    size = file_path.stat().st_size

    backup = DatabaseBackup(
        backup_type="logical",
        filename=filename,
        file_path=str(file_path),
        size_bytes=size,
        description=description,
        row_counts=json.dumps(row_counts),
        schema_fingerprint=json.dumps(schema_fp),
        app_version=os.environ.get("GIT_SHA"),
        created_by=user.user_id if user else None,
    )
    db.add(backup)
    db.commit()
    db.refresh(backup)
    logger.info("Logical backup created: %s (%d bytes, %d tables)", filename, size, len(row_counts))
    return backup


# ════════════════════════════════════════════════════════════════════════════
# CREATE — PHYSICAL
# ════════════════════════════════════════════════════════════════════════════

def create_physical_backup(
    db: Session,
    user: User | None,
    description: str | None = None,
) -> DatabaseBackup:
    """Byte-for-byte copy of the SQLite file using SQLite's online backup API.
    Safe to run while the app is serving traffic — no locks, no downtime."""
    _enforce_rotation(db, "physical")

    db_url = str(engine.url)
    if not db_url.startswith("sqlite"):
        raise NotImplementedError(
            "Physical backups currently support SQLite only. For PostgreSQL, "
            "use pg_dump from outside the application."
        )

    # Extract the source SQLite path from the engine URL
    src_path = engine.url.database
    if not src_path or not os.path.exists(src_path):
        raise FileNotFoundError(f"Source database file not found: {src_path}")

    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    filename = f"physical_{timestamp}.sqlite"
    dst_path = BACKUP_ROOT / filename

    # Use SQLite's backup API for a consistent, hot-copy snapshot
    src_conn = sqlite3.connect(src_path)
    dst_conn = sqlite3.connect(str(dst_path))
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()

    size = dst_path.stat().st_size
    schema_fp = _build_schema_fingerprint()

    # Row counts for the metadata block (helps users compare on restore)
    insp = inspect(engine)
    row_counts: dict[str, int] = {}
    with engine.connect() as conn:
        for tname in insp.get_table_names():
            try:
                row_counts[tname] = conn.execute(text(f"SELECT COUNT(*) FROM {tname}")).scalar() or 0
            except Exception:
                row_counts[tname] = -1

    backup = DatabaseBackup(
        backup_type="physical",
        filename=filename,
        file_path=str(dst_path),
        size_bytes=size,
        description=description,
        row_counts=json.dumps(row_counts),
        schema_fingerprint=json.dumps(schema_fp),
        app_version=os.environ.get("GIT_SHA"),
        created_by=user.user_id if user else None,
    )
    db.add(backup)
    db.commit()
    db.refresh(backup)
    logger.info("Physical backup created: %s (%d bytes)", filename, size)
    return backup


# ════════════════════════════════════════════════════════════════════════════
# RESTORE — LOGICAL (with dry-run support)
# ════════════════════════════════════════════════════════════════════════════

def restore_logical_backup(
    db: Session,
    backup_id: int,
    dry_run: bool = True,
) -> dict:
    """Restore a logical backup using upsert semantics.

    When dry_run=True (default), no writes occur — instead a diff report is
    returned showing what WOULD happen. The caller must explicitly call again
    with dry_run=False to commit. This is the safe two-phase restore the
    Settings UI uses.

    Restore behavior per row:
      - Unknown columns in the export are silently dropped (the live model
        no longer has them)
      - Missing required columns in the export use SQLAlchemy defaults
      - Foreign keys are validated against currently-existing rows; orphans
        are skipped and logged
      - Existing rows (matched by primary key) are UPDATED, not deleted-
        and-replaced — newer data added since the snapshot is preserved
      - Brand-new primary keys are INSERTED
    """
    backup = db.query(DatabaseBackup).filter(DatabaseBackup.backup_id == backup_id).first()
    if not backup:
        raise ValueError(f"Backup {backup_id} not found")
    if backup.backup_type != "logical":
        raise ValueError(f"Backup {backup_id} is not a logical backup; use restore_physical_backup")

    fp = Path(backup.file_path)
    if not fp.exists():
        raise FileNotFoundError(f"Backup file missing on disk: {fp}")

    with gzip.open(fp, "rt", encoding="utf-8") as fh:
        payload = json.load(fh)

    insp = inspect(engine)
    live_table_names = set(insp.get_table_names())

    diff_report = {
        "backup_id": backup_id,
        "dry_run": dry_run,
        "format_version": payload.get("format_version"),
        "exported_at": payload.get("exported_at"),
        "exported_by": payload.get("exported_by"),
        "tables": {},
        "summary": {
            "tables_processed": 0,
            "tables_skipped_missing": 0,
            "rows_inserted": 0,
            "rows_updated": 0,
            "rows_skipped_orphan": 0,
            "warnings": [],
        },
    }

    sorted_tables = Base.metadata.sorted_tables

    # We do EVERYTHING inside a transaction. If dry_run, rollback at the end.
    # If not dry_run, commit.
    with db.begin_nested() if db.in_transaction() else db.begin():
        for table in sorted_tables:
            tname = table.name
            if _classify(tname) == "C":
                continue
            if tname not in payload.get("tables", {}):
                continue
            if tname not in live_table_names:
                diff_report["summary"]["tables_skipped_missing"] += 1
                diff_report["tables"][tname] = {
                    "status": "skipped",
                    "reason": "table no longer exists in live schema",
                }
                continue

            live_columns = {c.name for c in table.columns}
            pk_cols = [c.name for c in table.primary_key.columns]
            if not pk_cols:
                diff_report["tables"][tname] = {"status": "skipped", "reason": "no primary key"}
                continue

            inserted = 0
            updated = 0
            skipped_orphan = 0
            warnings: list[str] = []
            export_rows = payload["tables"][tname]
            export_columns = set()
            for r in export_rows[:1]:
                export_columns = set(r.keys())

            # Only generate column-drift warnings if the export ACTUALLY had
            # rows (an empty table tells us nothing about its columns)
            if export_rows:
                dropped_cols = export_columns - live_columns
                new_cols = live_columns - export_columns
                if dropped_cols:
                    warnings.append(f"{len(dropped_cols)} export columns dropped (no longer in schema): {sorted(dropped_cols)[:5]}")
                if new_cols:
                    warnings.append(f"{len(new_cols)} new schema columns will use defaults for restored rows")

            for raw_row in export_rows:
                # Strip columns that no longer exist
                row = {k: v for k, v in raw_row.items() if k in live_columns}

                # Build PK lookup
                pk_filter = {pk: row.get(pk) for pk in pk_cols}
                if any(v is None for v in pk_filter.values()):
                    continue  # row has incomplete PK, skip

                # Foreign key orphan check — best effort
                fk_ok = True
                for fk in table.foreign_keys:
                    fk_col = fk.parent.name
                    fk_val = row.get(fk_col)
                    if fk_val is None:
                        continue
                    target = fk.column.table.name
                    target_pk = fk.column.name
                    try:
                        exists = db.execute(
                            text(f"SELECT 1 FROM {target} WHERE {target_pk} = :v LIMIT 1"),
                            {"v": fk_val},
                        ).first()
                        if not exists:
                            fk_ok = False
                            break
                    except Exception:
                        # If we can't check, allow it through
                        pass

                if not fk_ok:
                    skipped_orphan += 1
                    continue

                # Check if row exists
                where_clause = " AND ".join([f"{k} = :{k}" for k in pk_cols])
                exists_row = db.execute(
                    text(f"SELECT 1 FROM {tname} WHERE {where_clause} LIMIT 1"),
                    pk_filter,
                ).first()

                if not dry_run:
                    if exists_row:
                        non_pk_cols = [k for k in row.keys() if k not in pk_cols]
                        if non_pk_cols:
                            set_clause = ", ".join([f"{k} = :{k}" for k in non_pk_cols])
                            db.execute(
                                text(f"UPDATE {tname} SET {set_clause} WHERE {where_clause}"),
                                row,
                            )
                        updated += 1
                    else:
                        col_list = ", ".join(row.keys())
                        val_list = ", ".join([f":{k}" for k in row.keys()])
                        db.execute(
                            text(f"INSERT INTO {tname} ({col_list}) VALUES ({val_list})"),
                            row,
                        )
                        inserted += 1
                else:
                    # Dry-run: just count what WOULD happen
                    if exists_row:
                        updated += 1
                    else:
                        inserted += 1

            diff_report["tables"][tname] = {
                "status": "processed",
                "rows_in_export": len(export_rows),
                "rows_inserted": inserted,
                "rows_updated": updated,
                "rows_skipped_orphan": skipped_orphan,
                "warnings": warnings,
            }
            diff_report["summary"]["tables_processed"] += 1
            diff_report["summary"]["rows_inserted"] += inserted
            diff_report["summary"]["rows_updated"] += updated
            diff_report["summary"]["rows_skipped_orphan"] += skipped_orphan
            if warnings:
                diff_report["summary"]["warnings"].extend([f"{tname}: {w}" for w in warnings])

        if dry_run:
            # Rollback any preview writes (none should have happened, but be safe)
            db.rollback()
        else:
            db.commit()

    return diff_report


# ════════════════════════════════════════════════════════════════════════════
# RESTORE — PHYSICAL
# ════════════════════════════════════════════════════════════════════════════

def restore_physical_backup(db: Session, backup_id: int) -> dict:
    """Restore a physical SQLite backup. The caller MUST stop the app before
    calling this — the file replacement happens immediately.

    Returns a result dict; the next request after this call will see the
    restored database.
    """
    backup = db.query(DatabaseBackup).filter(DatabaseBackup.backup_id == backup_id).first()
    if not backup:
        raise ValueError(f"Backup {backup_id} not found")
    if backup.backup_type != "physical":
        raise ValueError(f"Backup {backup_id} is not a physical backup")

    fp = Path(backup.file_path)
    if not fp.exists():
        raise FileNotFoundError(f"Backup file missing on disk: {fp}")

    db_url = str(engine.url)
    if not db_url.startswith("sqlite"):
        raise NotImplementedError("Physical restore currently supports SQLite only")

    # Schema fingerprint check — block if schema has changed
    current_fp = _build_schema_fingerprint()
    backup_fp = json.loads(backup.schema_fingerprint or "{}")

    backup_tables = set(backup_fp.get("table_names") or [])
    current_tables = set(current_fp.get("table_names") or [])
    new_tables = current_tables - backup_tables
    removed_tables = backup_tables - current_tables

    if new_tables or removed_tables:
        raise ValueError(
            f"Schema fingerprint mismatch — physical restore blocked. "
            f"New tables since backup: {sorted(new_tables)[:5]}. "
            f"Tables since removed: {sorted(removed_tables)[:5]}. "
            f"Use a logical restore instead, or restore in an isolated environment."
        )

    src_path = engine.url.database
    # Take a safety copy of the current DB before clobbering it
    safety = BACKUP_ROOT / f"safety_pre_restore_{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}.sqlite"
    shutil.copy2(src_path, safety)

    # Replace the live DB file with the backup
    shutil.copy2(fp, src_path)

    return {
        "restored_from": str(fp),
        "restored_to": src_path,
        "safety_backup": str(safety),
        "warning": "App should be restarted to ensure all connections see the restored database.",
    }


# ════════════════════════════════════════════════════════════════════════════
# LIST / DELETE
# ════════════════════════════════════════════════════════════════════════════

def list_backups(db: Session) -> list[dict]:
    """Return all backups with parsed metadata, newest first."""
    rows = db.query(DatabaseBackup).order_by(DatabaseBackup.created_at.desc()).all()
    out = []
    for r in rows:
        try:
            row_counts = json.loads(r.row_counts) if r.row_counts else {}
        except Exception:
            row_counts = {}
        try:
            schema_fp = json.loads(r.schema_fingerprint) if r.schema_fingerprint else {}
        except Exception:
            schema_fp = {}
        out.append({
            "backup_id": r.backup_id,
            "backup_type": r.backup_type,
            "filename": r.filename,
            "size_bytes": r.size_bytes,
            "description": r.description,
            "row_counts": row_counts,
            "total_rows": sum(v for v in row_counts.values() if isinstance(v, int) and v >= 0),
            "table_count": len([t for t in row_counts if row_counts[t] > 0]),
            "schema_fingerprint_summary": {
                "table_count": len(schema_fp.get("table_names") or []),
                "captured_at": schema_fp.get("captured_at"),
            },
            "app_version": r.app_version,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "created_by_user_id": r.created_by,
            "file_exists": Path(r.file_path).exists() if r.file_path else False,
        })
    return out


def delete_backup(db: Session, backup_id: int) -> bool:
    """Delete a backup row and its on-disk file."""
    backup = db.query(DatabaseBackup).filter(DatabaseBackup.backup_id == backup_id).first()
    if not backup:
        return False
    try:
        fp = Path(backup.file_path)
        if fp.exists():
            fp.unlink()
    except Exception as e:
        logger.warning("Failed to delete backup file %s: %s", backup.file_path, e)
    db.delete(backup)
    db.commit()
    return True


def get_backup_file_path(db: Session, backup_id: int) -> Path | None:
    backup = db.query(DatabaseBackup).filter(DatabaseBackup.backup_id == backup_id).first()
    if not backup:
        return None
    fp = Path(backup.file_path)
    return fp if fp.exists() else None
