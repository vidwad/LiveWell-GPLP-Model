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
    four_bed = "4br"
    five_plus = "5br+"
    house = "house"         # whole single-family house (shared living)
    duplex = "duplex"       # duplex unit
    suite = "suite"         # legal suite / secondary suite
    shared = "shared"       # shared room


class RentType(str, enum.Enum):
    private_pay = "private_pay"
    government_supported = "government_supported"
    shared_room = "shared_room"
    transitional = "transitional"


class RentPricingMode(str, enum.Enum):
    by_unit = "by_unit"
    by_bedroom = "by_bedroom"
    by_bed = "by_bed"


class RenovationPhase(str, enum.Enum):
    pre_renovation = "pre_renovation"
    post_renovation = "post_renovation"


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


class PropertyDocumentCategory(str, enum.Enum):
    appraisal = "appraisal"
    insurance = "insurance"
    title = "title"
    survey = "survey"
    environmental = "environmental"
    permit = "permit"
    inspection = "inspection"
    purchase_agreement = "purchase_agreement"
    lease = "lease"
    construction_contract = "construction_contract"
    mortgage = "mortgage"
    tax_assessment = "tax_assessment"
    photo = "photo"
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
    """Purpose / community focus of the LP. Each LP serves exactly one community type."""
    recover_well = "RecoverWell"
    study_well = "StudyWell"
    retire_well = "RetireWell"


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


class ExpensePhase(str, enum.Enum):
    """Operating phase for expense tracking (interim vs stabilized)."""
    interim = "interim"
    stabilized = "stabilized"
    construction = "construction"


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


class StaffRole(str, enum.Enum):
    """Staff role categories for community operations."""
    community_manager = "community_manager"
    house_manager = "house_manager"
    caregiver = "caregiver"
    support_worker = "support_worker"
    maintenance_tech = "maintenance_tech"
    cook = "cook"
    cleaner = "cleaner"
    admin = "admin"
    security = "security"
    other = "other"


class StaffStatus(str, enum.Enum):
    active = "active"
    on_leave = "on_leave"
    terminated = "terminated"


class ShiftStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


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
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    entity_type = Column(_enum(ScopeEntityType), nullable=False)
    entity_id = Column(Integer, nullable=False, index=True)  # polymorphic FK
    permission_level = Column(
        _enum(ScopePermissionLevel), nullable=False, default=ScopePermissionLevel.view
    )

    user = relationship("User", back_populates="scope_assignments")


class UserCapability(Base):
    """Fine-grained capability grants for a user.

    Capabilities are action-level permissions (e.g., 'approve_distributions',
    'manage_debt', 'view_financials') that complement role-based guards.
    GP_ADMIN gets all capabilities by default; other roles get subsets.
    """
    __tablename__ = "user_capabilities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    capability = Column(String(128), nullable=False, index=True)
    granted_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    granted_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], backref="capabilities")


# Well-known capabilities (not exhaustive — extensible by adding new strings)
CAPABILITIES = {
    "view_financials",
    "manage_properties",
    "approve_distributions",
    "manage_debt",
    "manage_construction",
    "manage_staff",
    "manage_residents",
    "manage_investors",
    "create_reports",
    "manage_grants",
    "manage_documents",
    "transition_stages",
    "manage_valuations",
    "manage_waterfall",
    "admin_users",
}

# Default capabilities per role (GP_ADMIN gets ALL)
ROLE_DEFAULT_CAPABILITIES: dict[str, set[str]] = {
    UserRole.GP_ADMIN: CAPABILITIES,
    UserRole.OPERATIONS_MANAGER: {
        "view_financials", "manage_properties", "manage_debt",
        "manage_construction", "manage_staff", "manage_residents",
        "create_reports", "manage_grants", "manage_documents",
        "transition_stages", "manage_valuations",
    },
    UserRole.PROPERTY_MANAGER: {
        "view_financials", "manage_properties", "manage_staff",
        "manage_residents", "manage_construction", "create_reports",
        "manage_documents", "manage_grants",
    },
    UserRole.INVESTOR: {
        "view_financials", "create_reports",
    },
}


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
    gp_id = Column(Integer, ForeignKey("gp_entities.gp_id"), nullable=False, index=True)

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

    # LP-specific waterfall rules (fully configurable per LP)
    waterfall_style = Column(String(64), nullable=True, default="european")  # european, american, custom
    preferred_return_rate = Column(Numeric(5, 2), nullable=True)  # e.g. 8.00 for 8%
    gp_promote_percent = Column(Numeric(5, 2), nullable=True)     # e.g. 20.00 for 20%
    gp_catchup_percent = Column(Numeric(5, 2), nullable=True)     # e.g. 100.00 for 100% catch-up
    lp_split_percent = Column(Numeric(5, 2), nullable=True)       # Tier 4 LP split (default 80%)
    hurdle_rate_2 = Column(Numeric(5, 2), nullable=True)          # Optional second hurdle rate
    gp_promote_percent_2 = Column(Numeric(5, 2), nullable=True)   # GP promote above second hurdle
    management_fee_percent = Column(Numeric(5, 2), nullable=True) # annual management fee on funded capital

    # Fee structure
    asset_management_fee_percent = Column(Numeric(5, 2), nullable=True)
    acquisition_fee_percent = Column(Numeric(5, 2), nullable=True)
    selling_commission_percent = Column(Numeric(5, 2), nullable=True)
    construction_management_fee_percent = Column(Numeric(5, 2), nullable=True)
    refinancing_fee_percent = Column(Numeric(5, 2), nullable=True)
    turnover_replacement_fee_percent = Column(Numeric(5, 2), nullable=True)
    lp_profit_share_percent = Column(Numeric(5, 2), nullable=True, default=70)  # LP profit share after hurdle
    gp_profit_share_percent = Column(Numeric(5, 2), nullable=True, default=30)  # GP profit share after hurdle

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
    fee_items = relationship(
        "LPFeeItem", back_populates="lp", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# Investor — Subscription & Holding
# ---------------------------------------------------------------------------

class OnboardingStatus(str, enum.Enum):
    """Investor onboarding pipeline status."""
    lead = "lead"                         # Initial contact / expression of interest
    invited = "invited"                   # Invitation sent to submit documents
    documents_pending = "documents_pending"  # Awaiting document submission
    under_review = "under_review"         # GP reviewing submitted documents
    approved = "approved"                 # Cleared to invest
    active = "active"                     # Has at least one active subscription
    suspended = "suspended"               # Temporarily blocked
    rejected = "rejected"                 # Did not pass review


class InvestorStatus(str, enum.Enum):
    """Sales pipeline status for investor contacts."""
    new_lead = "new_lead"                # No contact at all
    warm_lead = "warm_lead"              # Referral or inbound (ad, social media)
    prospect = "prospect"                # Initial call/email/interaction occurred
    hot_prospect = "hot_prospect"        # Actively interested in investing
    investor = "investor"                # Signed subscription agreements
    write_off = "write_off"              # Not worth pursuing / not interested


class Investor(Base):
    __tablename__ = "investors"

    investor_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, unique=True)
    name = Column(String(256), nullable=False)         # legal name
    email = Column(String(256), nullable=True, unique=True, index=True)  # nullable for early-stage leads
    phone = Column(String(64), nullable=True)
    address = Column(Text, nullable=True)               # supports multi-line addresses
    entity_type = Column(String(64), nullable=True)    # individual, trust, corporation, etc.
    jurisdiction = Column(String(128), nullable=True)   # province / state / country
    accredited_status = Column(String(32), nullable=True, default="pending")

    # Sales pipeline status
    investor_status = Column(
        _enum(InvestorStatus), nullable=False, default=InvestorStatus.new_lead
    )
    exemption_type = Column(String(128), nullable=True) # accreditation exemption type
    accreditation_verified_at = Column(Date, nullable=True)
    accreditation_expires_at = Column(Date, nullable=True)
    accreditation_document_id = Column(Integer, nullable=True)  # FK to investor_documents
    tax_id = Column(String(64), nullable=True)          # SIN, BN, or other tax ID
    banking_info = Column(Text, nullable=True)          # encrypted or reference
    notes = Column(Text, nullable=True)

    # KYC / Relationship fields
    linkedin_url = Column(String(512), nullable=True)
    risk_tolerance = Column(String(32), nullable=True)   # conservative, moderate, aggressive
    re_knowledge = Column(String(32), nullable=True)     # none, beginner, intermediate, expert
    other_investments = Column(Text, nullable=True)      # stocks, bonds, crypto, private equity, etc.
    income_range = Column(String(64), nullable=True)     # e.g. "100k-250k", "250k-500k", "500k+"
    net_worth_range = Column(String(64), nullable=True)  # e.g. "500k-1M", "1M-5M", "5M+"
    investment_goals = Column(Text, nullable=True)       # free text: retirement, growth, income, etc.
    referral_source = Column(String(256), nullable=True) # who referred them or how they found us

    # Onboarding
    onboarding_status = Column(
        _enum(OnboardingStatus), nullable=False, default=OnboardingStatus.lead
    )
    onboarding_started_at = Column(DateTime, nullable=True)
    onboarding_completed_at = Column(DateTime, nullable=True)
    invited_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

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
    onboarding_checklist = relationship(
        "OnboardingChecklistItem", back_populates="investor", cascade="all, delete-orphan"
    )
    assigned_users = relationship(
        "ContactAssignment", back_populates="investor", cascade="all, delete-orphan"
    )


class ContactAssignment(Base):
    """Assigns an investor/lead to one or more platform users for CRM ownership."""
    __tablename__ = "contact_assignments"

    assignment_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    assigned_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    assigned_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    notes = Column(String(512), nullable=True)

    investor = relationship("Investor", back_populates="assigned_users")
    user = relationship("User", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])


class OnboardingChecklistItem(Base):
    """Tracks required onboarding steps for each investor."""
    __tablename__ = "onboarding_checklist"

    item_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False, index=True)
    step_name = Column(String(128), nullable=False)    # e.g. "kyc_identity", "accreditation_cert"
    step_label = Column(String(256), nullable=False)   # e.g. "KYC Identity Verification"
    is_required = Column(Boolean, default=True, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    completed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    document_id = Column(Integer, ForeignKey("investor_documents.document_id"), nullable=True)
    notes = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    investor = relationship("Investor", back_populates="onboarding_checklist")
    document = relationship("InvestorDocument")


class IOIStatus(str, enum.Enum):
    """Status of an Indication of Interest."""
    expressed = "expressed"       # Verbal or informal interest
    confirmed = "confirmed"       # Written/formal confirmation
    converted = "converted"       # Converted to subscription
    withdrawn = "withdrawn"       # Investor withdrew interest
    expired = "expired"           # Interest expired (past deadline)


class IndicationOfInterest(Base):
    """Tracks investor interest in an LP before formal subscription.

    The IOI pipeline feeds the subscription workflow:
    Lead → IOI expressed → IOI confirmed → Subscription created → Funded
    """
    __tablename__ = "indications_of_interest"

    ioi_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False, index=True)

    indicated_amount = Column(Numeric(14, 2), nullable=False)  # how much they want to invest
    status = Column(_enum(IOIStatus), nullable=False, default=IOIStatus.expressed)

    # CRM fields
    source = Column(String(128), nullable=True)       # referral, website, event, cold_outreach
    notes = Column(Text, nullable=True)
    follow_up_date = Column(Date, nullable=True)
    last_contact_date = Column(Date, nullable=True)

    # Conversion tracking
    subscription_id = Column(Integer, ForeignKey("subscriptions.subscription_id"), nullable=True)
    converted_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow)

    investor = relationship("Investor")
    lp = relationship("LPEntity")


class Subscription(Base):
    """An investor's commitment to invest in a specific LP."""
    __tablename__ = "subscriptions"

    subscription_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False, index=True)
    tranche_id = Column(Integer, ForeignKey("lp_tranches.tranche_id"), nullable=True, index=True)

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
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.subscription_id"), nullable=True, index=True)

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
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    lender_name = Column(String(200), nullable=False)
    debt_type = Column(_enum(DebtType), nullable=False)
    status = Column(_enum(DebtStatus), default=DebtStatus.pending)

    # Purpose: "acquisition" (original purchase), "construction", "refinancing" (post-dev)
    debt_purpose = Column(String(50), default="acquisition")
    # If this is a refinancing, link to the original debt it replaces
    replaces_debt_id = Column(Integer, ForeignKey("debt_facilities.debt_id"), nullable=True)
    # Link to development plan: NULL = baseline (acquisition debt), set = plan-specific debt
    development_plan_id = Column(Integer, ForeignKey("development_plans.plan_id"), nullable=True)

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
    development_plan = relationship("DevelopmentPlan", back_populates="planned_debt_rel")


# ---------------------------------------------------------------------------
# Distribution Events & Allocations
# ---------------------------------------------------------------------------

class DistributionEvent(Base):
    """A batch distribution record for a specific LP and period."""
    __tablename__ = "distribution_events"

    event_id = Column(Integer, primary_key=True, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False, index=True)
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
    event_id = Column(Integer, ForeignKey("distribution_events.event_id"), nullable=False, index=True)
    holding_id = Column(Integer, ForeignKey("holdings.holding_id"), nullable=False, index=True)
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
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False, index=True)
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
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False, index=True)

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
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=True, index=True)  # LP ownership
    cluster_id = Column(Integer, ForeignKey("property_clusters.cluster_id"), nullable=True, index=True)

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
    rent_pricing_mode = Column(
        _enum(RentPricingMode), nullable=False, default=RentPricingMode.by_bed
    )
    # Projected annual rent increase percentage (e.g. 3.0 = 3% per year)
    annual_rent_increase_pct = Column(Numeric(5, 2), nullable=True, default=0)
    # Revenue & expense fields for cash flow
    annual_revenue = Column(Numeric(14, 2), nullable=True)
    annual_expenses = Column(Numeric(14, 2), nullable=True)
    annual_other_income = Column(Numeric(14, 2), nullable=True)

    # ── Physical property details (from municipal data / MLS) ──
    year_built = Column(Integer, nullable=True)
    property_type = Column(String(128), nullable=True)        # e.g. "Single Family", "Multi-Family"
    building_sqft = Column(Numeric(14, 2), nullable=True)
    bedrooms = Column(Integer, nullable=True)
    bathrooms = Column(Integer, nullable=True)
    property_style = Column(String(128), nullable=True)       # e.g. "Bungalow", "2-Storey"
    garage = Column(String(64), nullable=True)                 # e.g. "Double Attached"

    # ── Location & municipal references ──
    neighbourhood = Column(String(256), nullable=True)
    ward = Column(String(64), nullable=True)
    legal_description = Column(String(512), nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(11, 7), nullable=True)
    roll_number = Column(String(64), nullable=True)           # municipal assessment roll ID
    assessment_class = Column(String(64), nullable=True)      # e.g. "Residential", "Non-Residential"

    # ── Tax data ──
    tax_amount = Column(Numeric(12, 2), nullable=True)
    tax_year = Column(Integer, nullable=True)

    # ── MLS / market data ──
    mls_number = Column(String(64), nullable=True)
    list_price = Column(Numeric(14, 2), nullable=True)
    last_sold_price = Column(Numeric(14, 2), nullable=True)
    last_sold_date = Column(Date, nullable=True)

    lp = relationship("LPEntity", back_populates="properties")
    cluster = relationship("PropertyCluster", back_populates="properties")
    development_plans = relationship(
        "DevelopmentPlan", back_populates="property", cascade="all, delete-orphan"
    )
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=True, index=True)
    community = relationship("Community", back_populates="properties")
    pm_id = Column(Integer, ForeignKey("property_managers.pm_id"), nullable=True, index=True)
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
    valuations = relationship(
        "ValuationHistory", back_populates="property", cascade="all, delete-orphan",
        order_by="ValuationHistory.valuation_date.desc()"
    )
    units = relationship(
        "Unit", back_populates="property", cascade="all, delete-orphan"
    )


class DevelopmentPlan(Base):
    __tablename__ = "development_plans"

    plan_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    plan_name = Column(String(256), nullable=True)  # human-readable label e.g. "8-Plex Conversion"
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

    # Rent roll configuration for this plan's projected state
    rent_pricing_mode = Column(_enum(RentPricingMode), nullable=True)  # how rent is priced after this plan
    annual_rent_increase_pct = Column(Numeric(5, 2), nullable=True, default=0)  # projected annual rent escalation

    property = relationship("Property", back_populates="development_plans")
    planned_units_rel = relationship("Unit", back_populates="development_plan", cascade="all, delete-orphan")
    planned_debt_rel = relationship("DebtFacility", back_populates="development_plan", cascade="all, delete-orphan")


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
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=True, index=True)
    unit_number = Column(String(32), nullable=False)
    unit_type = Column(_enum(UnitType), nullable=False)
    bed_count = Column(Integer, nullable=False)
    sqft = Column(Numeric(10, 2), nullable=False)
    floor = Column(String(16), nullable=True)  # e.g. "Main", "Upper", "Basement"
    is_legal_suite = Column(Boolean, default=False, nullable=False)
    is_occupied = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    # Rent roll fields
    monthly_rent = Column(Numeric(10, 2), nullable=True)  # used when pricing is by_unit
    bedroom_count = Column(Integer, nullable=True)  # explicit bedroom count for by_bedroom mode
    renovation_phase = Column(
        _enum(RenovationPhase), nullable=False, default=RenovationPhase.pre_renovation
    )
    # Link to development plan: NULL = baseline (as-acquired), set = projected state after that plan
    development_plan_id = Column(Integer, ForeignKey("development_plans.plan_id"), nullable=True)

    property = relationship("Property", back_populates="units")
    community = relationship("Community", back_populates="units")
    development_plan = relationship("DevelopmentPlan", back_populates="planned_units_rel")
    beds = relationship("Bed", back_populates="unit", cascade="all, delete-orphan")
    residents = relationship(
        "Resident", back_populates="unit", cascade="all, delete-orphan"
    )


class Bed(Base):
    """Individual bed within a unit — the atomic revenue-generating entity."""
    __tablename__ = "beds"

    bed_id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.unit_id"), nullable=False, index=True)
    bed_label = Column(String(16), nullable=False)
    monthly_rent = Column(Numeric(10, 2), nullable=False)
    rent_type = Column(_enum(RentType), nullable=False, default=RentType.private_pay)
    status = Column(_enum(BedStatus), nullable=False, default=BedStatus.available)
    bedroom_number = Column(Integer, nullable=True)  # which bedroom this bed belongs to (for by_bedroom mode)
    is_post_renovation = Column(Boolean, default=False, nullable=False)  # flag for post-reno beds

    unit = relationship("Unit", back_populates="beds")
    resident = relationship("Resident", back_populates="bed", uselist=False)


class Resident(Base):
    __tablename__ = "residents"

    resident_id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False, index=True)
    unit_id = Column(Integer, ForeignKey("units.unit_id"), nullable=False, index=True)
    bed_id = Column(Integer, ForeignKey("beds.bed_id"), nullable=True, index=True)
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
    resident_id = Column(Integer, ForeignKey("residents.resident_id"), nullable=False, index=True)
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
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    resident_id = Column(Integer, ForeignKey("residents.resident_id"), nullable=True, index=True)
    description = Column(Text, nullable=False)
    status = Column(
        _enum(MaintenanceStatus), nullable=False, default=MaintenanceStatus.open
    )
    priority = Column(String(32), nullable=True)  # low, medium, high, urgent
    category = Column(String(64), nullable=True)  # plumbing, electrical, structural, etc.
    estimated_cost = Column(Numeric(10, 2), nullable=True)
    actual_cost = Column(Numeric(10, 2), nullable=True)
    vendor = Column(String(256), nullable=True)
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


class PropertyDocument(Base):
    """Documents attached to a property (appraisals, insurance, permits, etc.)."""
    __tablename__ = "property_documents"

    document_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    category = Column(_enum(PropertyDocumentCategory), nullable=False, default=PropertyDocumentCategory.other)
    file_url = Column(String(1024), nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    expiry_date = Column(Date, nullable=True)  # for insurance, permits
    notes = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    upload_date = Column(DateTime, nullable=False, default=datetime.utcnow)

    property = relationship("Property", backref="documents")
    uploader = relationship("User")


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
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
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
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
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
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False, index=True)
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
    operator_id = Column(Integer, ForeignKey("operator_entities.operator_id"), nullable=False, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False, index=True)
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
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False, index=True)
    budget_id = Column(Integer, ForeignKey("operator_budgets.budget_id"), nullable=True, index=True)
    category = Column(_enum(ExpenseCategory), nullable=False)
    description = Column(String(512), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    expense_date = Column(Date, nullable=False)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    vendor = Column(String(256), nullable=True)
    invoice_ref = Column(String(128), nullable=True)
    is_recurring = Column(Boolean, default=False, nullable=False)
    phase = Column(_enum(ExpensePhase), nullable=True)  # interim, stabilized, construction
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    community = relationship("Community", back_populates="expenses")
    budget = relationship("OperatorBudget")


# ---------------------------------------------------------------------------
# Staffing & Scheduling
# ---------------------------------------------------------------------------

class Staff(Base):
    """Staff member working at a community."""
    __tablename__ = "staff"

    staff_id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False, index=True)
    first_name = Column(String(128), nullable=False)
    last_name = Column(String(128), nullable=False)
    email = Column(String(256), nullable=True)
    phone = Column(String(64), nullable=True)
    role = Column(_enum(StaffRole), nullable=False, default=StaffRole.support_worker)
    status = Column(_enum(StaffStatus), nullable=False, default=StaffStatus.active)
    hourly_rate = Column(Numeric(8, 2), nullable=True)
    hire_date = Column(Date, nullable=True)
    termination_date = Column(Date, nullable=True)
    emergency_contact_name = Column(String(256), nullable=True)
    emergency_contact_phone = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    community = relationship("Community", backref="staff_members")
    shifts = relationship("Shift", back_populates="staff_member", cascade="all, delete-orphan")


class Shift(Base):
    """A scheduled shift for a staff member."""
    __tablename__ = "shifts"

    shift_id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id"), nullable=False, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False, index=True)
    shift_date = Column(Date, nullable=False, index=True)
    start_time = Column(String(5), nullable=False)   # HH:MM format
    end_time = Column(String(5), nullable=False)      # HH:MM format
    hours = Column(Numeric(5, 2), nullable=True)
    status = Column(_enum(ShiftStatus), nullable=False, default=ShiftStatus.scheduled)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    staff_member = relationship("Staff", back_populates="shifts")
    community = relationship("Community", backref="shifts")


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
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
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
    # ── Date & event linkage ──
    expected_date = Column(Date, nullable=True)  # when the refinance is expected
    linked_milestone_id = Column(Integer, ForeignKey("property_milestones.milestone_id"), nullable=True)
    linked_event = Column(String(128), nullable=True)  # e.g. "construction_completion", "stabilization"
    # ── ROI inputs ──
    total_equity_invested = Column(Numeric(16, 2), nullable=True)  # total equity in the deal
    annual_noi_at_refi = Column(Numeric(14, 2), nullable=True)  # projected NOI at refi date
    hold_period_months = Column(Integer, nullable=True)  # months from purchase to refi

    property = relationship("Property", backref="refinance_scenarios")
    linked_milestone = relationship("PropertyMilestone", foreign_keys=[linked_milestone_id])


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
    # ── Date & event linkage ──
    expected_date = Column(Date, nullable=True)  # when the sale is expected
    linked_milestone_id = Column(Integer, ForeignKey("property_milestones.milestone_id"), nullable=True)
    linked_event = Column(String(128), nullable=True)  # e.g. "stabilization", "lease_up_complete"
    # ── ROI inputs ──
    total_equity_invested = Column(Numeric(16, 2), nullable=True)  # total equity in the deal
    annual_noi_at_sale = Column(Numeric(14, 2), nullable=True)  # projected NOI at sale date
    hold_period_months = Column(Integer, nullable=True)  # months from purchase to sale
    annual_cash_flow = Column(Numeric(14, 2), nullable=True)  # avg annual cash flow during hold

    property = relationship("Property", backref="sale_scenarios")
    linked_milestone = relationship("PropertyMilestone", foreign_keys=[linked_milestone_id])


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
    application_date = Column(Date, nullable=True)
    application_ref = Column(String(128), nullable=True)
    program_name = Column(String(256), nullable=True)
    contact_name = Column(String(256), nullable=True)
    contact_email = Column(String(256), nullable=True)
    reporting_frequency = Column(String(64), nullable=True)  # monthly, quarterly, annual
    next_report_date = Column(Date, nullable=True)
    requirements = Column(Text, nullable=True)  # JSON or text of application requirements
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    operator = relationship("OperatorEntity", backref="funding_opportunities")
    community = relationship("Community", backref="funding_opportunities")


class CommunityEventType(str, enum.Enum):
    """Types of community events and support services."""
    group_session = "group_session"
    counseling = "counseling"
    meal_service = "meal_service"
    workshop = "workshop"
    recreation = "recreation"
    medical = "medical"
    life_skills = "life_skills"
    community_meeting = "community_meeting"
    maintenance_day = "maintenance_day"
    other = "other"


class CommunityEvent(Base):
    """Tracks events and support services within a community."""
    __tablename__ = "community_events"

    event_id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    event_type = Column(_enum(CommunityEventType), nullable=False, default=CommunityEventType.other)
    description = Column(Text, nullable=True)
    event_date = Column(Date, nullable=False)
    start_time = Column(String(5), nullable=True)  # HH:MM
    end_time = Column(String(5), nullable=True)
    location = Column(String(256), nullable=True)
    facilitator = Column(String(256), nullable=True)
    max_participants = Column(Integer, nullable=True)
    actual_participants = Column(Integer, nullable=True)
    cost = Column(Numeric(10, 2), nullable=True)
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurrence_pattern = Column(String(64), nullable=True)  # weekly, biweekly, monthly
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    community = relationship("Community", backref="events")


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


# ---------------------------------------------------------------------------
# Phase 6: Valuation History
# ---------------------------------------------------------------------------

class ValuationMethod(str, enum.Enum):
    purchase = "purchase"
    appraisal = "appraisal"
    broker_opinion = "broker_opinion"
    cap_rate = "cap_rate"
    comparable_sales = "comparable_sales"
    internal_estimate = "internal_estimate"
    assessment = "assessment"


class ValuationHistory(Base):
    """Tracks property valuation changes over time for NAV and reporting."""
    __tablename__ = "valuation_history"

    valuation_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    valuation_date = Column(Date, nullable=False)
    value = Column(Numeric(16, 2), nullable=False)
    method = Column(_enum(ValuationMethod), nullable=False, default=ValuationMethod.internal_estimate)
    appraiser = Column(String(256), nullable=True)
    notes = Column(Text, nullable=True)
    document_url = Column(String(1024), nullable=True)  # link to appraisal PDF
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    property = relationship("Property", back_populates="valuations")
    creator = relationship("User")


# ---------------------------------------------------------------------------
# Construction Budget vs Actual Tracking
# ---------------------------------------------------------------------------

class ConstructionExpense(Base):
    """Line-item tracking of construction expenses against a development plan budget."""
    __tablename__ = "construction_expenses"

    expense_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("development_plans.plan_id"), nullable=False, index=True)
    category = Column(String(100), nullable=False)  # hard_costs, soft_costs, site_costs, financing_costs, contingency
    description = Column(String(512), nullable=True)
    budgeted_amount = Column(Numeric(16, 2), nullable=False, default=0)
    actual_amount = Column(Numeric(16, 2), nullable=False, default=0)
    vendor = Column(String(256), nullable=True)
    invoice_ref = Column(String(256), nullable=True)
    expense_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    property = relationship("Property", backref="construction_expenses")
    plan = relationship("DevelopmentPlan", backref="construction_expenses")


# ---------------------------------------------------------------------------
# Construction Draw Schedule
# ---------------------------------------------------------------------------

class ConstructionDrawStatus(str, enum.Enum):
    requested = "requested"
    approved = "approved"
    funded = "funded"
    rejected = "rejected"
    cancelled = "cancelled"


class ConstructionDraw(Base):
    """Draw/disbursement schedule for construction financing."""
    __tablename__ = "construction_draws"

    draw_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    debt_id = Column(Integer, ForeignKey("debt_facilities.debt_id"), nullable=False, index=True)
    draw_number = Column(Integer, nullable=False)
    requested_amount = Column(Numeric(16, 2), nullable=False)
    approved_amount = Column(Numeric(16, 2), nullable=True)
    status = Column(_enum(ConstructionDrawStatus), nullable=False, default=ConstructionDrawStatus.requested)
    description = Column(String(512), nullable=True)
    requested_date = Column(Date, nullable=True)
    approved_date = Column(Date, nullable=True)
    funded_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    property = relationship("Property", backref="construction_draws")
    debt_facility = relationship("DebtFacility", backref="construction_draws")


# ---------------------------------------------------------------------------
# LP Fee Schedule
# ---------------------------------------------------------------------------

class FeeType(str, enum.Enum):
    percentage = "percentage"
    fixed = "fixed"

class BasisType(str, enum.Enum):
    gross_raise = "gross_raise"
    funded_capital = "funded_capital"
    subscription_amount = "subscription_amount"
    acquisition_cost = "acquisition_cost"
    initial_capital_cost = "initial_capital_cost"
    gross_revenues = "gross_revenues"
    construction_budget = "construction_budget"
    fair_market_value = "fair_market_value"
    refinance_amount = "refinance_amount"
    sale_proceeds = "sale_proceeds"
    custom = "custom"
    not_applicable = "not_applicable"


class LPFeeItem(Base):
    """
    Configurable fee / cost / profit-sharing item for an LP.
    Each LP is seeded with 8 default items per the LP Agreement rules.
    GP/admin users may edit rates, bases, and notes.
    """
    __tablename__ = "lp_fee_items"

    fee_item_id = Column(Integer, primary_key=True, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=False, index=True)

    # Identity
    fee_name = Column(String(128), nullable=False)            # e.g. "Selling Commission"
    fee_slug = Column(String(64), nullable=False)             # e.g. "selling_commission"
    fee_type = Column(_enum(FeeType), nullable=False)         # percentage or fixed

    # Rate / Amount
    rate = Column(Numeric(7, 4), nullable=True)               # percentage rate (e.g. 10.0000)
    fixed_amount = Column(Numeric(16, 2), nullable=True)      # fixed dollar amount

    # Basis
    basis_type = Column(_enum(BasisType), nullable=True)      # what the % is applied to
    basis_description = Column(String(256), nullable=True)    # human-readable basis explanation

    # Timing
    timing_trigger = Column(String(256), nullable=True)       # when the fee applies

    # Calculation
    calculation_description = Column(String(512), nullable=True)  # how it's calculated
    calculated_amount = Column(Numeric(16, 2), nullable=True)     # last computed $ amount

    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    default_rate = Column(Numeric(7, 4), nullable=True)       # original default rate
    default_fixed_amount = Column(Numeric(16, 2), nullable=True)  # original default fixed amount

    # Notes
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, default=func.now(), onupdate=func.now())

    lp = relationship("LPEntity", back_populates="fee_items")


# ---------------------------------------------------------------------------
# Stabilized Pro Forma
# ---------------------------------------------------------------------------

class ProFormaStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class ProForma(Base):
    """Saved stabilized pro forma for a property — ties together rent roll,
    expenses, debt service, and valuation into a single snapshot."""
    __tablename__ = "pro_formas"

    proforma_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("development_plans.plan_id"), nullable=True, index=True)
    label = Column(String(256), nullable=False)
    status = Column(_enum(ProFormaStatus), nullable=False, default=ProFormaStatus.draft)

    # Revenue
    gross_potential_rent = Column(Numeric(14, 2), nullable=False, default=0)
    other_income = Column(Numeric(14, 2), nullable=True, default=0)
    vacancy_rate = Column(Numeric(5, 2), nullable=True)  # percentage
    vacancy_loss = Column(Numeric(14, 2), nullable=True)
    effective_gross_income = Column(Numeric(14, 2), nullable=True)

    # Expenses
    operating_expenses = Column(Numeric(14, 2), nullable=True, default=0)
    property_tax = Column(Numeric(14, 2), nullable=True, default=0)
    insurance = Column(Numeric(14, 2), nullable=True, default=0)
    management_fee = Column(Numeric(14, 2), nullable=True, default=0)
    management_fee_rate = Column(Numeric(5, 4), nullable=True)  # decimal
    replacement_reserves = Column(Numeric(14, 2), nullable=True, default=0)
    total_expenses = Column(Numeric(14, 2), nullable=True)

    # NOI
    noi = Column(Numeric(14, 2), nullable=True)
    expense_ratio = Column(Numeric(5, 2), nullable=True)  # percentage

    # Debt Service
    annual_debt_service = Column(Numeric(14, 2), nullable=True, default=0)
    cash_flow_after_debt = Column(Numeric(14, 2), nullable=True)

    # Ratios
    dscr = Column(Numeric(6, 4), nullable=True)
    cap_rate = Column(Numeric(5, 2), nullable=True)  # percentage
    ltv = Column(Numeric(5, 2), nullable=True)  # percentage

    # Valuation
    total_debt = Column(Numeric(16, 2), nullable=True, default=0)
    property_value = Column(Numeric(16, 2), nullable=True)  # current/estimated
    implied_value_at_cap = Column(Numeric(16, 2), nullable=True)  # NOI / cap_rate

    # Equity
    total_equity = Column(Numeric(16, 2), nullable=True)
    cash_on_cash = Column(Numeric(5, 2), nullable=True)  # percentage

    # Units
    total_units = Column(Integer, nullable=True)
    total_beds = Column(Integer, nullable=True)
    total_sqft = Column(Numeric(14, 2), nullable=True)
    noi_per_unit = Column(Numeric(10, 2), nullable=True)
    noi_per_bed = Column(Numeric(10, 2), nullable=True)
    noi_per_sqft = Column(Numeric(10, 2), nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    property = relationship("Property", backref="pro_formas")
    plan = relationship("DevelopmentPlan", backref="pro_formas")
    creator = relationship("User")


# ---------------------------------------------------------------------------
# Periodic Snapshots — Time-Series Metrics
# ---------------------------------------------------------------------------

class SnapshotEntityType(str, enum.Enum):
    community = "community"
    lp = "lp"


class PeriodicSnapshot(Base):
    """Monthly/quarterly snapshot of key metrics for trend analysis.

    Each row captures a point-in-time snapshot of financial and operational
    metrics for either a community or an LP. Enables time-series charting
    of occupancy, revenue, NOI, NAV, etc.
    """
    __tablename__ = "periodic_snapshots"

    snapshot_id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(_enum(SnapshotEntityType), nullable=False)
    entity_id = Column(Integer, nullable=False, index=True)  # community_id or lp_id
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12

    # Occupancy (community snapshots)
    total_beds = Column(Integer, nullable=True)
    occupied_beds = Column(Integer, nullable=True)
    occupancy_rate = Column(Numeric(5, 1), nullable=True)

    # Revenue & Expenses
    gross_revenue = Column(Numeric(14, 2), nullable=True)
    collected_revenue = Column(Numeric(14, 2), nullable=True)
    total_expenses = Column(Numeric(14, 2), nullable=True)
    noi = Column(Numeric(14, 2), nullable=True)

    # LP-specific
    total_funded = Column(Numeric(16, 2), nullable=True)
    capital_deployed = Column(Numeric(16, 2), nullable=True)
    nav = Column(Numeric(16, 2), nullable=True)
    nav_per_unit = Column(Numeric(14, 2), nullable=True)
    total_distributions = Column(Numeric(16, 2), nullable=True)

    # Debt
    total_debt = Column(Numeric(16, 2), nullable=True)
    portfolio_ltv = Column(Numeric(5, 2), nullable=True)

    # Property count
    property_count = Column(Integer, nullable=True)
    investor_count = Column(Integer, nullable=True)

    captured_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        # Ensure one snapshot per entity per month
        # (SQLAlchemy UniqueConstraint)
        {},
    )


# ---------------------------------------------------------------------------
# Decision Memory — Institutional Knowledge
# ---------------------------------------------------------------------------

class DecisionCategory(str, enum.Enum):
    acquisition = "acquisition"
    disposition = "disposition"
    distribution = "distribution"
    refinancing = "refinancing"
    construction = "construction"
    subscription = "subscription"
    stage_transition = "stage_transition"
    budget_approval = "budget_approval"
    investor_onboarding = "investor_onboarding"
    operational = "operational"
    strategic = "strategic"
    other = "other"


class DecisionOutcome(str, enum.Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"
    pending = "pending"


class DecisionLog(Base):
    """Institutional memory — logs major business decisions with context and outcomes.

    Enables AI to retrieve relevant past decisions when advising on similar situations.
    E.g., 'Last time we acquired in Red Deer at this price, construction ran 15% over.'
    """
    __tablename__ = "decision_log"

    decision_id = Column(Integer, primary_key=True, index=True)
    category = Column(_enum(DecisionCategory), nullable=False, index=True)
    title = Column(String(512), nullable=False)
    description = Column(Text, nullable=False)

    # Context snapshot (JSON) — captures relevant data at time of decision
    context_snapshot = Column(Text, nullable=True)  # JSON string

    # Entity linkage (optional — which property/LP/investor this relates to)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=True, index=True)
    lp_id = Column(Integer, ForeignKey("lp_entities.lp_id"), nullable=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=True, index=True)

    # Decision details
    decision_maker = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    decision_date = Column(Date, nullable=False)
    amount = Column(Numeric(16, 2), nullable=True)  # dollar amount involved

    # Outcome tracking (updated later)
    outcome = Column(_enum(DecisionOutcome), nullable=False, default=DecisionOutcome.pending)
    outcome_notes = Column(Text, nullable=True)
    outcome_date = Column(Date, nullable=True)
    lessons_learned = Column(Text, nullable=True)

    # Tags for retrieval
    tags = Column(String(512), nullable=True)  # comma-separated: "red_deer,construction,over_budget"

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    property = relationship("Property", backref="decision_logs")
    lp = relationship("LPEntity", backref="decision_logs")
    investor = relationship("Investor", backref="decision_logs")
    maker = relationship("User")


# ---------------------------------------------------------------------------
# Platform Settings (API Keys & Configuration)
# ---------------------------------------------------------------------------

class PlatformSetting(Base):
    """Key-value store for platform configuration including API keys.

    Sensitive values are stored as-is in the database (encrypt at the
    infrastructure layer for production).  The API never returns full
    secret values — only masked versions for display.
    """
    __tablename__ = "platform_settings"

    setting_id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(128), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False, default="")
    category = Column(String(64), nullable=False, default="general")  # api_keys, ai, maps, general
    label = Column(String(256), nullable=True)        # human-readable label
    description = Column(String(512), nullable=True)  # help text
    is_secret = Column(Boolean, nullable=False, default=False)  # mask value in API responses
    updated_by_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow)

    updated_by = relationship("User")


# ---------------------------------------------------------------------------
# Saved Area Research
# ---------------------------------------------------------------------------

class AreaResearch(Base):
    """Persisted area research results for a property."""
    __tablename__ = "area_research"

    research_id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False, index=True)
    address = Column(String(512), nullable=True)
    city = Column(String(128), nullable=True)
    radius_miles = Column(Integer, nullable=True)
    data = Column(Text, nullable=False)  # Full JSON result
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    property = relationship("Property")
    creator = relationship("User")


# ---------------------------------------------------------------------------
# CRM Activity Log
# ---------------------------------------------------------------------------

class CRMActivityType(str, enum.Enum):
    call = "call"
    email = "email"
    meeting = "meeting"
    note = "note"
    document = "document"
    status_change = "status_change"
    task = "task"
    follow_up = "follow_up"


class CRMActivity(Base):
    """Tracks all CRM interactions with an investor — calls, emails, meetings, notes."""
    __tablename__ = "crm_activities"

    activity_id = Column(Integer, primary_key=True, autoincrement=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False, index=True)
    activity_type = Column(_enum(CRMActivityType), nullable=False)
    subject = Column(String(512), nullable=False)
    body = Column(Text, nullable=True)
    outcome = Column(String(256), nullable=True)  # e.g. "Left voicemail", "Committed $250K", "Requested docs"
    follow_up_date = Column(Date, nullable=True)
    follow_up_notes = Column(String(512), nullable=True)
    is_follow_up_done = Column(Boolean, default=False, nullable=False)
    # Meeting-specific
    meeting_date = Column(DateTime, nullable=True)
    meeting_location = Column(String(256), nullable=True)
    attendees = Column(String(512), nullable=True)  # comma-separated names
    # Metadata
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    investor = relationship("Investor", backref="crm_activities")
    creator = relationship("User")


# ---------------------------------------------------------------------------
# User Invitations
# ---------------------------------------------------------------------------

class InvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    expired = "expired"
    revoked = "revoked"


class UserInvitation(Base):
    """Tracks user invitations sent by admins."""
    __tablename__ = "user_invitations"

    invitation_id = Column(Integer, primary_key=True, index=True)
    email = Column(String(256), nullable=False)
    role = Column(_enum(UserRole), nullable=False)
    full_name = Column(String(256), nullable=True)
    token = Column(String(128), nullable=False, unique=True, index=True)
    status = Column(_enum(InvitationStatus), nullable=False, default=InvitationStatus.pending)
    invited_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    accepted_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    message = Column(Text, nullable=True)  # optional personal message
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)

    inviter = relationship("User", foreign_keys=[invited_by])
    accepted_user = relationship("User", foreign_keys=[accepted_by_user_id])
