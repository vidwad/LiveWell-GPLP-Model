"""
Portfolio Lifecycle Routes — Acquisition Baseline, Exit Forecast, Exit Actual
=============================================================================
Manages the three-version exit model:
  1. Original Underwritten (AcquisitionBaseline) — immutable once created
  2. Current Forecast (ExitForecast) — updated as GP view evolves
  3. Actual Realized (ExitActual) — filled during/after sale process
"""
from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as _BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_gp_or_ops, require_investor_or_above
from app.db.models import (
    AcquisitionBaseline, ExitForecast, ExitActual, Property, User,
    DebtFacility, DebtStatus, DevelopmentPlan,
)
from app.db.session import get_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dec(val) -> float | None:
    if val is None:
        return None
    return float(val)


def _parse_dates(data: dict, date_fields: list[str]) -> dict:
    """Convert string date fields to Python date objects for SQLAlchemy."""
    from datetime import date as _date
    for field in date_fields:
        if field in data and isinstance(data[field], str):
            try:
                data[field] = _date.fromisoformat(data[field])
            except (ValueError, TypeError):
                data.pop(field, None)
    return data


def _serialize_model(obj, model_cls) -> dict:
    """Generic serializer that handles Decimal, datetime, date, and enum values."""
    from datetime import date as _date
    result = {}
    for c in model_cls.__table__.columns:
        val = getattr(obj, c.name)
        if isinstance(val, Decimal):
            result[c.name] = float(val)
        elif isinstance(val, datetime):
            result[c.name] = val.isoformat()
        elif isinstance(val, _date):
            result[c.name] = str(val)
        elif hasattr(val, 'value'):  # enum
            result[c.name] = val.value
        else:
            result[c.name] = val
    return result


def _baseline_out(b: AcquisitionBaseline) -> dict:
    return _serialize_model(b, AcquisitionBaseline)


def _forecast_out(f: ExitForecast) -> dict:
    return _serialize_model(f, ExitForecast)


def _actual_out(a: ExitActual) -> dict:
    return _serialize_model(a, ExitActual)


# ---------------------------------------------------------------------------
# Acquisition Baseline
# ---------------------------------------------------------------------------

class AcquisitionBaselineCreate(_BaseModel):
    purchase_price: float | None = None
    purchase_date: str | None = None
    closing_costs: float | None = None
    total_acquisition_cost: float | None = None
    initial_equity: float | None = None
    initial_debt: float | None = None
    acquisition_noi: float | None = None
    acquisition_cap_rate: float | None = None
    acquisition_occupancy_pct: float | None = None
    target_hold_years: int | None = None
    target_sale_year: int | None = None
    earliest_sale_date: str | None = None
    latest_sale_date: str | None = None
    original_exit_cap_rate: float | None = None
    original_exit_noi: float | None = None
    original_selling_cost_pct: float | None = 5.0
    original_sale_price: float | None = None
    original_net_proceeds: float | None = None
    target_irr: float | None = None
    target_equity_multiple: float | None = None
    intended_disposition_type: str | None = None
    notes: str | None = None


@router.get("/properties/{property_id}/acquisition-baseline")
def get_acquisition_baseline(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """Get the acquisition baseline for a property. Returns null fields if not yet created."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    baseline = db.query(AcquisitionBaseline).filter(
        AcquisitionBaseline.property_id == property_id
    ).first()

    if not baseline:
        # Return auto-populated defaults from property data
        total_debt = sum(
            float(d.outstanding_balance or d.commitment_amount or 0)
            for d in db.query(DebtFacility).filter(
                DebtFacility.property_id == property_id,
                DebtFacility.development_plan_id.is_(None),
            ).all()
        )
        return {
            "exists": False,
            "property_id": property_id,
            "purchase_price": _dec(prop.purchase_price),
            "purchase_date": str(prop.purchase_date) if prop.purchase_date else None,
            "initial_debt": round(total_debt, 2) if total_debt > 0 else None,
            "initial_equity": round(float(prop.purchase_price or 0) - total_debt, 2) if prop.purchase_price else None,
        }

    return {"exists": True, **_baseline_out(baseline)}


@router.post("/properties/{property_id}/acquisition-baseline", status_code=status.HTTP_201_CREATED)
def create_acquisition_baseline(
    property_id: int,
    payload: AcquisitionBaselineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Create or replace the acquisition baseline for a property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    existing = db.query(AcquisitionBaseline).filter(
        AcquisitionBaseline.property_id == property_id
    ).first()

    data = payload.model_dump(exclude_none=True)
    data["property_id"] = property_id
    data["created_by"] = current_user.user_id

    # Convert date strings to date objects
    _parse_dates(data, ["purchase_date", "earliest_sale_date", "latest_sale_date"])

    # Auto-calc total acquisition cost
    if "total_acquisition_cost" not in data and "purchase_price" in data:
        data["total_acquisition_cost"] = (data.get("purchase_price") or 0) + (data.get("closing_costs") or 0)

    # Auto-calc original sale price from NOI/cap
    if "original_sale_price" not in data and data.get("original_exit_noi") and data.get("original_exit_cap_rate"):
        cap = data["original_exit_cap_rate"]
        if cap > 0:
            data["original_sale_price"] = round(data["original_exit_noi"] / (cap / 100), 2)

    if existing:
        for k, v in data.items():
            if k not in ("property_id", "baseline_id"):
                setattr(existing, k, v)
    else:
        existing = AcquisitionBaseline(**data)
        db.add(existing)

    # Mirror canonical acquisition fields back to the Property row so that
    # other tabs/endpoints reading Property.purchase_price stay in sync.
    if "purchase_price" in data:
        prop.purchase_price = data["purchase_price"]
    if "purchase_date" in data:
        prop.purchase_date = data["purchase_date"]
    if "closing_costs" in data and hasattr(prop, "closing_costs"):
        prop.closing_costs = data["closing_costs"]

    db.commit()
    db.refresh(existing)
    return {"exists": True, **_baseline_out(existing)}


# ---------------------------------------------------------------------------
# Exit Forecast
# ---------------------------------------------------------------------------

class ExitForecastUpdate(_BaseModel):
    sale_status: str | None = None
    forecast_sale_year: int | None = None
    forecast_sale_date: str | None = None
    forecast_exit_noi: float | None = None
    forecast_exit_cap_rate: float | None = None
    forecast_sale_price: float | None = None
    forecast_selling_cost_pct: float | None = None
    forecast_selling_costs: float | None = None
    forecast_debt_payoff: float | None = None
    forecast_mortgage_prepayment: float | None = None
    forecast_net_proceeds: float | None = None
    forecast_irr: float | None = None
    forecast_equity_multiple: float | None = None
    planned_disposition_type: str | None = None
    planned_sale_condition: str | None = None
    min_occupancy_threshold_pct: float | None = None
    required_trailing_months: int | None = None
    outstanding_capex_items: str | None = None
    unresolved_leasing_issues: str | None = None
    notes: str | None = None


@router.get("/properties/{property_id}/exit-forecast")
def get_exit_forecast(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    forecast = db.query(ExitForecast).filter(ExitForecast.property_id == property_id).first()
    if not forecast:
        return {"exists": False, "property_id": property_id}

    return {"exists": True, **_forecast_out(forecast)}


@router.put("/properties/{property_id}/exit-forecast")
def upsert_exit_forecast(
    property_id: int,
    payload: ExitForecastUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Create or update the exit forecast."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    forecast = db.query(ExitForecast).filter(ExitForecast.property_id == property_id).first()
    data = payload.model_dump(exclude_none=True)
    _parse_dates(data, ["forecast_sale_date"])

    # Auto-calc sale price from NOI/cap if not provided
    if "forecast_sale_price" not in data and data.get("forecast_exit_noi") and data.get("forecast_exit_cap_rate"):
        cap = data["forecast_exit_cap_rate"]
        if cap > 0:
            data["forecast_sale_price"] = round(data["forecast_exit_noi"] / (cap / 100), 2)

    # Auto-calc selling costs
    if "forecast_selling_costs" not in data and data.get("forecast_sale_price") and data.get("forecast_selling_cost_pct"):
        data["forecast_selling_costs"] = round(
            data["forecast_sale_price"] * data["forecast_selling_cost_pct"] / 100, 2
        )

    # Auto-calc net proceeds
    if "forecast_net_proceeds" not in data and data.get("forecast_sale_price"):
        costs = data.get("forecast_selling_costs") or 0
        payoff = data.get("forecast_debt_payoff") or 0
        prepay = data.get("forecast_mortgage_prepayment") or 0
        data["forecast_net_proceeds"] = round(data["forecast_sale_price"] - costs - payoff - prepay, 2)

    data["updated_by"] = current_user.user_id

    if forecast:
        for k, v in data.items():
            if k not in ("property_id", "forecast_id"):
                setattr(forecast, k, v)
        db.commit()
        db.refresh(forecast)
        return {"exists": True, **_forecast_out(forecast)}
    else:
        forecast = ExitForecast(property_id=property_id, **data)
        db.add(forecast)
        db.commit()
        db.refresh(forecast)
        return {"exists": True, **_forecast_out(forecast)}


# ---------------------------------------------------------------------------
# Exit Actual
# ---------------------------------------------------------------------------

class ExitActualUpdate(_BaseModel):
    listing_date: str | None = None
    broker_name: str | None = None
    offer_date: str | None = None
    contract_date: str | None = None
    close_date: str | None = None
    actual_sale_price: float | None = None
    actual_selling_costs: float | None = None
    actual_mortgage_payout: float | None = None
    actual_mortgage_prepayment_penalty: float | None = None
    actual_net_proceeds: float | None = None
    actual_exit_noi: float | None = None
    actual_exit_occupancy_pct: float | None = None
    actual_exit_cap_rate: float | None = None
    total_equity_invested: float | None = None
    total_interim_distributions: float | None = None
    total_refinance_proceeds: float | None = None
    total_sale_proceeds: float | None = None
    total_lp_distributions: float | None = None
    realized_irr: float | None = None
    realized_equity_multiple: float | None = None
    notes: str | None = None


@router.get("/properties/{property_id}/exit-actual")
def get_exit_actual(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    actual = db.query(ExitActual).filter(ExitActual.property_id == property_id).first()
    if not actual:
        return {"exists": False, "property_id": property_id}

    return {"exists": True, **_actual_out(actual)}


@router.put("/properties/{property_id}/exit-actual")
def upsert_exit_actual(
    property_id: int,
    payload: ExitActualUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Create or update the exit actual record."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    actual = db.query(ExitActual).filter(ExitActual.property_id == property_id).first()
    data = payload.model_dump(exclude_none=True)
    _parse_dates(data, ["listing_date", "offer_date", "contract_date", "close_date"])

    # Auto-calc net proceeds
    if "actual_net_proceeds" not in data and data.get("actual_sale_price"):
        costs = data.get("actual_selling_costs") or 0
        payout = data.get("actual_mortgage_payout") or 0
        prepay = data.get("actual_mortgage_prepayment_penalty") or 0
        data["actual_net_proceeds"] = round(data["actual_sale_price"] - costs - payout - prepay, 2)

    # Auto-calc implied exit cap rate
    if "actual_exit_cap_rate" not in data and data.get("actual_sale_price") and data.get("actual_exit_noi"):
        price = data["actual_sale_price"]
        if price > 0:
            data["actual_exit_cap_rate"] = round(data["actual_exit_noi"] / price * 100, 2)

    # Auto-calc total LP distributions
    if "total_lp_distributions" not in data:
        interim = data.get("total_interim_distributions") or (float(actual.total_interim_distributions or 0) if actual else 0)
        refi = data.get("total_refinance_proceeds") or (float(actual.total_refinance_proceeds or 0) if actual else 0)
        sale = data.get("total_sale_proceeds") or data.get("actual_net_proceeds") or (float(actual.total_sale_proceeds or 0) if actual else 0)
        total = interim + refi + sale
        if total > 0:
            data["total_lp_distributions"] = round(total, 2)

    # Auto-calc equity multiple
    if "realized_equity_multiple" not in data and data.get("total_lp_distributions"):
        equity = data.get("total_equity_invested") or (float(actual.total_equity_invested or 0) if actual else 0)
        if equity > 0:
            data["realized_equity_multiple"] = round(data["total_lp_distributions"] / equity, 4)

    if actual:
        for k, v in data.items():
            if k not in ("property_id", "actual_id"):
                setattr(actual, k, v)
        db.commit()
        db.refresh(actual)
        return {"exists": True, **_actual_out(actual)}
    else:
        actual = ExitActual(property_id=property_id, **data)
        db.add(actual)
        db.commit()
        db.refresh(actual)
        return {"exists": True, **_actual_out(actual)}


# ---------------------------------------------------------------------------
# Exit Variance — computed endpoint comparing all three versions
# ---------------------------------------------------------------------------

@router.get("/properties/{property_id}/exit-variance")
def get_exit_variance(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """Compare underwritten vs forecast vs actual exit metrics."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    baseline = db.query(AcquisitionBaseline).filter(AcquisitionBaseline.property_id == property_id).first()
    forecast = db.query(ExitForecast).filter(ExitForecast.property_id == property_id).first()
    actual = db.query(ExitActual).filter(ExitActual.property_id == property_id).first()

    def _row(label: str, uw_val, fc_val, ac_val):
        uw = _dec(uw_val)
        fc = _dec(fc_val)
        ac = _dec(ac_val)
        return {
            "label": label,
            "underwritten": uw,
            "forecast": fc,
            "actual": ac,
            "variance_fc_vs_uw": round(fc - uw, 2) if fc is not None and uw is not None else None,
            "variance_ac_vs_uw": round(ac - uw, 2) if ac is not None and uw is not None else None,
        }

    rows = [
        _row("Sale Year",
             baseline.target_sale_year if baseline else None,
             forecast.forecast_sale_year if forecast else None,
             actual.close_date.year if actual and actual.close_date else None),
        _row("Exit NOI",
             baseline.original_exit_noi if baseline else None,
             forecast.forecast_exit_noi if forecast else None,
             actual.actual_exit_noi if actual else None),
        _row("Exit Cap Rate (%)",
             baseline.original_exit_cap_rate if baseline else None,
             forecast.forecast_exit_cap_rate if forecast else None,
             actual.actual_exit_cap_rate if actual else None),
        _row("Gross Sale Price",
             baseline.original_sale_price if baseline else None,
             forecast.forecast_sale_price if forecast else None,
             actual.actual_sale_price if actual else None),
        _row("Selling Costs",
             None,  # not on baseline as absolute
             forecast.forecast_selling_costs if forecast else None,
             actual.actual_selling_costs if actual else None),
        _row("Debt Payoff",
             None,
             forecast.forecast_debt_payoff if forecast else None,
             actual.actual_mortgage_payout if actual else None),
        _row("Net Sale Proceeds",
             baseline.original_net_proceeds if baseline else None,
             forecast.forecast_net_proceeds if forecast else None,
             actual.actual_net_proceeds if actual else None),
        _row("IRR",
             baseline.target_irr if baseline else None,
             forecast.forecast_irr if forecast else None,
             actual.realized_irr if actual else None),
        _row("Equity Multiple",
             baseline.target_equity_multiple if baseline else None,
             forecast.forecast_equity_multiple if forecast else None,
             actual.realized_equity_multiple if actual else None),
    ]

    return {
        "property_id": property_id,
        "has_baseline": baseline is not None,
        "has_forecast": forecast is not None,
        "has_actual": actual is not None,
        "sale_status": forecast.sale_status.value if forecast and forecast.sale_status else None,
        "rows": rows,
    }
