import enum
from functools import partial

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum as SAEnum,
    ForeignKey, Integer, Numeric, String, Text,
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


class CommunityType(str, enum.Enum):
    recover = "RecoverWell"
    study = "StudyWell"
    retire = "RetireWell"


class UnitType(str, enum.Enum):
    studio = "studio"
    one_bed = "1br"
    two_bed = "2br"
    three_bed = "3br"
    suite = "suite"          # for RetireWell private suites
    shared = "shared"        # shared room (2+ beds)


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
    acquisition = "acquisition"
    interim_operation = "interim_operation"
    planning = "planning"
    construction = "construction"
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
    refinancing = "refinancing"
    sale_proceeds = "sale_proceeds"


class EntityType(str, enum.Enum):
    property_lp = "property_lp"
    operating_company = "operating_company"
    property_management = "property_management"


class DocumentType(str, enum.Enum):
    subscription_agreement = "subscription_agreement"
    partnership_agreement = "partnership_agreement"
    tax_form = "tax_form"
    quarterly_report = "quarterly_report"
    capital_call = "capital_call"
    distribution_notice = "distribution_notice"
    other = "other"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    email = Column(String(256), nullable=False, unique=True, index=True)
    hashed_password = Column(String(256), nullable=False)
    full_name = Column(String(256), nullable=True)
    role = Column(_enum(UserRole), nullable=False, default=UserRole.INVESTOR)
    is_active = Column(Boolean, default=True, nullable=False)


# ---------------------------------------------------------------------------
# Portfolio — Property & Development
# ---------------------------------------------------------------------------

class Property(Base):
    __tablename__ = "properties"

    property_id = Column(Integer, primary_key=True, index=True)
    address = Column(String(256), nullable=False)
    city = Column(String(128), nullable=False)
    province = Column(String(64), nullable=False)
    purchase_date = Column(Date, nullable=False)
    purchase_price = Column(Numeric(14, 2), nullable=False)
    lot_size = Column(Numeric(14, 2), nullable=True)
    zoning = Column(String(128), nullable=True)
    max_buildable_area = Column(Numeric(14, 2), nullable=True)
    floor_area_ratio = Column(Numeric(5, 2), nullable=True)          # NEW
    development_stage = Column(
        _enum(DevelopmentStage), nullable=False, default=DevelopmentStage.acquisition
    )
    cluster_id = Column(Integer, ForeignKey("property_clusters.cluster_id"), nullable=True)  # NEW

    development_plans = relationship(
        "DevelopmentPlan", back_populates="property", cascade="all, delete-orphan"
    )
    communities = relationship(
        "Community", back_populates="property", cascade="all, delete-orphan"
    )
    maintenance_requests = relationship(
        "MaintenanceRequest", back_populates="property", cascade="all, delete-orphan"
    )
    cluster = relationship("PropertyCluster", back_populates="properties")  # NEW
    economic_entities = relationship(
        "EconomicEntity", back_populates="property", cascade="all, delete-orphan"
    )  # NEW


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


class DevelopmentPlan(Base):
    __tablename__ = "development_plans"

    plan_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)                  # NEW
    planned_units = Column(Integer, nullable=False)
    planned_beds = Column(Integer, nullable=False)
    planned_sqft = Column(Numeric(14, 2), nullable=False)

    # Detailed cost breakdown (NEW)
    hard_costs = Column(Numeric(16, 2), nullable=True)
    soft_costs = Column(Numeric(16, 2), nullable=True)
    site_costs = Column(Numeric(16, 2), nullable=True)
    financing_costs = Column(Numeric(16, 2), nullable=True)
    contingency_percent = Column(Numeric(5, 2), nullable=True)
    cost_escalation_percent_per_year = Column(Numeric(5, 2), nullable=True)
    cost_per_sqft = Column(Numeric(10, 2), nullable=True)

    # Kept for backward compat — now computed as sum of above
    estimated_construction_cost = Column(Numeric(16, 2), nullable=False)

    development_start_date = Column(Date, nullable=False)
    construction_duration_days = Column(Integer, nullable=False)
    estimated_completion_date = Column(Date, nullable=True)              # NEW

    property = relationship("Property", back_populates="development_plans")


# ---------------------------------------------------------------------------
# Economic Entities (Three-Layer Model)
# ---------------------------------------------------------------------------

class EconomicEntity(Base):
    """Represents one of the three economic layers for a property."""
    __tablename__ = "economic_entities"

    entity_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    entity_type = Column(_enum(EntityType), nullable=False)
    legal_name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    revenue_share_percent = Column(Numeric(5, 2), nullable=True)

    property = relationship("Property", back_populates="economic_entities")


# ---------------------------------------------------------------------------
# Community — Units, Beds, Residents
# ---------------------------------------------------------------------------

class Community(Base):
    __tablename__ = "communities"

    community_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    community_type = Column(_enum(CommunityType), nullable=False)
    name = Column(String(256), nullable=False)
    has_meal_plan = Column(Boolean, default=False, nullable=False)       # NEW
    meal_plan_monthly_cost = Column(Numeric(10, 2), nullable=True)      # NEW

    property = relationship("Property", back_populates="communities")
    units = relationship("Unit", back_populates="community", cascade="all, delete-orphan")
    residents = relationship(
        "Resident", back_populates="community", cascade="all, delete-orphan"
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

    # REMOVED: monthly_rent (now tracked per bed)

    community = relationship("Community", back_populates="units")
    beds = relationship("Bed", back_populates="unit", cascade="all, delete-orphan")  # NEW
    residents = relationship(
        "Resident", back_populates="unit", cascade="all, delete-orphan"
    )


class Bed(Base):
    """Individual bed within a unit — the atomic revenue-generating entity."""
    __tablename__ = "beds"

    bed_id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.unit_id"), nullable=False)
    bed_label = Column(String(16), nullable=False)          # e.g. "A", "B", "1", "2"
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
    bed_id = Column(Integer, ForeignKey("beds.bed_id"), nullable=True)    # NEW (nullable for migration)
    full_name = Column(String(256), nullable=False)
    email = Column(String(256), nullable=True)
    phone = Column(String(64), nullable=True)
    bed_number = Column(String(16), nullable=False)
    rent_type = Column(_enum(RentType), nullable=False)
    move_in_date = Column(Date, nullable=False)
    move_out_date = Column(Date, nullable=True)
    enrolled_meal_plan = Column(Boolean, default=False, nullable=False)    # NEW

    community = relationship("Community", back_populates="residents")
    unit = relationship("Unit", back_populates="residents")
    bed = relationship("Bed", back_populates="resident")                  # NEW
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
    bed_id = Column(Integer, ForeignKey("beds.bed_id"), nullable=True)    # NEW
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    status = Column(_enum(PaymentStatus), nullable=False, default=PaymentStatus.pending)
    includes_meal_plan = Column(Boolean, default=False, nullable=False)   # NEW

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
    created_at = Column(DateTime, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    property = relationship("Property", back_populates="maintenance_requests")
    resident = relationship("Resident", back_populates="maintenance_requests")


# ---------------------------------------------------------------------------
# Investor
# ---------------------------------------------------------------------------

class Investor(Base):
    __tablename__ = "investors"

    investor_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, unique=True)
    name = Column(String(256), nullable=False)
    email = Column(String(256), nullable=False, unique=True)
    accredited_status = Column(String(32), nullable=False)
    phone = Column(String(64), nullable=True)
    preferred_return_rate = Column(Numeric(5, 2), nullable=True)         # NEW — e.g. 8.00 for 8%

    contributions = relationship(
        "CapitalContribution", back_populates="investor", cascade="all, delete-orphan"
    )
    ownership_positions = relationship(
        "Ownership", back_populates="investor", cascade="all, delete-orphan"
    )
    distributions = relationship(
        "Distribution", back_populates="investor", cascade="all, delete-orphan"
    )
    documents = relationship(
        "InvestorDocument", back_populates="investor", cascade="all, delete-orphan"
    )
    messages = relationship(
        "InvestorMessage", back_populates="investor", cascade="all, delete-orphan"
    )


class CapitalContribution(Base):
    __tablename__ = "capital_contributions"

    contribution_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    date = Column(DateTime, nullable=False)
    notes = Column(Text, nullable=True)

    investor = relationship("Investor", back_populates="contributions")


class Ownership(Base):
    __tablename__ = "ownership"

    ownership_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=True)
    ownership_percent = Column(Numeric(5, 2), nullable=False)
    is_gp = Column(Boolean, default=False, nullable=False)               # NEW — distinguish GP vs LP

    investor = relationship("Investor", back_populates="ownership_positions")


class Distribution(Base):
    __tablename__ = "distributions"

    distribution_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    method = Column(_enum(DistributionMethod), nullable=False)
    distribution_type = Column(
        _enum(DistributionType), nullable=True, default=DistributionType.preferred_return
    )  # NEW
    notes = Column(Text, nullable=True)

    investor = relationship("Investor", back_populates="distributions")


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
