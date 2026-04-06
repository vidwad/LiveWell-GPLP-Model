"""
Portfolio Performance — Lifetime Cash Flow & Valuation
=======================================================
Computes the full investment lifecycle from acquisition through disposition
using data already captured in Operations, Strategy, Lender Financing,
and Acquisition Baseline. No duplicate data entry.
"""
from decimal import Decimal
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    Property, Unit, Bed, DevelopmentPlan, DebtFacility, DebtStatus,
    AcquisitionBaseline, ExitForecast, ExitActual,
    AncillaryRevenueStream, OperatingExpenseLineItem,
    User,
)
from app.core.deps import require_investor_or_above
from app.services.calculations import calculate_annual_debt_service

router = APIRouter()


def _f(val) -> float:
    if val is None:
        return 0.0
    return float(val)


def _remaining_balance_at(debt, exit_date: date, fallback_start: date | None = None) -> float:
    """Project a debt's outstanding principal forward to exit_date using standard amortization.

    - Starting balance: outstanding_balance if > 0, else commitment_amount.
    - IO period: no principal paydown during io_period_months.
    - Amortizing period: standard French amortization.
    - 0% rate: linear paydown.
    - No amortization_months / IO loan: balance stays at start.
    """
    start_bal = _f(debt.outstanding_balance) or _f(debt.commitment_amount)
    if start_bal <= 0:
        return 0.0

    start_date = debt.origination_date or fallback_start
    if not start_date or exit_date <= start_date:
        return start_bal

    months_elapsed = (exit_date.year - start_date.year) * 12 + (exit_date.month - start_date.month)
    if months_elapsed <= 0:
        return start_bal

    io_months = int(debt.io_period_months or 0)
    amort_months = int(debt.amortization_months or 0)

    # Still inside IO period — no principal paid
    if months_elapsed <= io_months:
        return start_bal

    months_amortizing = months_elapsed - io_months
    if amort_months <= 0:
        # Pure IO / non-amortizing — principal never reduces
        return start_bal

    # Cap amortizing months at the amortization schedule
    k = min(months_amortizing, amort_months)
    rate = _f(debt.interest_rate) / 100.0
    r = rate / 12.0
    n = amort_months
    P = start_bal

    if r == 0:
        remaining = P * (1 - k / n)
    else:
        # B_k = P * [(1+r)^n - (1+r)^k] / [(1+r)^n - 1]
        try:
            remaining = P * (((1 + r) ** n - (1 + r) ** k) / ((1 + r) ** n - 1))
        except (ZeroDivisionError, OverflowError):
            remaining = P

    return max(0.0, remaining)


def _compute_phase_noi(db: Session, property_id: int, plan_id: int | None) -> dict:
    """Compute NOI for a specific phase from Operations data."""
    from app.db.models import RenovationPhase

    if plan_id:
        units = db.query(Unit).filter(
            Unit.property_id == property_id, Unit.development_plan_id == plan_id
        ).all()
        if not units:
            units = db.query(Unit).filter(
                Unit.property_id == property_id, Unit.development_plan_id.is_(None)
            ).all()
    else:
        units = db.query(Unit).filter(
            Unit.property_id == property_id,
            Unit.renovation_phase != RenovationPhase.post_renovation,
        ).all()

    beds = []
    for u in units:
        if plan_id:
            plan_beds = db.query(Bed).filter(Bed.unit_id == u.unit_id, Bed.is_post_renovation == True).all()
            beds.extend(plan_beds if plan_beds else db.query(Bed).filter(Bed.unit_id == u.unit_id).all())
        else:
            beds.extend(db.query(Bed).filter(Bed.unit_id == u.unit_id, Bed.is_post_renovation == False).all())

    monthly_rent = sum(_f(b.monthly_rent) for b in beds)
    gpr = monthly_rent * 12

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if gpr <= 0 and prop and prop.annual_revenue:
        gpr = _f(prop.annual_revenue)

    # Ancillary
    anc = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.property_id == property_id,
        AncillaryRevenueStream.development_plan_id == plan_id,
    ).all()
    anc_annual = sum(
        _f(s.monthly_rate) * (s.total_count or 0) * _f(s.utilization_pct or 100) / 100 * 12
        for s in anc
    )
    other_income = anc_annual if anc_annual > 0 else _f(prop.annual_other_income) if prop else 0
    gross = gpr + other_income
    vacancy_loss = gross * 0.05
    # NOTE: "egi" returned here is GROSS rent (no vacancy applied), since the
    # period rows display actual monthly collections — vacancy is a budget
    # assumption tracked at the annual rollup level, not a per-month deduction.
    egi = gross

    # Expenses
    expenses = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.property_id == property_id,
        OperatingExpenseLineItem.development_plan_id == plan_id,
    ).all()
    num_units = len(units) if units else 1
    total_exp = 0.0
    for item in expenses:
        base = _f(item.base_amount)
        method = item.calc_method.value if hasattr(item.calc_method, 'value') else (item.calc_method or 'fixed')
        if method == 'per_unit':
            total_exp += base * num_units
        elif method == 'pct_egi':
            total_exp += egi * (base / 100)
        else:
            total_exp += base

    if not expenses:
        total_exp = _f(prop.annual_expenses) if prop and prop.annual_expenses else egi * 0.35

    noi = egi - total_exp

    return {
        "gpr": round(gpr, 2),
        "other_income": round(other_income, 2),
        "egi": round(egi, 2),
        "total_expenses": round(total_exp, 2),
        "noi": round(noi, 2),
        "units": len(units),
        "beds": len(beds),
    }


@router.get("/properties/{property_id}/lifetime-cashflow")
def get_lifetime_cashflow(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Compute the full investment lifecycle cash flow from existing data.

    Sources:
    - Acquisition Baseline → equity invested, purchase costs
    - Operations (per phase) → revenue, expenses, NOI
    - Strategy (plans) → construction costs, timelines
    - Lender Financing → debt service per phase
    - Exit assumptions → disposition proceeds

    Returns budget and actual columns for each period.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    baseline = db.query(AcquisitionBaseline).filter(
        AcquisitionBaseline.property_id == property_id
    ).first()
    exit_forecast = db.query(ExitForecast).filter(
        ExitForecast.property_id == property_id
    ).first()
    exit_actual = db.query(ExitActual).filter(
        ExitActual.property_id == property_id
    ).first()

    plans = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.property_id == property_id
    ).order_by(DevelopmentPlan.plan_id).all()

    all_debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == property_id
    ).all()

    # Build a per-plan lookup of interest reserve $ from EITHER:
    #  (a) the new debt_facilities.interest_reserve_amount field on the plan's
    #      construction loan, OR
    #  (b) a legacy budget line item categorized financing_cost with description
    #      containing "interest reserve" — for projects entered before the
    #      proper field existed.
    from app.db.models import ConstructionExpense
    plan_interest_reserve: dict[int, float] = {}
    for plan in plans:
        # Source A — debt facility field
        reserve_a = sum(
            _f(getattr(d, "interest_reserve_amount", 0))
            for d in all_debts
            if d.development_plan_id == plan.plan_id and d.debt_type == "construction_loan"
        )
        # Source B — budget line item fallback
        reserve_b = 0.0
        if reserve_a == 0:
            budget_lines = db.query(ConstructionExpense).filter(
                ConstructionExpense.property_id == property_id,
                ConstructionExpense.plan_id == plan.plan_id,
                ConstructionExpense.category == "financing_cost",
            ).all()
            reserve_b = sum(
                _f(b.budgeted_amount) for b in budget_lines
                if b.description and "interest reserve" in b.description.lower()
            )
        plan_interest_reserve[plan.plan_id] = reserve_a or reserve_b

    # Key values from Acquisition Baseline
    purchase_price = _f(baseline.purchase_price if baseline else prop.purchase_price)
    closing_costs = _f(baseline.closing_costs) if baseline else purchase_price * 0.03
    initial_equity = _f(baseline.initial_equity) if baseline else purchase_price * 0.25
    initial_debt = _f(baseline.initial_debt) if baseline else purchase_price * 0.75
    hold_years = int(baseline.target_hold_years) if baseline and baseline.target_hold_years else 7
    rent_growth = _f(prop.annual_rent_increase_pct) / 100 if prop.annual_rent_increase_pct else 0.03
    expense_growth = 0.02

    # Exit assumptions — sourced from baseline/forecast
    exit_cap = _f(exit_forecast.forecast_exit_cap_rate if exit_forecast and exit_forecast.forecast_exit_cap_rate
                  else baseline.original_exit_cap_rate if baseline and baseline.original_exit_cap_rate else 5.5)
    selling_cost_pct = _f(exit_forecast.forecast_selling_cost_pct if exit_forecast and exit_forecast.forecast_selling_cost_pct
                          else baseline.original_selling_cost_pct if baseline and baseline.original_selling_cost_pct else 5)

    # Baseline debt service
    baseline_debts = [d for d in all_debts if not d.development_plan_id]
    baseline_ads = 0.0
    for d in baseline_debts:
        bal = _f(d.outstanding_balance or d.commitment_amount)
        if bal > 0 and d.interest_rate:
            baseline_ads += calculate_annual_debt_service(
                bal, _f(d.interest_rate),
                d.amortization_months or 0, d.io_period_months or 0,
                compounding=getattr(d, 'compounding_method', None) or 'semi_annual',
            )

    # Baseline NOI from Operations
    baseline_noi_data = _compute_phase_noi(db, property_id, None)
    baseline_noi = baseline_noi_data["noi"]
    baseline_egi = baseline_noi_data["egi"]
    baseline_expenses = baseline_noi_data["total_expenses"]

    # Build period rows
    periods = []
    cumulative_budget = 0.0
    year_counter = 0

    # Row 0: Acquisition
    acq_cost = purchase_price + closing_costs
    periods.append({
        "period": "Acquisition",
        "type": "acquisition",
        "year": 0,
        "revenue_budget": 0,
        "expenses_budget": round(closing_costs, 0),
        "noi_budget": 0,
        "debt_service_budget": 0,
        "construction_cost": 0,
        "net_cashflow_budget": round(-initial_equity, 0),
        "cumulative_budget": round(-initial_equity, 0),
        "source": "Acquisition Baseline",
    })
    cumulative_budget = -initial_equity

    # ── Month-aware schedule ──────────────────────────────────────────────
    # We walk a 12-month cursor through each project year. For each month,
    # determine which "phase" applies (as-is operating, plan-construction
    # with/without occupancy, or post-plan operating) and aggregate to a
    # year row. This handles partial-year as-is income, occupancy during
    # renovations, and gaps between plans.
    purchase_dt = prop.purchase_date or date.today()
    exit_dt = date(purchase_dt.year + hold_years, purchase_dt.month, min(purchase_dt.day, 28))

    current_noi = baseline_noi
    current_egi = baseline_egi
    current_expenses = baseline_expenses
    current_ads = baseline_ads
    current_source_label = "As-Is"
    # Rent growth is anchored to when each rent roll first became effective.
    # As-is rents are effective at purchase. When a plan stabilizes, its new
    # rents are entered as expected rents at THAT future date — they should
    # not be inflated by the years between purchase and stabilization.
    current_rent_effective_date = purchase_dt

    # Pre-compute plan windows + per-plan post-NOI / debt service
    sorted_plans = sorted(
        [p for p in plans if p.development_start_date],
        key=lambda p: p.development_start_date,
    )
    plan_windows = []
    for plan in sorted_plans:
        duration_months = plan.construction_duration_months or (
            plan.construction_duration_days // 30 if plan.construction_duration_days else 6
        )
        start = plan.development_start_date
        # Prefer the explicit completion date if set (it can differ from
        # start + duration when the user has an actual schedule)
        if plan.estimated_completion_date:
            end = plan.estimated_completion_date
        else:
            end_year = start.year + (start.month - 1 + duration_months) // 12
            end_month = (start.month - 1 + duration_months) % 12 + 1
            end = date(end_year, end_month, min(start.day, 28))

        plan_debts = [d for d in all_debts if d.development_plan_id == plan.plan_id]
        # During construction, the *active* debt is the one being replaced at
        # takeout (e.g. construction loan), NOT the permanent that hasn't been
        # originated yet. Identify by: plan debts whose ID appears in any other
        # plan-debt's replaces_debt_id chain.
        plan_replaced_ids = {d.replaces_debt_id for d in plan_debts if d.replaces_debt_id}
        construction_active = [d for d in plan_debts if d.debt_id in plan_replaced_ids]
        # If no chain exists (single-debt plan), fall back to treating all plan
        # debts as construction-active.
        if not construction_active:
            construction_active = plan_debts

        plan_ads = 0.0
        for d in construction_active:
            bal = _f(d.outstanding_balance) or _f(d.commitment_amount)
            if bal > 0 and d.interest_rate:
                plan_ads += calculate_annual_debt_service(
                    bal, _f(d.interest_rate),
                    d.amortization_months or 0, d.io_period_months or 0,
                    compounding=getattr(d, 'compounding_method', None) or 'semi_annual',
                )

        post_noi_data = _compute_phase_noi(db, property_id, plan.plan_id)
        replaced_ids = plan_replaced_ids
        final_debts = [d for d in plan_debts if d.debt_id not in replaced_ids]
        post_ads = sum(
            calculate_annual_debt_service(
                _f(d.outstanding_balance) or _f(d.commitment_amount),
                _f(d.interest_rate),
                d.amortization_months or 0, d.io_period_months or 0,
                compounding=getattr(d, 'compounding_method', None) or 'semi_annual',
            )
            for d in final_debts
            if (_f(d.outstanding_balance) or _f(d.commitment_amount)) > 0 and d.interest_rate
        )

        reserve_amt = plan_interest_reserve.get(plan.plan_id, 0.0)
        rev_pct_raw = getattr(plan, "during_construction_revenue_pct", None)
        rev_pct = float(rev_pct_raw) / 100.0 if rev_pct_raw is not None else None

        # Total construction loan capacity available for project costs
        # (commitment less interest reserve, summed across construction loans
        # tied to this plan). Used to net construction-cost outflows against
        # loan-funded inflows so equity doesn't appear to "front" the build.
        net_loan_for_costs = 0.0
        for d in plan_debts:
            d_type = d.debt_type.value if hasattr(d.debt_type, 'value') else d.debt_type
            if d_type == "construction_loan":
                commitment = _f(d.commitment_amount)
                d_reserve = _f(getattr(d, "interest_reserve_amount", 0))
                net_loan_for_costs += max(0.0, commitment - d_reserve)

        plan_windows.append({
            "plan": plan,
            "start": start,
            "end": end,
            "duration_months": duration_months,
            "occupancy": bool(getattr(plan, "occupancy_during_construction", False)),
            "revenue_pct_during_construction": rev_pct,
            "plan_cost": _f(plan.estimated_construction_cost),
            "plan_ads": plan_ads,
            "interest_reserve": reserve_amt,
            "has_interest_reserve": reserve_amt > 0,
            "net_loan_for_costs": net_loan_for_costs,
            "draws_to_date": 0.0,  # mutable: tracks cumulative loan draws
            "post_noi": post_noi_data["noi"],
            "post_egi": post_noi_data["egi"],
            "post_expenses": post_noi_data["total_expenses"],
            "post_ads": post_ads,
        })

    # ── Refinance / capital-event pre-computation ───────────────────────────
    # When a debt has replaces_debt_id set AND it's a permanent takeout of a
    # construction loan, the new loan funds are wired in full at origination,
    # used to pay off the construction loan balance, and any excess flows to
    # the equity sponsor as a refinance distribution. This is a real cash
    # event that affects equity returns and IRR — institutional models always
    # surface it as a discrete "capital event" row, separated from operating
    # cash flow so analysts can distinguish refi-driven returns from operating-
    # driven returns.
    refi_events: list[dict] = []
    for d in all_debts:
        if not d.replaces_debt_id or not d.origination_date:
            continue
        replaced = next((x for x in all_debts if x.debt_id == d.replaces_debt_id), None)
        if not replaced:
            continue
        new_type = d.debt_type.value if hasattr(d.debt_type, "value") else str(d.debt_type or "")
        old_type = replaced.debt_type.value if hasattr(replaced.debt_type, "value") else str(replaced.debt_type or "")
        # Only book a discrete cash distribution event for permanent takeouts
        # of construction loans. Construction loans replacing baseline mortgages
        # are not fully funded at origination — only the payoff portion is, and
        # the rest is drawn over time (already handled by the cl_draw column).
        if not (new_type == "permanent_mortgage" and old_type == "construction_loan"):
            continue
        new_commitment = _f(d.commitment_amount)
        # Construction loan payoff at takeout = the loan's commitment amount.
        # By takeout, the construction loan is fully drawn (all project cost
        # draws + capitalized interest from the reserve account).
        old_payoff = _f(replaced.commitment_amount)
        net_distribution = new_commitment - old_payoff
        refi_events.append({
            "date": d.origination_date,
            "new_debt": d,
            "old_debt": replaced,
            "new_lender": d.lender_name,
            "old_lender": replaced.lender_name,
            "new_commitment": new_commitment,
            "old_payoff": old_payoff,
            "net_distribution": net_distribution,
            "processed": False,
        })
    refi_events.sort(key=lambda e: e["date"])

    def _phase_for_month(d: date):
        """Return (kind, plan_window_or_None) for a given calendar month start."""
        for w in plan_windows:
            if w["start"] <= d < w["end"]:
                return ("construction", w)
        return ("operating", None)

    def _apply_post_plan(w):
        """Switch current operating state to a plan's post-completion state."""
        nonlocal current_noi, current_egi, current_expenses, current_ads, current_source_label, current_rent_effective_date
        current_noi = w["post_noi"]
        current_egi = w["post_egi"]
        current_expenses = w["post_expenses"]
        if w["post_ads"]:
            current_ads = w["post_ads"]
        current_source_label = w["plan"].plan_name or "Post-Plan"
        # Reset the rent-growth clock to this plan's stabilization date —
        # the new rents on this plan are expected rents at THAT date, not
        # today's market rates.
        current_rent_effective_date = w["end"]

    # Walk year by year up to exit
    cursor = purchase_dt
    operating_years_elapsed = 0
    applied_plans = set()
    while cursor < exit_dt:
        year_counter += 1
        year_start = cursor  # captured for refi event detection at end of year
        year_label_parts = []
        rev_year = 0.0
        exp_year = 0.0
        ds_year = 0.0
        cc_year = 0.0
        ir_draw_year = 0.0  # interest reserve draw (offsets debt service)
        cl_draw_year = 0.0  # construction loan draw (offsets construction cost)
        primary_kind = "operating"
        primary_source = current_source_label
        active_plan_name = None
        # Per-month detail rows for this year (real values, not annual/12)
        month_rows: list[dict] = []
        construction_kinds_seen: set[str] = set()

        for m in range(12):
            # Compute the calendar month start for this slot
            mo_year = cursor.year + (cursor.month - 1 + m) // 12
            mo_month = (cursor.month - 1 + m) % 12 + 1
            month_start = date(mo_year, mo_month, 1)
            if month_start >= exit_dt:
                break

            kind, w = _phase_for_month(month_start)

            # Reset per-month accumulators
            m_rev = 0.0
            m_exp = 0.0
            m_ds = 0.0
            m_cc = 0.0
            m_ir = 0.0
            m_cl = 0.0  # construction loan draw
            m_label = month_start.strftime("%b %Y")
            m_source = ""

            if kind == "construction":
                primary_kind = "construction"
                active_plan_name = w["plan"].plan_name
                primary_source = f"Master Plan: {active_plan_name}"
                construction_kinds_seen.add(active_plan_name)
                m_source = f"{active_plan_name} (construction)"
                # Construction cost spread evenly over duration
                m_cc = w["plan_cost"] / max(1, w["duration_months"])
                m_ds = w["plan_ads"] / 12.0
                # Interest reserve draws fund the debt service in cash terms
                if w["has_interest_reserve"]:
                    m_ir = m_ds
                # Construction loan draw — funds the project cost (not equity).
                # Cap by remaining loan capacity; any shortfall comes from equity.
                remaining_loan = w["net_loan_for_costs"] - w["draws_to_date"]
                m_cl = max(0.0, min(m_cc, remaining_loan))
                w["draws_to_date"] += m_cl
                if w["occupancy"]:
                    # Occupancy continues — book pro-rata current operating income,
                    # reduced by during_construction_revenue_pct if set.
                    yrs = month_start.year - current_rent_effective_date.year
                    if month_start.month < current_rent_effective_date.month:
                        yrs -= 1
                    yrs = max(0, yrs)
                    grow = (1 + rent_growth) ** yrs
                    egrow = (1 + expense_growth) ** yrs
                    revenue_pct = w.get("revenue_pct_during_construction")
                    if revenue_pct is None:
                        revenue_pct = 1.0
                    m_rev = (current_egi * grow * revenue_pct) / 12.0
                    m_exp = (current_expenses * egrow) / 12.0
            else:
                # Operating month — check if any plan just completed and we
                # need to switch to its post-state
                for w_check in plan_windows:
                    if w_check["end"] <= month_start and w_check["plan"].plan_id not in applied_plans:
                        _apply_post_plan(w_check)
                        applied_plans.add(w_check["plan"].plan_id)
                yrs = month_start.year - current_rent_effective_date.year
                if month_start.month < current_rent_effective_date.month:
                    yrs -= 1
                yrs = max(0, yrs)
                grow = (1 + rent_growth) ** yrs
                egrow = (1 + expense_growth) ** yrs
                m_rev = (current_egi * grow) / 12.0
                m_exp = (current_expenses * egrow) / 12.0
                m_ds = current_ads / 12.0
                m_source = f"Operations ({current_source_label})"
                if primary_kind == "operating":
                    primary_source = m_source

            rev_year += m_rev
            exp_year += m_exp
            ds_year += m_ds
            cc_year += m_cc
            ir_draw_year += m_ir
            cl_draw_year += m_cl
            m_noi = m_rev - m_exp
            m_cash_ds = m_ds - m_ir
            # Net cash to equity: construction cost is offset by loan draws.
            m_cf = m_noi - m_cash_ds - (m_cc - m_cl)
            month_rows.append({
                "month": m_label,
                "month_start": str(month_start),
                "revenue_budget": round(m_rev, 0),
                "expenses_budget": round(m_exp, 0),
                "noi_budget": round(m_noi, 0),
                "debt_service_budget": round(m_ds, 0),
                "interest_reserve_draw": round(m_ir, 0),
                "construction_cost": round(m_cc, 0),
                "construction_loan_draw": round(m_cl, 0),
                "refinance_proceeds": 0,
                "net_cashflow_budget": round(m_cf, 0),
                "source": m_source,
            })

        noi_year = rev_year - exp_year
        # Net cash flow: NOI minus cash debt service (after interest reserve
        # offset) minus the EQUITY portion of construction cost (= cost less
        # construction loan draws). Reserve and loan draws are non-cash to the
        # equity sponsor.
        cash_ds = ds_year - ir_draw_year
        equity_construction = cc_year - cl_draw_year
        cf_year = noi_year - cash_ds - equity_construction
        cumulative_budget += cf_year

        # Determine if year is mixed (has both operating and construction months)
        has_construction = any(r["construction_cost"] > 0 for r in month_rows)
        has_operating_revenue = any(r["revenue_budget"] > 0 for r in month_rows)

        if has_construction and has_operating_revenue:
            # Mixed year — show what's in the year
            plan_names = ", ".join(sorted(construction_kinds_seen))
            label = f"Year {year_counter} (Mixed: Operating + {plan_names})"
            row_type = "mixed"
        elif primary_kind == "construction":
            label = f"Year {year_counter} ({active_plan_name or 'Construction'})"
            row_type = "construction"
        else:
            # Operating year — distinguish "as-is" vs "post-plan stabilized"
            if applied_plans:
                label = f"Year {year_counter} (Stabilized — {current_source_label})"
                row_type = "stabilized"
                primary_source = f"Operations (Stabilized)"
            else:
                label = f"Year {year_counter} (As-Is)"
                row_type = "operating"
                primary_source = "Operations (As-Is)"

        periods.append({
            "period": label,
            "type": row_type,
            "year": year_counter,
            "revenue_budget": round(rev_year, 0),
            "expenses_budget": round(exp_year, 0),
            "noi_budget": round(noi_year, 0),
            "debt_service_budget": round(ds_year, 0),
            "interest_reserve_draw": round(ir_draw_year, 0),
            "construction_cost": round(cc_year, 0),
            "construction_loan_draw": round(cl_draw_year, 0),
            "refinance_proceeds": 0,
            "net_cashflow_budget": round(cf_year, 0),
            "cumulative_budget": round(cumulative_budget, 0),
            "source": primary_source,
            "months": month_rows,
        })

        operating_years_elapsed += 1
        next_cursor = date(cursor.year + 1, cursor.month, min(cursor.day, 28))

        # ── Emit any refinance events that fell within this year ──────────
        # Synthetic period rows are inserted immediately after the operating
        # year row that contains them, so the cumulative cash flow flows
        # naturally and the capital event is clearly separated from operating
        # cash flow (institutional convention).
        for ev in refi_events:
            if ev["processed"]:
                continue
            if year_start <= ev["date"] < next_cursor:
                cumulative_budget += ev["net_distribution"]
                ev_label = (
                    f"Refinance — {ev['new_lender']} takes out {ev['old_lender']}"
                )
                ev_source = (
                    f"Capital event: ${ev['new_commitment']:,.0f} new commitment "
                    f"− ${ev['old_payoff']:,.0f} payoff"
                )
                periods.append({
                    "period": ev_label,
                    "type": "refinance",
                    "year": year_counter,
                    "revenue_budget": 0,
                    "expenses_budget": 0,
                    "noi_budget": 0,
                    "debt_service_budget": 0,
                    "interest_reserve_draw": 0,
                    "construction_cost": 0,
                    "construction_loan_draw": 0,
                    "refinance_proceeds": round(ev["net_distribution"], 0),
                    "net_cashflow_budget": round(ev["net_distribution"], 0),
                    "cumulative_budget": round(cumulative_budget, 0),
                    "source": ev_source,
                    "months": [{
                        "month": ev["date"].strftime("%b %Y"),
                        "month_start": str(ev["date"]),
                        "revenue_budget": 0,
                        "expenses_budget": 0,
                        "noi_budget": 0,
                        "debt_service_budget": 0,
                        "interest_reserve_draw": 0,
                        "construction_cost": 0,
                        "construction_loan_draw": 0,
                        "refinance_proceeds": round(ev["net_distribution"], 0),
                        "net_cashflow_budget": round(ev["net_distribution"], 0),
                        "source": ev_source,
                    }],
                })
                ev["processed"] = True

        cursor = next_cursor

    # Skip the legacy plan loop below — it's superseded by the month-aware
    # walker above. Mark all plans as already processed so the old loop
    # becomes a no-op.
    _legacy_plans_processed = True
    for plan in []:  # disabled
        pass
    if _legacy_plans_processed:
        plans_for_legacy_loop = []
    else:
        plans_for_legacy_loop = plans

    for plan in plans_for_legacy_loop:
        plan_cost = _f(plan.estimated_construction_cost)
        duration_months = plan.construction_duration_months or (plan.construction_duration_days // 30 if plan.construction_duration_days else 6)
        duration_years = max(1, round(duration_months / 12))
        lease_up_months = getattr(plan, 'lease_up_months', None) or 6

        # Construction debt service
        plan_debts = [d for d in all_debts if d.development_plan_id == plan.plan_id]
        plan_ads = 0.0
        for d in plan_debts:
            bal = _f(d.outstanding_balance or d.commitment_amount)
            if bal > 0 and d.interest_rate:
                plan_ads += calculate_annual_debt_service(
                    bal, _f(d.interest_rate),
                    d.amortization_months or 0, d.io_period_months or 0,
                    compounding=getattr(d, 'compounding_method', None) or 'semi_annual',
                )

        # Construction period
        for cy in range(1, duration_years + 1):
            year_counter += 1
            # During construction: no revenue, IO debt payments, construction costs spread
            cost_this_year = plan_cost / duration_years
            cf = -cost_this_year - plan_ads
            cumulative_budget += cf
            periods.append({
                "period": f"Year {year_counter} ({plan.plan_name or 'Construction'})",
                "type": "construction",
                "year": year_counter,
                "revenue_budget": 0,
                "expenses_budget": 0,
                "noi_budget": 0,
                "debt_service_budget": round(plan_ads, 0),
                "construction_cost": round(cost_this_year, 0),
                "net_cashflow_budget": round(cf, 0),
                "cumulative_budget": round(cumulative_budget, 0),
                "source": f"Master Plan: {plan.plan_name}",
            })

        # Post-plan NOI
        plan_noi_data = _compute_phase_noi(db, property_id, plan.plan_id)
        current_noi = plan_noi_data["noi"]
        current_egi = plan_noi_data["egi"]
        current_expenses = plan_noi_data["total_expenses"]

        # Update debt service to final plan debt
        if plan_debts:
            # Use the final (non-replaced) debt in the chain
            replaced_ids = {d.replaces_debt_id for d in plan_debts if d.replaces_debt_id}
            final_debts = [d for d in plan_debts if d.debt_id not in replaced_ids]
            current_ads = sum(
                calculate_annual_debt_service(
                    _f(d.outstanding_balance or d.commitment_amount),
                    _f(d.interest_rate),
                    d.amortization_months or 0, d.io_period_months or 0,
                    compounding=getattr(d, 'compounding_method', None) or 'semi_annual',
                )
                for d in final_debts if _f(d.outstanding_balance or d.commitment_amount) > 0 and d.interest_rate
            )

    # Remaining stabilized years until exit
    remaining_years = max(0, hold_years - year_counter)
    stabilized_start_noi = current_noi

    for y in range(1, remaining_years + 1):
        year_counter += 1
        growth = (1 + rent_growth) ** (y - 1)
        exp_growth = (1 + expense_growth) ** (y - 1)
        rev = current_egi * growth
        exp = current_expenses * exp_growth
        noi = rev - exp
        cf = noi - current_ads
        cumulative_budget += cf
        periods.append({
            "period": f"Year {year_counter} (Stabilized)",
            "type": "stabilized",
            "year": year_counter,
            "revenue_budget": round(rev, 0),
            "expenses_budget": round(exp, 0),
            "noi_budget": round(noi, 0),
            "debt_service_budget": round(current_ads, 0),
            "construction_cost": 0,
            "net_cashflow_budget": round(cf, 0),
            "cumulative_budget": round(cumulative_budget, 0),
            "source": "Operations (Stabilized)",
        })

    # Disposition
    exit_noi = periods[-1]["noi_budget"] if periods else current_noi
    exit_price = round(exit_noi / (exit_cap / 100), 0) if exit_cap > 0 else 0
    selling_costs = round(exit_price * selling_cost_pct / 100, 0)
    # Debt payoff — project each terminal debt's principal forward to the exit date,
    # accounting for IO period + amortization. Scope to debts realized under the
    # current strategy: baseline debts that aren't replaced by a plan, plus terminal
    # debts of the *last* plan (the one that runs to exit).
    purchase_dt = prop.purchase_date or date.today()
    exit_date = date(purchase_dt.year + hold_years, purchase_dt.month, min(purchase_dt.day, 28))

    realized_plan_id = plans[-1].plan_id if plans else None
    replaced_ids_global = {d.replaces_debt_id for d in all_debts if d.replaces_debt_id}

    payoff_debts = []
    for d in all_debts:
        if d.debt_id in replaced_ids_global:
            continue  # superseded in chain
        # Include if baseline (no plan) OR belongs to the realized plan
        if d.development_plan_id is None or d.development_plan_id == realized_plan_id:
            if _f(d.outstanding_balance) > 0 or _f(d.commitment_amount) > 0:
                payoff_debts.append(d)

    debt_payoff = sum(_remaining_balance_at(d, exit_date, fallback_start=purchase_dt) for d in payoff_debts)
    net_proceeds = exit_price - selling_costs - debt_payoff
    cumulative_budget += net_proceeds

    periods.append({
        "period": "Disposition",
        "type": "disposition",
        "year": year_counter,
        "revenue_budget": round(exit_price, 0),
        "expenses_budget": round(selling_costs + debt_payoff, 0),
        "noi_budget": round(exit_noi, 0),
        "debt_service_budget": 0,
        "construction_cost": 0,
        "net_cashflow_budget": round(net_proceeds, 0),
        "cumulative_budget": round(cumulative_budget, 0),
        "source": "Acquisition Baseline (exit assumptions)",
    })

    # Return metrics — equity invested = ALL capital outflows the sponsor
    # had to fund (acquisition equity + any construction shortfall + any
    # operating shortfall years). Equity returned = ALL positive cash flows.
    equity_in = sum(-p["net_cashflow_budget"] for p in periods if p["net_cashflow_budget"] < 0)
    equity_out = sum(p["net_cashflow_budget"] for p in periods if p["net_cashflow_budget"] > 0)
    total_operating_cf = sum(
        p["net_cashflow_budget"]
        for p in periods
        if p["type"] in ("operating", "stabilized") and p["net_cashflow_budget"] > 0
    )

    total_equity_invested = equity_in
    total_return = equity_out - equity_in  # net profit after returning capital
    equity_multiple = round(equity_out / equity_in, 2) if equity_in > 0 else None

    # Annualized ROI — handle negative returns safely
    annualized_roi = None
    if equity_in > 0 and hold_years > 0:
        if equity_out > 0:
            annualized_roi = round(((equity_out / equity_in) ** (1 / hold_years) - 1) * 100, 1)
        else:
            annualized_roi = round(-100.0, 1)

    # ── Five canonical return metrics, each with a breakdown payload so the
    # frontend can show the formula and inputs on click. ────────────────────

    # Operating-year cash flow series (years only — excludes acquisition,
    # refinance, and disposition rows). Each entry is the annual NCF.
    operating_year_rows = [
        p for p in periods
        if p["type"] in ("operating", "stabilized", "construction", "mixed")
    ]
    stabilized_year_rows = [p for p in periods if p["type"] == "stabilized"]

    # 1. Initial Year Cash-on-Cash — first operating year's NCF / equity
    initial_year_coc = None
    initial_year_breakdown = None
    if operating_year_rows and equity_in > 0:
        first_year = operating_year_rows[0]
        first_cf = first_year["net_cashflow_budget"]
        initial_year_coc = round(first_cf / equity_in * 100, 1)
        initial_year_breakdown = {
            "label": "Initial Year Cash-on-Cash",
            "formula": "Year 1 Cash Flow ÷ Initial Equity",
            "inputs": [
                {"name": f"{first_year['period']} cash flow", "value": first_cf, "format": "currency"},
                {"name": "Initial equity (sum of capital contributions)", "value": equity_in, "format": "currency"},
            ],
            "calculation": f"${first_cf:,.0f} ÷ ${equity_in:,.0f} = {initial_year_coc}%",
            "result": f"{initial_year_coc}%",
            "interpretation": "Operating yield in the first full year of ownership, before stabilization. Useful for showing investors the project's day-one cash return.",
        }

    # 2. Average Stabilized Cash-on-Cash — avg of stabilized years / equity
    stabilized_avg_coc = None
    stabilized_breakdown = None
    if stabilized_year_rows and equity_in > 0:
        sums = [p["net_cashflow_budget"] for p in stabilized_year_rows]
        avg_stab = sum(sums) / len(sums)
        stabilized_avg_coc = round(avg_stab / equity_in * 100, 1)
        first_stab = stabilized_year_rows[0]["year"]
        last_stab = stabilized_year_rows[-1]["year"]
        stabilized_breakdown = {
            "label": f"Average Stabilized Cash-on-Cash (Years {first_stab}–{last_stab})",
            "formula": "Average of stabilized-year cash flows ÷ Initial Equity",
            "inputs": [
                {"name": f"Year {p['year']} cash flow", "value": p["net_cashflow_budget"], "format": "currency"}
                for p in stabilized_year_rows
            ] + [
                {"name": "Sum of stabilized cash flows", "value": sum(sums), "format": "currency"},
                {"name": f"Number of stabilized years", "value": len(sums), "format": "number"},
                {"name": "Average stabilized cash flow", "value": round(avg_stab, 0), "format": "currency"},
                {"name": "Initial equity", "value": equity_in, "format": "currency"},
            ],
            "calculation": f"${avg_stab:,.0f} ÷ ${equity_in:,.0f} = {stabilized_avg_coc}%",
            "result": f"{stabilized_avg_coc}%",
            "interpretation": "Operating yield once the property is fully leased and operating at full capacity. The most useful single number for steady-state operating returns. Excludes construction-period years where cash flow is depressed.",
        }

    # 3. Average Hold-Period Cash-on-Cash — total operating CF over ALL hold
    # years (including negative years) ÷ hold years ÷ equity. The most honest
    # full-hold operating yield.
    hold_period_avg_coc = None
    hold_period_breakdown = None
    if operating_year_rows and equity_in > 0 and hold_years > 0:
        total_op_cf_full = sum(p["net_cashflow_budget"] for p in operating_year_rows)
        avg_hold = total_op_cf_full / hold_years
        hold_period_avg_coc = round(avg_hold / equity_in * 100, 1)
        hold_period_breakdown = {
            "label": f"Average Hold-Period Cash-on-Cash (Years 1–{hold_years})",
            "formula": "Sum of all operating-year cash flows ÷ Hold years ÷ Initial Equity",
            "inputs": [
                {"name": f"Year {p['year']} cash flow", "value": p["net_cashflow_budget"], "format": "currency"}
                for p in operating_year_rows
            ] + [
                {"name": "Total operating cash flow", "value": round(total_op_cf_full, 0), "format": "currency"},
                {"name": "Hold years", "value": hold_years, "format": "number"},
                {"name": "Average annual cash flow", "value": round(avg_hold, 0), "format": "currency"},
                {"name": "Initial equity", "value": equity_in, "format": "currency"},
            ],
            "calculation": f"${total_op_cf_full:,.0f} ÷ {hold_years} ÷ ${equity_in:,.0f} = {hold_period_avg_coc}%",
            "result": f"{hold_period_avg_coc}%",
            "interpretation": "The most honest full-hold operating yield because it includes negative-cash construction years. Conservative — does not include disposition or refi proceeds.",
        }

    # 4. Equity Multiple — total cash returned / equity invested
    equity_multiple_breakdown = None
    if equity_multiple is not None and equity_in > 0:
        equity_multiple_breakdown = {
            "label": "Equity Multiple",
            "formula": "Total Cash Returned to Equity ÷ Initial Equity",
            "inputs": [
                {"name": "Total cash returned (operating + refi + disposition)", "value": round(equity_out, 0), "format": "currency"},
                {"name": "Initial equity (sum of capital contributions)", "value": equity_in, "format": "currency"},
                {"name": "Net profit (return − equity)", "value": round(equity_out - equity_in, 0), "format": "currency"},
            ],
            "calculation": f"${equity_out:,.0f} ÷ ${equity_in:,.0f} = {equity_multiple}x",
            "result": f"{equity_multiple}x",
            "interpretation": "How many dollars come back for every dollar invested. Captures the entire investment outcome — operating cash flow, refinance distributions, and sale proceeds.",
        }

    # 5. Annualized ROI — (EM)^(1/n) − 1, expressed as %
    annualized_roi_breakdown = None
    if annualized_roi is not None and equity_multiple is not None and hold_years > 0:
        annualized_roi_breakdown = {
            "label": "Annualized Return / Average Annual ROI",
            "formula": "(Equity Multiple)^(1 / Hold Years) − 1",
            "inputs": [
                {"name": "Equity multiple", "value": equity_multiple, "format": "multiple"},
                {"name": "Hold years", "value": hold_years, "format": "number"},
            ],
            "calculation": f"({equity_multiple})^(1/{hold_years}) − 1 = {annualized_roi}%",
            "result": f"{annualized_roi}%",
            "interpretation": "Equivalent constant annual return that produces the same equity multiple over the hold period. NOT a true IRR (it doesn't weight cash flows by their timing) — for an IRR, dated month-by-month cash flows would be needed. Acceptable as an approximation when the cash flow shape is reasonably even.",
        }

    # Legacy: keep avg_coc field for backward compatibility (used by sensitivity table etc.)
    avg_coc = stabilized_avg_coc

    # Actual disposition data
    actual_disposition = None
    if exit_actual and exit_actual.actual_sale_price:
        actual_disposition = {
            "listing_date": str(exit_actual.listing_date) if exit_actual.listing_date else None,
            "broker": exit_actual.broker_name,
            "close_date": str(exit_actual.close_date) if exit_actual.close_date else None,
            "sale_price": _f(exit_actual.actual_sale_price),
            "selling_costs": _f(exit_actual.actual_selling_costs),
            "mortgage_payout": _f(exit_actual.actual_mortgage_payout),
            "net_proceeds": _f(exit_actual.actual_net_proceeds),
            "realized_irr": _f(exit_actual.realized_irr),
            "realized_equity_multiple": _f(exit_actual.realized_equity_multiple),
        }

    return {
        "property_id": property_id,
        "hold_years": hold_years,
        "periods": periods,
        "assumptions": {
            "purchase_price": round(purchase_price, 0),
            "closing_costs": round(closing_costs, 0),
            "initial_equity": round(initial_equity, 0),
            "initial_debt": round(initial_debt, 0),
            "rent_growth_pct": round(rent_growth * 100, 1),
            "expense_growth_pct": round(expense_growth * 100, 1),
            "exit_cap_rate": exit_cap,
            "exit_cap_rate_source": "Exit Forecast" if exit_forecast and exit_forecast.forecast_exit_cap_rate else "Acquisition Baseline" if baseline and baseline.original_exit_cap_rate else "Default (5.5%)",
            "selling_cost_pct": selling_cost_pct,
            "selling_cost_source": "Exit Forecast" if exit_forecast and exit_forecast.forecast_selling_cost_pct else "Acquisition Baseline" if baseline and baseline.original_selling_cost_pct else "Default (5%)",
        },
        "returns": {
            "total_equity_invested": round(total_equity_invested, 0),
            "total_operating_cashflow": round(total_operating_cf, 0),
            "net_sale_proceeds": round(net_proceeds, 0),
            "total_return": round(total_return, 0),
            "equity_multiple": equity_multiple,
            "annualized_roi": annualized_roi,
            # Five canonical CoC variants
            "initial_year_coc": initial_year_coc,
            "stabilized_avg_coc": stabilized_avg_coc,
            "hold_period_avg_coc": hold_period_avg_coc,
            # Legacy alias kept for backward-compat with the sensitivity table
            "avg_cash_on_cash": avg_coc,
            # Per-metric breakdowns for click-to-explain UI
            "breakdowns": {
                "initial_year_coc": initial_year_breakdown,
                "stabilized_avg_coc": stabilized_breakdown,
                "hold_period_avg_coc": hold_period_breakdown,
                "equity_multiple": equity_multiple_breakdown,
                "annualized_roi": annualized_roi_breakdown,
            },
        },
        "disposition": {
            "exit_price": round(exit_price, 0),
            "exit_noi": round(exit_noi, 0),
            "selling_costs": round(selling_costs, 0),
            "debt_payoff": round(debt_payoff, 0),
            "net_proceeds": round(net_proceeds, 0),
        },
        "actual_disposition": actual_disposition,
    }


@router.get("/properties/{property_id}/lifetime-cashflow.csv")
def export_lifetime_cashflow_csv(
    property_id: int,
    include_monthly: bool = Query(True, description="Include per-month detail rows"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Export the Lifetime Cash Flow as a CSV that opens cleanly in Excel/Google Sheets.

    Includes the period-level rows and (optionally) every per-month detail row,
    plus a returns summary block at the bottom.
    """
    import csv
    import io

    data = get_lifetime_cashflow(property_id=property_id, db=db, current_user=current_user)

    buf = io.StringIO()
    w = csv.writer(buf)

    # Header block
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    w.writerow(["Lifetime Cash Flow Export"])
    w.writerow(["Property", prop.address if prop else f"Property {property_id}"])
    w.writerow(["Property ID", property_id])
    w.writerow(["Hold Years", data.get("hold_years")])
    w.writerow(["Generated", date.today().isoformat()])
    w.writerow([])

    # Column headers
    cols = [
        "Period", "Type", "Year", "Month",
        "Revenue", "Expenses", "NOI",
        "Debt Service", "Interest Reserve Draw",
        "Construction Cost", "Construction Loan Draw",
        "Refinance Distribution",
        "Net Cash Flow", "Cumulative Cash Flow", "Source",
    ]
    w.writerow(cols)

    def _fmt(v):
        if v is None:
            return ""
        return v

    for p in data.get("periods", []):
        # Year-level row
        w.writerow([
            p.get("period", ""),
            p.get("type", ""),
            p.get("year", ""),
            "",  # month column blank for year row
            _fmt(p.get("revenue_budget")),
            _fmt(p.get("expenses_budget")),
            _fmt(p.get("noi_budget")),
            _fmt(p.get("debt_service_budget")),
            _fmt(p.get("interest_reserve_draw")),
            _fmt(p.get("construction_cost")),
            _fmt(p.get("construction_loan_draw")),
            _fmt(p.get("refinance_proceeds")),
            _fmt(p.get("net_cashflow_budget")),
            _fmt(p.get("cumulative_budget")),
            p.get("source", ""),
        ])

        if include_monthly:
            for mr in p.get("months", []) or []:
                w.writerow([
                    "",  # blank period to indicate monthly child
                    p.get("type", ""),
                    p.get("year", ""),
                    mr.get("month", ""),
                    _fmt(mr.get("revenue_budget")),
                    _fmt(mr.get("expenses_budget")),
                    _fmt(mr.get("noi_budget")),
                    _fmt(mr.get("debt_service_budget")),
                    _fmt(mr.get("interest_reserve_draw")),
                    _fmt(mr.get("construction_cost")),
                    _fmt(mr.get("construction_loan_draw")),
                    _fmt(mr.get("refinance_proceeds")),
                    _fmt(mr.get("net_cashflow_budget")),
                    "",  # cumulative tracked at year level only
                    mr.get("source", ""),
                ])

    # Returns summary
    w.writerow([])
    w.writerow(["Return Metrics"])
    returns = data.get("returns", {}) or {}
    for k in ("total_equity_invested", "total_operating_cashflow", "net_sale_proceeds",
              "total_return", "equity_multiple", "annualized_roi", "avg_cash_on_cash"):
        if k in returns:
            w.writerow([k.replace("_", " ").title(), returns[k]])

    # Disposition block
    disp = data.get("disposition", {}) or {}
    if disp:
        w.writerow([])
        w.writerow(["Disposition"])
        for k in ("exit_noi", "exit_price", "selling_costs", "debt_payoff", "net_proceeds"):
            if k in disp:
                w.writerow([k.replace("_", " ").title(), disp[k]])

    csv_text = buf.getvalue()
    buf.close()

    filename = f"lifetime_cashflow_property_{property_id}_{date.today().isoformat()}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
