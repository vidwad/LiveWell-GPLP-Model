"""
Property Lifecycle Service
===========================
Manages stage transitions with validation gates, milestone auto-generation,
and timeline tracking for the Living Well property development pipeline.

Stage Order:
  prospect → acquisition → interim_operation → planning → construction → lease_up → stabilized → exit
"""
import json
from datetime import datetime, date
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import (
    Property, DevelopmentStage, DevelopmentPlan, DebtFacility,
    PropertyStageTransition, PropertyMilestone, MilestoneStatus,
    Community, User, NotificationType,
)


# ---------------------------------------------------------------------------
# Stage Order & Allowed Transitions
# ---------------------------------------------------------------------------

STAGE_ORDER = [
    DevelopmentStage.prospect,
    DevelopmentStage.acquisition,
    DevelopmentStage.interim_operation,
    DevelopmentStage.planning,
    DevelopmentStage.construction,
    DevelopmentStage.lease_up,
    DevelopmentStage.stabilized,
    DevelopmentStage.exit,
]

STAGE_INDEX = {stage: idx for idx, stage in enumerate(STAGE_ORDER)}

# Allowed forward transitions (can skip interim_operation if going straight to planning)
ALLOWED_TRANSITIONS = {
    DevelopmentStage.prospect: [DevelopmentStage.acquisition],
    DevelopmentStage.acquisition: [DevelopmentStage.interim_operation, DevelopmentStage.planning],
    DevelopmentStage.interim_operation: [DevelopmentStage.planning],
    DevelopmentStage.planning: [DevelopmentStage.construction],
    DevelopmentStage.construction: [DevelopmentStage.lease_up],
    DevelopmentStage.lease_up: [DevelopmentStage.stabilized],
    DevelopmentStage.stabilized: [DevelopmentStage.exit],
    DevelopmentStage.exit: [],  # terminal
}

# Default milestones auto-created for each stage
DEFAULT_MILESTONES = {
    DevelopmentStage.prospect: [
        "Site identification and initial assessment",
        "Zoning and land-use verification",
        "Preliminary financial feasibility study",
    ],
    DevelopmentStage.acquisition: [
        "Purchase agreement executed",
        "Due diligence completed",
        "Title transfer and closing",
        "Environmental assessment (Phase I ESA)",
    ],
    DevelopmentStage.interim_operation: [
        "Existing tenant assessment",
        "Interim property management setup",
        "Revenue stabilization during hold period",
    ],
    DevelopmentStage.planning: [
        "Architectural design completed",
        "Development permit application submitted",
        "Development permit approved",
        "Construction financing secured",
        "Development plan finalized",
    ],
    DevelopmentStage.construction: [
        "Construction commencement",
        "Foundation and framing complete",
        "Mechanical/electrical rough-in",
        "Interior finishing",
        "Final inspection and occupancy permit",
    ],
    DevelopmentStage.lease_up: [
        "Marketing campaign launched",
        "First resident move-in",
        "50% occupancy achieved",
        "90% occupancy achieved",
        "Stabilized occupancy target reached",
    ],
    DevelopmentStage.stabilized: [
        "Permanent financing in place",
        "First quarterly distribution",
        "Annual budget approved",
        "Property management review",
    ],
    DevelopmentStage.exit: [
        "Exit strategy determined (sale/refinance)",
        "Appraisal completed",
        "Sale/refinance closed",
        "Final investor distributions",
    ],
}


# ---------------------------------------------------------------------------
# Validation Gates
# ---------------------------------------------------------------------------

class ValidationResult:
    def __init__(self):
        self.checks: list[dict] = []
        self.passed = True

    def add_check(self, name: str, passed: bool, message: str):
        self.checks.append({"name": name, "passed": passed, "message": message})
        if not passed:
            self.passed = False

    def to_json(self) -> str:
        return json.dumps(self.checks)


def _validate_to_acquisition(prop: Property, db: Session) -> ValidationResult:
    result = ValidationResult()
    result.add_check(
        "lp_assigned",
        prop.lp_id is not None,
        "Property must be assigned to an LP fund before acquisition."
    )
    result.add_check(
        "purchase_price_set",
        prop.purchase_price is not None and prop.purchase_price > 0,
        "Purchase price must be set."
    )
    return result


def _validate_to_planning(prop: Property, db: Session) -> ValidationResult:
    result = ValidationResult()
    result.add_check(
        "lp_assigned",
        prop.lp_id is not None,
        "Property must be assigned to an LP fund."
    )
    result.add_check(
        "purchase_completed",
        prop.purchase_date is not None,
        "Purchase date must be recorded (acquisition completed)."
    )
    result.add_check(
        "zoning_set",
        prop.zoning is not None and len(prop.zoning) > 0,
        "Zoning designation must be set."
    )
    return result


def _validate_to_construction(prop: Property, db: Session) -> ValidationResult:
    result = ValidationResult()
    # Must have an approved development plan
    plans = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.property_id == prop.property_id,
        DevelopmentPlan.status.in_(["approved", "active"])
    ).all()
    result.add_check(
        "approved_plan",
        len(plans) > 0,
        "An approved or active development plan is required."
    )
    # Must have construction financing
    debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == prop.property_id,
    ).all()
    has_construction_debt = any(
        d.debt_type.value in ("construction_loan", "bridge_loan") for d in debts
    )
    result.add_check(
        "construction_financing",
        has_construction_debt,
        "Construction or bridge financing must be in place."
    )
    return result


def _validate_to_lease_up(prop: Property, db: Session) -> ValidationResult:
    result = ValidationResult()
    # Must have communities defined
    communities = db.query(Community).filter(
        Community.property_id == prop.property_id
    ).all()
    result.add_check(
        "communities_defined",
        len(communities) > 0,
        "At least one community must be defined for lease-up."
    )
    return result


def _validate_to_stabilized(prop: Property, db: Session) -> ValidationResult:
    result = ValidationResult()
    # Check occupancy (if communities exist with units)
    communities = db.query(Community).filter(
        Community.property_id == prop.property_id
    ).all()
    result.add_check(
        "communities_exist",
        len(communities) > 0,
        "Communities must exist."
    )
    # Check for permanent financing
    debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == prop.property_id,
    ).all()
    has_perm = any(
        d.debt_type.value == "permanent_mortgage" for d in debts
    )
    result.add_check(
        "permanent_financing",
        has_perm,
        "Permanent mortgage financing should be in place for stabilization."
    )
    return result


VALIDATION_MAP = {
    DevelopmentStage.acquisition: _validate_to_acquisition,
    DevelopmentStage.planning: _validate_to_planning,
    DevelopmentStage.construction: _validate_to_construction,
    DevelopmentStage.lease_up: _validate_to_lease_up,
    DevelopmentStage.stabilized: _validate_to_stabilized,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_allowed_transitions(current_stage: DevelopmentStage) -> list[str]:
    """Return list of stages a property can transition to from its current stage."""
    return [s.value for s in ALLOWED_TRANSITIONS.get(current_stage, [])]


def validate_transition(
    prop: Property,
    to_stage: DevelopmentStage,
    db: Session,
) -> ValidationResult:
    """Run validation gates for a proposed stage transition."""
    validator = VALIDATION_MAP.get(to_stage)
    if validator:
        return validator(prop, db)
    # No special validation for this stage
    result = ValidationResult()
    result.add_check("no_gates", True, "No validation gates for this transition.")
    return result


def transition_property_stage(
    prop: Property,
    to_stage: DevelopmentStage,
    user: User,
    db: Session,
    notes: Optional[str] = None,
    force: bool = False,
) -> tuple[PropertyStageTransition, ValidationResult]:
    """
    Transition a property to a new development stage.

    Args:
        prop: The property to transition
        to_stage: Target stage
        user: User performing the transition
        db: Database session
        notes: Optional notes
        force: If True, skip validation (GP_ADMIN only)

    Returns:
        Tuple of (transition record, validation result)

    Raises:
        ValueError: If transition is not allowed
    """
    from_stage = prop.development_stage

    # Check if transition is allowed
    allowed = ALLOWED_TRANSITIONS.get(from_stage, [])
    if to_stage not in allowed:
        raise ValueError(
            f"Transition from {from_stage.value} to {to_stage.value} is not allowed. "
            f"Allowed: {[s.value for s in allowed]}"
        )

    # Run validation
    validation = validate_transition(prop, to_stage, db)

    if not validation.passed and not force:
        # Record the failed attempt
        transition = PropertyStageTransition(
            property_id=prop.property_id,
            from_stage=from_stage,
            to_stage=to_stage,
            transitioned_by=user.user_id,
            transitioned_at=datetime.utcnow(),
            notes=notes,
            validation_passed=False,
            validation_details=validation.to_json(),
        )
        db.add(transition)
        db.flush()
        return transition, validation

    # Perform the transition
    prop.development_stage = to_stage

    transition = PropertyStageTransition(
        property_id=prop.property_id,
        from_stage=from_stage,
        to_stage=to_stage,
        transitioned_by=user.user_id,
        transitioned_at=datetime.utcnow(),
        notes=notes,
        validation_passed=True,
        validation_details=validation.to_json(),
    )
    db.add(transition)

    # Auto-generate milestones for the new stage
    _create_stage_milestones(prop.property_id, to_stage, db)

    # Notify GP admin users of stage change
    try:
        from app.services.notifications import create_notification
        from app.db.models import UserRole
        from app.db.session import Session as _S
        gp_users = db.query(User).filter(
            User.role.in_([UserRole.DEVELOPER, UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER]),
            User.is_active == True,  # noqa: E712
        ).all()
        for gp_user in gp_users:
            create_notification(
                db=db,
                user_id=gp_user.user_id,
                title="Property Stage Transition",
                message=(
                    f"{prop.address} moved from {from_stage.value.replace('_', ' ').title()} "
                    f"to {to_stage.value.replace('_', ' ').title()}."
                ),
                type=NotificationType.stage_transition,
                action_url=f"/lifecycle",
            )
    except Exception:
        pass  # Notifications must never block a transition

    db.flush()
    return transition, validation


def _create_stage_milestones(
    property_id: int,
    stage: DevelopmentStage,
    db: Session,
):
    """Auto-create default milestones for a stage if they don't already exist."""
    existing = db.query(PropertyMilestone).filter(
        PropertyMilestone.property_id == property_id,
        PropertyMilestone.stage == stage,
    ).count()

    if existing > 0:
        return  # milestones already exist for this stage

    titles = DEFAULT_MILESTONES.get(stage, [])
    for idx, title in enumerate(titles):
        milestone = PropertyMilestone(
            property_id=property_id,
            title=title,
            status=MilestoneStatus.pending,
            stage=stage,
            sort_order=idx,
        )
        db.add(milestone)
