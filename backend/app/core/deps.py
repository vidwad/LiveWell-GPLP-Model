"""
Dependency helpers for authentication, role guards, and scope-based access control.
"""
from typing import List, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import (
    User, UserRole, ScopeAssignment, ScopeEntityType, ScopePermissionLevel,
    UserCapability, ROLE_DEFAULT_CAPABILITIES,
)
from app.db.session import get_db

# auto_error=False so missing header doesn't 401 — we'll check cookie as fallback
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ---------------------------------------------------------------------------
# Current User (Authorization header → httpOnly cookie fallback)
# ---------------------------------------------------------------------------

def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Try Bearer token from Authorization header
    # 2. Fall back to httpOnly cookie
    jwt_token = token or request.cookies.get("lwc_access_token")
    if not jwt_token:
        raise credentials_exc

    try:
        payload = decode_token(jwt_token)
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


# Convenience role guards (DEVELOPER has access to everything GP_ADMIN can)
require_developer = require_roles(UserRole.DEVELOPER)
require_gp_admin = require_roles(UserRole.DEVELOPER, UserRole.GP_ADMIN)
require_gp_or_ops = require_roles(UserRole.DEVELOPER, UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER)
require_gp_ops_pm = require_roles(
    UserRole.DEVELOPER, UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.PROPERTY_MANAGER
)
require_investor_or_above = require_roles(
    UserRole.DEVELOPER, UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.PROPERTY_MANAGER, UserRole.INVESTOR
)


# ---------------------------------------------------------------------------
# Capability-Based Permissions (1.1.7)
# ---------------------------------------------------------------------------

def get_user_capabilities(user: User, db: Session) -> set[str]:
    """
    Return the effective capability set for a user.

    Logic: role defaults UNION explicit DB grants.
    GP_ADMIN always gets everything.
    """
    if user.role in (UserRole.GP_ADMIN, UserRole.DEVELOPER):
        return set(ROLE_DEFAULT_CAPABILITIES.get(UserRole.GP_ADMIN, set()))

    # Start with role defaults
    caps = set(ROLE_DEFAULT_CAPABILITIES.get(user.role, set()))

    # Add explicitly granted capabilities
    explicit = (
        db.query(UserCapability.capability)
        .filter(UserCapability.user_id == user.user_id)
        .all()
    )
    caps.update(row[0] for row in explicit)
    return caps


def require_capability(*capabilities: str):
    """
    FastAPI dependency that checks the user has ALL of the given capabilities.

    Usage:
        @router.post("/distributions/{id}/approve")
        def approve(user: User = Depends(require_capability("approve_distributions"))):
            ...
    """
    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        user_caps = get_user_capabilities(current_user, db)
        missing = set(capabilities) - user_caps
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing capabilities: {', '.join(sorted(missing))}",
            )
        return current_user
    return checker


def require_any_capability(*capabilities: str):
    """Check the user has at least ONE of the given capabilities."""
    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        user_caps = get_user_capabilities(current_user, db)
        if not user_caps.intersection(capabilities):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(sorted(capabilities))}",
            )
        return current_user
    return checker


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
    if user.role in (UserRole.DEVELOPER, UserRole.GP_ADMIN):
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
    if user.role in (UserRole.GP_ADMIN, UserRole.DEVELOPER):
        return True

    allowed_ids = get_user_entity_ids(user, db, entity_type, min_level)
    return entity_id in allowed_ids


def filter_by_lp_scope(
    query,
    user: User,
    db: Session,
    lp_id_column,
):
    """
    Apply LP-based scope filtering to a SQLAlchemy query.

    - GP_ADMIN / OPERATIONS_MANAGER: no filtering (see everything)
    - PROPERTY_MANAGER: filter to properties they manage → LP IDs from those properties
    - INVESTOR: filter to LPs they have scope assignments for
    - Others: return empty (filter to impossible ID)

    Args:
        query: The SQLAlchemy query to filter
        user: The current user
        db: The database session
        lp_id_column: The SQLAlchemy column representing lp_id (e.g., Property.lp_id)

    Returns:
        The filtered query
    """
    if user.role in (UserRole.DEVELOPER, UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        return query  # unrestricted

    # For INVESTOR and PROPERTY_MANAGER, use scope assignments
    allowed_lp_ids = get_user_entity_ids(user, db, ScopeEntityType.lp)
    if allowed_lp_ids:
        return query.filter(lp_id_column.in_(allowed_lp_ids))

    # If no LP scopes, check if they have property-level scopes
    allowed_property_ids = get_user_entity_ids(user, db, ScopeEntityType.property)
    if allowed_property_ids:
        from app.db.models import Property
        lp_ids = [
            r[0] for r in
            db.query(Property.lp_id)
            .filter(Property.property_id.in_(allowed_property_ids))
            .distinct()
            .all()
            if r[0] is not None
        ]
        if lp_ids:
            return query.filter(lp_id_column.in_(lp_ids))

    # No scopes at all — return nothing
    return query.filter(lp_id_column == -1)


def filter_by_community_scope(
    query,
    user: User,
    db: Session,
    community_id_column,
):
    """
    Apply Community-based scope filtering to a SQLAlchemy query.

    - GP_ADMIN / OPERATIONS_MANAGER: no filtering
    - PROPERTY_MANAGER: filter to communities linked to properties they manage
    - INVESTOR: filter to communities linked to properties in their LPs
    - Others: empty
    """
    if user.role in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        return query

    # Check community-level scopes
    allowed_community_ids = get_user_entity_ids(user, db, ScopeEntityType.community)
    if allowed_community_ids:
        return query.filter(community_id_column.in_(allowed_community_ids))

    # Fall back to LP scopes → properties → community_ids
    allowed_lp_ids = get_user_entity_ids(user, db, ScopeEntityType.lp)
    if allowed_lp_ids:
        from app.db.models import Property
        comm_ids = [
            r[0] for r in
            db.query(Property.community_id)
            .filter(Property.lp_id.in_(allowed_lp_ids))
            .distinct()
            .all()
            if r[0] is not None
        ]
        if comm_ids:
            return query.filter(community_id_column.in_(comm_ids))

    # Fall back to property scopes → community_ids
    allowed_property_ids = get_user_entity_ids(user, db, ScopeEntityType.property)
    if allowed_property_ids:
        from app.db.models import Property
        comm_ids = [
            r[0] for r in
            db.query(Property.community_id)
            .filter(Property.property_id.in_(allowed_property_ids))
            .distinct()
            .all()
            if r[0] is not None
        ]
        if comm_ids:
            return query.filter(community_id_column.in_(comm_ids))

    return query.filter(community_id_column == -1)


def filter_by_property_scope(
    query,
    user: User,
    db: Session,
    property_id_column,
):
    """
    Apply Property-based scope filtering to a SQLAlchemy query.

    - GP_ADMIN / OPERATIONS_MANAGER: no filtering
    - PROPERTY_MANAGER: filter to properties they have scope for
    - INVESTOR: filter to properties in LPs they have scope for
    - Others: empty
    """
    if user.role in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        return query

    # Check property-level scopes first
    allowed_property_ids = get_user_entity_ids(user, db, ScopeEntityType.property)
    if allowed_property_ids:
        return query.filter(property_id_column.in_(allowed_property_ids))

    # Fall back to LP scopes → property_ids
    allowed_lp_ids = get_user_entity_ids(user, db, ScopeEntityType.lp)
    if allowed_lp_ids:
        from app.db.models import Property
        prop_ids = [
            r[0] for r in
            db.query(Property.property_id)
            .filter(Property.lp_id.in_(allowed_lp_ids))
            .all()
        ]
        if prop_ids:
            return query.filter(property_id_column.in_(prop_ids))

    return query.filter(property_id_column == -1)


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

from fastapi import Query as _Query


class PaginationParams:
    """Reusable pagination dependency.

    Usage in route:
        def list_things(pg: PaginationParams = Depends(PaginationParams)):
            query = db.query(Thing)
            return pg.paginate(query)
    """

    MAX_LIMIT = 5000
    DEFAULT_LIMIT = 100

    def __init__(
        self,
        skip: int = _Query(0, ge=0, description="Number of records to skip"),
        limit: int = _Query(100, ge=1, le=5000, description="Max records to return (1-5000)"),
    ):
        self.skip = skip
        self.limit = min(limit, self.MAX_LIMIT)

    def paginate(self, query, *, transform=None):
        """Apply pagination and return { items, total, skip, limit }.

        Args:
            query: SQLAlchemy query object
            transform: optional callable to transform each row (e.g., _property_to_out)
        """
        total = query.count()
        rows = query.offset(self.skip).limit(self.limit).all()
        items = [transform(r) for r in rows] if transform else rows
        return {
            "items": items,
            "total": total,
            "skip": self.skip,
            "limit": self.limit,
        }
