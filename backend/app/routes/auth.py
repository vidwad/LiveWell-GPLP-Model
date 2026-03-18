import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
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


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
