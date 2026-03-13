"""
Notification Routes
===================
Provides endpoints for fetching and marking notifications as read.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.models import Notification, NotificationType, User
from app.db.session import get_db

router = APIRouter()


class NotificationOut(BaseModel):
    notification_id: int
    user_id: int
    title: str
    message: str
    type: NotificationType
    is_read: bool
    action_url: str | None
    created_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, n: Notification) -> "NotificationOut":
        return cls(
            notification_id=n.notification_id,
            user_id=n.user_id,
            title=n.title,
            message=n.message,
            type=n.type,
            is_read=n.is_read,
            action_url=n.action_url,
            created_at=n.created_at.isoformat() if n.created_at else "",
        )


@router.get("", response_model=List[NotificationOut])
def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return notifications for the current user, newest first."""
    query = db.query(Notification).filter(Notification.user_id == current_user.user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    notifications = (
        query.order_by(Notification.created_at.desc()).limit(limit).all()
    )
    return [NotificationOut.from_orm_obj(n) for n in notifications]


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    notif = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.user_id == current_user.user_id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return NotificationOut.from_orm_obj(notif)


@router.patch("/read-all", response_model=dict)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all unread notifications as read for the current user."""
    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.user_id,
            Notification.is_read == False,  # noqa: E712
        )
        .all()
    )
    for n in updated:
        n.is_read = True
    db.commit()
    return {"marked_read": len(updated)}
