# Phase 2 Sprint 1: Scope-Based Filtering & Debt Facility Model

> **Status:** Ready for Claude  
> **Depends on:** Phase 1 Foundation Rebuild (complete)  
> **Estimated effort:** Medium  

## Overview

Phase 1 established the correct entity architecture (GP → LP → Subscription → Holding → Property). This sprint adds two critical capabilities:

1. **Scope-based data filtering** — Investors should only see properties/LPs they have subscriptions to
2. **Debt Facility model** — Properties need mortgage/construction loan tracking

---

## Section A — Scope-Based Property Filtering

The `ScopeAssignment` model and `require_scope` helper already exist in `deps.py`. This sprint wires them into the property listing endpoint so that INVESTOR-role users only see properties belonging to LPs they've subscribed to.

### File: `backend/app/routes/portfolio.py`

**Replace the `list_properties` function** with this version that filters by LP scope for investors:

```python
@router.get("/properties", response_model=list[PropertyOut])
def list_properties(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GP_ADMIN / OPERATIONS_MANAGER / PROPERTY_MANAGER: see all properties.
    INVESTOR: see only properties belonging to LPs they have subscriptions in.
    """
    from app.db.models import Property, LPEntity, Subscription, Investor

    if current_user.role in ("GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER"):
        props = db.query(Property).all()
    elif current_user.role == "INVESTOR":
        # Find the Investor record linked to this user
        investor = db.query(Investor).filter(Investor.user_id == current_user.user_id).first()
        if not investor:
            return []
        # Find LP IDs this investor has subscriptions in
        lp_ids = (
            db.query(Subscription.lp_id)
            .filter(Subscription.investor_id == investor.investor_id)
            .distinct()
            .all()
        )
        lp_id_list = [lp_id for (lp_id,) in lp_ids]
        props = db.query(Property).filter(Property.lp_id.in_(lp_id_list)).all()
    else:
        props = []

    results = []
    for p in props:
        data = PropertyOut.model_validate(p)
        if p.lp:
            data.lp_name = p.lp.name
        results.append(data)
    return results
```

### File: `backend/app/routes/investor.py`

**Update the `investor_dashboard` function** to also scope-filter for INVESTOR-role users. Currently it takes an `investor_id` parameter — add a check that the logged-in investor can only view their own dashboard:

```python
@router.get("/investors/{investor_id}/dashboard", response_model=InvestorDashboard)
def investor_dashboard(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    investor = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not investor:
        raise HTTPException(404, "Investor not found")

    # INVESTOR role can only view their own dashboard
    if current_user.role == "INVESTOR":
        if investor.user_id != current_user.user_id:
            raise HTTPException(403, "Access denied")

    # ... rest of the function remains the same
```

---

## Section B — Debt Facility Model

### File: `backend/app/db/models.py`

**Add the following model** after the `Holding` class:

```python
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
    debt_type = Column(Enum(DebtType), nullable=False)
    status = Column(Enum(DebtStatus), default=DebtStatus.pending)

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
```

**Add to the `Property` model** (in the relationships section):

```python
    debt_facilities = relationship("DebtFacility", back_populates="property", cascade="all, delete-orphan")
```

### File: `backend/app/schemas/portfolio.py`

**Add these schemas:**

```python
class DebtFacilityCreate(BaseModel):
    property_id: int
    lender_name: str
    debt_type: str
    commitment_amount: float
    interest_rate: float | None = None
    rate_type: str = "fixed"
    term_months: int | None = None
    amortization_months: int | None = None
    io_period_months: int = 0
    origination_date: str | None = None
    maturity_date: str | None = None
    ltv_covenant: float | None = None
    dscr_covenant: float | None = None
    notes: str | None = None

class DebtFacilityOut(BaseModel):
    debt_id: int
    property_id: int
    lender_name: str
    debt_type: str
    status: str
    commitment_amount: float
    drawn_amount: float
    outstanding_balance: float
    interest_rate: float | None
    rate_type: str
    term_months: int | None
    amortization_months: int | None
    io_period_months: int
    origination_date: str | None
    maturity_date: str | None
    ltv_covenant: float | None
    dscr_covenant: float | None
    notes: str | None
    created_at: str | None

    class Config:
        from_attributes = True
```

### File: `backend/app/routes/portfolio.py`

**Add these endpoints:**

```python
from app.db.models import DebtFacility

@router.post("/debt-facilities", response_model=DebtFacilityOut)
def create_debt_facility(
    payload: DebtFacilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    facility = DebtFacility(**payload.model_dump())
    db.add(facility)
    db.commit()
    db.refresh(facility)
    return facility

@router.get("/properties/{property_id}/debt", response_model=list[DebtFacilityOut])
def list_debt_facilities(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(DebtFacility).filter(DebtFacility.property_id == property_id).all()

@router.patch("/debt-facilities/{debt_id}", response_model=DebtFacilityOut)
def update_debt_facility(
    debt_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    facility = db.query(DebtFacility).filter(DebtFacility.debt_id == debt_id).first()
    if not facility:
        raise HTTPException(404, "Debt facility not found")
    for k, v in payload.items():
        if hasattr(facility, k):
            setattr(facility, k, v)
    db.commit()
    db.refresh(facility)
    return facility
```

### File: `livingwell-frontend/src/types/portfolio.ts`

**Add these types:**

```typescript
export interface DebtFacility {
  debt_id: number;
  property_id: number;
  lender_name: string;
  debt_type: string;
  status: string;
  commitment_amount: number;
  drawn_amount: number;
  outstanding_balance: number;
  interest_rate: number | null;
  rate_type: string;
  term_months: number | null;
  amortization_months: number | null;
  io_period_months: number;
  origination_date: string | null;
  maturity_date: string | null;
  ltv_covenant: number | null;
  dscr_covenant: number | null;
  notes: string | null;
  created_at: string | null;
}

export interface DebtFacilityCreate {
  property_id: number;
  lender_name: string;
  debt_type: string;
  commitment_amount: number;
  interest_rate?: number;
  rate_type?: string;
  term_months?: number;
  amortization_months?: number;
  io_period_months?: number;
  origination_date?: string;
  maturity_date?: string;
  ltv_covenant?: number;
  dscr_covenant?: number;
  notes?: string;
}
```

### File: `backend/seed.py`

**Add seed data for debt facilities** after the property creation section:

```python
    # ── Debt Facilities ──────────────────────────────────────
    debt1 = m.DebtFacility(
        property_id=prop1.property_id,
        lender_name="ATB Financial",
        debt_type=m.DebtType.permanent_mortgage,
        status=m.DebtStatus.active,
        commitment_amount=Decimal("2400000.00"),
        drawn_amount=Decimal("2400000.00"),
        outstanding_balance=Decimal("2350000.00"),
        interest_rate=Decimal("5.2500"),
        rate_type="fixed",
        term_months=60,
        amortization_months=300,
        io_period_months=0,
        origination_date=date(2024, 6, 1),
        maturity_date=date(2029, 6, 1),
        ltv_covenant=Decimal("75.00"),
        dscr_covenant=Decimal("1.25"),
    )
    debt2 = m.DebtFacility(
        property_id=prop2.property_id,
        lender_name="First National Financial",
        debt_type=m.DebtType.construction_loan,
        status=m.DebtStatus.active,
        commitment_amount=Decimal("3500000.00"),
        drawn_amount=Decimal("1200000.00"),
        outstanding_balance=Decimal("1200000.00"),
        interest_rate=Decimal("6.7500"),
        rate_type="variable",
        term_months=24,
        amortization_months=0,
        io_period_months=24,
        origination_date=date(2025, 1, 15),
        maturity_date=date(2027, 1, 15),
        ltv_covenant=Decimal("80.00"),
        dscr_covenant=None,
    )
    debt3 = m.DebtFacility(
        property_id=prop3.property_id,
        lender_name="CMHC MLI Select",
        debt_type=m.DebtType.permanent_mortgage,
        status=m.DebtStatus.pending,
        commitment_amount=Decimal("4000000.00"),
        drawn_amount=Decimal("0.00"),
        outstanding_balance=Decimal("0.00"),
        interest_rate=Decimal("4.8500"),
        rate_type="fixed",
        term_months=120,
        amortization_months=300,
        io_period_months=0,
        origination_date=None,
        maturity_date=None,
        ltv_covenant=Decimal("80.00"),
        dscr_covenant=Decimal("1.10"),
        notes="CMHC MLI Select program — pending approval",
    )
    db.add_all([debt1, debt2, debt3])
    db.commit()
    print("  ✓ Debt facilities")
```

---

## Section C — Verification Checklist

1. Delete and rebuild the database: `rm -f backend/livingwell_dev.db && cd backend && python seed.py`
2. Start the backend: `cd backend && uvicorn app.main:app --reload`
3. Login as admin: `POST /api/auth/login` with `admin@livingwell.ca` / `Password1!`
4. Test scope filtering:
   - Login as `investor1@example.com` / `Password1!`
   - `GET /api/portfolio/properties` — should only return properties belonging to LPs investor1 has subscriptions in
5. Test debt facilities:
   - `GET /api/portfolio/properties/1/debt` — should return ATB Financial mortgage
   - `POST /api/portfolio/debt-facilities` — create a new facility
6. Verify the investor dashboard self-access check:
   - Login as `investor1@example.com`
   - `GET /api/investor/investors/1/dashboard` — should work (own dashboard)
   - `GET /api/investor/investors/2/dashboard` — should return 403

---

## Notes for Claude

- The `require_gp_or_ops` dependency is already defined in `backend/app/core/deps.py`
- The `Property` model already has an `lp_id` foreign key and `lp` relationship
- The `Investor` model already has a `user_id` field linking to the User table
- Import `DebtFacility` in `models.py` alongside the other model imports
- Remember to import the new schemas in the routes file
