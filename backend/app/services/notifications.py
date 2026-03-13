"""
Notification Service
====================
Creates in-app notifications for key platform events.
Called from lifecycle, quarterly report, and eTransfer workflows.
"""
from sqlalchemy.orm import Session

from app.db.models import Notification, NotificationType


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: NotificationType = NotificationType.general,
    action_url: str | None = None,
) -> Notification:
    """Persist a notification for a user and flush to the session."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        action_url=action_url,
    )
    db.add(notif)
    db.flush()
    return notif


def notify_all_lp_investors(
    db: Session,
    lp_id: int,
    title: str,
    message: str,
    type: NotificationType = NotificationType.general,
    action_url: str | None = None,
) -> list[Notification]:
    """
    Notify every investor subscribed to a given LP.
    Returns list of created Notification objects (not yet committed).
    """
    from app.db.models import Subscription, Investor

    subscriptions = (
        db.query(Subscription)
        .filter(Subscription.lp_id == lp_id)
        .all()
    )
    investor_ids = {s.investor_id for s in subscriptions}

    users = (
        db.query(Investor)
        .filter(Investor.investor_id.in_(investor_ids), Investor.user_id.isnot(None))
        .all()
    )

    notifications = []
    for investor in users:
        n = create_notification(
            db=db,
            user_id=investor.user_id,
            title=title,
            message=message,
            type=type,
            action_url=action_url,
        )
        notifications.append(n)
    return notifications
