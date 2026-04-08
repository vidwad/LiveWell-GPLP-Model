"""Developer admin routes — screen permission management."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.models import ScreenPermission, User, UserRole
from app.db.session import get_db

router = APIRouter()

# Only DEVELOPER users can manage screen permissions
require_developer = require_roles(UserRole.DEVELOPER)

# ── Default screen registry (all screens in the app) ─────────────────────

DEFAULT_SCREENS = [
    # Section, Key, Label, Default roles
    # PARTNER = co-GP / JV partner. Read-only across portfolio + financials.
    ("Dashboard", "/dashboard", "Dashboard", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER", "INVESTOR", "PARTNER"]),
    ("Investment", "/investment", "LP Funds", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Investment", "/investors", "Investors", ["DEVELOPER", "GP_ADMIN", "INVESTOR", "PARTNER"]),
    ("Investment", "/investor-onboarding", "CRM & Onboarding", ["DEVELOPER", "GP_ADMIN"]),
    ("Investment", "/pipeline", "My Pipeline", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Portfolio", "/portfolio", "Properties", ["DEVELOPER", "GP_ADMIN", "PROPERTY_MANAGER", "PARTNER"]),
    ("Portfolio", "/area-research", "Area Research", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Portfolio", "/lifecycle", "Lifecycle", ["DEVELOPER", "GP_ADMIN", "PROPERTY_MANAGER", "PARTNER"]),
    ("Portfolio", "/analytics", "Portfolio Analytics", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Portfolio", "/lp-comparison", "LP Comparison", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Portfolio", "/trends", "Trends", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Operations", "/communities", "Communities", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER", "PARTNER"]),
    ("Operations", "/maintenance", "Maintenance", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER"]),
    ("Operations", "/vacancy-alerts", "Vacancy Alerts", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER"]),
    ("Operations", "/arrears-aging", "Arrears & Aging", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER"]),
    ("Operations", "/variance-alerts", "Variance Alerts", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER"]),
    ("Operations", "/staffing", "Staffing", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER"]),
    ("Operations", "/operator/turnovers", "Unit Turnovers", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER"]),
    ("Operations", "/operations", "Operations P&L", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER", "PARTNER"]),
    ("Finance", "/funding", "Funding & Debt", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Finance", "/cash-flow", "Cash Flow", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Finance", "/distributions", "Distributions", ["DEVELOPER", "GP_ADMIN", "INVESTOR", "PARTNER"]),
    ("Finance", "/etransfers", "E-Transfers", ["DEVELOPER", "GP_ADMIN"]),
    ("Finance", "/debt-maturity", "Debt Maturity", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Reports", "/reports", "Reports", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER", "PARTNER"]),
    ("Reports", "/quarterly-reports", "Quarterly Reports", ["DEVELOPER", "GP_ADMIN", "INVESTOR", "PARTNER"]),
    ("Reports", "/tax-documents", "Tax Documents", ["DEVELOPER", "GP_ADMIN", "INVESTOR"]),
    ("AI", "/ai", "AI Assistant", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER", "INVESTOR", "PARTNER"]),
    ("Admin", "/user-management", "User Management", ["DEVELOPER", "GP_ADMIN"]),
    ("Admin", "/property-managers", "Property Managers", ["DEVELOPER", "GP_ADMIN"]),
    ("Admin", "/operator", "Operators", ["DEVELOPER", "GP_ADMIN"]),
    ("Admin", "/documents", "Documents", ["DEVELOPER", "GP_ADMIN", "PARTNER"]),
    ("Admin", "/settings", "Settings", ["DEVELOPER", "GP_ADMIN"]),
    ("Admin", "/profile", "Profile", ["DEVELOPER", "GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER", "INVESTOR", "PARTNER"]),
    ("Developer", "/developer/screen-access", "Screen Access Control", ["DEVELOPER"]),
]

ALL_ROLES = ["DEVELOPER", "GP_ADMIN", "PARTNER", "OPERATIONS_MANAGER", "PROPERTY_MANAGER", "INVESTOR"]


def _ensure_defaults(db: Session):
    """Seed default screen permissions for any screens not yet present.

    Idempotent and additive: walks every entry in DEFAULT_SCREENS, checks
    whether each (screen_key, role) combo exists, and inserts only the
    missing ones. Safe to call on every request — newly added screens get
    backfilled automatically without wiping existing user customizations.
    """
    # Build a set of existing (screen_key, role) tuples for fast lookup
    existing: set[tuple[str, str]] = set()
    for p in db.query(ScreenPermission.screen_key, ScreenPermission.role).all():
        role_val = p.role.value if hasattr(p.role, "value") else str(p.role)
        existing.add((p.screen_key, role_val))

    added = 0
    for section, key, label, default_roles in DEFAULT_SCREENS:
        for role_str in ALL_ROLES:
            if (key, role_str) in existing:
                continue
            try:
                role = UserRole(role_str)
            except ValueError:
                continue
            db.add(ScreenPermission(
                screen_key=key,
                screen_label=label,
                section=section,
                role=role,
                is_enabled=role_str in default_roles,
            ))
            added += 1
    if added:
        db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/screen-permissions")
def get_screen_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """Get the full screen permission matrix."""
    _ensure_defaults(db)

    perms = db.query(ScreenPermission).order_by(
        ScreenPermission.section, ScreenPermission.screen_key
    ).all()

    # Group by screen
    screens: dict[str, dict] = {}
    for p in perms:
        if p.screen_key not in screens:
            screens[p.screen_key] = {
                "screen_key": p.screen_key,
                "screen_label": p.screen_label,
                "section": p.section,
                "roles": {},
            }
        role_val = p.role.value if hasattr(p.role, "value") else p.role
        screens[p.screen_key]["roles"][role_val] = {
            "permission_id": p.permission_id,
            "is_enabled": p.is_enabled,
        }

    # Group by section
    sections: dict[str, list] = {}
    for screen in screens.values():
        sec = screen["section"]
        if sec not in sections:
            sections[sec] = []
        sections[sec].append(screen)

    return {
        "sections": sections,
        "roles": ALL_ROLES,
    }


class TogglePermissionRequest(BaseModel):
    permission_id: int
    is_enabled: bool


@router.patch("/screen-permissions/{permission_id}")
def toggle_screen_permission(
    permission_id: int,
    body: TogglePermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """Toggle a screen permission on/off for a role."""
    perm = db.query(ScreenPermission).filter(
        ScreenPermission.permission_id == permission_id
    ).first()
    if not perm:
        raise HTTPException(404, "Permission not found")

    # Prevent disabling Developer's own access to screen-access page
    if perm.screen_key == "/developer/screen-access" and perm.role == UserRole.DEVELOPER and not body.is_enabled:
        raise HTTPException(400, "Cannot disable Developer access to Screen Access Control")

    perm.is_enabled = body.is_enabled
    perm.updated_by = current_user.user_id
    db.commit()
    return {"permission_id": permission_id, "is_enabled": perm.is_enabled}


class BulkToggleRequest(BaseModel):
    updates: list[dict]  # [{permission_id, is_enabled}, ...]


@router.put("/screen-permissions/bulk")
def bulk_update_permissions(
    body: BulkToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """Bulk update multiple screen permissions at once."""
    updated = 0
    for update in body.updates:
        perm = db.query(ScreenPermission).filter(
            ScreenPermission.permission_id == update["permission_id"]
        ).first()
        if perm:
            if perm.screen_key == "/developer/screen-access" and perm.role == UserRole.DEVELOPER:
                continue  # Protect developer's own access
            perm.is_enabled = update["is_enabled"]
            perm.updated_by = current_user.user_id
            updated += 1
    db.commit()
    return {"updated": updated}


@router.post("/screen-permissions/add-screen")
def add_screen(
    screen_key: str,
    screen_label: str,
    section: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    """Register a new screen in the permission system."""
    for role_str in ALL_ROLES:
        try:
            role = UserRole(role_str)
        except ValueError:
            continue
        existing = db.query(ScreenPermission).filter(
            ScreenPermission.screen_key == screen_key,
            ScreenPermission.role == role,
        ).first()
        if not existing:
            db.add(ScreenPermission(
                screen_key=screen_key,
                screen_label=screen_label,
                section=section,
                role=role,
                is_enabled=role_str == "DEVELOPER",  # Only developer by default
            ))
    db.commit()
    return {"status": "added", "screen_key": screen_key}


# ── Public endpoint: get permissions for current user ─────────────────────

@router.get("/my-screen-permissions")
def get_my_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the list of screens the current user has access to."""
    _ensure_defaults(db)

    perms = db.query(ScreenPermission).filter(
        ScreenPermission.role == current_user.role,
        ScreenPermission.is_enabled == True,
    ).all()

    return {
        "role": current_user.role.value if hasattr(current_user.role, "value") else current_user.role,
        "screens": [p.screen_key for p in perms],
    }
