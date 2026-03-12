# Sprint 1 — Enhanced Data Model

**Status:** Ready for implementation
**Assigned to:** Claude (local development)
**Reviewed by:** Manus
**Date:** 2026-03-11

---

## Overview

This sprint enhances the database schema, Pydantic schemas, API routes, TypeScript types, and seed data to support the full Living Well business model. The current codebase has a simplified data model that treats rent at the unit level and lacks several critical concepts. This sprint adds:

1. **Bed-level revenue tracking** — rent is per bed, not per unit
2. **Expanded rent types** — shared room, transitional, meal plan add-ons
3. **Full property lifecycle** — 6 stages from acquisition through exit
4. **Property clusters with shared kitchen infrastructure**
5. **Three economic layers** — Property LP, Operating Company, Property Management Company
6. **Expanded development plan fields** — hard/soft/site costs, contingency, escalation

After this sprint, the data model will accurately represent the Alberta Multiplex LP business structure.

---

## Important Instructions for Claude

1. **Work in order.** Complete each section (A through H) sequentially. Later sections depend on earlier ones.
2. **Do not rename existing columns** unless explicitly instructed. We are adding to the schema, not replacing it.
3. **Delete and recreate the SQLite database** after making model changes. Run `rm -f backend/livingwell_dev.db && cd backend && python seed.py` to rebuild.
4. **Test each backend change** by starting the server (`cd backend && uvicorn app.main:app --reload`) and hitting the relevant endpoints with curl or the Swagger UI at `/docs`.
5. **Do not modify files not listed here** unless absolutely necessary for imports.
6. **Use the exact code provided.** Do not paraphrase, simplify, or "improve" the code blocks — they are designed to be copy-paste ready and maintain consistency with the existing codebase patterns.

---

## Section A: Updated Enumerations

**File:** `backend/app/db/models.py`

Replace the existing enum definitions (lines 20–68) with the following. Keep the `_enum` helper and all imports unchanged.

```python
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
```

**What changed:**
- `UnitType`: added `three_bed`, `suite`, `shared`
- `RentType`: added `shared_room`, `transitional`
- `BedStatus`: new enum for individual bed tracking
- `DevelopmentStage`: renamed `operational` to `stabilized`, added `interim_operation` and `exit`
- `DistributionType`: new enum to classify distribution sources
- `EntityType`: new enum for the three economic layers

---

## Section B: New and Updated SQLAlchemy Models

**File:** `backend/app/db/models.py`

Replace everything from `# Auth` (line 71) to the end of the file with the following. This preserves the `User` model and enhances all other models.

```python
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
```

**Summary of changes to existing models:**

| Model | Change |
|-------|--------|
| Property | Added `floor_area_ratio`, `cluster_id` FK, `cluster` and `economic_entities` relationships |
| DevelopmentPlan | Added `version`, `hard_costs`, `soft_costs`, `site_costs`, `financing_costs`, `contingency_percent`, `cost_escalation_percent_per_year`, `cost_per_sqft`, `estimated_completion_date` |
| Community | Added `has_meal_plan`, `meal_plan_monthly_cost` |
| Unit | **Removed** `monthly_rent` (now on Bed). Added `beds` relationship |
| Resident | Added `bed_id` FK, `enrolled_meal_plan`, `bed` relationship |
| RentPayment | Added `bed_id`, `includes_meal_plan` |
| Investor | Added `preferred_return_rate` |
| Ownership | Added `is_gp` |
| Distribution | Added `distribution_type` |

**New models:**

| Model | Purpose |
|-------|---------|
| PropertyCluster | Groups nearby properties sharing infrastructure |
| EconomicEntity | Represents the three economic layers per property |
| Bed | Individual bed within a unit — the atomic revenue entity |

---

## Section C: Updated Pydantic Schemas

### File: `backend/app/schemas/portfolio.py`

Replace the entire file:

```python
import datetime
from decimal import Decimal

from pydantic import BaseModel
from app.db.models import DevelopmentStage, EntityType


# ---------------------------------------------------------------------------
# Property Cluster
# ---------------------------------------------------------------------------

class PropertyClusterCreate(BaseModel):
    name: str
    city: str
    has_commercial_kitchen: bool = False
    kitchen_capacity_meals_per_day: int | None = None
    notes: str | None = None


class PropertyClusterOut(BaseModel):
    cluster_id: int
    name: str
    city: str
    has_commercial_kitchen: bool
    kitchen_capacity_meals_per_day: int | None
    notes: str | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Property
# ---------------------------------------------------------------------------

class PropertyCreate(BaseModel):
    address: str
    city: str
    province: str
    purchase_date: datetime.date
    purchase_price: Decimal
    lot_size: Decimal | None = None
    zoning: str | None = None
    max_buildable_area: Decimal | None = None
    floor_area_ratio: Decimal | None = None
    development_stage: DevelopmentStage = DevelopmentStage.acquisition
    cluster_id: int | None = None


class PropertyUpdate(BaseModel):
    address: str | None = None
    city: str | None = None
    province: str | None = None
    purchase_date: datetime.date | None = None
    purchase_price: Decimal | None = None
    lot_size: Decimal | None = None
    zoning: str | None = None
    max_buildable_area: Decimal | None = None
    floor_area_ratio: Decimal | None = None
    development_stage: DevelopmentStage | None = None
    cluster_id: int | None = None


class PropertyOut(BaseModel):
    property_id: int
    address: str
    city: str
    province: str
    purchase_date: datetime.date
    purchase_price: Decimal
    lot_size: Decimal | None
    zoning: str | None
    max_buildable_area: Decimal | None
    floor_area_ratio: Decimal | None
    development_stage: DevelopmentStage
    cluster_id: int | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Development Plan
# ---------------------------------------------------------------------------

class DevelopmentPlanCreate(BaseModel):
    version: int = 1
    planned_units: int
    planned_beds: int
    planned_sqft: Decimal
    hard_costs: Decimal | None = None
    soft_costs: Decimal | None = None
    site_costs: Decimal | None = None
    financing_costs: Decimal | None = None
    contingency_percent: Decimal | None = None
    cost_escalation_percent_per_year: Decimal | None = None
    cost_per_sqft: Decimal | None = None
    estimated_construction_cost: Decimal
    development_start_date: datetime.date
    construction_duration_days: int
    estimated_completion_date: datetime.date | None = None


class DevelopmentPlanOut(BaseModel):
    plan_id: int
    property_id: int
    version: int
    planned_units: int
    planned_beds: int
    planned_sqft: Decimal
    hard_costs: Decimal | None
    soft_costs: Decimal | None
    site_costs: Decimal | None
    financing_costs: Decimal | None
    contingency_percent: Decimal | None
    cost_escalation_percent_per_year: Decimal | None
    cost_per_sqft: Decimal | None
    estimated_construction_cost: Decimal
    development_start_date: datetime.date
    construction_duration_days: int
    estimated_completion_date: datetime.date | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Economic Entity
# ---------------------------------------------------------------------------

class EconomicEntityCreate(BaseModel):
    entity_type: EntityType
    legal_name: str
    description: str | None = None
    revenue_share_percent: Decimal | None = None


class EconomicEntityOut(BaseModel):
    entity_id: int
    property_id: int
    entity_type: EntityType
    legal_name: str
    description: str | None
    revenue_share_percent: Decimal | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Financial Modeling (unchanged interface, will be enhanced in Sprint 2)
# ---------------------------------------------------------------------------

class ModelingInput(BaseModel):
    unit_count: int
    avg_cost_per_unit: Decimal
    rent_income: Decimal
    other_income: Decimal
    operating_expenses: Decimal
    market_value: Decimal
    cash_flows: list[Decimal]


class ModelingResult(BaseModel):
    construction_costs: Decimal
    noi: Decimal
    cap_rate: Decimal
    irr: Decimal
```

### File: `backend/app/schemas/community.py`

Replace the entire file:

```python
import datetime
from decimal import Decimal

from pydantic import BaseModel
from app.db.models import (
    BedStatus, CommunityType, MaintenanceStatus, PaymentStatus, RentType, UnitType,
)


# ---------------------------------------------------------------------------
# Community
# ---------------------------------------------------------------------------

class CommunityCreate(BaseModel):
    property_id: int
    community_type: CommunityType
    name: str
    has_meal_plan: bool = False
    meal_plan_monthly_cost: Decimal | None = None


class CommunityOut(BaseModel):
    community_id: int
    property_id: int
    community_type: CommunityType
    name: str
    has_meal_plan: bool
    meal_plan_monthly_cost: Decimal | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Unit
# ---------------------------------------------------------------------------

class UnitCreate(BaseModel):
    unit_number: str
    unit_type: UnitType
    bed_count: int
    sqft: Decimal


class UnitOut(BaseModel):
    unit_id: int
    community_id: int
    unit_number: str
    unit_type: UnitType
    bed_count: int
    sqft: Decimal
    is_occupied: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Bed
# ---------------------------------------------------------------------------

class BedCreate(BaseModel):
    unit_id: int
    bed_label: str
    monthly_rent: Decimal
    rent_type: RentType = RentType.private_pay


class BedOut(BaseModel):
    bed_id: int
    unit_id: int
    bed_label: str
    monthly_rent: Decimal
    rent_type: RentType
    status: BedStatus

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Resident
# ---------------------------------------------------------------------------

class ResidentCreate(BaseModel):
    unit_id: int
    bed_id: int | None = None
    full_name: str
    email: str | None = None
    phone: str | None = None
    bed_number: str
    rent_type: RentType
    move_in_date: datetime.date
    move_out_date: datetime.date | None = None
    enrolled_meal_plan: bool = False


class ResidentOut(BaseModel):
    resident_id: int
    community_id: int
    unit_id: int
    bed_id: int | None
    full_name: str
    email: str | None
    phone: str | None
    bed_number: str
    rent_type: RentType
    move_in_date: datetime.date
    move_out_date: datetime.date | None
    enrolled_meal_plan: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Maintenance Request
# ---------------------------------------------------------------------------

class MaintenanceRequestCreate(BaseModel):
    property_id: int
    resident_id: int | None = None
    description: str


class MaintenanceRequestUpdate(BaseModel):
    status: MaintenanceStatus
    resolved_at: datetime.datetime | None = None


class MaintenanceRequestOut(BaseModel):
    request_id: int
    property_id: int
    resident_id: int | None
    description: str
    status: MaintenanceStatus
    created_at: datetime.datetime
    resolved_at: datetime.datetime | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Rent Payment
# ---------------------------------------------------------------------------

class RentPaymentCreate(BaseModel):
    amount: Decimal
    payment_date: datetime.datetime
    period_month: int
    period_year: int
    bed_id: int | None = None
    includes_meal_plan: bool = False


class RentPaymentOut(BaseModel):
    payment_id: int
    resident_id: int
    bed_id: int | None
    amount: Decimal
    payment_date: datetime.datetime
    period_month: int
    period_year: int
    status: PaymentStatus
    includes_meal_plan: bool

    model_config = {"from_attributes": True}
```

### File: `backend/app/schemas/investor.py`

Replace the entire file:

```python
import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr
from app.db.models import DistributionMethod, DistributionType


class InvestorCreate(BaseModel):
    name: str
    email: EmailStr
    accredited_status: str
    phone: str | None = None
    user_id: int | None = None
    preferred_return_rate: Decimal | None = None


class InvestorOut(BaseModel):
    investor_id: int
    name: str
    email: EmailStr
    accredited_status: str
    phone: str | None
    preferred_return_rate: Decimal | None

    model_config = {"from_attributes": True}


class ContributionCreate(BaseModel):
    amount: Decimal
    date: datetime.datetime
    notes: str | None = None


class ContributionOut(BaseModel):
    contribution_id: int
    investor_id: int
    amount: Decimal
    date: datetime.datetime
    notes: str | None

    model_config = {"from_attributes": True}


class OwnershipCreate(BaseModel):
    property_id: int | None = None
    ownership_percent: Decimal
    is_gp: bool = False


class OwnershipOut(BaseModel):
    ownership_id: int
    investor_id: int
    property_id: int | None
    ownership_percent: Decimal
    is_gp: bool

    model_config = {"from_attributes": True}


class DistributionCreate(BaseModel):
    amount: Decimal
    payment_date: datetime.datetime
    method: DistributionMethod
    distribution_type: DistributionType = DistributionType.preferred_return
    notes: str | None = None


class DistributionOut(BaseModel):
    distribution_id: int
    investor_id: int
    amount: Decimal
    payment_date: datetime.datetime
    method: DistributionMethod
    distribution_type: DistributionType | None
    notes: str | None

    model_config = {"from_attributes": True}


class InvestorDashboard(BaseModel):
    investor: InvestorOut
    total_contributed: Decimal
    total_distributed: Decimal
    net_position: Decimal
    ownership_positions: list[OwnershipOut]
    recent_distributions: list[DistributionOut]
```

---

## Section D: New API Routes

### File: `backend/app/routes/portfolio.py`

Add the following new endpoints **after** the existing financial modeling section. Also update the imports at the top of the file.

**Updated imports** (replace the existing import block):

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_ops_pm, require_gp_or_ops
from app.db.models import DevelopmentPlan, EconomicEntity, Property, PropertyCluster, User
from app.db.session import get_db
from app.schemas.portfolio import (
    DevelopmentPlanCreate, DevelopmentPlanOut,
    EconomicEntityCreate, EconomicEntityOut,
    ModelingInput, ModelingResult,
    PropertyClusterCreate, PropertyClusterOut,
    PropertyCreate, PropertyOut, PropertyUpdate,
)
from app.services.modeling import (
    calculate_cap_rate, calculate_construction_costs, calculate_irr, calculate_noi,
)
```

**New endpoints to append at the end of the file:**

```python
# ---------------------------------------------------------------------------
# Property Clusters
# ---------------------------------------------------------------------------

@router.get("/clusters", response_model=list[PropertyClusterOut])
def list_clusters(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(PropertyCluster).all()


@router.post("/clusters", response_model=PropertyClusterOut, status_code=status.HTTP_201_CREATED)
def create_cluster(
    payload: PropertyClusterCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    cluster = PropertyCluster(**payload.model_dump())
    db.add(cluster)
    db.commit()
    db.refresh(cluster)
    return cluster


@router.get("/clusters/{cluster_id}", response_model=PropertyClusterOut)
def get_cluster(
    cluster_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cluster = db.query(PropertyCluster).filter(PropertyCluster.cluster_id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return cluster


# ---------------------------------------------------------------------------
# Economic Entities
# ---------------------------------------------------------------------------

@router.get("/properties/{property_id}/entities", response_model=list[EconomicEntityOut])
def list_entities(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop.economic_entities


@router.post(
    "/properties/{property_id}/entities",
    response_model=EconomicEntityOut,
    status_code=status.HTTP_201_CREATED,
)
def create_entity(
    property_id: int,
    payload: EconomicEntityCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(status_code=404, detail="Property not found")
    entity = EconomicEntity(property_id=property_id, **payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity
```

### File: `backend/app/routes/community.py`

**Updated imports** (replace the existing import block):

```python
import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_ops_pm, require_gp_or_ops
from app.db.models import (
    Bed, BedStatus, Community, MaintenanceRequest, MaintenanceStatus, Resident,
    RentPayment, PaymentStatus, Unit, User,
)
from app.db.session import get_db
from app.schemas.community import (
    BedCreate, BedOut,
    CommunityCreate, CommunityOut,
    MaintenanceRequestCreate, MaintenanceRequestOut, MaintenanceRequestUpdate,
    RentPaymentCreate, RentPaymentOut,
    ResidentCreate, ResidentOut,
    UnitCreate, UnitOut,
)
```

**Add these new bed endpoints** after the Units section and before the Residents section:

```python
# ---------------------------------------------------------------------------
# Beds
# ---------------------------------------------------------------------------

@router.get("/units/{unit_id}/beds", response_model=list[BedOut])
def list_beds(
    unit_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    unit = db.query(Unit).filter(Unit.unit_id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit.beds


@router.post(
    "/units/{unit_id}/beds",
    response_model=BedOut,
    status_code=status.HTTP_201_CREATED,
)
def add_bed(
    unit_id: int,
    payload: BedCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    unit = db.query(Unit).filter(Unit.unit_id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    bed = Bed(unit_id=unit_id, bed_label=payload.bed_label,
              monthly_rent=payload.monthly_rent, rent_type=payload.rent_type)
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@router.patch("/beds/{bed_id}/status")
def update_bed_status(
    bed_id: int,
    new_status: BedStatus,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    bed = db.query(Bed).filter(Bed.bed_id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    bed.status = new_status
    db.commit()
    return {"bed_id": bed_id, "status": new_status.value}
```

---

## Section E: Updated TypeScript Types

### File: `livingwell-frontend/src/types/portfolio.ts`

Replace the entire file:

```typescript
export type DevelopmentStage =
  | "acquisition"
  | "interim_operation"
  | "planning"
  | "construction"
  | "stabilized"
  | "exit";

export type EntityType =
  | "property_lp"
  | "operating_company"
  | "property_management";

export interface PropertyCluster {
  cluster_id: number;
  name: string;
  city: string;
  has_commercial_kitchen: boolean;
  kitchen_capacity_meals_per_day: number | null;
  notes: string | null;
}

export interface Property {
  property_id: number;
  address: string;
  city: string;
  province: string;
  purchase_date: string;
  purchase_price: string;
  lot_size: string | null;
  zoning: string | null;
  max_buildable_area: string | null;
  floor_area_ratio: string | null;
  development_stage: DevelopmentStage;
  cluster_id: number | null;
}

export interface PropertyCreate {
  address: string;
  city: string;
  province: string;
  purchase_date: string;
  purchase_price: number;
  lot_size?: number;
  zoning?: string;
  max_buildable_area?: number;
  floor_area_ratio?: number;
  development_stage: DevelopmentStage;
  cluster_id?: number;
}

export interface DevelopmentPlan {
  plan_id: number;
  property_id: number;
  version: number;
  planned_units: number;
  planned_beds: number;
  planned_sqft: string;
  hard_costs: string | null;
  soft_costs: string | null;
  site_costs: string | null;
  financing_costs: string | null;
  contingency_percent: string | null;
  cost_escalation_percent_per_year: string | null;
  cost_per_sqft: string | null;
  estimated_construction_cost: string;
  development_start_date: string;
  construction_duration_days: number;
  estimated_completion_date: string | null;
}

export interface DevelopmentPlanCreate {
  version?: number;
  planned_units: number;
  planned_beds: number;
  planned_sqft: number;
  hard_costs?: number;
  soft_costs?: number;
  site_costs?: number;
  financing_costs?: number;
  contingency_percent?: number;
  cost_escalation_percent_per_year?: number;
  cost_per_sqft?: number;
  estimated_construction_cost: number;
  development_start_date: string;
  construction_duration_days: number;
  estimated_completion_date?: string;
}

export interface EconomicEntity {
  entity_id: number;
  property_id: number;
  entity_type: EntityType;
  legal_name: string;
  description: string | null;
  revenue_share_percent: string | null;
}

export interface ModelingInput {
  purchase_price: number;
  construction_cost: number;
  annual_revenue: number;
  annual_expenses: number;
  hold_period_years: number;
  exit_cap_rate: number;
}

export interface ModelingResult {
  construction_costs: string;
  noi: string;
  cap_rate: string;
  irr: string;
}
```

### File: `livingwell-frontend/src/types/community.ts`

Replace the entire file:

```typescript
export type CommunityType = "RecoverWell" | "StudyWell" | "RetireWell";
export type UnitType = "studio" | "1br" | "2br" | "3br" | "suite" | "shared";
export type RentType = "private_pay" | "government_supported" | "shared_room" | "transitional";
export type BedStatus = "available" | "occupied" | "reserved" | "maintenance";
export type MaintenanceStatus = "open" | "in_progress" | "resolved";
export type PaymentStatus = "pending" | "paid" | "overdue";

export interface Community {
  community_id: number;
  property_id: number;
  community_type: CommunityType;
  name: string;
  has_meal_plan: boolean;
  meal_plan_monthly_cost: string | null;
}

export interface Unit {
  unit_id: number;
  community_id: number;
  unit_number: string;
  unit_type: UnitType;
  bed_count: number;
  sqft: string;
  is_occupied: boolean;
}

export interface Bed {
  bed_id: number;
  unit_id: number;
  bed_label: string;
  monthly_rent: string;
  rent_type: RentType;
  status: BedStatus;
}

export interface Resident {
  resident_id: number;
  community_id: number;
  unit_id: number;
  bed_id: number | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  bed_number: string;
  rent_type: RentType;
  move_in_date: string;
  move_out_date: string | null;
  enrolled_meal_plan: boolean;
}

export interface RentPayment {
  payment_id: number;
  resident_id: number;
  bed_id: number | null;
  amount: string;
  payment_date: string;
  period_month: number;
  period_year: number;
  status: PaymentStatus;
  includes_meal_plan: boolean;
}

export interface MaintenanceRequest {
  request_id: number;
  property_id: number;
  resident_id: number | null;
  description: string;
  status: MaintenanceStatus;
  created_at: string;
  resolved_at: string | null;
}
```

### File: `livingwell-frontend/src/types/investor.ts`

Replace the entire file:

```typescript
export type DistributionMethod = "eTransfer" | "Wire" | "ACH";
export type DistributionType =
  | "preferred_return"
  | "profit_share"
  | "refinancing"
  | "sale_proceeds";

export interface Investor {
  investor_id: number;
  user_id: number | null;
  name: string;
  email: string;
  accredited_status: string;
  phone: string | null;
  preferred_return_rate: string | null;
}

export interface Contribution {
  contribution_id: number;
  investor_id: number;
  amount: string;
  date: string;
  notes: string | null;
}

export interface Ownership {
  ownership_id: number;
  investor_id: number;
  property_id: number | null;
  ownership_percent: string;
  is_gp: boolean;
}

export interface Distribution {
  distribution_id: number;
  investor_id: number;
  amount: string;
  payment_date: string;
  method: DistributionMethod;
  distribution_type: DistributionType | null;
  notes: string | null;
}

export interface InvestorDashboard {
  investor: Investor;
  total_contributed: string;
  total_distributed: string;
  net_position: string;
  ownership_positions: Ownership[];
  recent_distributions: Distribution[];
}
```

---

## Section F: Updated Seed Script

### File: `backend/seed.py`

This is the most complex change. Replace the entire `seed.py` file. The new version creates Alberta-based properties, clusters, economic entities, beds, and uses the expanded enums.

**Key changes in seed data:**
- Properties are now in Alberta (Edmonton, Calgary, Red Deer, Lethbridge)
- A property cluster with a commercial kitchen is created
- Each unit has individual beds with per-bed rent
- Economic entities (3 layers) are created for each operational property
- Investors have preferred return rates
- Distributions have distribution types
- Development plans have detailed cost breakdowns

```python
"""
Seed script — populate the database with realistic Alberta demo data.

Usage (from the backend/ directory):
    python seed.py

Idempotent: running it twice will skip rows that already exist.
"""

import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import engine, SessionLocal
import app.db.models  # noqa: F401

# ── helpers ────────────────────────────────────────────────────────────────

def _try_add(db, obj):
    """Add obj to session; roll back silently on integrity error."""
    try:
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
    except Exception:
        db.rollback()
        return None


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    from app.db.models import (
        User, Property, PropertyCluster, DevelopmentPlan, Community, Unit, Bed,
        Resident, RentPayment, MaintenanceRequest, EconomicEntity,
        Investor, CapitalContribution, Ownership, Distribution,
        UserRole, DevelopmentStage, CommunityType, UnitType, RentType,
        BedStatus, PaymentStatus, MaintenanceStatus, DistributionMethod,
        DistributionType, EntityType,
    )

    # ── Users ──────────────────────────────────────────────────────────
    print("Seeding users …")
    users = {}
    for email, full_name, role in [
        ("admin@livingwell.ca",     "Alex Chen",       UserRole.GP_ADMIN),
        ("ops@livingwell.ca",       "Maria Santos",    UserRole.OPERATIONS_MANAGER),
        ("pm@livingwell.ca",        "James Okafor",    UserRole.PROPERTY_MANAGER),
        ("investor1@example.ca",    "Sarah Mitchell",  UserRole.INVESTOR),
        ("investor2@example.ca",    "David Nguyen",    UserRole.INVESTOR),
        ("resident1@example.ca",    "Tom Clarke",      UserRole.RESIDENT),
    ]:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            users[email] = existing
            continue
        u = User(
            email=email,
            hashed_password=hash_password("Password1!"),
            full_name=full_name,
            role=role,
        )
        result = _try_add(db, u)
        users[email] = result or db.query(User).filter(User.email == email).first()
    print(f"  {len(users)} users ready")

    # ── Property Clusters ──────────────────────────────────────────────
    print("Seeding property clusters …")
    cluster = db.query(PropertyCluster).filter(PropertyCluster.name == "Edmonton Central Cluster").first()
    if not cluster:
        cluster = _try_add(db, PropertyCluster(
            name="Edmonton Central Cluster",
            city="Edmonton",
            has_commercial_kitchen=True,
            kitchen_capacity_meals_per_day=150,
            notes="Commercial kitchen at 142 Whyte Ave serves 5 nearby properties",
        ))
    print(f"  cluster ready: {cluster.name if cluster else 'N/A'}")

    # ── Properties ─────────────────────────────────────────────────────
    print("Seeding properties …")
    props_data = [
        {
            "address": "142 Whyte Ave",
            "city": "Edmonton",
            "province": "AB",
            "purchase_date": date(2021, 6, 15),
            "purchase_price": Decimal("1_850_000"),
            "lot_size": Decimal("6200"),
            "zoning": "RF3",
            "max_buildable_area": Decimal("4800"),
            "floor_area_ratio": Decimal("0.80"),
            "development_stage": DevelopmentStage.stabilized,
            "cluster_id": cluster.cluster_id if cluster else None,
        },
        {
            "address": "89 Bow Trail SW",
            "city": "Calgary",
            "province": "AB",
            "purchase_date": date(2022, 2, 28),
            "purchase_price": Decimal("2_100_000"),
            "lot_size": Decimal("5400"),
            "zoning": "M-C2",
            "max_buildable_area": Decimal("4200"),
            "floor_area_ratio": Decimal("0.78"),
            "development_stage": DevelopmentStage.stabilized,
            "cluster_id": None,
        },
        {
            "address": "310 Gaetz Ave",
            "city": "Red Deer",
            "province": "AB",
            "purchase_date": date(2023, 9, 1),
            "purchase_price": Decimal("780_000"),
            "lot_size": Decimal("8100"),
            "zoning": "R2",
            "max_buildable_area": Decimal("6500"),
            "floor_area_ratio": Decimal("0.80"),
            "development_stage": DevelopmentStage.construction,
            "cluster_id": None,
        },
        {
            "address": "55 University Dr",
            "city": "Lethbridge",
            "province": "AB",
            "purchase_date": date(2024, 1, 20),
            "purchase_price": Decimal("920_000"),
            "lot_size": Decimal("4900"),
            "zoning": "C-N",
            "max_buildable_area": Decimal("3800"),
            "floor_area_ratio": Decimal("0.78"),
            "development_stage": DevelopmentStage.planning,
            "cluster_id": None,
        },
        {
            "address": "220 Jasper Ave",
            "city": "Edmonton",
            "province": "AB",
            "purchase_date": date(2024, 8, 1),
            "purchase_price": Decimal("1_450_000"),
            "lot_size": Decimal("5800"),
            "zoning": "RF3",
            "max_buildable_area": Decimal("4500"),
            "floor_area_ratio": Decimal("0.78"),
            "development_stage": DevelopmentStage.acquisition,
            "cluster_id": cluster.cluster_id if cluster else None,
        },
    ]
    props = []
    for pd in props_data:
        existing = db.query(Property).filter(
            Property.address == pd["address"],
            Property.city == pd["city"],
        ).first()
        if existing:
            props.append(existing)
            continue
        p = Property(**pd)
        result = _try_add(db, p)
        props.append(result or existing)
    print(f"  {len(props)} properties ready")

    # ── Economic Entities ──────────────────────────────────────────────
    print("Seeding economic entities …")
    for prop in props[:2]:  # Only for stabilized properties
        if not prop:
            continue
        for etype, lname, desc, share in [
            (EntityType.property_lp, f"Alberta Multiplex LP – {prop.address}",
             "Property ownership entity receiving rental income", Decimal("100.00")),
            (EntityType.operating_company, f"RecoverWell Operations – {prop.address}",
             "Manages day-to-day community operations", None),
            (EntityType.property_management, f"Living Well PM – {prop.address}",
             "Handles maintenance, building ops, compliance", None),
        ]:
            existing = db.query(EconomicEntity).filter(
                EconomicEntity.property_id == prop.property_id,
                EconomicEntity.entity_type == etype,
            ).first()
            if not existing:
                _try_add(db, EconomicEntity(
                    property_id=prop.property_id,
                    entity_type=etype,
                    legal_name=lname,
                    description=desc,
                    revenue_share_percent=share,
                ))
    print("  economic entities ready")

    # ── Development Plans ──────────────────────────────────────────────
    print("Seeding development plans …")
    plan_specs = [
        (props[0], 1, 12, 24, Decimal("6400"), Decimal("1_200_000"), Decimal("280_000"),
         Decimal("120_000"), Decimal("80_000"), Decimal("10.00"), Decimal("4.00"),
         Decimal("262.50"), Decimal("1_920_000"), date(2020, 3, 1), 480, date(2021, 6, 24)),
        (props[1], 1, 10, 18, Decimal("5200"), Decimal("980_000"), Decimal("220_000"),
         Decimal("100_000"), Decimal("60_000"), Decimal("10.00"), Decimal("4.00"),
         Decimal("261.54"), Decimal("1_560_000"), date(2021, 6, 1), 420, date(2022, 7, 26)),
        (props[2], 1, 8, 14, Decimal("4800"), Decimal("860_000"), Decimal("200_000"),
         Decimal("90_000"), Decimal("50_000"), Decimal("10.00"), Decimal("4.50"),
         Decimal("250.00"), Decimal("1_440_000"), date(2023, 11, 1), 365, date(2024, 11, 1)),
        (props[3], 1, 6, 10, Decimal("3200"), Decimal("580_000"), Decimal("140_000"),
         Decimal("70_000"), Decimal("40_000"), Decimal("10.00"), Decimal("4.50"),
         Decimal("259.38"), Decimal("960_000"), date(2024, 6, 1), 300, date(2025, 3, 28)),
    ]
    for (prop, ver, units, beds, sqft, hard, soft, site, fin,
         cont_pct, esc_pct, cpsf, total, start, days, completion) in plan_specs:
        if not prop:
            continue
        if not db.query(DevelopmentPlan).filter(DevelopmentPlan.property_id == prop.property_id).first():
            _try_add(db, DevelopmentPlan(
                property_id=prop.property_id,
                version=ver,
                planned_units=units,
                planned_beds=beds,
                planned_sqft=sqft,
                hard_costs=hard,
                soft_costs=soft,
                site_costs=site,
                financing_costs=fin,
                contingency_percent=cont_pct,
                cost_escalation_percent_per_year=esc_pct,
                cost_per_sqft=cpsf,
                estimated_construction_cost=total,
                development_start_date=start,
                construction_duration_days=days,
                estimated_completion_date=completion,
            ))
    print("  development plans ready")

    # ── Communities ────────────────────────────────────────────────────
    print("Seeding communities …")
    communities = []
    community_specs = [
        (props[0], CommunityType.recover, "RecoverWell Whyte Ave", True, Decimal("350.00")),
        (props[1], CommunityType.retire,  "RetireWell Bow Trail", True, Decimal("500.00")),
        (props[1], CommunityType.study,   "StudyWell Bow Trail", False, None),
        (props[3], CommunityType.study,   "StudyWell University", False, None),
    ]
    for prop, ctype, name, meal, meal_cost in community_specs:
        if not prop:
            communities.append(None)
            continue
        existing = db.query(Community).filter(Community.name == name).first()
        if existing:
            communities.append(existing)
            continue
        c = Community(
            property_id=prop.property_id, community_type=ctype, name=name,
            has_meal_plan=meal, meal_plan_monthly_cost=meal_cost,
        )
        result = _try_add(db, c)
        communities.append(result or db.query(Community).filter(Community.name == name).first())
    print(f"  {len([c for c in communities if c])} communities ready")

    # ── Units & Beds ───────────────────────────────────────────────────
    print("Seeding units and beds …")
    unit_map = {}  # community_id -> list of units
    # (community_idx, unit_number, type, bed_count, sqft, bed_rents)
    # bed_rents is a list of (label, monthly_rent, rent_type)
    unit_specs = [
        # RecoverWell Whyte Ave — shared rooms common in recovery housing
        (0, "101", UnitType.shared, 2, Decimal("400"),
         [("A", Decimal("1100"), RentType.private_pay),
          ("B", Decimal("1100"), RentType.government_supported)]),
        (0, "102", UnitType.shared, 2, Decimal("400"),
         [("A", Decimal("1100"), RentType.private_pay),
          ("B", Decimal("1100"), RentType.shared_room)]),
        (0, "103", UnitType.one_bed, 1, Decimal("480"),
         [("A", Decimal("1800"), RentType.private_pay)]),
        (0, "104", UnitType.one_bed, 1, Decimal("480"),
         [("A", Decimal("1800"), RentType.transitional)]),
        (0, "201", UnitType.two_bed, 2, Decimal("720"),
         [("A", Decimal("1400"), RentType.private_pay),
          ("B", Decimal("1400"), RentType.private_pay)]),
        (0, "202", UnitType.two_bed, 2, Decimal("720"),
         [("A", Decimal("1400"), RentType.government_supported),
          ("B", Decimal("1400"), RentType.government_supported)]),
        # RetireWell Bow Trail — suites for seniors
        (1, "101", UnitType.suite, 1, Decimal("550"),
         [("A", Decimal("2600"), RentType.private_pay)]),
        (1, "102", UnitType.suite, 1, Decimal("550"),
         [("A", Decimal("2600"), RentType.private_pay)]),
        (1, "103", UnitType.two_bed, 2, Decimal("750"),
         [("A", Decimal("1800"), RentType.private_pay),
          ("B", Decimal("1800"), RentType.private_pay)]),
        (1, "104", UnitType.two_bed, 2, Decimal("750"),
         [("A", Decimal("1800"), RentType.government_supported),
          ("B", Decimal("1800"), RentType.government_supported)]),
        # StudyWell Bow Trail — student rooms
        (2, "101", UnitType.shared, 2, Decimal("310"),
         [("A", Decimal("850"), RentType.private_pay),
          ("B", Decimal("850"), RentType.private_pay)]),
        (2, "102", UnitType.studio, 1, Decimal("310"),
         [("A", Decimal("1200"), RentType.private_pay)]),
        (2, "103", UnitType.one_bed, 1, Decimal("460"),
         [("A", Decimal("1500"), RentType.private_pay)]),
    ]

    bed_map = {}  # unit_id -> list of beds

    for ci, unit_number, utype, beds, sqft, bed_rents in unit_specs:
        comm = communities[ci]
        if not comm:
            continue
        existing = db.query(Unit).filter(
            Unit.community_id == comm.community_id,
            Unit.unit_number == unit_number,
        ).first()
        if existing:
            unit_map.setdefault(comm.community_id, []).append(existing)
            # Load existing beds
            existing_beds = db.query(Bed).filter(Bed.unit_id == existing.unit_id).all()
            bed_map[existing.unit_id] = existing_beds
            continue
        u = Unit(
            community_id=comm.community_id,
            unit_number=unit_number,
            unit_type=utype,
            bed_count=beds,
            sqft=sqft,
            is_occupied=False,
        )
        result = _try_add(db, u)
        if result:
            unit_map.setdefault(comm.community_id, []).append(result)
            # Create beds for this unit
            unit_beds = []
            for label, rent, rtype in bed_rents:
                bed = _try_add(db, Bed(
                    unit_id=result.unit_id,
                    bed_label=label,
                    monthly_rent=rent,
                    rent_type=rtype,
                    status=BedStatus.available,
                ))
                if bed:
                    unit_beds.append(bed)
            bed_map[result.unit_id] = unit_beds

    total_units = sum(len(v) for v in unit_map.values())
    total_beds = sum(len(v) for v in bed_map.values())
    print(f"  {total_units} units, {total_beds} beds ready")

    # ── Residents ──────────────────────────────────────────────────────
    print("Seeding residents …")
    resident_specs = [
        # (community_idx, unit_idx, bed_idx_in_unit, name, email, rent_type, move_in, meal_plan)
        (0, 0, 0, "Tom Clarke",    "resident1@example.ca", RentType.private_pay,          date(2022, 3, 1), True),
        (0, 0, 1, "Linda Park",    "linda@example.ca",     RentType.government_supported, date(2022, 5, 1), True),
        (0, 2, 0, "Michael Brown", "michael@example.ca",   RentType.private_pay,          date(2022, 7, 1), False),
        (1, 0, 0, "Grace Kim",     "grace@example.ca",     RentType.private_pay,          date(2022, 9, 1), True),
        (1, 1, 0, "Robert Davis",  "robert@example.ca",    RentType.private_pay,          date(2023, 1, 1), True),
        (2, 0, 0, "Emma Wilson",   "emma@example.ca",      RentType.private_pay,          date(2023, 3, 1), False),
        (2, 0, 1, "Noah Taylor",   "noah@example.ca",      RentType.private_pay,          date(2023, 5, 1), False),
    ]
    residents = []
    for ci, ui, bi, name, email, rtype, move_in, meal in resident_specs:
        comm = communities[ci]
        if not comm:
            residents.append(None)
            continue
        comm_units = unit_map.get(comm.community_id, [])
        if ui >= len(comm_units) or not comm_units[ui]:
            residents.append(None)
            continue
        unit = comm_units[ui]
        unit_beds = bed_map.get(unit.unit_id, [])
        bed = unit_beds[bi] if bi < len(unit_beds) else None

        existing = db.query(Resident).filter(Resident.email == email).first()
        if existing:
            residents.append(existing)
            continue
        r = Resident(
            community_id=comm.community_id,
            unit_id=unit.unit_id,
            bed_id=bed.bed_id if bed else None,
            full_name=name,
            email=email,
            bed_number=bed.bed_label if bed else "1",
            rent_type=rtype,
            move_in_date=move_in,
            enrolled_meal_plan=meal,
        )
        result = _try_add(db, r)
        if result:
            unit.is_occupied = True
            if bed:
                bed.status = BedStatus.occupied
            db.commit()
        residents.append(result or db.query(Resident).filter(Resident.email == email).first())
    print(f"  {len([r for r in residents if r])} residents ready")

    # ── Rent Payments ──────────────────────────────────────────────────
    print("Seeding rent payments …")
    now = datetime.utcnow()
    payment_count = 0
    for resident in residents:
        if not resident:
            continue
        existing = db.query(RentPayment).filter(
            RentPayment.resident_id == resident.resident_id
        ).count()
        if existing > 0:
            continue
        # Get the bed rent amount
        bed = db.query(Bed).filter(Bed.bed_id == resident.bed_id).first() if resident.bed_id else None
        amount = bed.monthly_rent if bed else Decimal("1500")
        # Add meal plan cost if enrolled
        meal_included = False
        if resident.enrolled_meal_plan:
            comm = db.query(Community).filter(
                Community.community_id == resident.community_id
            ).first()
            if comm and comm.meal_plan_monthly_cost:
                amount += comm.meal_plan_monthly_cost
                meal_included = True

        for months_ago in range(3, 0, -1):
            pay_date = now - timedelta(days=months_ago * 30)
            rp = RentPayment(
                resident_id=resident.resident_id,
                bed_id=resident.bed_id,
                amount=amount,
                payment_date=pay_date,
                period_month=pay_date.month,
                period_year=pay_date.year,
                status=PaymentStatus.paid,
                includes_meal_plan=meal_included,
            )
            p = _try_add(db, rp)
            if p:
                payment_count += 1
    print(f"  {payment_count} payments seeded")

    # ── Maintenance Requests ───────────────────────────────────────────
    print("Seeding maintenance requests …")
    maint_specs = [
        (props[0], None, "HVAC unit in room 101 making loud noise", MaintenanceStatus.resolved,
         datetime.utcnow() - timedelta(days=45), datetime.utcnow() - timedelta(days=40)),
        (props[0], None, "Leaking faucet in unit 202 bathroom", MaintenanceStatus.resolved,
         datetime.utcnow() - timedelta(days=20), datetime.utcnow() - timedelta(days=18)),
        (props[1], None, "Elevator requires annual inspection", MaintenanceStatus.in_progress,
         datetime.utcnow() - timedelta(days=10), None),
        (props[0], None, "Common area carpet cleaning needed", MaintenanceStatus.open,
         datetime.utcnow() - timedelta(days=3), None),
        (props[1], None, "Parking lot lighting replacement", MaintenanceStatus.open,
         datetime.utcnow() - timedelta(days=1), None),
    ]
    for prop, res, desc, mstatus, created, resolved in maint_specs:
        if not prop:
            continue
        existing = db.query(MaintenanceRequest).filter(
            MaintenanceRequest.property_id == prop.property_id,
            MaintenanceRequest.description == desc,
        ).first()
        if existing:
            continue
        _try_add(db, MaintenanceRequest(
            property_id=prop.property_id,
            resident_id=None,
            description=desc,
            status=mstatus,
            created_at=created,
            resolved_at=resolved,
        ))
    print("  maintenance requests ready")

    # ── Investors ──────────────────────────────────────────────────────
    print("Seeding investors …")
    investor_map = {}
    for email, user_email, name, accredited, pref_return in [
        ("sarah.mitchell@investors.ca", "investor1@example.ca", "Sarah Mitchell", "accredited", Decimal("8.00")),
        ("david.nguyen@investors.ca",   "investor2@example.ca", "David Nguyen",   "accredited", Decimal("8.00")),
        ("wei.zhang@investors.ca",      None,                   "Wei Zhang",       "accredited", Decimal("10.00")),
    ]:
        existing = db.query(Investor).filter(Investor.email == email).first()
        if existing:
            investor_map[email] = existing
            continue
        linked_user = users.get(user_email) if user_email else None
        inv = Investor(
            user_id=linked_user.user_id if linked_user else None,
            name=name,
            email=email,
            accredited_status=accredited,
            preferred_return_rate=pref_return,
        )
        result = _try_add(db, inv)
        investor_map[email] = result or db.query(Investor).filter(Investor.email == email).first()
    print(f"  {len(investor_map)} investors ready")

    # ── Capital Contributions ──────────────────────────────────────────
    print("Seeding capital contributions …")
    contrib_count = 0
    contrib_specs = [
        ("sarah.mitchell@investors.ca", Decimal("500_000"), datetime(2021, 7, 1),  "Initial capital raise"),
        ("sarah.mitchell@investors.ca", Decimal("250_000"), datetime(2022, 3, 15), "Second tranche"),
        ("david.nguyen@investors.ca",   Decimal("350_000"), datetime(2021, 8, 1),  "Initial capital raise"),
        ("david.nguyen@investors.ca",   Decimal("150_000"), datetime(2022, 6, 1),  "Top-up"),
        ("wei.zhang@investors.ca",      Decimal("600_000"), datetime(2021, 7, 15), "Initial capital raise"),
    ]
    for inv_email, amount, dt, notes in contrib_specs:
        inv = investor_map.get(inv_email)
        if not inv:
            continue
        existing = db.query(CapitalContribution).filter(
            CapitalContribution.investor_id == inv.investor_id,
            CapitalContribution.amount == amount,
            CapitalContribution.notes == notes,
        ).first()
        if existing:
            continue
        result = _try_add(db, CapitalContribution(
            investor_id=inv.investor_id,
            amount=amount,
            date=dt,
            notes=notes,
        ))
        if result:
            contrib_count += 1
    print(f"  {contrib_count} contributions seeded")

    # ── Ownership ──────────────────────────────────────────────────────
    print("Seeding ownership …")
    ownership_specs = [
        # GP ownership
        ("sarah.mitchell@investors.ca", props[0], Decimal("5.00"), True),   # GP carry
        # LP ownership
        ("sarah.mitchell@investors.ca", props[0], Decimal("25.00"), False),
        ("sarah.mitchell@investors.ca", props[1], Decimal("20.00"), False),
        ("david.nguyen@investors.ca",   props[0], Decimal("15.00"), False),
        ("david.nguyen@investors.ca",   props[1], Decimal("10.00"), False),
        ("wei.zhang@investors.ca",      props[0], Decimal("30.00"), False),
        ("wei.zhang@investors.ca",      props[1], Decimal("25.00"), False),
    ]
    for inv_email, prop, pct, is_gp in ownership_specs:
        inv = investor_map.get(inv_email)
        if not inv or not prop:
            continue
        existing = db.query(Ownership).filter(
            Ownership.investor_id == inv.investor_id,
            Ownership.property_id == prop.property_id,
            Ownership.is_gp == is_gp,
        ).first()
        if not existing:
            _try_add(db, Ownership(
                investor_id=inv.investor_id,
                property_id=prop.property_id,
                ownership_percent=pct,
                is_gp=is_gp,
            ))
    print("  ownership records ready")

    # ── Distributions ──────────────────────────────────────────────────
    print("Seeding distributions …")
    dist_count = 0
    dist_specs = [
        ("sarah.mitchell@investors.ca", Decimal("18_750"), datetime(2022, 12, 31),
         DistributionMethod.etransfer, DistributionType.preferred_return, "Q4 2022 preferred return"),
        ("sarah.mitchell@investors.ca", Decimal("18_750"), datetime(2023, 6, 30),
         DistributionMethod.etransfer, DistributionType.preferred_return, "Q2 2023 preferred return"),
        ("sarah.mitchell@investors.ca", Decimal("8_000"), datetime(2023, 12, 31),
         DistributionMethod.etransfer, DistributionType.profit_share, "Q4 2023 profit share"),
        ("david.nguyen@investors.ca",   Decimal("12_500"), datetime(2022, 12, 31),
         DistributionMethod.wire, DistributionType.preferred_return, "Q4 2022 preferred return"),
        ("david.nguyen@investors.ca",   Decimal("12_500"), datetime(2023, 6, 30),
         DistributionMethod.wire, DistributionType.preferred_return, "Q2 2023 preferred return"),
        ("wei.zhang@investors.ca",      Decimal("22_500"), datetime(2022, 12, 31),
         DistributionMethod.ach, DistributionType.preferred_return, "Q4 2022 preferred return"),
        ("wei.zhang@investors.ca",      Decimal("22_500"), datetime(2023, 12, 31),
         DistributionMethod.ach, DistributionType.preferred_return, "Q4 2023 preferred return"),
    ]
    for inv_email, amount, dt, method, dtype, notes in dist_specs:
        inv = investor_map.get(inv_email)
        if not inv:
            continue
        existing = db.query(Distribution).filter(
            Distribution.investor_id == inv.investor_id,
            Distribution.amount == amount,
            Distribution.notes == notes,
        ).first()
        if existing:
            continue
        result = _try_add(db, Distribution(
            investor_id=inv.investor_id,
            amount=amount,
            payment_date=dt,
            method=method,
            distribution_type=dtype,
            notes=notes,
        ))
        if result:
            dist_count += 1
    print(f"  {dist_count} distributions seeded")

    db.close()
    print("\nSeed complete.")
    print("\nDemo accounts (all passwords: Password1!)")
    print("  admin@livingwell.ca       — GP Admin (full access)")
    print("  ops@livingwell.ca         — Operations Manager")
    print("  pm@livingwell.ca          — Property Manager")
    print("  investor1@example.ca      — Investor (Sarah Mitchell)")
    print("  investor2@example.ca      — Investor (David Nguyen)")
    print("  resident1@example.ca      — Resident (Tom Clarke)")


if __name__ == "__main__":
    run()
```

---

## Section G: Frontend Adjustments Required

The following frontend files reference `monthly_rent` on the `Unit` type, which has been removed. Claude should search for all occurrences and update them to either:
- Display the sum of bed rents for that unit (fetched via `/api/units/{unit_id}/beds`), or
- Remove the field from display temporarily and mark it with a `// TODO: fetch bed rents` comment

**Files likely affected** (search for `monthly_rent`):
- `livingwell-frontend/src/app/(dashboard)/communities/[id]/page.tsx`
- `livingwell-frontend/src/app/(dashboard)/communities/page.tsx`
- `livingwell-frontend/src/hooks/useCommunities.ts`

Also update any references to `DevelopmentStage` value `"operational"` to `"stabilized"` across the frontend.

---

## Section H: Verification Checklist

After completing all sections, verify the following:

1. **Delete old database and reseed:**
   ```bash
   cd backend
   rm -f livingwell_dev.db
   python seed.py
   ```
   Expected: All seed sections print "ready" with no errors.

2. **Start backend and check Swagger:**
   ```bash
   uvicorn app.main:app --reload
   ```
   Open `http://localhost:8000/docs` and verify:
   - `/api/portfolio/clusters` returns the Edmonton cluster
   - `/api/portfolio/properties` returns 5 Alberta properties
   - `/api/portfolio/properties/1/entities` returns 3 economic entities
   - `/api/community/units/1/beds` returns 2 beds
   - `/api/investor/investors` shows preferred_return_rate

3. **Start frontend and verify no TypeScript errors:**
   ```bash
   cd livingwell-frontend
   npm run dev
   ```
   The dashboard should load. Some data displays may show differently due to the `monthly_rent` removal — that is expected and will be addressed in Sprint 2.

4. **Commit and push:**
   ```bash
   git add -A
   git commit -m "Sprint 1: Enhanced data model — beds, clusters, economic entities, expanded enums"
   git push
   ```

---

## What Comes Next (Sprint 2 Preview)

Sprint 2 will be designed by Manus after reviewing the Sprint 1 implementation. It will focus on the **Construction Cost Estimation Engine** — building the structured cost calculator with Alberta-specific benchmarks, escalation modeling, and integration with the development plan data created in this sprint.
