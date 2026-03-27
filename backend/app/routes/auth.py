import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
from pydantic import BaseModel as _BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, oauth2_scheme
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, Token, TokenRefreshRequest, UserCreate, UserOut

router = APIRouter()

# ---------------------------------------------------------------------------
# Simple in-memory login rate limiter
# ---------------------------------------------------------------------------
_login_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_WINDOW = 300  # 5 minutes
_RATE_LIMIT_MAX = 10      # max attempts per window


def _check_rate_limit(ip: str):
    now = time.time()
    # Prune old entries
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < _RATE_LIMIT_WINDOW]
    if len(_login_attempts[ip]) >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again in a few minutes.",
        )
    _login_attempts[ip].append(now)


# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------
_COOKIE_SECURE = settings.ENVIRONMENT == "production"
_COOKIE_SAMESITE = "lax"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set httpOnly cookies for both access and refresh tokens."""
    response.set_cookie(
        key="lwc_access_token",
        value=access_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="lwc_refresh_token",
        value=refresh_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth",  # only sent to auth endpoints
    )
    # Non-httpOnly flag cookie for frontend to know if logged in (for SSR/middleware)
    response.set_cookie(
        key="lwc_token_present",
        value="1",
        httponly=False,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def _clear_auth_cookies(response: Response):
    """Clear all auth cookies."""
    for name in ("lwc_access_token", "lwc_refresh_token", "lwc_token_present"):
        response.delete_cookie(key=name, path="/")
    response.delete_cookie(key="lwc_refresh_token", path="/api/auth")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive account")

    access = create_access_token(user.user_id)
    refresh = create_refresh_token(user.user_id)

    # Set httpOnly cookies (primary auth mechanism)
    _set_auth_cookies(response, access, refresh)

    # Also return tokens in body for backward compat (mobile, Swagger, etc.)
    return Token(access_token=access, refresh_token=refresh)


from fastapi import Body as _Body

@router.post("/refresh", response_model=Token)
def refresh_token(
    request: Request,
    response: Response,
    payload: TokenRefreshRequest | None = _Body(None),
    db: Session = Depends(get_db),
):
    """Refresh tokens. Accepts refresh_token from JSON body OR from httpOnly cookie."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
    )

    # Try JSON body first, then fall back to cookie
    token_str = None
    if payload and payload.refresh_token:
        token_str = payload.refresh_token
    else:
        token_str = request.cookies.get("lwc_refresh_token")

    if not token_str:
        raise credentials_exc

    try:
        data = decode_token(token_str)
        if data.get("type") != "refresh":
            raise credentials_exc
        user_id = int(data["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_exc

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user or not user.is_active:
        raise credentials_exc

    access = create_access_token(user.user_id)
    refresh = create_refresh_token(user.user_id)

    # Update cookies
    if response:
        _set_auth_cookies(response, access, refresh)

    return Token(access_token=access, refresh_token=refresh)


@router.post("/logout")
def logout(response: Response):
    """Clear auth cookies."""
    _clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
        "phone": current_user.phone,
        "linkedin_url": current_user.linkedin_url,
        "profile_photo_url": current_user.profile_photo_url,
        "title": current_user.title,
        "bio": current_user.bio,
        "timezone": current_user.timezone,
        "google_calendar_connected": current_user.google_calendar_connected,
        "google_calendar_email": current_user.google_calendar_email,
    }


# ---------------------------------------------------------------------------
# User Profile
# ---------------------------------------------------------------------------

class UpdateProfileBody(_BaseModel):
    full_name: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    profile_photo_url: str | None = None
    title: str | None = None
    bio: str | None = None
    timezone: str | None = None


@router.patch("/me/profile")
def update_profile(
    body: UpdateProfileBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's profile."""
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, val)
    db.commit()
    db.refresh(current_user)
    return {"status": "updated", "user_id": current_user.user_id}


from fastapi import UploadFile, File as FastAPIFile
import uuid
from pathlib import Path as _Path


@router.post("/me/profile-photo")
def upload_profile_photo(
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a profile photo. Saves to /uploads/profile-photos/ and updates user record."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")

    # Save file
    uploads_dir = _Path(__file__).resolve().parent.parent.parent / "uploads" / "profile-photos"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user.user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = uploads_dir / filename

    with open(filepath, "wb") as f:
        content = file.file.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(400, "File must be under 5MB")
        f.write(content)

    photo_url = f"/uploads/profile-photos/{filename}"
    current_user.profile_photo_url = photo_url
    db.commit()

    return {"url": photo_url, "filename": filename}


@router.patch("/me/password")
def change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's password."""
    old_password = payload.get("old_password")
    new_password = payload.get("new_password")
    if not old_password or not new_password:
        raise HTTPException(400, "Both old_password and new_password required")
    if not verify_password(old_password, current_user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    if len(new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")
    current_user.hashed_password = hash_password(new_password)
    db.commit()
    return {"status": "password_changed"}


# ---------------------------------------------------------------------------
# Google Calendar Integration
# ---------------------------------------------------------------------------

@router.post("/me/google-calendar/connect")
def connect_google_calendar(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Store Google Calendar email for calendar event links."""
    email = payload.get("google_email")
    if not email:
        raise HTTPException(400, "google_email required")
    current_user.google_calendar_connected = True
    current_user.google_calendar_email = email
    db.commit()
    return {"status": "connected", "google_calendar_email": email}


@router.delete("/me/google-calendar/disconnect")
def disconnect_google_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect Google Calendar."""
    current_user.google_calendar_connected = False
    current_user.google_calendar_email = None
    db.commit()
    return {"status": "disconnected"}


# ---------------------------------------------------------------------------
# Capability Management (1.1.7)
# ---------------------------------------------------------------------------

from app.core.deps import get_user_capabilities, require_capability
from app.db.models import UserCapability, CAPABILITIES


@router.get("/users/{user_id}/capabilities")
def list_user_capabilities(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_capability("admin_users")),
):
    """List effective capabilities for a user (role defaults + explicit grants)."""
    target_user = db.query(User).filter(User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(404, "User not found")

    effective = get_user_capabilities(target_user, db)

    explicit = (
        db.query(UserCapability)
        .filter(UserCapability.user_id == user_id)
        .all()
    )
    explicit_caps = {c.capability for c in explicit}

    return {
        "user_id": user_id,
        "role": target_user.role.value,
        "effective_capabilities": sorted(effective),
        "explicit_grants": sorted(explicit_caps),
        "from_role": sorted(effective - explicit_caps),
        "all_known_capabilities": sorted(CAPABILITIES),
    }


@router.post("/users/{user_id}/capabilities", status_code=201)
def grant_capability(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_capability("admin_users")),
):
    """Grant one or more capabilities to a user."""
    target_user = db.query(User).filter(User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(404, "User not found")

    caps_to_grant = payload.get("capabilities", [])
    if isinstance(caps_to_grant, str):
        caps_to_grant = [caps_to_grant]

    invalid = set(caps_to_grant) - CAPABILITIES
    if invalid:
        raise HTTPException(400, f"Unknown capabilities: {', '.join(invalid)}")

    existing = {
        c.capability for c in
        db.query(UserCapability).filter(
            UserCapability.user_id == user_id,
            UserCapability.capability.in_(caps_to_grant),
        ).all()
    }

    granted = []
    for cap in caps_to_grant:
        if cap not in existing:
            db.add(UserCapability(
                user_id=user_id,
                capability=cap,
                granted_by=current_user.user_id,
            ))
            granted.append(cap)

    db.commit()
    return {"user_id": user_id, "granted": granted, "already_had": list(existing & set(caps_to_grant))}


# ---------------------------------------------------------------------------
# User Invitations
# ---------------------------------------------------------------------------

from pydantic import BaseModel as _BaseModel
from app.db.models import UserInvitation, InvitationStatus, UserRole
import secrets


class InviteRequest(_BaseModel):
    email: str
    role: str
    full_name: str | None = None
    message: str | None = None


class InviteOut(_BaseModel):
    invitation_id: int
    email: str
    role: str
    full_name: str | None
    status: str
    token: str
    invited_by_name: str | None
    message: str | None
    expires_at: str
    created_at: str
    accepted_at: str | None


@router.post("/invitations", status_code=201)
def create_invitation(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_capability("admin_users")),
):
    """Send an invitation to join the platform."""
    # Check if user already exists
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "A user with this email already exists")

    # Check for pending invite to same email
    pending = db.query(UserInvitation).filter(
        UserInvitation.email == payload.email,
        UserInvitation.status == InvitationStatus.pending,
    ).first()
    if pending:
        raise HTTPException(400, "A pending invitation already exists for this email")

    # Validate role
    try:
        role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(400, f"Invalid role: {payload.role}")

    token = secrets.token_urlsafe(48)
    from datetime import datetime, timedelta
    expires = datetime.utcnow() + timedelta(days=7)

    invite = UserInvitation(
        email=payload.email,
        role=role,
        full_name=payload.full_name,
        token=token,
        invited_by=current_user.user_id,
        message=payload.message,
        expires_at=expires,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    # Send invitation email via Resend
    invite_url = f"/accept-invite?token={invite.token}"
    from app.services.email import send_invitation_email
    email_sent = send_invitation_email(
        to_email=invite.email,
        invite_url=invite_url,
        inviter_name=current_user.full_name or current_user.email,
        role=invite.role.value,
        personal_message=payload.message,
        invitee_name=payload.full_name,
    )

    return {
        "invitation_id": invite.invitation_id,
        "email": invite.email,
        "role": invite.role.value,
        "token": invite.token,
        "invite_url": invite_url,
        "expires_at": str(invite.expires_at),
        "email_sent": email_sent,
    }


@router.get("/invitations")
def list_invitations(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_capability("admin_users")),
):
    """List all invitations."""
    query = db.query(UserInvitation).order_by(UserInvitation.created_at.desc())
    if status_filter:
        query = query.filter(UserInvitation.status == status_filter)

    invites = query.all()
    result = []
    for inv in invites:
        inviter = db.query(User).filter(User.user_id == inv.invited_by).first()
        result.append({
            "invitation_id": inv.invitation_id,
            "email": inv.email,
            "role": inv.role.value,
            "full_name": inv.full_name,
            "status": inv.status.value,
            "token": inv.token,
            "invited_by_name": inviter.full_name if inviter else None,
            "message": inv.message,
            "expires_at": str(inv.expires_at),
            "created_at": str(inv.created_at),
            "accepted_at": str(inv.accepted_at) if inv.accepted_at else None,
        })
    return result


@router.get("/invitations/{token}/validate")
def validate_invitation(token: str, db: Session = Depends(get_db)):
    """Validate an invitation token (public — no auth required)."""
    invite = db.query(UserInvitation).filter(UserInvitation.token == token).first()
    if not invite:
        raise HTTPException(404, "Invitation not found")

    from datetime import datetime
    if invite.status != InvitationStatus.pending:
        raise HTTPException(400, f"Invitation is {invite.status.value}")
    if invite.expires_at < datetime.utcnow():
        invite.status = InvitationStatus.expired
        db.commit()
        raise HTTPException(400, "Invitation has expired")

    return {
        "email": invite.email,
        "role": invite.role.value,
        "full_name": invite.full_name,
        "message": invite.message,
        "invited_by": invite.inviter.full_name if invite.inviter else None,
    }


class AcceptInviteRequest(_BaseModel):
    token: str
    password: str
    full_name: str | None = None


@router.post("/invitations/accept", response_model=Token)
def accept_invitation(
    payload: AcceptInviteRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Accept an invitation and create the user account (public — no auth required)."""
    invite = db.query(UserInvitation).filter(UserInvitation.token == payload.token).first()
    if not invite:
        raise HTTPException(404, "Invitation not found")

    from datetime import datetime
    if invite.status != InvitationStatus.pending:
        raise HTTPException(400, f"Invitation is {invite.status.value}")
    if invite.expires_at < datetime.utcnow():
        invite.status = InvitationStatus.expired
        db.commit()
        raise HTTPException(400, "Invitation has expired")

    # Check email not already taken
    if db.query(User).filter(User.email == invite.email).first():
        raise HTTPException(400, "A user with this email already exists")

    # Create user
    user = User(
        email=invite.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name or invite.full_name,
        role=invite.role,
    )
    db.add(user)
    db.flush()

    # Mark invitation as accepted
    invite.status = InvitationStatus.accepted
    invite.accepted_by_user_id = user.user_id
    invite.accepted_at = datetime.utcnow()
    db.commit()

    # Auto-login
    access = create_access_token(user.user_id)
    refresh = create_refresh_token(user.user_id)
    _set_auth_cookies(response, access, refresh)

    return Token(access_token=access, refresh_token=refresh)


@router.delete("/invitations/{invitation_id}")
def revoke_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_capability("admin_users")),
):
    """Revoke a pending invitation."""
    invite = db.query(UserInvitation).filter(UserInvitation.invitation_id == invitation_id).first()
    if not invite:
        raise HTTPException(404, "Invitation not found")
    if invite.status != InvitationStatus.pending:
        raise HTTPException(400, f"Cannot revoke — invitation is {invite.status.value}")
    invite.status = InvitationStatus.revoked
    db.commit()
    return {"invitation_id": invitation_id, "status": "revoked"}


# ---------------------------------------------------------------------------
# User Management (list/update users)
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_capability("admin_users")),
):
    """List all platform users."""
    users = db.query(User).order_by(User.user_id).all()
    return [{
        "user_id": u.user_id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role.value,
        "is_active": u.is_active,
    } for u in users]


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_capability("admin_users")),
):
    """Update a user's role or active status."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    if "role" in payload:
        try:
            user.role = UserRole(payload["role"])
        except ValueError:
            raise HTTPException(400, f"Invalid role: {payload['role']}")
    if "is_active" in payload:
        user.is_active = bool(payload["is_active"])
    if "full_name" in payload:
        user.full_name = payload["full_name"]

    db.commit()
    db.refresh(user)
    return {
        "user_id": user.user_id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "is_active": user.is_active,
    }


@router.delete("/users/{user_id}/capabilities/{capability}")
def revoke_capability(
    user_id: int,
    capability: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_capability("admin_users")),
):
    """Revoke an explicitly granted capability from a user."""
    rows = (
        db.query(UserCapability)
        .filter(UserCapability.user_id == user_id, UserCapability.capability == capability)
        .all()
    )
    if not rows:
        raise HTTPException(404, "Capability grant not found")
    for row in rows:
        db.delete(row)
    db.commit()
    return {"user_id": user_id, "revoked": capability}
