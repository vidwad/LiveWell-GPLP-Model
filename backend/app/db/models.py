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


class RentType(str, enum.Enum):
    private_pay = "private_pay"
    government_supported = "government_supported"


class DistributionMethod(str, enum.Enum):
    etransfer = "eTransfer"
    wire = "Wire"
    ach = "ACH"


class DevelopmentStage(str, enum.Enum):
    acquisition = "acquisition"
    planning = "planning"
    construction = "construction"
    operational = "operational"


class MaintenanceStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    overdue = "overdue"


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
# Portfolio
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
    development_stage = Column(
        _enum(DevelopmentStage), nullable=False, default=DevelopmentStage.acquisition
    )

    development_plans = relationship(
        "DevelopmentPlan", back_populates="property", cascade="all, delete-orphan"
    )
    communities = relationship(
        "Community", back_populates="property", cascade="all, delete-orphan"
    )
    maintenance_requests = relationship(
        "MaintenanceRequest", back_populates="property", cascade="all, delete-orphan"
    )


class DevelopmentPlan(Base):
    __tablename__ = "development_plans"

    plan_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    planned_units = Column(Integer, nullable=False)
    planned_beds = Column(Integer, nullable=False)
    planned_sqft = Column(Numeric(14, 2), nullable=False)
    estimated_construction_cost = Column(Numeric(16, 2), nullable=False)
    development_start_date = Column(Date, nullable=False)
    construction_duration_days = Column(Integer, nullable=False)

    property = relationship("Property", back_populates="development_plans")


# ---------------------------------------------------------------------------
# Community
# ---------------------------------------------------------------------------

class Community(Base):
    __tablename__ = "communities"

    community_id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.property_id"), nullable=False)
    community_type = Column(_enum(CommunityType), nullable=False)
    name = Column(String(256), nullable=False)

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
    monthly_rent = Column(Numeric(10, 2), nullable=False)
    is_occupied = Column(Boolean, default=False, nullable=False)

    community = relationship("Community", back_populates="units")
    residents = relationship(
        "Resident", back_populates="unit", cascade="all, delete-orphan"
    )


class Resident(Base):
    __tablename__ = "residents"

    resident_id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.community_id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.unit_id"), nullable=False)
    full_name = Column(String(256), nullable=False)
    email = Column(String(256), nullable=True)
    phone = Column(String(64), nullable=True)
    bed_number = Column(String(16), nullable=False)
    rent_type = Column(_enum(RentType), nullable=False)
    move_in_date = Column(Date, nullable=False)
    move_out_date = Column(Date, nullable=True)

    community = relationship("Community", back_populates="residents")
    unit = relationship("Unit", back_populates="residents")
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
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    status = Column(_enum(PaymentStatus), nullable=False, default=PaymentStatus.pending)

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

    contributions = relationship(
        "CapitalContribution", back_populates="investor", cascade="all, delete-orphan"
    )
    ownership_positions = relationship(
        "Ownership", back_populates="investor", cascade="all, delete-orphan"
    )
    distributions = relationship(
        "Distribution", back_populates="investor", cascade="all, delete-orphan"
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

    investor = relationship("Investor", back_populates="ownership_positions")


class Distribution(Base):
    __tablename__ = "distributions"

    distribution_id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.investor_id"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    method = Column(_enum(DistributionMethod), nullable=False)
    notes = Column(Text, nullable=True)

    investor = relationship("Investor", back_populates="distributions")
