"""
API routes for Property Lifecycle management:
- Stage transitions with validation gates
- Milestone tracking
- Quarterly report generation
- eTransfer distribution tracking
- Message thread replies
"""
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import (
    get_current_user, require_gp_admin, require_gp_or_ops,
    require_gp_ops_pm, require_investor_or_above,
)
from app.db.models import (
    User, UserRole, Property, DevelopmentStage,
    PropertyStageTransition, PropertyMilestone, MilestoneStatus,
    QuarterlyReport, QuarterlyReportStatus, LPEntity,
    DistributionAllocation, ETransferTracking, ETransferStatus,
    InvestorMessage, MessageThread,
)
from app.db.session import get_db
from app.schemas.lifecycle import (
    StageTransitionRequest, StageTransitionOut, ValidationCheckOut,
    AllowedTransitionsOut,
    MilestoneCreate, MilestoneUpdate, MilestoneOut,
    QuarterlyReportGenerate, QuarterlyReportUpdate, QuarterlyReportOut,
    ETransferCreate, ETransferUpdate, ETransferOut,
    MessageReplyCreate, MessageReplyOut,
)
from app.db.models import NotificationType
from app.services.notifications import create_notification, notify_all_lp_investors
from app.services.lifecycle import (
    get_allowed_transitions, transition_property_stage, validate_transition,
)
from app.services.quarterly_reports import generate_quarterly_report

router = APIRouter()


# ---------------------------------------------------------------------------
# Stage Transitions
# ---------------------------------------------------------------------------

@router.get(
    "/properties/{property_id}/transitions",
    response_model=List[StageTransitionOut],
)
def list_stage_transitions(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """List all stage transitions for a property (audit trail)."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    transitions = (
        db.query(PropertyStageTransition)
        .filter(PropertyStageTransition.property_id == property_id)
        .order_by(PropertyStageTransition.transitioned_at.desc())
        .all()
    )
    result = []
    for t in transitions:
        checks = []
        if t.validation_details:
            try:
                checks = [ValidationCheckOut(**c) for c in json.loads(t.validation_details)]
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning("Failed to parse validation_details for transition %d: %s", t.transition_id, e)
        result.append(StageTransitionOut(
            transition_id=t.transition_id,
            property_id=t.property_id,
            from_stage=t.from_stage.value,
            to_stage=t.to_stage.value,
            transitioned_by=t.transitioned_by,
            transitioned_at=t.transitioned_at,
            notes=t.notes,
            validation_passed=t.validation_passed,
            validation_checks=checks,
        ))
    return result


@router.get(
    "/properties/{property_id}/allowed-transitions",
    response_model=AllowedTransitionsOut,
)
def get_property_allowed_transitions(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_ops_pm),
):
    """Get allowed stage transitions for a property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    return AllowedTransitionsOut(
        current_stage=prop.development_stage.value,
        allowed_transitions=get_allowed_transitions(prop.development_stage),
    )


@router.post(
    "/properties/{property_id}/transition",
    response_model=StageTransitionOut,
)
def perform_stage_transition(
    property_id: int,
    payload: StageTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Transition a property to a new development stage."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Only GP_ADMIN can force transitions
    if payload.force and current_user.role != UserRole.GP_ADMIN:
        raise HTTPException(403, "Only GP Admin can force stage transitions")

    try:
        transition, validation = transition_property_stage(
            prop=prop,
            to_stage=payload.to_stage,
            user=current_user,
            db=db,
            notes=payload.notes,
            force=payload.force,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    db.commit()

    # Dispatch notification for stage transition
    try:
        prop = db.query(Property).filter(Property.property_id == property_id).first()
        if prop and prop.lp_id:
            from_label = (transition.from_stage.value if transition.from_stage else "—").replace("_", " ")
            to_label = transition.to_stage.value.replace("_", " ")
            notify_all_lp_investors(
                db=db,
                lp_id=prop.lp_id,
                title=f"Property Stage Change: {prop.address or prop.name}",
                message=f"Property has moved from {from_label} to {to_label}.",
                type=NotificationType.stage_transition,
                action_url=f"/portfolio/{property_id}",
            )
            db.commit()
    except Exception:
        logger.warning("Failed to dispatch stage transition notification", exc_info=True)

    checks = []
    if transition.validation_details:
        try:
            checks = [ValidationCheckOut(**c) for c in json.loads(transition.validation_details)]
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("Failed to parse validation_details for transition %d: %s", transition.transition_id, e)

    result = StageTransitionOut(
        transition_id=transition.transition_id,
        property_id=transition.property_id,
        from_stage=transition.from_stage.value,
        to_stage=transition.to_stage.value,
        transitioned_by=transition.transitioned_by,
        transitioned_at=transition.transitioned_at,
        notes=transition.notes,
        validation_passed=transition.validation_passed,
        validation_checks=checks,
    )

    if not validation.passed and not payload.force:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Validation failed. Use force=true (GP Admin) to override.",
                "transition": result.model_dump(mode="json"),
            }
        )

    return result


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------

@router.get(
    "/properties/{property_id}/milestones",
    response_model=List[MilestoneOut],
)
def list_milestones(
    property_id: int,
    stage: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """List milestones for a property, optionally filtered by stage."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    query = db.query(PropertyMilestone).filter(
        PropertyMilestone.property_id == property_id
    )
    if stage:
        query = query.filter(PropertyMilestone.stage == stage)

    milestones = query.order_by(
        PropertyMilestone.stage, PropertyMilestone.sort_order
    ).all()

    return [
        MilestoneOut(
            milestone_id=m.milestone_id,
            property_id=m.property_id,
            title=m.title,
            description=m.description,
            target_date=m.target_date,
            actual_date=m.actual_date,
            status=m.status,
            stage=m.stage.value if m.stage else None,
            sort_order=m.sort_order,
            created_at=m.created_at,
        )
        for m in milestones
    ]


@router.post(
    "/properties/{property_id}/milestones",
    response_model=MilestoneOut,
    status_code=status.HTTP_201_CREATED,
)
def create_milestone(
    property_id: int,
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_ops_pm),
):
    """Create a custom milestone for a property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    milestone = PropertyMilestone(
        property_id=property_id,
        title=payload.title,
        description=payload.description,
        target_date=payload.target_date,
        status=MilestoneStatus.pending,
        stage=payload.stage,
        sort_order=payload.sort_order,
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)

    return MilestoneOut(
        milestone_id=milestone.milestone_id,
        property_id=milestone.property_id,
        title=milestone.title,
        description=milestone.description,
        target_date=milestone.target_date,
        actual_date=milestone.actual_date,
        status=milestone.status,
        stage=milestone.stage.value if milestone.stage else None,
        sort_order=milestone.sort_order,
        created_at=milestone.created_at,
    )


@router.patch(
    "/milestones/{milestone_id}",
    response_model=MilestoneOut,
)
def update_milestone(
    milestone_id: int,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_ops_pm),
):
    """Update a milestone (status, dates, etc.)."""
    milestone = db.query(PropertyMilestone).filter(
        PropertyMilestone.milestone_id == milestone_id
    ).first()
    if not milestone:
        raise HTTPException(404, "Milestone not found")

    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, key, val)

    db.commit()
    db.refresh(milestone)

    return MilestoneOut(
        milestone_id=milestone.milestone_id,
        property_id=milestone.property_id,
        title=milestone.title,
        description=milestone.description,
        target_date=milestone.target_date,
        actual_date=milestone.actual_date,
        status=milestone.status,
        stage=milestone.stage.value if milestone.stage else None,
        sort_order=milestone.sort_order,
        created_at=milestone.created_at,
    )


# ---------------------------------------------------------------------------
# Quarterly Reports
# ---------------------------------------------------------------------------

@router.get(
    "/lp/{lp_id}/quarterly-reports",
    response_model=List[QuarterlyReportOut],
)
def list_quarterly_reports(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """List all quarterly reports for an LP fund."""
    reports = (
        db.query(QuarterlyReport)
        .filter(QuarterlyReport.lp_id == lp_id)
        .order_by(QuarterlyReport.year.desc(), QuarterlyReport.quarter.desc())
        .all()
    )
    return reports


@router.post(
    "/lp/{lp_id}/quarterly-reports",
    response_model=QuarterlyReportOut,
    status_code=status.HTTP_201_CREATED,
)
def create_quarterly_report(
    lp_id: int,
    payload: QuarterlyReportGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Generate a new quarterly report for an LP fund."""
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(404, "LP entity not found")

    if payload.quarter < 1 or payload.quarter > 4:
        raise HTTPException(400, "Quarter must be between 1 and 4")

    # Check for existing report
    existing = db.query(QuarterlyReport).filter(
        QuarterlyReport.lp_id == lp_id,
        QuarterlyReport.quarter == payload.quarter,
        QuarterlyReport.year == payload.year,
    ).first()
    if existing:
        raise HTTPException(400, f"Report for Q{payload.quarter} {payload.year} already exists (ID: {existing.report_id})")

    try:
        report = generate_quarterly_report(
            lp_id=lp_id,
            quarter=payload.quarter,
            year=payload.year,
            db=db,
            generated_by=current_user.user_id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    db.commit()
    db.refresh(report)
    return report


@router.patch(
    "/quarterly-reports/{report_id}",
    response_model=QuarterlyReportOut,
)
def update_quarterly_report(
    report_id: int,
    payload: QuarterlyReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Update a quarterly report (status, narrative sections)."""
    report = db.query(QuarterlyReport).filter(
        QuarterlyReport.report_id == report_id
    ).first()
    if not report:
        raise HTTPException(404, "Quarterly report not found")

    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(report, key, val)

    # Set published_at when status changes to published
    if payload.status == QuarterlyReportStatus.published and not report.published_at:
        report.published_at = datetime.utcnow()

    db.commit()
    db.refresh(report)

    # Notify investors when report is published
    if payload.status == QuarterlyReportStatus.published:
        try:
            notify_all_lp_investors(
                db=db,
                lp_id=report.lp_id,
                title=f"Q{report.quarter} {report.year} Report Published",
                message=f"The quarterly report for Q{report.quarter} {report.year} is now available.",
                type=NotificationType.quarterly_report,
                action_url=f"/quarterly-reports",
            )
            db.commit()
        except Exception:
            logger.warning("Failed to dispatch quarterly report notification", exc_info=True)

    return report


# ---------------------------------------------------------------------------
# eTransfer Tracking
# ---------------------------------------------------------------------------

@router.post(
    "/etransfers",
    response_model=ETransferOut,
    status_code=status.HTTP_201_CREATED,
)
def create_etransfer(
    payload: ETransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Initiate an eTransfer for a distribution allocation."""
    allocation = db.query(DistributionAllocation).filter(
        DistributionAllocation.allocation_id == payload.allocation_id
    ).first()
    if not allocation:
        raise HTTPException(404, "Distribution allocation not found")

    # Check if eTransfer already exists
    existing = db.query(ETransferTracking).filter(
        ETransferTracking.allocation_id == payload.allocation_id
    ).first()
    if existing:
        raise HTTPException(400, f"eTransfer already exists for this allocation (ID: {existing.tracking_id})")

    etransfer = ETransferTracking(
        allocation_id=payload.allocation_id,
        recipient_email=payload.recipient_email,
        amount=payload.amount,
        security_question=payload.security_question,
        status=ETransferStatus.initiated,
        initiated_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=30),
        notes=payload.notes,
    )
    db.add(etransfer)

    # Notify the recipient investor if they have a user account
    try:
        from app.services.notifications import create_notification
        from app.db.models import Investor, NotificationType
        investor = db.query(Investor).filter(
            Investor.email == payload.recipient_email
        ).first()
        if investor and investor.user_id:
            create_notification(
                db=db,
                user_id=investor.user_id,
                title="Distribution eTransfer Initiated",
                message=f"An eTransfer of ${payload.amount:,.2f} has been initiated to {payload.recipient_email}.",
                type=NotificationType.etransfer,
                action_url="/quarterly-reports",
            )
    except Exception as e:
        logger.error("Failed to create eTransfer notification for investor %s: %s", payload.investor_id, e)

    db.commit()
    db.refresh(etransfer)
    return etransfer


@router.get(
    "/etransfers",
    response_model=List[ETransferOut],
)
def list_etransfers(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """List all eTransfers, optionally filtered by status."""
    query = db.query(ETransferTracking)
    if status_filter:
        query = query.filter(ETransferTracking.status == status_filter)
    return query.order_by(ETransferTracking.initiated_at.desc()).all()


@router.patch(
    "/etransfers/{tracking_id}",
    response_model=ETransferOut,
)
def update_etransfer(
    tracking_id: int,
    payload: ETransferUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Update eTransfer status (sent, accepted, expired, etc.)."""
    etransfer = db.query(ETransferTracking).filter(
        ETransferTracking.tracking_id == tracking_id
    ).first()
    if not etransfer:
        raise HTTPException(404, "eTransfer not found")

    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(etransfer, key, val)

    db.commit()
    db.refresh(etransfer)

    # Notify investor when eTransfer is sent
    if payload.status == ETransferStatus.sent:
        try:
            alloc = db.query(DistributionAllocation).filter(
                DistributionAllocation.allocation_id == etransfer.allocation_id
            ).first()
            if alloc and alloc.investor and alloc.investor.user_id:
                create_notification(
                    db=db,
                    user_id=alloc.investor.user_id,
                    title="Distribution Payment Sent",
                    message=f"An eTransfer of ${float(etransfer.amount):,.2f} has been sent to your account.",
                    type=NotificationType.etransfer,
                    action_url="/investors",
                )
                db.commit()
        except Exception:
            logger.warning("Failed to dispatch eTransfer notification", exc_info=True)

    return etransfer


# ---------------------------------------------------------------------------
# Message Thread Replies
# ---------------------------------------------------------------------------

@router.get(
    "/messages/{message_id}/replies",
    response_model=List[MessageReplyOut],
)
def list_message_replies(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """List replies for a message thread."""
    msg = db.query(InvestorMessage).filter(
        InvestorMessage.message_id == message_id
    ).first()
    if not msg:
        raise HTTPException(404, "Message not found")

    replies = (
        db.query(MessageThread)
        .filter(MessageThread.parent_message_id == message_id)
        .order_by(MessageThread.sent_at.asc())
        .all()
    )
    return replies


@router.post(
    "/messages/{message_id}/replies",
    response_model=MessageReplyOut,
    status_code=status.HTTP_201_CREATED,
)
def create_message_reply(
    message_id: int,
    payload: MessageReplyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Reply to an investor message."""
    msg = db.query(InvestorMessage).filter(
        InvestorMessage.message_id == message_id
    ).first()
    if not msg:
        raise HTTPException(404, "Message not found")

    reply = MessageThread(
        parent_message_id=message_id,
        sender_id=current_user.user_id,
        body=payload.body,
        sent_at=datetime.utcnow(),
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return reply
