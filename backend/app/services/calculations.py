"""
Living Well Communities — Financial Calculation Engines
=======================================================
Pure functions that compute key real estate financial metrics.
All inputs are plain Python types; no database dependencies.
"""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
import math

try:
    import numpy_financial as npf
    _HAS_NPF = True
except ImportError:
    _HAS_NPF = False


def calculate_noi(
    gross_potential_revenue: float,
    vacancy_rate: float = 0.05,
    operating_expenses: float = 0.0,
    property_tax: float = 0.0,
    insurance: float = 0.0,
    management_fee_rate: float = 0.04,
    replacement_reserves: float = 0.0,
) -> dict:
    """
    Calculate Net Operating Income.

    Args:
        gross_potential_revenue: Total annual revenue if 100% occupied
        vacancy_rate: Expected vacancy as decimal (0.05 = 5%)
        operating_expenses: Annual operating expenses (utilities, repairs, etc.)
        property_tax: Annual property tax
        insurance: Annual insurance premium
        management_fee_rate: Management fee as % of effective gross income
        replacement_reserves: Annual capital reserve allocation

    Returns:
        Dict with line-item breakdown and final NOI
    """
    vacancy_loss = gross_potential_revenue * vacancy_rate
    effective_gross_income = gross_potential_revenue - vacancy_loss
    management_fee = effective_gross_income * management_fee_rate

    total_expenses = (
        operating_expenses
        + property_tax
        + insurance
        + management_fee
        + replacement_reserves
    )

    noi = effective_gross_income - total_expenses

    return {
        "gross_potential_revenue": round(gross_potential_revenue, 2),
        "vacancy_loss": round(vacancy_loss, 2),
        "vacancy_rate": round(vacancy_rate, 4),
        "effective_gross_income": round(effective_gross_income, 2),
        "operating_expenses": round(operating_expenses, 2),
        "property_tax": round(property_tax, 2),
        "insurance": round(insurance, 2),
        "management_fee": round(management_fee, 2),
        "management_fee_rate": round(management_fee_rate, 4),
        "replacement_reserves": round(replacement_reserves, 2),
        "total_expenses": round(total_expenses, 2),
        "noi": round(noi, 2),
    }


def calculate_dscr(
    noi: float,
    annual_debt_service: float,
) -> dict:
    """
    Calculate Debt Service Coverage Ratio.

    DSCR = NOI / Annual Debt Service
    - Above 1.25 is generally healthy
    - Below 1.0 means the property cannot cover its debt payments

    Args:
        noi: Net Operating Income (annual)
        annual_debt_service: Total annual debt payments (P&I)

    Returns:
        Dict with DSCR value and health assessment
    """
    if annual_debt_service <= 0:
        return {
            "noi": round(noi, 2),
            "annual_debt_service": 0.0,
            "dscr": None,
            "health": "no_debt",
            "message": "No debt service — property is unlevered",
        }

    dscr = noi / annual_debt_service

    if dscr >= 1.50:
        health = "strong"
    elif dscr >= 1.25:
        health = "healthy"
    elif dscr >= 1.10:
        health = "adequate"
    elif dscr >= 1.00:
        health = "tight"
    else:
        health = "distressed"

    return {
        "noi": round(noi, 2),
        "annual_debt_service": round(annual_debt_service, 2),
        "dscr": round(dscr, 4),
        "health": health,
        "message": f"DSCR of {dscr:.2f}x is {health}",
    }


def calculate_ltv(
    outstanding_debt: float,
    property_value: float,
) -> dict:
    """
    Calculate Loan-to-Value ratio.

    LTV = Outstanding Debt / Property Value
    - Below 65% is conservative
    - 65-75% is typical
    - Above 80% is high leverage

    Args:
        outstanding_debt: Total outstanding loan balance
        property_value: Current estimated property value

    Returns:
        Dict with LTV percentage and risk assessment
    """
    if property_value <= 0:
        return {
            "outstanding_debt": round(outstanding_debt, 2),
            "property_value": 0.0,
            "ltv_percent": None,
            "risk": "unknown",
            "message": "Property value not available",
        }

    ltv = (outstanding_debt / property_value) * 100

    if ltv <= 50:
        risk = "low"
    elif ltv <= 65:
        risk = "conservative"
    elif ltv <= 75:
        risk = "moderate"
    elif ltv <= 80:
        risk = "elevated"
    else:
        risk = "high"

    return {
        "outstanding_debt": round(outstanding_debt, 2),
        "property_value": round(property_value, 2),
        "ltv_percent": round(ltv, 2),
        "equity_percent": round(100 - ltv, 2),
        "equity_value": round(property_value - outstanding_debt, 2),
        "risk": risk,
        "message": f"LTV of {ltv:.1f}% — {risk} leverage",
    }


def calculate_annual_debt_service(
    outstanding_balance: float,
    annual_interest_rate: float,
    amortization_months: int,
    io_period_remaining_months: int = 0,
) -> float:
    """
    Calculate annual debt service (principal + interest).

    During IO period: interest only.
    After IO period: fully amortizing P&I.

    Args:
        outstanding_balance: Current loan balance
        annual_interest_rate: Annual rate as percentage (e.g. 5.25)
        amortization_months: Total amortization period in months
        io_period_remaining_months: Months remaining in IO period

    Returns:
        Annual debt service amount
    """
    if outstanding_balance <= 0 or annual_interest_rate <= 0:
        return 0.0

    monthly_rate = (annual_interest_rate / 100) / 12

    if io_period_remaining_months > 0:
        # Interest-only payment
        monthly_payment = outstanding_balance * monthly_rate
    elif amortization_months > 0:
        # Fully amortizing P&I
        monthly_payment = outstanding_balance * (
            monthly_rate * (1 + monthly_rate) ** amortization_months
        ) / ((1 + monthly_rate) ** amortization_months - 1)
    else:
        # Interest-only fallback
        monthly_payment = outstanding_balance * monthly_rate

    return round(monthly_payment * 12, 2)


def calculate_irr(
    cash_flows: list[float],
    guess: float = 0.10,
    max_iterations: int = 1000,
    tolerance: float = 1e-8,
) -> Optional[float]:
    """
    Calculate Internal Rate of Return using Newton's method.

    Args:
        cash_flows: List of cash flows. First element is typically negative (investment).
                    Subsequent elements are periodic returns.
        guess: Initial IRR guess (default 10%)
        max_iterations: Maximum Newton iterations
        tolerance: Convergence tolerance

    Returns:
        IRR as a decimal (0.15 = 15%), or None if it doesn't converge
    """
    if not cash_flows or len(cash_flows) < 2:
        return None

    rate = guess

    for _ in range(max_iterations):
        npv = sum(cf / (1 + rate) ** i for i, cf in enumerate(cash_flows))
        npv_derivative = sum(
            -i * cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cash_flows)
        )

        if abs(npv_derivative) < 1e-14:
            return None

        new_rate = rate - npv / npv_derivative

        if abs(new_rate - rate) < tolerance:
            return round(new_rate, 6)

        rate = new_rate

    return None


def calculate_cap_rate(noi: float, property_value: float) -> Optional[float]:
    """
    Calculate Capitalization Rate.

    Cap Rate = NOI / Property Value

    Returns:
        Cap rate as percentage (e.g. 6.5), or None if value is zero
    """
    if property_value <= 0:
        return None
    return round((noi / property_value) * 100, 2)


def calculate_cash_on_cash(
    annual_cash_flow_after_debt: float,
    total_equity_invested: float,
) -> Optional[float]:
    """
    Calculate Cash-on-Cash Return.

    CoC = Annual Cash Flow After Debt Service / Total Equity Invested

    Returns:
        Cash-on-cash as percentage, or None if no equity
    """
    if total_equity_invested <= 0:
        return None
    return round((annual_cash_flow_after_debt / total_equity_invested) * 100, 2)


def calculate_xirr(
    cash_flows: list[float],
    dates: list[date],
    guess: float = 0.10,
) -> Optional[float]:
    """
    Calculate Extended Internal Rate of Return (XIRR) using numpy-financial.

    XIRR accounts for irregular cash flow timing, unlike standard IRR which
    assumes equally spaced periods.

    Args:
        cash_flows: List of cash flows (negative = investment, positive = return)
        dates: Corresponding list of dates for each cash flow
        guess: Initial IRR guess

    Returns:
        XIRR as a decimal (0.15 = 15%), or None if not computable
    """
    if not _HAS_NPF:
        # Fallback to standard IRR if numpy-financial is unavailable
        return calculate_irr(cash_flows, guess)

    if len(cash_flows) < 2 or len(cash_flows) != len(dates):
        return None

    if not any(cf < 0 for cf in cash_flows) or not any(cf > 0 for cf in cash_flows):
        return None  # Need at least one outflow and one inflow

    try:
        # Convert dates to year fractions relative to first date
        t0 = dates[0]
        year_fracs = [(d - t0).days / 365.25 for d in dates]

        # Newton's method with year-fraction exponents
        rate = guess
        for _ in range(1000):
            npv = sum(cf / (1 + rate) ** t for cf, t in zip(cash_flows, year_fracs))
            npv_d = sum(
                -t * cf / (1 + rate) ** (t + 1)
                for cf, t in zip(cash_flows, year_fracs)
            )
            if abs(npv_d) < 1e-14:
                return None
            new_rate = rate - npv / npv_d
            if abs(new_rate - rate) < 1e-8:
                return round(new_rate, 6)
            rate = new_rate
        return None
    except Exception:
        return None


def calculate_equity_multiple(
    total_distributions: float,
    total_invested_capital: float,
) -> Optional[float]:
    """
    Calculate Equity Multiple (EM).

    EM = Total Distributions / Total Invested Capital

    A multiple of 2.0x means investors received $2 for every $1 invested.

    Args:
        total_distributions: Sum of all distributions returned to investors
        total_invested_capital: Total equity capital invested

    Returns:
        Equity multiple as a decimal (e.g. 1.85), or None if no capital invested
    """
    if total_invested_capital <= 0:
        return None
    return round(total_distributions / total_invested_capital, 4)
