"""
Shared utility functions for route handlers and services.

Centralizes common patterns:
  - get_or_404: Look up a model instance or raise 404
  - validate_enum_value: Validate a string against an enum
  - parse_date_range: Parse optional start/end date query params
"""
from datetime import date
from typing import Optional, Type, TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Session

T = TypeVar("T")


def get_or_404(
    db: Session,
    model: Type[T],
    pk_value: int,
    *,
    pk_column: str = None,
    detail: str = None,
) -> T:
    """
    Look up a model instance by primary key. Raises HTTP 404 if not found.

    Usage:
        property = get_or_404(db, Property, property_id)
        debt = get_or_404(db, DebtFacility, debt_id, pk_column="debt_id")
    """
    if pk_column is None:
        # Infer PK column name from mapper
        mapper = model.__mapper__  # type: ignore[attr-defined]
        pk_cols = mapper.primary_key
        pk_column = pk_cols[0].name if pk_cols else "id"

    col = getattr(model, pk_column, None)
    if col is None:
        raise ValueError(f"Model {model.__name__} has no column '{pk_column}'")

    instance = db.query(model).filter(col == pk_value).first()
    if instance is None:
        entity_name = detail or model.__name__.replace("_", " ")
        raise HTTPException(status_code=404, detail=f"{entity_name} not found")
    return instance


def validate_enum_value(enum_cls, value: str, field_name: str = "value"):
    """
    Validate that a string is a valid member of an enum.
    Raises HTTP 400 with a helpful error message if invalid.
    """
    try:
        return enum_cls(value)
    except ValueError:
        valid = [e.value for e in enum_cls]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: '{value}'. Must be one of: {', '.join(valid)}"
        )


def parse_date_range(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> tuple[Optional[date], Optional[date]]:
    """Parse optional ISO date strings into date objects."""
    start = None
    end = None
    try:
        if start_date:
            start = date.fromisoformat(start_date)
        if end_date:
            end = date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")
    return start, end


def paginate_query(query, skip: int = 0, limit: int = 100):
    """Apply pagination to a SQLAlchemy query and return items + total count."""
    total = query.count()
    items = query.offset(skip).limit(min(limit, 500)).all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}
