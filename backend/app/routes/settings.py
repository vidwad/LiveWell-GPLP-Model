"""
Settings Routes — Platform Configuration & API Key Management
==============================================================
GP_ADMIN-only endpoints for managing API keys and platform settings.
Secret values are never returned in full — only masked versions.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, PlatformSetting
from app.core.deps import require_gp_admin

router = APIRouter()


# ── Default settings definitions ─────────────────────────────────────────

DEFAULT_SETTINGS = [
    {
        "key": "ANTHROPIC_API_KEY",
        "category": "api_keys",
        "label": "Anthropic API Key",
        "description": "Powers AI analysis, underwriting, area research, risk assessment, and chat. Get your key at console.anthropic.com.",
        "is_secret": True,
    },
    {
        "key": "OPENAI_API_KEY",
        "category": "api_keys",
        "label": "OpenAI API Key",
        "description": "Optional fallback AI provider. Get your key at platform.openai.com.",
        "is_secret": True,
    },
    {
        "key": "GOOGLE_MAPS_API_KEY",
        "category": "api_keys",
        "label": "Google Maps API Key",
        "description": "Enables interactive map view in Area Research with property markers and radius overlay. Requires Maps JavaScript API enabled. Get your key at console.cloud.google.com.",
        "is_secret": True,
    },
    {
        "key": "REPLIERS_API_KEY",
        "category": "api_keys",
        "label": "Repliers API Key (Canadian MLS)",
        "description": "Canadian MLS/IDX listing data for property lookups. Provides comparable sales, active listings, and sold data. Sign up at repliers.io.",
        "is_secret": True,
    },
    {
        "key": "CLAUDE_MODEL",
        "category": "ai",
        "label": "Claude Model",
        "description": "Which Claude model to use for AI features. Options: claude-sonnet-4-20250514, claude-opus-4-20250514, claude-haiku-4-5-20251001.",
        "is_secret": False,
    },
    {
        "key": "FRONTEND_URL",
        "category": "general",
        "label": "Frontend URL",
        "description": "The URL of the frontend application. Used for CORS configuration.",
        "is_secret": False,
    },
    {
        "key": "ENVIRONMENT",
        "category": "general",
        "label": "Environment",
        "description": "Current deployment environment (development or production).",
        "is_secret": False,
    },
]


def _mask_value(value: str, is_secret: bool) -> str:
    """Mask secret values for display, showing only last 4 characters."""
    if not is_secret or not value:
        return value
    if len(value) <= 8:
        return "••••••••"
    return "••••••••" + value[-4:]


def _ensure_defaults(db: Session):
    """Ensure all default settings exist in the database."""
    from app.core.config import settings as env_settings

    existing_keys = {s.key for s in db.query(PlatformSetting.key).all()}

    for defn in DEFAULT_SETTINGS:
        if defn["key"] not in existing_keys:
            # Pre-populate from environment variable if available
            env_value = ""
            if defn["key"] == "ANTHROPIC_API_KEY":
                env_value = env_settings.ANTHROPIC_API_KEY or ""
            elif defn["key"] == "OPENAI_API_KEY":
                env_value = env_settings.OPENAI_API_KEY or ""
            elif defn["key"] == "CLAUDE_MODEL":
                env_value = env_settings.CLAUDE_MODEL or "claude-sonnet-4-20250514"
            elif defn["key"] == "FRONTEND_URL":
                env_value = env_settings.FRONTEND_URL or ""
            elif defn["key"] == "ENVIRONMENT":
                env_value = env_settings.ENVIRONMENT or "development"
            # GOOGLE_MAPS_API_KEY is frontend-only (NEXT_PUBLIC_), not in backend env

            setting = PlatformSetting(
                key=defn["key"],
                value=env_value,
                category=defn["category"],
                label=defn["label"],
                description=defn["description"],
                is_secret=defn["is_secret"],
            )
            db.add(setting)

    db.commit()


# ── Schemas ──────────────────────────────────────────────────────────────

class SettingResponse(BaseModel):
    setting_id: int
    key: str
    value: str  # masked if secret
    category: str
    label: Optional[str]
    description: Optional[str]
    is_secret: bool
    is_configured: bool  # whether a non-empty value is set
    updated_at: Optional[str]
    updated_by: Optional[str]


class UpdateSettingRequest(BaseModel):
    value: str


class BulkUpdateRequest(BaseModel):
    settings: dict[str, str]  # key -> value


# ── Endpoints ────────────────────────────────────────────────────────────

@router.get("")
def list_settings(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """List all platform settings (values masked for secrets)."""
    _ensure_defaults(db)

    query = db.query(PlatformSetting)
    if category:
        query = query.filter(PlatformSetting.category == category)

    settings = query.order_by(PlatformSetting.category, PlatformSetting.key).all()

    return [
        {
            "setting_id": s.setting_id,
            "key": s.key,
            "value": _mask_value(s.value, s.is_secret),
            "category": s.category,
            "label": s.label,
            "description": s.description,
            "is_secret": s.is_secret,
            "is_configured": bool(s.value and s.value.strip()),
            "updated_at": str(s.updated_at) if s.updated_at else None,
            "updated_by": s.updated_by.email if s.updated_by else None,
        }
        for s in settings
    ]


@router.put("/{key}")
def update_setting(
    key: str,
    payload: UpdateSettingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Update a single setting value."""
    _ensure_defaults(db)

    setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if not setting:
        raise HTTPException(404, f"Setting '{key}' not found")

    setting.value = payload.value.strip()
    setting.updated_by_id = current_user.user_id
    db.commit()
    db.refresh(setting)

    # Apply to runtime config if applicable
    _apply_setting_to_runtime(key, setting.value)

    return {
        "key": setting.key,
        "is_configured": bool(setting.value),
        "message": f"Setting '{setting.label or setting.key}' updated successfully.",
    }


@router.put("")
def bulk_update_settings(
    payload: BulkUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Update multiple settings at once."""
    _ensure_defaults(db)

    updated = []
    for key, value in payload.settings.items():
        setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
        if not setting:
            continue
        setting.value = value.strip()
        setting.updated_by_id = current_user.user_id
        updated.append(key)
        _apply_setting_to_runtime(key, setting.value)

    db.commit()

    return {
        "updated": updated,
        "count": len(updated),
        "message": f"{len(updated)} settings updated successfully.",
    }


@router.delete("/{key}")
def clear_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Clear a setting value (set to empty string)."""
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if not setting:
        raise HTTPException(404, f"Setting '{key}' not found")

    setting.value = ""
    setting.updated_by_id = current_user.user_id
    db.commit()

    _apply_setting_to_runtime(key, "")

    return {
        "key": key,
        "message": f"Setting '{setting.label or key}' cleared.",
    }


@router.get("/status")
def get_integration_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Check which integrations are currently active."""
    _ensure_defaults(db)

    settings = {s.key: s.value for s in db.query(PlatformSetting).all()}

    # Check Anthropic
    anthropic_key = settings.get("ANTHROPIC_API_KEY", "")
    anthropic_active = False
    if anthropic_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=anthropic_key)
            # Simple validation — just check the key format
            anthropic_active = anthropic_key.startswith("sk-ant-")
        except Exception:
            pass

    return {
        "integrations": [
            {
                "key": "ANTHROPIC_API_KEY",
                "name": "Claude AI (Anthropic)",
                "status": "active" if anthropic_active else ("configured" if anthropic_key else "not_configured"),
                "features": [
                    "Property Analysis",
                    "Risk Assessment",
                    "Underwriting Memos",
                    "Area Research",
                    "AI Chat Assistant",
                    "Report Narratives",
                    "Funding Research",
                    "Investor Communications",
                    "Anomaly Detection",
                ],
            },
            {
                "key": "OPENAI_API_KEY",
                "name": "OpenAI",
                "status": "configured" if settings.get("OPENAI_API_KEY") else "not_configured",
                "features": ["Fallback AI Provider"],
            },
            {
                "key": "GOOGLE_MAPS_API_KEY",
                "name": "Google Maps",
                "status": "configured" if settings.get("GOOGLE_MAPS_API_KEY") else "not_configured",
                "features": [
                    "Area Research Map View",
                    "Property Markers & Overlays",
                    "Satellite / Street View",
                    "Radius Visualization",
                ],
            },
        ],
        "ai_model": settings.get("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
        "environment": settings.get("ENVIRONMENT", "development"),
    }


# ── Runtime Application ──────────────────────────────────────────────────

def _apply_setting_to_runtime(key: str, value: str):
    """Apply a setting change to the running application where possible."""
    from app.core.config import settings as env_settings

    if key == "ANTHROPIC_API_KEY" and value:
        try:
            import anthropic
            from app.services import ai as ai_service
            ai_service._client = anthropic.Anthropic(api_key=value)
            ai_service._HAS_CLAUDE = True
        except Exception:
            pass
    elif key == "ANTHROPIC_API_KEY" and not value:
        from app.services import ai as ai_service
        ai_service._client = None
        ai_service._HAS_CLAUDE = False
    elif key == "CLAUDE_MODEL" and value:
        env_settings.CLAUDE_MODEL = value
    elif key == "OPENAI_API_KEY":
        env_settings.OPENAI_API_KEY = value


def get_setting_value(db: Session, key: str) -> Optional[str]:
    """Utility: get a setting value from the database.

    Returns the DB value if set, otherwise returns None so the caller
    can fall back to environment variables.
    """
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if setting and setting.value:
        return setting.value
    return None
