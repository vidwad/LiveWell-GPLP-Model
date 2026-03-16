"""
Living Well Communities — Time-Phased Annual Pro Forma Projection Engine
=========================================================================
Projects property financials year-by-year, transitioning through
lifecycle stages: As-Is → Construction → Lease-up → Stabilized.

Produces a full 10-year (or N-year) cash flow projection with:
  - Phase-aware income recognition
  - Operating expense modelling
  - LP fee integration (management fee on gross revenues, construction mgmt fee)
  - Debt service integration
  - Exit / terminal value calculation
  - Summary return metrics (IRR, equity multiple, cash-on-cash)
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class YearProjection:
    year: int
    phase: str                    # "as_is", "construction", "lease_up", "stabilized"
    rentable_months: int          # months the property generates revenue this year
    occupancy_rate: float         # 0.0 – 1.0
    gross_potential_rent: float   # full rent if 100% occupied
    vacancy_loss: float
    effective_gross_income: float
    management_fee: float         # LP management fee (2.5% of gross revenues)
    operating_expenses: float     # OpEx EXCLUDING management fee
    total_expenses: float         # OpEx + management fee
    noi: float                    # EGI - total_expenses
    construction_mgmt_fee: float  # 1.5% of construction budget (during construction only)
    annual_debt_service: float
    cash_flow: float              # NOI – Debt Service – construction mgmt fee
    cumulative_cash_flow: float


@dataclass
class FeesSummary:
    """Aggregated fee totals across the projection horizon."""
    total_management_fees: float
    total_construction_mgmt_fees: float
    selling_commission: float
    offering_cost: float
    acquisition_fee: float
    refinancing_fee: float
    turnover_replacement_fee: float
    total_upfront_fees: float         # selling + offering + acquisition
    total_ongoing_fees: float         # management + construction mgmt
    total_all_fees: float
    net_deployable_capital: float     # gross_raise - upfront fees


@dataclass
class ProjectionSummary:
    """Aggregated metrics computed after the year-by-year projection."""
    total_cash_flow: float              # sum of all yearly cash flows
    exit_noi: float                     # Year-N NOI used for terminal value
    exit_cap_rate: float                # user-supplied cap rate
    terminal_value: float               # exit_noi / exit_cap_rate
    disposition_costs: float            # selling costs at exit (default 2%)
    net_exit_proceeds: float            # terminal_value - disposition_costs - debt_payoff
    total_return: float                 # total_cash_flow + net_exit_proceeds
    total_equity_invested: float        # user-supplied equity basis
    equity_multiple: Optional[float]    # total_return / equity
    irr_estimate: Optional[float]       # approximate IRR
    cash_on_cash_avg: Optional[float]   # avg annual cash flow / equity
    annualized_roi: Optional[float]     # (total_return / equity - 1) annualized
    # LP fee totals
    fees: Optional[FeesSummary] = None
    # Profit sharing (70/30 split)
    lp_share_of_profits: Optional[float] = None
    gp_share_of_profits: Optional[float] = None


# ---------------------------------------------------------------------------
# Projection Engine
# ---------------------------------------------------------------------------

class LifecycleProjectionEngine:
    """
    Projects property financials over a multi-year horizon.

    The engine handles four phases automatically:
      1. **As-Is (Baseline)** — property operates with current baseline income.
         Income = baseline_annual_revenue. No development activity.
      2. **Construction** — zero rental income. Carrying costs only
         (construction loan interest, insurance, taxes).
      3. **Lease-Up** — occupancy ramps linearly from 0% to stabilized_occupancy
         over lease_up_months. Revenue = stabilized_rent * occupancy_pct.
      4. **Stabilized** — full operations at stabilized_occupancy with annual
         rent escalation and expense growth.

    LP Fee Integration:
      - Management Fee: 2.5% of gross revenues (ongoing, included in expenses)
      - Construction Management Fee: 1.5% of construction budget (during construction)
      - Selling Commission: 10% of gross raise (upfront, deducted from capital)
      - Offering Cost: $250K fixed (upfront, deducted from capital)
      - Acquisition Fee: 2% of acquisition cost (upfront, at closing)
      - Refinancing Fee: 2.5% of refinance amount (event-triggered)
      - Turnover/Replacement Fee: 2% of FMV (event-triggered)
      - Profit Sharing: 70% LP / 30% GP after priority return
    """

    def __init__(
        self,
        baseline_annual_revenue: float = 0.0,
        baseline_annual_expenses: float = 0.0,
        stabilized_annual_revenue: float = 0.0,
        annual_expense_ratio: float = 0.35,
        annual_debt_service: float = 0.0,
        vacancy_rate: float = 0.05,
        annual_rent_increase: float = 0.03,
        expense_growth_rate: float = 0.02,
        construction_start_year: Optional[int] = None,
        construction_duration_years: int = 1,
        lease_up_months: int = 6,
        carrying_cost_annual: float = 0.0,
        exit_cap_rate: float = 0.055,
        disposition_cost_pct: float = 0.02,
        total_equity_invested: float = 0.0,
        debt_balance_at_exit: float = 0.0,
        projection_years: int = 10,
        # LP Fee parameters
        management_fee_rate: float = 0.025,       # 2.5% of gross revenues
        construction_mgmt_fee_rate: float = 0.015, # 1.5% of construction budget
        construction_budget: float = 0.0,          # total construction cost
        selling_commission_rate: float = 0.10,     # 10% of gross raise
        offering_cost: float = 250000.0,           # fixed $250K
        acquisition_fee_rate: float = 0.02,        # 2% of acquisition cost
        acquisition_cost: float = 0.0,             # total acquisition cost
        gross_raise: float = 0.0,                  # total capital raised
        refinancing_fee_rate: float = 0.025,       # 2.5% of refinance amount
        refinance_amount: float = 0.0,             # refinance loan amount (if any)
        turnover_fee_rate: float = 0.02,           # 2% of FMV
        property_fmv_at_turnover: float = 0.0,     # FMV at turnover (if any)
        lp_profit_share: float = 0.70,             # 70% to LP
        gp_profit_share: float = 0.30,             # 30% to GP
        # Legacy compatibility parameters
        stabilized_operating_expenses: Optional[float] = None,
        lease_up_start_occupancy: float = 0.0,
        stabilized_occupancy: Optional[float] = None,
        interim_revenue: Optional[float] = None,
        interim_expenses: Optional[float] = None,
        revenue_growth_rate: Optional[float] = None,
    ):
        # Core parameters
        self.baseline_revenue = baseline_annual_revenue or (interim_revenue or 0.0)
        self.baseline_expenses = baseline_annual_expenses or (interim_expenses or 0.0)
        self.stabilized_revenue = stabilized_annual_revenue
        self.expense_ratio = annual_expense_ratio
        self.annual_debt_service = annual_debt_service
        self.vacancy_rate = vacancy_rate
        self.rent_escalation = annual_rent_increase or (revenue_growth_rate or 0.03)
        self.expense_growth = expense_growth_rate
        self.construction_start_year = construction_start_year
        self.construction_duration_years = construction_duration_years
        self.lease_up_months = lease_up_months
        self.carrying_cost = carrying_cost_annual
        self.exit_cap_rate = exit_cap_rate
        self.disposition_cost_pct = disposition_cost_pct
        self.total_equity = total_equity_invested
        self.debt_at_exit = debt_balance_at_exit
        self.projection_years = projection_years

        # LP Fee parameters
        self.management_fee_rate = management_fee_rate
        self.construction_mgmt_fee_rate = construction_mgmt_fee_rate
        self.construction_budget = construction_budget
        self.selling_commission_rate = selling_commission_rate
        self.offering_cost = offering_cost
        self.acquisition_fee_rate = acquisition_fee_rate
        self.acquisition_cost = acquisition_cost
        self.gross_raise = gross_raise
        self.refinancing_fee_rate = refinancing_fee_rate
        self.refinance_amount = refinance_amount
        self.turnover_fee_rate = turnover_fee_rate
        self.property_fmv_at_turnover = property_fmv_at_turnover
        self.lp_profit_share = lp_profit_share
        self.gp_profit_share = gp_profit_share

        # Legacy compatibility
        if stabilized_occupancy is not None:
            self.vacancy_rate = 1.0 - stabilized_occupancy
        if stabilized_operating_expenses is not None and stabilized_operating_expenses > 0:
            if self.stabilized_revenue > 0:
                self.expense_ratio = stabilized_operating_expenses / self.stabilized_revenue
            else:
                self.expense_ratio = 0.35

    # ── Phase boundary helpers ──

    def _construction_end_year(self) -> Optional[int]:
        if self.construction_start_year is None:
            return None
        return self.construction_start_year + self.construction_duration_years - 1

    def _lease_up_start_year(self) -> Optional[int]:
        end = self._construction_end_year()
        if end is None:
            return None
        return end + 1

    def _stabilization_year(self) -> int:
        """First full year of stabilized operations."""
        lu_start = self._lease_up_start_year()
        if lu_start is None:
            return 1  # No construction → already stabilized
        lease_up_years = max(1, math.ceil(self.lease_up_months / 12))
        return lu_start + lease_up_years

    # ── Core projection ──

    def project(self) -> List[YearProjection]:
        """Generate the year-by-year projection."""
        results: List[YearProjection] = []
        cumulative_cf = 0.0

        construction_end = self._construction_end_year()
        lease_up_start = self._lease_up_start_year()
        stabilization_year = self._stabilization_year()

        # Construction management fee spread across construction years
        total_construction_mgmt_fee = round(self.construction_budget * self.construction_mgmt_fee_rate, 2)
        annual_construction_mgmt_fee = 0.0
        if self.construction_duration_years > 0 and total_construction_mgmt_fee > 0:
            annual_construction_mgmt_fee = round(total_construction_mgmt_fee / self.construction_duration_years, 2)

        for year in range(1, self.projection_years + 1):
            phase, occupancy, gpr, opex, rentable_months = self._calc_year(
                year, construction_end, lease_up_start, stabilization_year
            )

            vacancy_loss = round(gpr * self.vacancy_rate, 2) if phase == "stabilized" else round(gpr * (1.0 - occupancy), 2)
            egi = round(gpr - vacancy_loss, 2)

            # Management fee: 2.5% of gross revenues (EGI)
            mgmt_fee = 0.0
            if phase in ("as_is", "lease_up", "stabilized") and egi > 0:
                mgmt_fee = round(egi * self.management_fee_rate, 2)

            # Operating expenses (excluding management fee)
            if phase == "construction":
                opex = round(self.carrying_cost, 2)
            elif phase == "as_is":
                if self.baseline_expenses > 0:
                    years_from_start = year - 1
                    opex = round(self.baseline_expenses * (1 + self.expense_growth) ** years_from_start, 2)
                else:
                    opex = round(egi * self.expense_ratio, 2)
            else:
                # Lease-up and stabilized: expense ratio on stabilized revenue base
                years_from_stabilization = max(0, year - stabilization_year)
                base_expenses = self.stabilized_revenue * self.expense_ratio
                opex = round(base_expenses * (1 + self.expense_growth) ** years_from_stabilization, 2)

            total_expenses = round(opex + mgmt_fee, 2)
            noi = round(egi - total_expenses, 2)

            # Construction management fee (only during construction phase)
            constr_mgmt = 0.0
            if phase == "construction" and annual_construction_mgmt_fee > 0:
                constr_mgmt = annual_construction_mgmt_fee

            # Debt service
            ds = round(self.annual_debt_service, 2)

            cash_flow = round(noi - ds - constr_mgmt, 2)
            cumulative_cf = round(cumulative_cf + cash_flow, 2)

            results.append(YearProjection(
                year=year,
                phase=phase,
                rentable_months=rentable_months,
                occupancy_rate=round(occupancy, 4),
                gross_potential_rent=gpr,
                vacancy_loss=vacancy_loss,
                effective_gross_income=egi,
                management_fee=mgmt_fee,
                operating_expenses=opex,
                total_expenses=total_expenses,
                noi=noi,
                construction_mgmt_fee=constr_mgmt,
                annual_debt_service=ds,
                cash_flow=cash_flow,
                cumulative_cash_flow=cumulative_cf,
            ))

        return results

    def _calc_year(self, year: int, construction_end, lease_up_start, stabilization_year):
        """Determine phase and compute gross potential rent for a given year."""

        # ── Construction ──
        if (self.construction_start_year is not None
                and construction_end is not None
                and year >= self.construction_start_year
                and year <= construction_end):
            return "construction", 0.0, 0.0, 0.0, 0

        # ── Lease-Up ──
        if (lease_up_start is not None
                and year >= lease_up_start
                and year < stabilization_year):
            # Linear ramp from 0% to (1 - vacancy_rate)
            years_into_leaseup = year - lease_up_start + 1
            total_leaseup_years = max(1, math.ceil(self.lease_up_months / 12))
            ramp_pct = min(years_into_leaseup / total_leaseup_years, 1.0)
            target_occupancy = 1.0 - self.vacancy_rate
            occupancy = ramp_pct * target_occupancy

            # Revenue = stabilized rent * occupancy (straight-line increase)
            gpr = round(self.stabilized_revenue * occupancy, 2)
            return "lease_up", occupancy, gpr, 0.0, 12

        # ── Stabilized ──
        if year >= stabilization_year and self.construction_start_year is not None:
            years_post_stabilization = year - stabilization_year
            occupancy = 1.0 - self.vacancy_rate
            # Apply annual rent escalation from stabilization year
            gpr = round(self.stabilized_revenue * (1 + self.rent_escalation) ** years_post_stabilization, 2)
            return "stabilized", occupancy, gpr, 0.0, 12

        # ── As-Is (no construction planned, or before construction starts) ──
        if self.construction_start_year is None:
            years_from_start = year - 1
            if self.baseline_revenue > 0:
                gpr = round(self.baseline_revenue * (1 + self.rent_escalation) ** years_from_start, 2)
                occupancy = 1.0 - self.vacancy_rate
            else:
                gpr = round(self.stabilized_revenue * (1 + self.rent_escalation) ** years_from_start, 2)
                occupancy = 1.0 - self.vacancy_rate
            return "as_is", occupancy, gpr, 0.0, 12
        else:
            # Before construction starts — operate at baseline
            if self.baseline_revenue > 0:
                years_from_start = year - 1
                gpr = round(self.baseline_revenue * (1 + self.rent_escalation) ** years_from_start, 2)
                occupancy = 1.0 - self.vacancy_rate
            else:
                gpr = 0.0
                occupancy = 0.0
            return "as_is", occupancy, gpr, 0.0, 12

    # ── Fee Summary ──

    def compute_fees_summary(self, projections: List[YearProjection]) -> FeesSummary:
        """Compute all LP fee totals across the projection horizon."""
        total_mgmt = sum(y.management_fee for y in projections)
        total_constr_mgmt = sum(y.construction_mgmt_fee for y in projections)

        selling_commission = round(self.gross_raise * self.selling_commission_rate, 2)
        acquisition_fee = round(self.acquisition_cost * self.acquisition_fee_rate, 2)
        refinancing_fee = round(self.refinance_amount * self.refinancing_fee_rate, 2)
        turnover_fee = round(self.property_fmv_at_turnover * self.turnover_fee_rate, 2)

        total_upfront = round(selling_commission + self.offering_cost + acquisition_fee, 2)
        total_ongoing = round(total_mgmt + total_constr_mgmt, 2)
        total_all = round(total_upfront + total_ongoing + refinancing_fee + turnover_fee, 2)

        net_deployable = round(self.gross_raise - total_upfront, 2) if self.gross_raise > 0 else 0.0

        return FeesSummary(
            total_management_fees=round(total_mgmt, 2),
            total_construction_mgmt_fees=round(total_constr_mgmt, 2),
            selling_commission=selling_commission,
            offering_cost=round(self.offering_cost, 2),
            acquisition_fee=acquisition_fee,
            refinancing_fee=refinancing_fee,
            turnover_replacement_fee=turnover_fee,
            total_upfront_fees=total_upfront,
            total_ongoing_fees=total_ongoing,
            total_all_fees=total_all,
            net_deployable_capital=net_deployable,
        )

    # ── Summary / Return Metrics ──

    def compute_summary(self, projections: List[YearProjection]) -> ProjectionSummary:
        """Compute exit value and return metrics from the projection results."""
        if not projections:
            return ProjectionSummary(
                total_cash_flow=0, exit_noi=0, exit_cap_rate=self.exit_cap_rate,
                terminal_value=0, disposition_costs=0, net_exit_proceeds=0,
                total_return=0, total_equity_invested=self.total_equity,
                equity_multiple=None, irr_estimate=None,
                cash_on_cash_avg=None, annualized_roi=None,
            )

        total_cf = sum(y.cash_flow for y in projections)
        exit_noi = projections[-1].noi

        # Terminal value
        if self.exit_cap_rate > 0:
            terminal_value = round(exit_noi / self.exit_cap_rate, 2)
        else:
            terminal_value = 0.0

        disposition_costs = round(terminal_value * self.disposition_cost_pct, 2)
        net_exit = round(terminal_value - disposition_costs - self.debt_at_exit, 2)
        total_return = round(total_cf + net_exit, 2)

        # Return metrics
        equity = self.total_equity if self.total_equity > 0 else None
        equity_multiple = round(total_return / equity, 2) if equity else None
        n_years = len(projections)

        # Average annual cash-on-cash
        stabilized_cfs = [y.cash_flow for y in projections if y.phase == "stabilized"]
        avg_cf = sum(stabilized_cfs) / len(stabilized_cfs) if stabilized_cfs else (total_cf / n_years)
        cash_on_cash = round((avg_cf / equity) * 100, 2) if equity else None

        # Annualized ROI
        annualized_roi = None
        if equity and n_years > 0 and total_return > 0:
            annualized_roi = round(((total_return / equity) ** (1 / n_years) - 1) * 100, 2)

        # IRR estimate using Newton's method
        irr = self._estimate_irr(projections, net_exit)

        # Fees summary
        fees = self.compute_fees_summary(projections)

        # Profit sharing (70/30 LP/GP split on net profits after priority return)
        net_profit = max(0, total_return - self.total_equity) if self.total_equity > 0 else max(0, total_return)
        lp_share = round(net_profit * self.lp_profit_share, 2)
        gp_share = round(net_profit * self.gp_profit_share, 2)

        return ProjectionSummary(
            total_cash_flow=round(total_cf, 2),
            exit_noi=round(exit_noi, 2),
            exit_cap_rate=self.exit_cap_rate,
            terminal_value=terminal_value,
            disposition_costs=disposition_costs,
            net_exit_proceeds=net_exit,
            total_return=total_return,
            total_equity_invested=self.total_equity,
            equity_multiple=equity_multiple,
            irr_estimate=irr,
            cash_on_cash_avg=cash_on_cash,
            annualized_roi=annualized_roi,
            fees=fees,
            lp_share_of_profits=lp_share,
            gp_share_of_profits=gp_share,
        )

    def _estimate_irr(self, projections: List[YearProjection], net_exit: float) -> Optional[float]:
        """Estimate IRR using Newton-Raphson on the cash flow series."""
        if not self.total_equity or self.total_equity <= 0:
            return None

        # Cash flow series: Year 0 = -equity, Years 1..N = cash_flow, Year N += net_exit
        cfs = [-self.total_equity]
        for i, y in enumerate(projections):
            cf = y.cash_flow
            if i == len(projections) - 1:
                cf += net_exit
            cfs.append(cf)

        # Newton-Raphson
        rate = 0.10  # initial guess 10%
        for _ in range(200):
            npv = sum(cf / (1 + rate) ** t for t, cf in enumerate(cfs))
            dnpv = sum(-t * cf / (1 + rate) ** (t + 1) for t, cf in enumerate(cfs))
            if abs(dnpv) < 1e-12:
                break
            new_rate = rate - npv / dnpv
            if abs(new_rate - rate) < 1e-8:
                rate = new_rate
                break
            rate = new_rate
            # Guard against divergence
            if rate < -0.99 or rate > 10.0:
                return None

        return round(rate * 100, 2)
