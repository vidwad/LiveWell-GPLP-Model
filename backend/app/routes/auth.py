from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, oauth2_scheme
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, Token, TokenRefreshRequest, UserCreate, UserOut

router = APIRouter()


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
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive account")
    return Token(
        access_token=create_access_token(user.user_id),
        refresh_token=create_refresh_token(user.user_id),
    )


@router.post("/refresh", response_model=Token)
def refresh_token(payload: TokenRefreshRequest, db: Session = Depends(get_db)):
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
    )
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise credentials_exc
        user_id = int(data["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_exc
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user or not user.is_active:
        raise credentials_exc
    return Token(
        access_token=create_access_token(user.user_id),
        refresh_token=create_refresh_token(user.user_id),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
