# Sprint 3 — Investor Portal Enhancement

**Status:** Ready for implementation
**Assigned to:** Claude (local development)
**Reviewed by:** Manus
**Date:** 2026-03-11

---

## Overview

This sprint enhances the Investor Portal by adding the **LP Waterfall Distribution Engine**, **Document Management**, and **Secure Messaging**. 

The waterfall engine implements a standard 3-tier real estate distribution model:
1. **Tier 1:** Return of Capital + 8% Preferred Return to LPs
2. **Tier 2:** GP Catch-up (100% to GP until 80/20 split is achieved)
3. **Tier 3:** 80/20 LP/GP split for remaining profits

We will also add database models for Investor Documents (K-1s, Subscription Agreements) and Messages, and update the frontend to display these new features.

**Prerequisite:** This sprint assumes Sprint 1 and Sprint 2 have been fully implemented.

---

## Important Instructions for Claude

1. **Work in order.** Complete each section (A through F) sequentially.
2. **Use the exact code provided.** Do not paraphrase or simplify the calculation logic.
3. **Delete and recreate the SQLite database** after making model changes (`rm -f backend/livingwell_dev.db && cd backend && python seed.py`).
4. **Test the backend** by starting the server (`uvicorn app.main:app --reload`) and hitting the new endpoints via Swagger (`/docs`).

---

## Section A: New Database Models

**File:** `backend/app/db/models.py`

1. Add the `DocumentType` enum to the Enumerations section (around line 50):

```python
class DocumentType(str, enum.Enum):
    subscription_agreement = "subscription_agreement"
    partnership_agreement = "partnership_agreement"
    tax_form = "tax_form"
    quarterly_report = "quarterly_report"
    capital_call = "capital_call"
    distribution_notice = "distribution_notice"
    other = "other"
```

2. Add the new models to the bottom of the file (under the Investor section):

```python
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
```

3. Update the `Investor` model to include the new relationships:

```python
    # Add these to the Investor class:
    documents = relationship(
        "InvestorDocument", back_populates="investor", cascade="all, delete-orphan"
    )
    messages = relationship(
        "InvestorMessage", back_populates="investor", cascade="all, delete-orphan"
    )
```

---

## Section B: Waterfall Distribution Service

**File:** `backend/app/services/waterfall.py` (Create this new file)

Create a new file for the waterfall calculation logic:

```python
from decimal import Decimal, ROUND_HALF_UP
from typing import TypedDict

class WaterfallResult(TypedDict):
    total_distribution: Decimal
    lp_distribution: Decimal
    gp_distribution: Decimal
    tier_1_lp: Decimal
    tier_1_gp: Decimal
    tier_2_lp: Decimal
    tier_2_gp: Decimal
    tier_3_lp: Decimal
    tier_3_gp: Decimal
    unpaid_pref_balance: Decimal
    unreturned_capital: Decimal

class WaterfallEngine:
    """
    Calculates GP/LP distributions based on a 3-tier waterfall structure:
    Tier 1: Return of Capital + 8% Preferred Return (100% to LP)
    Tier 2: GP Catch-up (100% to GP until 80/20 split achieved)
    Tier 3: 80/20 LP/GP Split
    """
    
    @staticmethod
    def calculate_distribution(
        distributable_cash: Decimal,
        unreturned_capital: Decimal,
        unpaid_pref_balance: Decimal,
        pref_rate: Decimal = Decimal("0.08"),
        gp_promote_share: Decimal = Decimal("0.20")
    ) -> WaterfallResult:
        
        remaining_cash = distributable_cash
        
        # Initialize buckets
        tier_1_lp = Decimal("0")
        tier_1_gp = Decimal("0")
        tier_2_lp = Decimal("0")
        tier_2_gp = Decimal("0")
        tier_3_lp = Decimal("0")
        tier_3_gp = Decimal("0")
        
        # ---------------------------------------------------------
        # Tier 1: Return of Capital + Preferred Return (100% to LP)
        # ---------------------------------------------------------
        tier_1_hurdle = unreturned_capital + unpaid_pref_balance
        
        if remaining_cash <= tier_1_hurdle:
            tier_1_lp = remaining_cash
            remaining_cash = Decimal("0")
            
            # Pay down pref first, then capital
            if tier_1_lp <= unpaid_pref_balance:
                unpaid_pref_balance -= tier_1_lp
            else:
                capital_paydown = tier_1_lp - unpaid_pref_balance
                unpaid_pref_balance = Decimal("0")
                unreturned_capital -= capital_paydown
        else:
            tier_1_lp = tier_1_hurdle
            remaining_cash -= tier_1_hurdle
            unpaid_pref_balance = Decimal("0")
            unreturned_capital = Decimal("0")
            
        # ---------------------------------------------------------
        # Tier 2: GP Catch-up (100% to GP until split achieved)
        # ---------------------------------------------------------
        if remaining_cash > 0:
            # How much does GP need to catch up to the promote share?
            # If GP gets 20% of total profits, GP = 0.2 * (LP_Profits + GP_Profits)
            # GP = (0.2 / 0.8) * LP_Profits
            
            lp_profits_so_far = tier_1_lp - unreturned_capital # Only pref is profit
            if lp_profits_so_far < 0:
                lp_profits_so_far = Decimal("0")
                
            target_gp_catchup = lp_profits_so_far * (gp_promote_share / (Decimal("1") - gp_promote_share))
            
            if remaining_cash <= target_gp_catchup:
                tier_2_gp = remaining_cash
                remaining_cash = Decimal("0")
            else:
                tier_2_gp = target_gp_catchup
                remaining_cash -= target_gp_catchup
                
        # ---------------------------------------------------------
        # Tier 3: 80/20 Split
        # ---------------------------------------------------------
        if remaining_cash > 0:
            tier_3_gp = remaining_cash * gp_promote_share
            tier_3_lp = remaining_cash - tier_3_gp
            
        # ---------------------------------------------------------
        # Summarize
        # ---------------------------------------------------------
        lp_total = tier_1_lp + tier_2_lp + tier_3_lp
        gp_total = tier_1_gp + tier_2_gp + tier_3_gp
        
        return {
            "total_distribution": distributable_cash.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "lp_distribution": lp_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "gp_distribution": gp_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_1_lp": tier_1_lp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_1_gp": tier_1_gp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_2_lp": tier_2_lp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_2_gp": tier_2_gp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_3_lp": tier_3_lp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_3_gp": tier_3_gp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "unpaid_pref_balance": unpaid_pref_balance.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "unreturned_capital": unreturned_capital.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        }
```

---

## Section C: New Pydantic Schemas

**File:** `backend/app/schemas/investor.py`

Add the following new schemas to the bottom of the file:

```python
from app.db.models import DocumentType

# ---------------------------------------------------------------------------
# Documents & Messages
# ---------------------------------------------------------------------------

class DocumentCreate(BaseModel):
    title: str
    document_type: DocumentType
    file_url: str

class DocumentOut(BaseModel):
    document_id: int
    investor_id: int
    title: str
    document_type: DocumentType
    file_url: str
    upload_date: datetime.datetime
    is_viewed: bool

    model_config = {"from_attributes": True}

class MessageCreate(BaseModel):
    subject: str
    body: str

class MessageOut(BaseModel):
    message_id: int
    investor_id: int
    sender_id: int
    subject: str
    body: str
    sent_at: datetime.datetime
    is_read: bool

    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# Waterfall
# ---------------------------------------------------------------------------

class WaterfallInput(BaseModel):
    distributable_cash: Decimal
    unreturned_capital: Decimal
    unpaid_pref_balance: Decimal
    pref_rate: Decimal = Decimal("0.08")
    gp_promote_share: Decimal = Decimal("0.20")

class WaterfallResultSchema(BaseModel):
    total_distribution: Decimal
    lp_distribution: Decimal
    gp_distribution: Decimal
    tier_1_lp: Decimal
    tier_1_gp: Decimal
    tier_2_lp: Decimal
    tier_2_gp: Decimal
    tier_3_lp: Decimal
    tier_3_gp: Decimal
    unpaid_pref_balance: Decimal
    unreturned_capital: Decimal

# Update InvestorDashboard to include documents and messages
class InvestorDashboard(BaseModel):
    investor: InvestorOut
    total_contributed: Decimal
    total_distributed: Decimal
    net_position: Decimal
    ownership_positions: list[OwnershipOut]
    recent_distributions: list[DistributionOut]
    documents: list[DocumentOut] = []
    messages: list[MessageOut] = []
```

---

## Section D: New API Endpoints

**File:** `backend/app/routes/investor.py`

1. **Update imports** at the top:

```python
import datetime
# Add to existing schemas imports:
from app.schemas.investor import (
    # ... existing ...
    DocumentCreate, DocumentOut,
    MessageCreate, MessageOut,
    WaterfallInput, WaterfallResultSchema
)
from app.services.waterfall import WaterfallEngine
from app.db.models import InvestorDocument, InvestorMessage
```

2. **Update `_build_dashboard`** to include documents and messages:

```python
def _build_dashboard(inv: Investor) -> InvestorDashboard:
    total_contributed = sum((c.amount for c in inv.contributions), Decimal(0))
    total_distributed = sum((d.amount for d in inv.distributions), Decimal(0))
    recent_distributions = sorted(inv.distributions, key=lambda d: d.payment_date, reverse=True)[:5]
    
    # Sort documents and messages
    docs = sorted(inv.documents, key=lambda x: x.upload_date, reverse=True)
    msgs = sorted(inv.messages, key=lambda x: x.sent_at, reverse=True)
    
    return InvestorDashboard(
        investor=InvestorOut.model_validate(inv),
        total_contributed=total_contributed,
        total_distributed=total_distributed,
        net_position=total_contributed - total_distributed,
        ownership_positions=[OwnershipOut.model_validate(o) for o in inv.ownership_positions],
        recent_distributions=[DistributionOut.model_validate(d) for d in recent_distributions],
        documents=[DocumentOut.model_validate(doc) for doc in docs],
        messages=[MessageOut.model_validate(msg) for msg in msgs],
    )
```

3. **Add new endpoints** at the bottom of the file:

```python
# ---------------------------------------------------------------------------
# Documents & Messages
# ---------------------------------------------------------------------------

@router.post("/investors/{investor_id}/documents", response_model=DocumentOut)
def upload_document(
    investor_id: int,
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    _get_investor_or_404(investor_id, db)
    doc = InvestorDocument(
        investor_id=investor_id,
        upload_date=datetime.datetime.utcnow(),
        **payload.model_dump()
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

@router.post("/investors/{investor_id}/messages", response_model=MessageOut)
def send_message(
    investor_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    _get_investor_or_404(investor_id, db)
    msg = InvestorMessage(
        investor_id=investor_id,
        sender_id=current_user.user_id,
        sent_at=datetime.datetime.utcnow(),
        **payload.model_dump()
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

# ---------------------------------------------------------------------------
# Waterfall Engine
# ---------------------------------------------------------------------------

@router.post("/waterfall/calculate", response_model=WaterfallResultSchema)
def calculate_waterfall(
    payload: WaterfallInput,
    _: User = Depends(require_gp_or_ops),
):
    """
    Calculate GP/LP distribution split based on waterfall tiers.
    """
    result = WaterfallEngine.calculate_distribution(
        distributable_cash=payload.distributable_cash,
        unreturned_capital=payload.unreturned_capital,
        unpaid_pref_balance=payload.unpaid_pref_balance,
        pref_rate=payload.pref_rate,
        gp_promote_share=payload.gp_promote_share
    )
    return result
```

---

## Section E: Frontend Types Update

**File:** `livingwell-frontend/src/types/investor.ts`

Add the new types:

```typescript
export type DocumentType = "subscription_agreement" | "partnership_agreement" | "tax_form" | "quarterly_report" | "capital_call" | "distribution_notice" | "other";

export interface Document {
  document_id: number;
  investor_id: number;
  title: string;
  document_type: DocumentType;
  file_url: string;
  upload_date: string;
  is_viewed: boolean;
}

export interface Message {
  message_id: number;
  investor_id: number;
  sender_id: number;
  subject: string;
  body: string;
  sent_at: string;
  is_read: boolean;
}

// Update InvestorDashboard to include the new arrays
export interface InvestorDashboard {
  investor: Investor;
  total_contributed: string;
  total_distributed: string;
  net_position: string;
  ownership_positions: Ownership[];
  recent_distributions: Distribution[];
  documents: Document[];
  messages: Message[];
}

export interface WaterfallInput {
  distributable_cash: number;
  unreturned_capital: number;
  unpaid_pref_balance: number;
  pref_rate?: number;
  gp_promote_share?: number;
}

export interface WaterfallResult {
  total_distribution: string;
  lp_distribution: string;
  gp_distribution: string;
  tier_1_lp: string;
  tier_1_gp: string;
  tier_2_lp: string;
  tier_2_gp: string;
  tier_3_lp: string;
  tier_3_gp: string;
  unpaid_pref_balance: string;
  unreturned_capital: string;
}
```

---

## Section F: Verification Checklist

After completing all sections, verify the following:

1. **Rebuild Database:**
   ```bash
   cd backend
   rm -f livingwell_dev.db
   python seed.py
   ```

2. **Start backend and check Swagger:**
   ```bash
   uvicorn app.main:app --reload
   ```
   Open `http://localhost:8000/docs` and verify:
   - The `/api/investor/waterfall/calculate` endpoint exists.
   - Test it with `distributable_cash: 100000`, `unreturned_capital: 500000`, `unpaid_pref_balance: 40000`. It should return `tier_1_lp: 100000` and `unpaid_pref_balance: 0`, `unreturned_capital: 440000`.

3. **Commit and push:**
   ```bash
   git add -A
   git commit -m "Sprint 3: Investor Portal Enhancement (Waterfall, Docs, Messages)"
   git push
   ```

---

## What Comes Next (Sprint 4 Preview)

Sprint 4 will focus on the **AI Decision Layer** — moving beyond basic chat to assumption validation, compliance guidance, and market intelligence using structured OpenAI outputs.
