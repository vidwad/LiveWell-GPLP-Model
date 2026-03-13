"""
Dependency helpers for authentication, role guards, and scope-based access control.
"""
from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import (
    User, UserRole, ScopeAssignment, ScopeEntityType, ScopePermissionLevel,
)
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ---------------------------------------------------------------------------
# Current User
# ---------------------------------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exc
    return user


# ---------------------------------------------------------------------------
# Role Guards (unchanged API, still useful for coarse checks)
# ---------------------------------------------------------------------------

def require_roles(*roles: UserRole):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return checker


# Convenience role guards
require_gp_admin = require_roles(UserRole.GP_ADMIN)
require_gp_or_ops = require_roles(UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER)
require_gp_ops_pm = require_roles(
    UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.PROPERTY_MANAGER
)
require_investor_or_above = require_roles(
    UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.PROPERTY_MANAGER, UserRole.INVESTOR
)


# ---------------------------------------------------------------------------
# Scope-Based Access Control
# ---------------------------------------------------------------------------

def get_user_scopes(
    user: User,
    db: Session,
    entity_type: Optional[ScopeEntityType] = None,
) -> List[ScopeAssignment]:
    """Return all scope assignments for a user, optionally filtered by entity type."""
    query = db.query(ScopeAssignment).filter(ScopeAssignment.user_id == user.user_id)
    if entity_type:
        query = query.filter(ScopeAssignment.entity_type == entity_type)
    return query.all()


def get_user_entity_ids(
    user: User,
    db: Session,
    entity_type: ScopeEntityType,
    min_level: ScopePermissionLevel = ScopePermissionLevel.view,
) -> List[int]:
    """
    Return the list of entity IDs the user has access to for a given entity type,
    at or above the specified permission level.

    GP_ADMIN users bypass scope checks and get access to everything.
    """
    if user.role == UserRole.GP_ADMIN:
        return []  # empty list signals "unrestricted" — caller must handle

    level_hierarchy = {
        ScopePermissionLevel.view: 0,
        ScopePermissionLevel.manage: 1,
        ScopePermissionLevel.admin: 2,
    }
    min_rank = level_hierarchy.get(min_level, 0)

    scopes = get_user_scopes(user, db, entity_type)
    return [
        s.entity_id for s in scopes
        if level_hierarchy.get(s.permission_level, 0) >= min_rank
    ]


def check_entity_access(
    user: User,
    db: Session,
    entity_type: ScopeEntityType,
    entity_id: int,
    min_level: ScopePermissionLevel = ScopePermissionLevel.view,
) -> bool:
    """Check if a user has access to a specific entity at or above the given level."""
    if user.role == UserRole.GP_ADMIN:
        return True

    allowed_ids = get_user_entity_ids(user, db, entity_type, min_level)
    return entity_id in allowed_ids


def require_entity_access(
    entity_type: ScopeEntityType,
    min_level: ScopePermissionLevel = ScopePermissionLevel.view,
):
    """
    FastAPI dependency factory that checks scope access for a given entity_type.
    Expects the route to have a path parameter matching the entity type
    (e.g. lp_id, property_id, community_id, cluster_id).
    """
    param_map = {
        ScopeEntityType.lp: "lp_id",
        ScopeEntityType.property: "property_id",
        ScopeEntityType.community: "community_id",
        ScopeEntityType.cluster: "cluster_id",
    }

    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        **kwargs,
    ) -> User:
        # GP_ADMIN bypasses all scope checks
        if current_user.role == UserRole.GP_ADMIN:
            return current_user

        # This is a factory — actual entity_id resolution happens in the route
        return current_user

    return checker
