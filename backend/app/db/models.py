"""
Living Well Communities Platform — SQLAlchemy Models
=====================================================
Phase 1 Foundation Rebuild: LP-centric investment architecture,
scope-based permissions, and corrected entity relationships.
"""
import enum
from datetime import datetime
from functools import partial

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum as SAEnum,
    ForeignKey, Integer, Numeric, String, Text, func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base

# Use native_enum=False so enum columns work on both PostgreSQL and SQLite
def _enum(*args, **kwargs):
    return SAEnum(*args, native_enum=False, **kwargs)


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    GP_ADMIN = "GP_ADMIN"
    OPERATIONS_MANAGER = "OPERATIONS_MANAGER"
    PROPERTY_MANAGER = "PROPERTY_MANAGER"
    INVESTOR = "INVESTOR"
    RESIDENT = "RESIDENT"


class ScopeEntityType(str, enum.Enum):
    """What kind of entity a scope assignment grants access to."""
    lp = "lp"
    community = "community"
    property = "property"
    cluster = "cluster"


class ScopePermissionLevel(str, enum.Enum):
    """Level of access within the assigned scope."""
    view = "view"
    manage = "manage"
    admin = "admin"


class CommunityType(str, enum.Enum):
    recover = "RecoverWell"
    study = "StudyWell"
    retire = "RetireWell"


class UnitType(str, enum.Enum):
    studio = "studio"
    one_bed = "1br"
    two_bed = "2br"
    three_bed = "3br"
    suite = "suite"
    shared = "shared"


class RentType(str, enum.Enum):
    private_pay = "private_pay"
    government_supported = "government_supported"
    shared_room = "shared_room"
    transitional = "transitional"


class BedStatus(str, enum.Enum):
    available = "available"
    occupied = "occupied"
    reserved = "reserved"
    maintenance = "maintenance"


class DevelopmentStage(str, enum.Enum):
    prospect = "prospect"
    acquisition = "acquisition"
    interim_operation = "interim_operation"
    planning = "planning"
    construction = "construction"
    lease_up = "lease_up"
    stabilized = "stabilized"
    exit = "exit"


class MaintenanceStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    overdue = "overdue"


class DistributionMethod(str, enum.Enum):
    etransfer = "eTransfer"
    wire = "Wire"
    ach = "ACH"


class DistributionType(str, enum.Enum):
    preferred_return = "preferred_return"
    profit_share = "profit_share"
    return_of_capital = "return_of_capital"
    refinancing = "refinancing"
    sale_proceeds = "sale_proceeds"


class DocumentType(str, enum.Enum):
    subscription_agreement = "subscription_agreement"
    partnership_agreement = "partnership_agreement"
    tax_form = "tax_form"
    quarterly_report = "quarterly_report"
    capital_call = "capital_call"
    distribution_notice = "distribution_notice"
    appraisal = "appraisal"
    insurance = "insurance"
    other = "other"


class LPStatus(str, enum.Enum):
    """Lifecycle / offering status of an LP fund."""
    draft = "draft"
    under_review = "under_review"
    approved = "approved"
    open_for_subscription = "open_for_subscription"
    partially_funded = "partially_funded"
    tranche_closed = "tranche_closed"
    fully_funded = "fully_funded"
    closed = "closed"
    operating = "operating"
    winding_down = "winding_down"


class LPPurposeType(str, enum.Enum):
    """Purpose / community focus of the LP."""
    recover_well = "RecoverWell"
    study_well = "StudyWell"
    retire_well = "RetireWell"
    mixed = "Mixed"


class TrancheStatus(str, enum.Enum):
    """Status of an LP tranche / closing."""
    draft = "draft"
    open = "open"
    closed = "closed"
    cancelled = "cancelled"


class TargetPropertyStatus(str, enum.Enum):
    """Status of a target / pipeline property."""
    identified = "identified"
    underwriting = "underwriting"
    approved_target = "approved_target"
    under_offer = "under_offer"
    acquired = "acquired"
    rejected = "rejected"
    dropped = "dropped"


class SubscriptionStatus(str, enum.Enum):
    """Workflow state of an investor subscription to an LP."""
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    accepted = "accepted"
    funded = "funded"
    issued = "issued"
    closed = "closed"
    rejected = "rejected"
    withdrawn = "withdrawn"
    cancelled = "cancelled"


class DistributionEventStatus(str, enum.Enum):
    """Workflow state of a distribution event."""
    draft = "draft"
    calculated = "calculated"
    approved = "approved"
    paid = "paid"
    published = "published"


class DevelopmentPlanStatus(str, enum.Enum):
    """Workflow state of a development plan."""
    draft = "draft"
    approved = "approved"
    active = "active"
    superseded = "superseded"


class ETransferStatus(str, enum.Enum):
    """Tracking state for eTransfer distributions."""
    initiated = "initiated"
    sent = "sent"
    accepted = "accepted"
    expired = "expired"
    cancelled = "cancelled"
    failed = "failed"


class QuarterlyReportStatus(str, enum.Enum):
    """Workflow state of a quarterly report."""
    draft = "draft"
    reviewed = "reviewed"
    approved = "approved"
    published = "published"
    archived = "archived"


class ExpenseCategory(str, enum.Enum):
    """Operating expense categories."""
    property_management = "property_management"
    maintenance_repairs = "maintenance_repairs"
    utilities = "utilities"
    insurance = "insurance"
    property_tax = "property_tax"
    meal_program = "meal_program"
    staffing = "staffing"
    marketing = "marketing"
    supplies = "supplies"
    professional_fees = "professional_fees"
    technology = "technology"
    other = "other"


class BudgetPeriodType(str, enum.Enum):
    """Budget period granularity."""
    monthly = "monthly"
    quarterly = "quarterly"
    annual = "annual"


class MilestoneStatus(str, enum.Enum):
    """Status of a property milestone."""
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    overdue = "overdue"
    skipped = "skipped"


# ---------------------------------------------------------------------------
# Auth & Permissions
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    email = Column(String(256), nullable=False, unique=True, index=True)
    hashed_password = Column(String(256), nullable=False)
    full_name = Column(String(256), nullable=True)
    role = Column(_enum(UserRole), nullable=False, default=UserRole.INVESTOR)
    is_active = Column(Boolean, default=True, nullable=False)

    scope_assignments = relationship(
        "ScopeAssignment", back_populates="user", cascade="all, delete-orphan"
    )


class ScopeAssignment(Base):
    """Maps a user to a specific entity they are authorized to access."""
    __tablename__ = "scope_assignments"

    assignment_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    entity_type = Column(_enum(ScopeEntityType), nullable=False)
    entity_id = Column(Integer, nullable=False)  # polymorphic FK
    permission_level = Column(
        _enum(ScopePermissionLevel), nullable=False, default=ScopePermissionLevel.view
    )

    user = relationship("User", back_populates="scope_assignments")


class AuditLog(Base):
    """Tracks high-risk actions for governance and compliance."""
    __tablename__ = "audit_log"

    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    action = Column(String(128), nullable=False)  # e.g. "distribution.approved"
    entity_type = Column(String(64), nullable=False)  # e.g. "DistributionEvent"
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)  # JSON-encoded extra info
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User")


# ---------------------------------------------------------------------------
# GP & LP — Investment Structure
# ---------------------------------------------------------------------------

class GPEntity(Base):
    """The General Partner managing entity."""
    __tablename__ = "gp_entities"

    gp_id = Column(Integer, primary_key=True, index=True)
    legal_name = Column(String(256), nullable=False)
    management_fee_percent = Column(Numeric(5, 2), nullable=True)  # e.g. 2.00 for 2%
    address = Column(String(512), nullable=True)
    contact_email = Column(String(256), nullable=True)
    notes = Column(Text, nullable=True)

    lps = relationship("LPEntity", back_populates="gp", cascade="all, delete-orphan")


class LPEntity(Base):
    """A Limited Partnership fund vehicle — the core economic boundary."""
    __tablename__ = "lp_entities"

    lp_id = Column(Integer, primary_key=True, index=True)
    gp_id = Column(Integer, ForeignKey("gp_entities.gp_id"), nullable=False)

    # Identity
    name = Column(String(256), nullable=False)              # display name
    legal_name = Column(String(256), nullable=True)         # legal name
    lp_number = Column(String(32), nullable=True)           # sequence / reference number
    description = Column(Text, nullable=True)

    # Focus
    city_focus = Column(String(256), nullable=True)         # e.g. "Calgary, Edmonton"
    community_focus = Column(String(256), nullable=True)    # e.g. "RecoverWell, StudyWell"
    purpose_type = Column(_enum(LPPurposeType), nullable=True)

    # Status
    status = Column(_enum(LPStatus), nullable=False, default=LPStatus.draft)

    # Offering terms
    unit_price = Column(Numeric(14, 2), nullable=True)      # price per LP unit
    minimum_subscription = Column(Numeric(14, 2), nullable=True)  # min subscription amount
    # minimum_investment removed — use minimum_subscription only
    target_raise = Column(Numeric(16, 2), nullable=True)
    minimum_raise = Column(Numeric(16, 2), nullable=True)
    maximum_raise = Column(Numeric(16, 2), nullable=True)
    offering_date = Column(Date, nullable=True)
    closing_date = Column(Date, nullable=True)

    # Financing / offering costs
    formation_costs = Column(Numeric(14, 2), nullable=True)       # legal, accounting, etc.
    offering_costs = Column(Numeric(14, 2), nullable=True)        # placement fees, etc.
    reserve_percent = Column(Numeric(5, 2), nullable=True)        # operating reserve %
    reserve_amount = Column(Numeric(14, 2), nullable=True)        # fixed reserve amount

    # LP-specific waterfall rules
    preferred_return_rate = Column(Numeric(5, 2), nullable=True)  # e.g. 8.00 for 8%
    gp_promote_percent = Column(Numeric(5, 2), nullable=True)     # e.g. 20.00 for 20%
    gp_catchup_percent = Column(Numeric(5, 2), nullable=True)     # e.g. 100.00 for 100% catch-up

    # Fee structure
    asset_management_fee_percent = Column(Numeric(5, 2), nullable=True)
    acquisition_fee_percent = Column(Numeric(5, 2), nullable=True)

    # Total units authorized for issuance (= maximum_raise / unit_price)
    total_units_authorized = Column(Numeric(14, 4), nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True, default=func.now())
    updated_at = Column(DateTime, nullable=True, default=func.now(), onupdate=func.now())

    gp = relationship("GPEntity", back_populates="lps")
    properties = relationship("Property", back_populates="lp", cascade="all, delete-orphan")
    tranches = relationship("LPTranche", back_populates="lp", cascade="all, delete-orphan")
    subscriptions = relationship(
        "Subscription", back_populates="lp", cascade="all, delete-orphan"
    )
    holdings = relationship("Holding", back_populates="lp", cascade="all, delete-orphan")
    target_properties = relationship(
        "TargetProperty", back_populates="lp", cascade="all, delete-orphan"
    )
    distribution_events = relationship(
        "DistributionEvent", back_populates="lp", cascade="all, delete-orphan"
    )
    quarterly_reports = relationship(
        "QuarterlyReport", back_populates="lp", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# Investor — Subscription & Holding
# ---------------------------------------------------------------------------

class Investor(Base):
    __tablename__ = "investors"

    investor_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, unique=True)
    name = Column(String(256), nullable=False)         # legal name
    email = Column(String(256), nullable=False, unique=True)
    phone = Column(String(64), nullable=True)
    address = Column(String(512), nullable=True)
    entity_type = Column(String(64), nullable=True)    # individual, trust, corporation, etc.
    jurisdiction = Column(String(128), nullable=True)   # province / state / country
    accredited_status = Column(String(32), nullable=False)
    exemption_type = Column(String(128), nullable=True) # accreditation exemption type
    tax_id = Column(String(64), nullable=True)          # SIN, BN, or other tax ID
    banking_info = Column(Text, nullable=True)          # encrypted or reference
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True, default=func.now())
    updated_at = Column(DateTime, nullable=True, default=func.now(), onupdate=func.now())

    subscriptions = relationship(
        "Subscription", back_populates="investor", cascade="all, delete-orphan"
    )
    holdings = relationship(
        "Holding", back_populates="investor", cascade="all, delete-orphan"
    )
    documents = relationship(
        "InvestorDocument", back_populates="investor", cascade="all, delete-orphan"
    )
    messages = relationship(
        "InvestorMessage", back_populates="investor", cascade="all, delete-orphan"
    )


class Subscription(Base):
    """An investor's commitment to invest in a specific LP."""
    __tablename__ = "subscriptions"

    subscription_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False)
    tranche_id = Column(Integer, ForeignKey("lp_tranches.tranche_id"), nullable=True)

    commitment_amount = Column(Numeric(14, 2), nullable=False)  # subscription amount
    funded_amount = Column(Numeric(14, 2), nullable=False, default=0)
    issue_price = Column(Numeric(14, 2), nullable=False)         # price per unit at subscription
    unit_quantity = Column(Numeric(14, 4), nullable=False)       # number of units issued

    status = Column(
        _enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.draft
    )
    submitted_date = Column(Date, nullable=True)
    accepted_date = Column(Date, nullable=True)
    funded_date = Column(Date, nullable=True)
    issued_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True, default=func.now())

    investor = relationship("Investor", back_populates="subscriptions")
    lp = relationship("LPEntity", back_populates="subscriptions")
    tranche = relationship("LPTranche", back_populates="subscriptions")
    holding = relationship("Holding", back_populates="subscription", uselist=False)


class Holding(Base):
    """An investor's actual equity position in a specific LP (unit-based tracking)."""
    __tablename__ = "holdings"

    holding_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.subscription_id"), nullable=True)

    # Unit-based position (PRIMARY equity tracking)
    units_held = Column(Numeric(14, 4), nullable=False)           # total LP units held
    average_issue_price = Column(Numeric(14, 2), nullable=False)  # weighted avg price per unit
    total_capital_contributed = Column(Numeric(14, 2), nullable=False)  # total cash invested
    initial_issue_date = Column(Date, nullable=False)

    # Capital account tracking (updated on distributions)
    unreturned_capital = Column(Numeric(14, 2), nullable=False)   # capital not yet returned
    unpaid_preferred = Column(Numeric(14, 2), nullable=False, default=0)  # accrued pref return owed
    is_gp = Column(Boolean, default=False, nullable=False)
    status = Column(String(32), nullable=False, default="active")  # active, redeemed, transferred

    investor = relationship("Investor", back_populates="holdings")
    lp = relationship("LPEntity", back_populates="holdings")
    subscription = relationship("Subscription", back_populates="holding")
    allocations = relationship(
        "DistributionAllocation", back_populates="holding", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# Debt Facility
# ---------------------------------------------------------------------------

class DebtType(str, enum.Enum):
    construction_loan = "construction_loan"
    bridge_loan = "bridge_loan"
    permanent_mortgage = "permanent_mortgage"
    mezzanine = "mezzanine"
    line_of_credit = "line_of_credit"

class DebtStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    matured = "matured"
    refinanced = "refinanced"
    paid_off = "paid_off"

class DebtFacility(Base):
    __tablename__ = "debt_facilities"

    debt_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    lender_name = Column(String(200), nullable=False)
    debt_type = Column(_enum(DebtType), nullable=False)
    status = Column(_enum(DebtStatus), default=DebtStatus.pending)

    # Amounts
    commitment_amount = Column(Numeric(15, 2), nullable=False)  # Total facility size
    drawn_amount = Column(Numeric(15, 2), default=0)            # Amount drawn to date
    outstanding_balance = Column(Numeric(15, 2), default=0)     # Current balance

    # Terms
    interest_rate = Column(Numeric(6, 4))          # e.g. 5.2500 = 5.25%
    rate_type = Column(String(20), default="fixed") # fixed, variable, hybrid
    term_months = Column(Integer)                   # Loan term in months
    amortization_months = Column(Integer)           # Amortization period
    io_period_months = Column(Integer, default=0)   # Interest-only period

    # Dates
    origination_date = Column(Date)
    maturity_date = Column(Date)

    # Covenants
    ltv_covenant = Column(Numeric(5, 2))   # Max LTV e.g. 75.00
    dscr_covenant = Column(Numeric(5, 2))  # Min DSCR e.g. 1.25

    notes = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    property = relationship("Property", back_populates="debt_facilities")


# ---------------------------------------------------------------------------
# Distribution Events & Allocations
# ---------------------------------------------------------------------------

class DistributionEvent(Base):
    """A batch distribution record for a specific LP and period."""
    __tablename__ = "distribution_events"

    event_id = Column(Integer, primary_key=True, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False)
    period_label = Column(String(64), nullable=False)  # e.g. "Q1 2026"
    total_distributable = Column(Numeric(16, 2), nullable=False)
    status = Column(
        _enum(DistributionEventStatus), nullable=False,
        default=DistributionEventStatus.draft
    )
    created_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    approved_date = Column(DateTime, nullable=True)
    paid_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    lp = relationship("LPEntity", back_populates="distribution_events")
    allocations = relationship(
        "DistributionAllocation", back_populates="event", cascade="all, delete-orphan"
    )


class DistributionAllocation(Base):
    """Per-holding allocation within a distribution event."""
    __tablename__ = "distribution_allocations"

    allocation_id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("distribution_events.event_id"), nullable=False)
    holding_id = Column(Integer, ForeignKey("holdings.holding_id"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    distribution_type = Column(_enum(DistributionType), nullable=False)
    method = Column(_enum(DistributionMethod), nullable=True)
    notes = Column(Text, nullable=True)

    event = relationship("DistributionEvent", back_populates="allocations")
    holding = relationship("Holding", back_populates="allocations")
    etransfer = relationship("ETransferTracking", back_populates="allocation", uselist=False)


# ---------------------------------------------------------------------------
# LP Tranche / Closing
# ---------------------------------------------------------------------------

class LPTranche(Base):
    """A funding tranche / closing within an LP offering."""
    __tablename__ = "lp_tranches"

    tranche_id = Column(Integer, primary_key=True, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False)
    tranche_number = Column(Integer, nullable=False, default=1)
    tranche_name = Column(String(128), nullable=True)       # e.g. "First Close"
    opening_date = Column(Date, nullable=True)
    closing_date = Column(Date, nullable=True)
    status = Column(_enum(TrancheStatus), nullable=False, default=TrancheStatus.draft)
    issue_price = Column(Numeric(14, 2), nullable=True)     # price per unit for this tranche
    target_amount = Column(Numeric(16, 2), nullable=True)   # target raise for this tranche
    target_units = Column(Numeric(14, 4), nullable=True)    # target units for this tranche
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True, default=func.now())

    lp = relationship("LPEntity", back_populates="tranches")
    subscriptions = relationship("Subscription", back_populates="tranche")


# ---------------------------------------------------------------------------
# Target / Pipeline Property
# ---------------------------------------------------------------------------

class TargetProperty(Base):
    """A hypothetical or planned property assigned to an LP for portfolio modeling."""
    __tablename__ = "target_properties"

    target_property_id = Column(Integer, primary_key=True, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False)

    # Identity
    address = Column(String(256), nullable=True)            # address or target identifier
    city = Column(String(128), nullable=True)
    province = Column(String(64), nullable=True, default="AB")
    intended_community = Column(String(128), nullable=True) # e.g. "RecoverWell"
    status = Column(_enum(TargetPropertyStatus), nullable=False, default=TargetPropertyStatus.identified)

    # Acquisition assumptions
    estimated_acquisition_price = Column(Numeric(16, 2), nullable=True)
    lot_size = Column(Numeric(14, 2), nullable=True)
    zoning = Column(String(128), nullable=True)

    # Current house characteristics
    current_sqft = Column(Numeric(10, 2), nullable=True)
    current_bedrooms = Column(Integer, nullable=True)
    current_bathrooms = Column(Integer, nullable=True)
    current_condition = Column(String(64), nullable=True)   # good, fair, poor
    current_assessed_value = Column(Numeric(14, 2), nullable=True)

    # Interim operating assumptions
    interim_monthly_revenue = Column(Numeric(12, 2), nullable=True)
    interim_monthly_expenses = Column(Numeric(12, 2), nullable=True)
    interim_occupancy_percent = Column(Numeric(5, 2), nullable=True)
    interim_hold_months = Column(Integer, nullable=True)    # months before redevelopment

    # Redevelopment scenario
    planned_units = Column(Integer, nullable=True)
    planned_beds = Column(Integer, nullable=True)
    planned_sqft = Column(Numeric(10, 2), nullable=True)
    construction_budget = Column(Numeric(16, 2), nullable=True)
    hard_costs = Column(Numeric(16, 2), nullable=True)
    soft_costs = Column(Numeric(16, 2), nullable=True)
    contingency_percent = Column(Numeric(5, 2), nullable=True)
    construction_duration_months = Column(Integer, nullable=True)

    # Stabilized pro forma
    stabilized_monthly_revenue = Column(Numeric(12, 2), nullable=True)
    stabilized_monthly_expenses = Column(Numeric(12, 2), nullable=True)
    stabilized_occupancy_percent = Column(Numeric(5, 2), nullable=True)
    stabilized_annual_noi = Column(Numeric(14, 2), nullable=True)
    stabilized_cap_rate = Column(Numeric(5, 2), nullable=True)
    stabilized_value = Column(Numeric(16, 2), nullable=True)

    # Debt assumptions
    assumed_ltv_percent = Column(Numeric(5, 2), nullable=True)
    assumed_interest_rate = Column(Numeric(6, 4), nullable=True)
    assumed_amortization_months = Column(Integer, nullable=True)
    assumed_debt_amount = Column(Numeric(16, 2), nullable=True)

    # Timing
    target_acquisition_date = Column(Date, nullable=True)
    target_completion_date = Column(Date, nullable=True)
    target_stabilization_date = Column(Date, nullable=True)

    # Converted property reference
    converted_property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True, default=func.now())
    updated_at = Column(DateTime, nullable=True, default=func.now(), onupdate=func.now())

    lp = relationship("LPEntity", back_populates="target_properties")
    converted_property = relationship("Property", foreign_keys=[converted_property_id])


# ---------------------------------------------------------------------------
# Portfolio — Property, Cluster, Development
# ---------------------------------------------------------------------------

class PropertyCluster(Base):
    """A group of nearby properties that share infrastructure (e.g. a commercial kitchen)."""
    __tablename__ = "property_clusters"

    cluster_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    city = Column(String(128), nullable=False)
    has_commercial_kitchen = Column(Boolean, default=False, nullable=False)
    kitchen_capacity_meals_per_day = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

    properties = relationship("Property", back_populates="cluster")


class Property(Base):
    __tablename__ = "properties"

    property_id = Column(Integer, primary_key=True, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=True)  # LP ownership
    cluster_id = Column(Integer, ForeignKey("property_clusters.cluster_id"), nullable=True)

    address = Column(String(256), nullable=False)
    city = Column(String(128), nullable=False)
    province = Column(String(64), nullable=False)
    purchase_date = Column(Date, nullable=True)
    purchase_price = Column(Numeric(14, 2), nullable=True)
    assessed_value = Column(Numeric(14, 2), nullable=True)
    current_market_value = Column(Numeric(14, 2), nullable=True)
    estimated_value = Column(Numeric(15, 2), nullable=True)
    lot_size = Column(Numeric(14, 2), nullable=True)
    zoning = Column(String(128), nullable=True)
    max_buildable_area = Column(Numeric(14, 2), nullable=True)
    floor_area_ratio = Column(Numeric(5, 2), nullable=True)
    development_stage = Column(
        _enum(DevelopmentStage), nullable=False, default=DevelopmentStage.prospect
    )

    lp = relationship("LPEntity", back_populates="properties")
    cluster = relationship("PropertyCluster", back_populates="properties")
    development_plans = relationship(
        "DevelopmentPlan", back_populates="property", cascade="all, delete-orphan"
    )
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=True)
    community = relationship("Community", back_populates="properties")
    pm_id = Column(Integer, ForeignKey("property_managers.pm_id"), nullable=True)
    property_manager = relationship("PropertyManagerEntity", back_populates="properties")
    maintenance_requests = relationship(
        "MaintenanceRequest", back_populates="property", cascade="all, delete-orphan"
    )
    debt_facilities = relationship("DebtFacility", back_populates="property", cascade="all, delete-orphan")
    stage_transitions = relationship(
        "PropertyStageTransition", back_populates="property", cascade="all, delete-orphan"
    )
    milestones = relationship(
        "PropertyMilestone", back_populates="property", cascade="all, delete-orphan"
    )


class DevelopmentPlan(Base):
    __tablename__ = "development_plans"

    plan_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    status = Column(
        _enum(DevelopmentPlanStatus), nullable=False, default=DevelopmentPlanStatus.draft
    )
    planned_units = Column(Integer, nullable=False)
    planned_beds = Column(Integer, nullable=False)
    planned_sqft = Column(Numeric(14, 2), nullable=False)

    # Detailed cost breakdown
    hard_costs = Column(Numeric(16, 2), nullable=True)
    soft_costs = Column(Numeric(16, 2), nullable=True)
    site_costs = Column(Numeric(16, 2), nullable=True)
    financing_costs = Column(Numeric(16, 2), nullable=True)
    contingency_percent = Column(Numeric(5, 2), nullable=True)
    cost_escalation_percent_per_year = Column(Numeric(5, 2), nullable=True)
    cost_per_sqft = Column(Numeric(10, 2), nullable=True)
    estimated_construction_cost = Column(Numeric(16, 2), nullable=False)

    # Projected revenue (stabilized)
    projected_annual_revenue = Column(Numeric(16, 2), nullable=True)
    projected_annual_noi = Column(Numeric(16, 2), nullable=True)

    # Timeline
    development_start_date = Column(Date, nullable=True)
    construction_duration_days = Column(Integer, nullable=True)
    estimated_completion_date = Column(Date, nullable=True)
    estimated_stabilization_date = Column(Date, nullable=True)

    property = relationship("Property", back_populates="development_plans")


# ---------------------------------------------------------------------------
# Operator Entity
# ---------------------------------------------------------------------------

class OperatorEntity(Base):
    """The business entity operating a community (e.g. RecoverWell Operations Inc)."""
    __tablename__ = "operator_entities"

    operator_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    contact_email = Column(String(256), nullable=True)
    contact_phone = Column(String(64), nullable=True)
    address = Column(String(512), nullable=True)
    notes = Column(Text, nullable=True)

    communities = relationship("Community", back_populates="operator")
    budgets = relationship("OperatorBudget", back_populates="operator", cascade="all, delete-orphan")


class PropertyManagerEntity(Base):
    """Third-party property management company responsible for the physical
    building: maintenance, rent collection, inspections, turnovers.
    Distinct from the community Operator (who runs the program) and the
    LP (who owns the asset)."""
    __tablename__ = "property_managers"

    pm_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    contact_email = Column(String(256), nullable=True)
    contact_phone = Column(String(64), nullable=True)
    address = Column(String(512), nullable=True)
    management_fee_percent = Column(Numeric(5, 2), nullable=True)  # e.g. 8.00 = 8%
    contract_start_date = Column(Date, nullable=True)
    contract_end_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    # A PM can manage many properties
    properties = relationship("Property", back_populates="property_manager")


# ---------------------------------------------------------------------------
# Community — Units, Beds, Residents
# ---------------------------------------------------------------------------

class Community(Base):
    """City + purpose-level grouping. Multiple properties (from different LPs)
    can belong to the same community.  E.g. 'Calgary Recovery Community'."""
    __tablename__ = "communities"

    community_id = Column(Integer, primary_key=True, index=True)
    operator_id = Column(Integer, ForeignKey("operator_entities.operator_id"), nullable=True)
    community_type = Column(_enum(CommunityType), nullable=False)
    name = Column(String(256), nullable=False)
    city = Column(String(128), nullable=False)
    province = Column(String(64), nullable=False, default="Alberta")
    has_meal_plan = Column(Boolean, default=False, nullable=False)
    meal_plan_monthly_cost = Column(Numeric(10, 2), nullable=True)
    target_occupancy_percent = Column(Numeric(5, 2), nullable=True)  # e.g. 95.00
    description = Column(Text, nullable=True)

    operator = relationship("OperatorEntity", back_populates="communities")
    properties = relationship("Property", back_populates="community")
    units = relationship("Unit", back_populates="community", cascade="all, delete-orphan")
    residents = relationship(
        "Resident", back_populates="community", cascade="all, delete-orphan"
    )
    budgets = relationship(
        "OperatorBudget", back_populates="community", cascade="all, delete-orphan"
    )
    expenses = relationship(
        "OperatingExpense", back_populates="community", cascade="all, delete-orphan"
    )


class Unit(Base):
    __tablename__ = "units"

    unit_id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False)
    unit_number = Column(String(32), nullable=False)
    unit_type = Column(_enum(UnitType), nullable=False)
    bed_count = Column(Integer, nullable=False)
    sqft = Column(Numeric(10, 2), nullable=False)
    is_occupied = Column(Boolean, default=False, nullable=False)

    community = relationship("Community", back_populates="units")
    beds = relationship("Bed", back_populates="unit", cascade="all, delete-orphan")
    residents = relationship(
        "Resident", back_populates="unit", cascade="all, delete-orphan"
    )


class Bed(Base):
    """Individual bed within a unit — the atomic revenue-generating entity."""
    __tablename__ = "beds"

    bed_id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.unit_id"), nullable=False)
    bed_label = Column(String(16), nullable=False)
    monthly_rent = Column(Numeric(10, 2), nullable=False)
    rent_type = Column(_enum(RentType), nullable=False, default=RentType.private_pay)
    status = Column(_enum(BedStatus), nullable=False, default=BedStatus.available)

    unit = relationship("Unit", back_populates="beds")
    resident = relationship("Resident", back_populates="bed", uselist=False)


class Resident(Base):
    __tablename__ = "residents"

    resident_id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.unit_id"), nullable=False)
    bed_id = Column(Integer, ForeignKey("beds.bed_id"), nullable=True)
    full_name = Column(String(256), nullable=False)
    email = Column(String(256), nullable=True)
    phone = Column(String(64), nullable=True)
    bed_number = Column(String(16), nullable=False)
    rent_type = Column(_enum(RentType), nullable=False)
    move_in_date = Column(Date, nullable=False)
    move_out_date = Column(Date, nullable=True)
    enrolled_meal_plan = Column(Boolean, default=False, nullable=False)

    community = relationship("Community", back_populates="residents")
    unit = relationship("Unit", back_populates="residents")
    bed = relationship("Bed", back_populates="resident")
    payments = relationship(
        "RentPayment", back_populates="resident", cascade="all, delete-orphan"
    )
    maintenance_requests = relationship(
        "MaintenanceRequest", back_populates="resident", cascade="all, delete-orphan"
    )


class RentPayment(Base):
    __tablename__ = "rent_payments"

    payment_id = Column(Integer, primary_key=True, index=True)
    resident_id = Column(Integer, ForeignKey("residents.resident_id"), nullable=False)
    bed_id = Column(Integer, ForeignKey("beds.bed_id"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    status = Column(_enum(PaymentStatus), nullable=False, default=PaymentStatus.pending)
    includes_meal_plan = Column(Boolean, default=False, nullable=False)

    resident = relationship("Resident", back_populates="payments")


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    request_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    resident_id = Column(Integer, ForeignKey("residents.resident_id"), nullable=True)
    description = Column(Text, nullable=False)
    status = Column(
        _enum(MaintenanceStatus), nullable=False, default=MaintenanceStatus.open
    )
    priority = Column(String(32), nullable=True)  # low, medium, high, urgent
    category = Column(String(64), nullable=True)  # plumbing, electrical, structural, etc.
    created_at = Column(DateTime, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    property = relationship("Property", back_populates="maintenance_requests")
    resident = relationship("Resident", back_populates="maintenance_requests")


# ---------------------------------------------------------------------------
# Investor Documents & Messages (kept from Sprint 3)
# ---------------------------------------------------------------------------

class InvestorDocument(Base):
    __tablename__ = "investor_documents"

    document_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False)
    title = Column(String(256), nullable=False)
    document_type = Column(_enum(DocumentType), nullable=False)
    file_url = Column(String(1024), nullable=False)
    upload_date = Column(DateTime, nullable=False)
    is_viewed = Column(Boolean, default=False, nullable=False)

    investor = relationship("Investor", back_populates="documents")


class InvestorMessage(Base):
    __tablename__ = "investor_messages"

    message_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    subject = Column(String(256), nullable=False)
    body = Column(Text, nullable=False)
    sent_at = Column(DateTime, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)

    investor = relationship("Investor", back_populates="messages")
    sender = relationship("User")
    replies = relationship("MessageThread", back_populates="parent_message", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Phase 3: Property Lifecycle — Stage Transitions & Milestones
# ---------------------------------------------------------------------------

class PropertyStageTransition(Base):
    """Audit trail of property stage changes with validation gates."""
    __tablename__ = "property_stage_transitions"

    transition_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    from_stage = Column(_enum(DevelopmentStage), nullable=False)
    to_stage = Column(_enum(DevelopmentStage), nullable=False)
    transitioned_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    transitioned_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    validation_passed = Column(Boolean, default=True, nullable=False)
    validation_details = Column(Text, nullable=True)  # JSON: list of checks

    property = relationship("Property", back_populates="stage_transitions")
    user = relationship("User")


class PropertyMilestone(Base):
    """Key milestones in a property's lifecycle with target and actual dates."""
    __tablename__ = "property_milestones"

    milestone_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    target_date = Column(Date, nullable=True)
    actual_date = Column(Date, nullable=True)
    status = Column(_enum(MilestoneStatus), nullable=False, default=MilestoneStatus.pending)
    stage = Column(_enum(DevelopmentStage), nullable=True)  # which stage this belongs to
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    property = relationship("Property", back_populates="milestones")


# ---------------------------------------------------------------------------
# Phase 3: Enhanced Investor Portal — Quarterly Reports & eTransfer Tracking
# ---------------------------------------------------------------------------

class QuarterlyReport(Base):
    """Generated quarterly report for an LP fund."""
    __tablename__ = "quarterly_reports"

    report_id = Column(Integer, primary_key=True, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False)
    period_label = Column(String(32), nullable=False)  # e.g. "Q1 2026"
    quarter = Column(Integer, nullable=False)  # 1-4
    year = Column(Integer, nullable=False)
    status = Column(_enum(QuarterlyReportStatus), nullable=False, default=QuarterlyReportStatus.draft)

    # Financial summary
    total_revenue = Column(Numeric(16, 2), nullable=True)
    total_expenses = Column(Numeric(16, 2), nullable=True)
    net_operating_income = Column(Numeric(16, 2), nullable=True)
    total_distributions = Column(Numeric(16, 2), nullable=True)
    portfolio_value = Column(Numeric(16, 2), nullable=True)
    portfolio_ltv = Column(Numeric(5, 2), nullable=True)

    # Narrative sections (stored as JSON or markdown)
    executive_summary = Column(Text, nullable=True)
    property_updates = Column(Text, nullable=True)  # JSON array of per-property updates
    market_commentary = Column(Text, nullable=True)

    # Versioning
    version = Column(Integer, nullable=False, default=1)
    superseded_by = Column(Integer, ForeignKey("quarterly_reports.report_id"), nullable=True)

    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    generated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    lp = relationship("LPEntity", back_populates="quarterly_reports")
    generator = relationship("User")
    superseded_by_report = relationship(
        "QuarterlyReport", remote_side="QuarterlyReport.report_id", foreign_keys=[superseded_by]
    )


class ETransferTracking(Base):
    """Tracks individual eTransfer payments for distribution allocations."""
    __tablename__ = "etransfer_tracking"

    tracking_id = Column(Integer, primary_key=True, index=True)
    allocation_id = Column(Integer, ForeignKey("distribution_allocations.allocation_id"), nullable=False)
    recipient_email = Column(String(256), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    security_question = Column(String(256), nullable=True)
    reference_number = Column(String(64), nullable=True)  # bank reference
    status = Column(_enum(ETransferStatus), nullable=False, default=ETransferStatus.initiated)
    initiated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    allocation = relationship("DistributionAllocation", back_populates="etransfer")


class MessageThread(Base):
    """Reply thread for investor messages."""
    __tablename__ = "message_threads"

    reply_id = Column(Integer, primary_key=True, index=True)
    parent_message_id = Column(Integer, ForeignKey("investor_messages.message_id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    body = Column(Text, nullable=False)
    sent_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    is_read = Column(Boolean, default=False, nullable=False)

    parent_message = relationship("InvestorMessage", back_populates="replies")
    sender = relationship("User")


# ---------------------------------------------------------------------------
# Phase 3: Operator Layer — Budgets & Operating Expenses
# ---------------------------------------------------------------------------

class OperatorBudget(Base):
    """Annual or quarterly budget for an operator managing a community."""
    __tablename__ = "operator_budgets"

    budget_id = Column(Integer, primary_key=True, index=True)
    operator_id = Column(Integer, ForeignKey("operator_entities.operator_id"), nullable=False)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False)
    period_type = Column(_enum(BudgetPeriodType), nullable=False, default=BudgetPeriodType.annual)
    period_label = Column(String(32), nullable=False)  # e.g. "2026" or "Q1 2026"
    year = Column(Integer, nullable=False)
    quarter = Column(Integer, nullable=True)  # null for annual

    # Budget amounts
    budgeted_revenue = Column(Numeric(14, 2), nullable=False, default=0)
    budgeted_expenses = Column(Numeric(14, 2), nullable=False, default=0)
    budgeted_noi = Column(Numeric(14, 2), nullable=False, default=0)

    # Actuals (updated as data comes in)
    actual_revenue = Column(Numeric(14, 2), nullable=True)
    actual_expenses = Column(Numeric(14, 2), nullable=True)
    actual_noi = Column(Numeric(14, 2), nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    operator = relationship("OperatorEntity", back_populates="budgets")
    community = relationship("Community", back_populates="budgets")


class OperatingExpense(Base):
    """Individual operating expense line item for a community."""
    __tablename__ = "operating_expenses"

    expense_id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False)
    budget_id = Column(Integer, ForeignKey("operator_budgets.budget_id"), nullable=True)
    category = Column(_enum(ExpenseCategory), nullable=False)
    description = Column(String(512), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    expense_date = Column(Date, nullable=False)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    vendor = Column(String(256), nullable=True)
    invoice_ref = Column(String(128), nullable=True)
    is_recurring = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    community = relationship("Community", back_populates="expenses")
    budget = relationship("OperatorBudget")


# ---------------------------------------------------------------------------
# Phase 4: Notifications
# ---------------------------------------------------------------------------

class NotificationType(str, enum.Enum):
    stage_transition = "stage_transition"
    quarterly_report = "quarterly_report"
    etransfer = "etransfer"
    document_uploaded = "document_uploaded"
    distribution = "distribution"
    general = "general"


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    title = Column(String(256), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(_enum(NotificationType), nullable=False, default=NotificationType.general)
    is_read = Column(Boolean, default=False, nullable=False)
    action_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User")


# ---------------------------------------------------------------------------
# Phase 5: Refinance & Sale Scenarios
# ---------------------------------------------------------------------------

class RefinanceScenario(Base):
    """Models a refinance event for a property — new loan pays out existing debt."""
    __tablename__ = "refinance_scenarios"

    scenario_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    label = Column(String(256), nullable=False, default="Refinance Scenario")
    assumed_new_valuation = Column(Numeric(16, 2), nullable=False)
    new_ltv_percent = Column(Numeric(5, 2), nullable=False)
    new_interest_rate = Column(Numeric(6, 4), nullable=True)
    new_amortization_months = Column(Integer, nullable=True)
    existing_debt_payout = Column(Numeric(16, 2), nullable=True)
    closing_costs = Column(Numeric(14, 2), nullable=True, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    property = relationship("Property")


class SaleScenario(Base):
    """Models a property sale — net proceeds after costs and debt payout."""
    __tablename__ = "sale_scenarios"

    scenario_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    label = Column(String(256), nullable=False, default="Sale Scenario")
    assumed_sale_price = Column(Numeric(16, 2), nullable=False)
    selling_costs_percent = Column(Numeric(5, 2), nullable=False, default=5)
    debt_payout = Column(Numeric(16, 2), nullable=True)
    capital_gains_reserve = Column(Numeric(14, 2), nullable=True, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    property = relationship("Property")


# ---------------------------------------------------------------------------
# Phase 5: Funding Opportunities (Grant Tracking)
# ---------------------------------------------------------------------------

class FundingStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    awarded = "awarded"
    denied = "denied"
    withdrawn = "withdrawn"


class FundingOpportunity(Base):
    """Grant or external funding opportunity linked to an operator or community."""
    __tablename__ = "funding_opportunities"

    funding_id = Column(Integer, primary_key=True, index=True)
    operator_id = Column(Integer, ForeignKey("operator_entities.operator_id"), nullable=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=True)
    title = Column(String(256), nullable=False)
    funding_source = Column(String(256), nullable=True)
    amount = Column(Numeric(14, 2), nullable=True)
    status = Column(_enum(FundingStatus), nullable=False, default=FundingStatus.draft)
    submission_deadline = Column(Date, nullable=True)
    reporting_deadline = Column(Date, nullable=True)
    awarded_amount = Column(Numeric(14, 2), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    operator = relationship("OperatorEntity")
    community = relationship("Community")


# ---------------------------------------------------------------------------
# Phase 5: Unit Turnover & Arrears
# ---------------------------------------------------------------------------

class TurnoverStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    ready = "ready"
    completed = "completed"


class UnitTurnover(Base):
    """Tracks inspection checklist and readiness between resident move-outs and move-ins."""
    __tablename__ = "unit_turnovers"

    turnover_id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.unit_id"), nullable=False)
    vacated_by_resident_id = Column(Integer, ForeignKey("residents.resident_id"), nullable=True)
    move_out_date = Column(Date, nullable=True)
    target_ready_date = Column(Date, nullable=True)
    actual_ready_date = Column(Date, nullable=True)
    status = Column(_enum(TurnoverStatus), nullable=False, default=TurnoverStatus.scheduled)
    inspection_notes = Column(Text, nullable=True)
    cleaning_complete = Column(Boolean, default=False, nullable=False)
    repairs_complete = Column(Boolean, default=False, nullable=False)
    painting_complete = Column(Boolean, default=False, nullable=False)
    inspection_passed = Column(Boolean, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    unit = relationship("Unit")
    vacated_by = relationship("Resident", foreign_keys=[vacated_by_resident_id])
    assignee = relationship("User", foreign_keys=[assigned_to])


class ArrearsRecord(Base):
    """Tracks overdue rent collection follow-up with aging buckets."""
    __tablename__ = "arrears_records"

    arrears_id = Column(Integer, primary_key=True, index=True)
    resident_id = Column(Integer, ForeignKey("residents.resident_id"), nullable=False)
    rent_payment_id = Column(Integer, ForeignKey("rent_payments.payment_id"), nullable=True)
    amount_overdue = Column(Numeric(12, 2), nullable=False)
    due_date = Column(Date, nullable=False)
    days_overdue = Column(Integer, nullable=False, default=0)
    aging_bucket = Column(String(16), nullable=False, default="0-30")
    follow_up_action = Column(String(256), nullable=True)
    follow_up_date = Column(Date, nullable=True)
    is_resolved = Column(Boolean, default=False, nullable=False)
    resolved_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    resident = relationship("Resident")
    rent_payment = relationship("RentPayment")
