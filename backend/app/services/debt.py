"""
Living Well Communities — Mortgage Amortization Engine
=======================================================
Generates full amortization schedules and annual debt projections
for DebtFacility records. Supports:
  - Interest-only periods
  - Standard amortizing P&I
  - Canadian semi-annual compounding (if canadian_compounding=True)
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class AmortizationPeriod:
    period: int           # 1-based month number
    payment: float
    interest: float
    principal: float
    balance: float


@dataclass
class AnnualDebtSummary:
    year: int
    total_payment: float
    total_interest: float
    total_principal: float
    closing_balance: float
    is_io_year: bool


class MortgageEngine:
    """
    Deterministic mortgage amortization engine.

    Args:
        outstanding_balance:    Current outstanding loan balance ($)
        annual_interest_rate:   Annual rate as a decimal (e.g. 0.0525 = 5.25%)
        amortization_months:    Total amortization period in months
        io_period_months:       Months at the start that are interest-only
        canadian_compounding:   Use Canadian semi-annual compounding (default False)
    """

    def __init__(
        self,
        outstanding_balance: float,
        annual_interest_rate: float,
        amortization_months: int,
        io_period_months: int = 0,
        canadian_compounding: bool = False,
    ):
        self.balance = outstanding_balance
        self.annual_rate = annual_interest_rate
        self.amortization_months = amortization_months
        self.io_period_months = io_period_months

        # Effective monthly rate
        if canadian_compounding:
            # Canadian mortgage: semi-annual compounding
            # Effective monthly rate = (1 + annual_rate/2)^(1/6) - 1
            self.monthly_rate = (1 + annual_rate / 2) ** (1 / 6) - 1
        else:
            self.monthly_rate = annual_interest_rate / 12

    def _pi_payment(self, balance: float, remaining_months: int) -> float:
        """Calculate fully amortizing P&I monthly payment."""
        r = self.monthly_rate
        n = remaining_months
        if r == 0 or n == 0:
            return balance / n if n > 0 else 0.0
        return balance * (r * (1 + r) ** n) / ((1 + r) ** n - 1)

    def monthly_schedule(self, periods: Optional[int] = None) -> List[AmortizationPeriod]:
        """
        Generate a month-by-month amortization schedule.

        Args:
            periods: Number of months to generate (default = io_period + amortization_months)

        Returns:
            List of AmortizationPeriod dataclasses.
        """
        total_periods = periods or (self.io_period_months + self.amortization_months)
        schedule: List[AmortizationPeriod] = []
        balance = self.balance

        for month in range(1, total_periods + 1):
            if balance <= 0:
                break

            if month <= self.io_period_months:
                # Interest-only period
                interest = round(balance * self.monthly_rate, 2)
                principal = 0.0
                payment = interest
            else:
                # Amortizing period — recalculate P&I on remaining amortization months
                months_into_amort = month - self.io_period_months
                remaining = self.amortization_months - (months_into_amort - 1)
                payment = round(self._pi_payment(balance, remaining), 2)
                interest = round(balance * self.monthly_rate, 2)
                principal = round(min(payment - interest, balance), 2)

            balance = round(balance - principal, 2)

            schedule.append(AmortizationPeriod(
                period=month,
                payment=payment,
                interest=interest,
                principal=principal,
                balance=balance,
            ))

        return schedule

    def annual_schedule(self, years: int = 10) -> List[AnnualDebtSummary]:
        """
        Aggregate the monthly schedule into year-by-year annual summaries.

        Args:
            years: Number of years to project (default 10)

        Returns:
            List of AnnualDebtSummary dataclasses.
        """
        monthly = self.monthly_schedule(periods=years * 12)
        annual: List[AnnualDebtSummary] = []

        for year in range(1, years + 1):
            start_idx = (year - 1) * 12
            end_idx = year * 12
            year_periods = monthly[start_idx:end_idx]

            if not year_periods:
                break

            total_payment = round(sum(p.payment for p in year_periods), 2)
            total_interest = round(sum(p.interest for p in year_periods), 2)
            total_principal = round(sum(p.principal for p in year_periods), 2)
            closing_balance = year_periods[-1].balance
            is_io_year = all(p.principal == 0 for p in year_periods)

            annual.append(AnnualDebtSummary(
                year=year,
                total_payment=total_payment,
                total_interest=total_interest,
                total_principal=total_principal,
                closing_balance=closing_balance,
                is_io_year=is_io_year,
            ))

        return annual

    def annual_debt_service(self, year: int = 1) -> float:
        """Return the total annual debt service for a given year (1-based)."""
        schedule = self.annual_schedule(years=year)
        if not schedule:
            return 0.0
        return schedule[year - 1].total_payment
