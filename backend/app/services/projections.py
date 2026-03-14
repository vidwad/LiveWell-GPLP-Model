"""
Living Well Communities — Time-Phased Annual Projection Engine
==============================================================
Projects property financials year-by-year, transitioning through
lifecycle stages: Interim → Construction → Lease-up → Stabilized.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class YearProjection:
    year: int
    phase: str                    # "interim", "construction", "lease_up", "stabilized"
    rentable_months: int          # months the property generates revenue this year
    occupancy_rate: float         # 0.0 – 1.0
    gross_revenue: float
    vacancy_loss: float
    effective_gross_income: float
    operating_expenses: float
    noi: float
    annual_debt_service: float
    cash_flow: float              # NOI – Debt Service
    cumulative_cash_flow: float


class LifecycleProjectionEngine:
    """
    Projects property financials over a multi-year horizon.

    The engine handles three phases automatically:
    1. Interim/Pre-construction — property is operating at reduced capacity
    2. Construction — no revenue, carrying costs only
    3. Lease-up — occupancy ramps from lease_up_start_occupancy to stabilized_occupancy
    4. Stabilized — full stabilized operations

    Args:
        stabilized_annual_revenue:    Projected gross revenue at full stabilization ($)
        stabilized_operating_expenses: Annual operating expenses at stabilization ($)
        annual_debt_service:          Annual debt service payment (P&I or IO) ($)
        construction_start_year:      Year construction begins (1-based, None = already done)
        construction_duration_years:  How many years construction takes
        lease_up_months:              Months to ramp from initial to stabilized occupancy
        lease_up_start_occupancy:     Occupancy rate at the start of lease-up (e.g. 0.20)
        stabilized_occupancy:         Target stabilized occupancy rate (e.g. 0.93)
        interim_revenue:              Revenue during interim operation phase ($, before construction)
        interim_expenses:             Expenses during interim operation phase ($)
        carrying_cost_annual:         Annual carrying cost during construction (interest, insurance, etc.)
        projection_years:             Total number of years to project (default 10)
        expense_growth_rate:          Annual expense escalation rate (default 0.03 = 3%)
        revenue_growth_rate:          Annual revenue growth post-stabilization (default 0.025 = 2.5%)
    """

    def __init__(
        self,
        stabilized_annual_revenue: float,
        stabilized_operating_expenses: float,
        annual_debt_service: float,
        construction_start_year: Optional[int] = None,
        construction_duration_years: int = 1,
        lease_up_months: int = 12,
        lease_up_start_occupancy: float = 0.20,
        stabilized_occupancy: float = 0.93,
        interim_revenue: float = 0.0,
        interim_expenses: float = 0.0,
        carrying_cost_annual: float = 0.0,
        projection_years: int = 10,
        expense_growth_rate: float = 0.03,
        revenue_growth_rate: float = 0.025,
    ):
        self.stabilized_revenue = stabilized_annual_revenue
        self.stabilized_expenses = stabilized_operating_expenses
        self.annual_debt_service = annual_debt_service
        self.construction_start_year = construction_start_year
        self.construction_duration_years = construction_duration_years
        self.lease_up_months = lease_up_months
        self.lease_up_start_occupancy = lease_up_start_occupancy
        self.stabilized_occupancy = stabilized_occupancy
        self.interim_revenue = interim_revenue
        self.interim_expenses = interim_expenses
        self.carrying_cost = carrying_cost_annual
        self.projection_years = projection_years
        self.expense_growth = expense_growth_rate
        self.revenue_growth = revenue_growth_rate

    def _construction_end_year(self) -> Optional[int]:
        if self.construction_start_year is None:
            return None
        return self.construction_start_year + self.construction_duration_years - 1

    def _stabilization_year(self) -> Optional[int]:
        end = self._construction_end_year()
        if end is None:
            return 1  # Already stabilized
        lease_up_full_years = (self.lease_up_months + 11) // 12
        return end + lease_up_full_years + 1

    def project(self) -> List[YearProjection]:
        """Generate the year-by-year projection."""
        results: List[YearProjection] = []
        cumulative_cf = 0.0

        construction_end = self._construction_end_year()
        stabilization_year = self._stabilization_year()

        # Lease-up year boundaries
        lease_up_start_year = (construction_end + 1) if construction_end else None
        lease_up_end_year = (stabilization_year - 1) if stabilization_year else None

        for year in range(1, self.projection_years + 1):
            growth_factor = (1 + self.revenue_growth) ** max(0, year - (stabilization_year or 1))
            expense_factor = (1 + self.expense_growth) ** (year - 1)

            if self.construction_start_year and year >= self.construction_start_year and year <= (construction_end or year):
                # --- Construction Phase ---
                phase = "construction"
                rentable_months = 0
                occupancy = 0.0
                gross_revenue = 0.0
                vacancy_loss = 0.0
                egi = 0.0
                opex = self.carrying_cost
                noi = -opex
            elif lease_up_start_year and lease_up_end_year and year >= lease_up_start_year and year <= lease_up_end_year:
                # --- Lease-up Phase ---
                phase = "lease_up"
                years_into_leaseup = year - lease_up_start_year + 1
                total_leaseup_years = max(1, (self.lease_up_months + 11) // 12)
                ramp = min(years_into_leaseup / total_leaseup_years, 1.0)
                occupancy = self.lease_up_start_occupancy + ramp * (self.stabilized_occupancy - self.lease_up_start_occupancy)
                rentable_months = 12
                gross_revenue = round(self.stabilized_revenue * occupancy * expense_factor, 2)
                vacancy_loss = round(gross_revenue * (1 - occupancy), 2)
                egi = round(gross_revenue - vacancy_loss, 2)
                opex = round(self.stabilized_expenses * expense_factor, 2)
                noi = round(egi - opex, 2)
            elif stabilization_year and year >= stabilization_year:
                # --- Stabilized Phase ---
                phase = "stabilized"
                rentable_months = 12
                occupancy = self.stabilized_occupancy
                gross_revenue = round(self.stabilized_revenue * growth_factor, 2)
                vacancy_loss = round(gross_revenue * (1 - self.stabilized_occupancy), 2)
                egi = round(gross_revenue - vacancy_loss, 2)
                opex = round(self.stabilized_expenses * expense_factor, 2)
                noi = round(egi - opex, 2)
            else:
                # --- Interim Phase (before construction or if no construction planned) ---
                if self.construction_start_year is None and stabilization_year == 1:
                    # Property already stabilized
                    phase = "stabilized"
                    rentable_months = 12
                    occupancy = self.stabilized_occupancy
                    gross_revenue = round(self.stabilized_revenue * growth_factor, 2)
                    vacancy_loss = round(gross_revenue * (1 - self.stabilized_occupancy), 2)
                    egi = round(gross_revenue - vacancy_loss, 2)
                    opex = round(self.stabilized_expenses * expense_factor, 2)
                    noi = round(egi - opex, 2)
                else:
                    phase = "interim"
                    rentable_months = 12
                    occupancy = 0.7  # rough interim occupancy
                    gross_revenue = round(self.interim_revenue * expense_factor, 2)
                    vacancy_loss = 0.0
                    egi = gross_revenue
                    opex = round(self.interim_expenses * expense_factor, 2)
                    noi = round(egi - opex, 2)

            cash_flow = round(noi - self.annual_debt_service, 2)
            cumulative_cf = round(cumulative_cf + cash_flow, 2)

            results.append(YearProjection(
                year=year,
                phase=phase,
                rentable_months=rentable_months,
                occupancy_rate=round(occupancy, 4),
                gross_revenue=gross_revenue,
                vacancy_loss=vacancy_loss,
                effective_gross_income=egi,
                operating_expenses=opex,
                noi=noi,
                annual_debt_service=round(self.annual_debt_service, 2),
                cash_flow=cash_flow,
                cumulative_cash_flow=cumulative_cf,
            ))

        return results
