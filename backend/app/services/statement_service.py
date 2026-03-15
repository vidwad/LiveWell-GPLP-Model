"""
Investor Statement PDF Generation
===================================
Generates a professional PDF statement for an investor showing:
  - Account summary (holdings across all LPs)
  - Distribution history
  - Current NAV per unit values
"""
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from typing import Optional

from fpdf import FPDF
from sqlalchemy.orm import Session

from app.db import models as m


def _d(val) -> float:
    if val is None:
        return 0.0
    return float(val)


def _fmt_currency(val) -> str:
    v = _d(val)
    if v < 0:
        return f"-${abs(v):,.2f}"
    return f"${v:,.2f}"


def _fmt_date(val) -> str:
    if val is None:
        return "—"
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, date):
        return val.isoformat()
    return str(val)


class InvestorStatementPDF(FPDF):
    """Custom PDF class for investor statements."""

    def __init__(self, investor_name: str, statement_date: str):
        super().__init__()
        self.investor_name = investor_name
        self.statement_date = statement_date

    def header(self):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 8, "Living Well Communities", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, "Investor Account Statement", new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)
        self.ln(2)
        # Separator line
        self.set_draw_color(200, 200, 200)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="R")

    def section_title(self, title: str):
        self.set_font("Helvetica", "B", 11)
        self.set_fill_color(245, 245, 245)
        self.cell(0, 8, f"  {title}", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def detail_row(self, label: str, value: str, bold_value: bool = False):
        self.set_font("Helvetica", "", 9)
        self.cell(70, 5, label)
        self.set_font("Helvetica", "B" if bold_value else "", 9)
        self.cell(0, 5, value, new_x="LMARGIN", new_y="NEXT")

    def table_header(self, headers: list[str], widths: list[int]):
        self.set_font("Helvetica", "B", 8)
        self.set_fill_color(230, 230, 230)
        for i, h in enumerate(headers):
            align = "R" if i > 0 else "L"
            self.cell(widths[i], 6, h, border=1, fill=True, align=align)
        self.ln()

    def table_row(self, values: list[str], widths: list[int], bold: bool = False):
        self.set_font("Helvetica", "B" if bold else "", 8)
        for i, v in enumerate(values):
            align = "R" if i > 0 else "L"
            self.cell(widths[i], 5, v, border=1, align=align)
        self.ln()


def generate_investor_statement(
    db: Session,
    investor_id: int,
    as_of_date: Optional[date] = None,
) -> bytes:
    """Generate a PDF investor statement and return as bytes."""
    inv = db.query(m.Investor).filter(m.Investor.investor_id == investor_id).first()
    if not inv:
        raise ValueError("Investor not found")

    if as_of_date is None:
        as_of_date = date.today()

    pdf = InvestorStatementPDF(
        investor_name=inv.name,
        statement_date=as_of_date.isoformat(),
    )
    pdf.alias_nb_pages()
    pdf.add_page()

    # ── Investor Info ──────────────────────────────────────────────
    pdf.section_title("Account Information")
    pdf.detail_row("Investor Name:", inv.name)
    pdf.detail_row("Email:", inv.email or "—")
    pdf.detail_row("Phone:", inv.phone or "—")
    pdf.detail_row("Statement Date:", as_of_date.isoformat())
    pdf.detail_row("Investor Type:", (inv.investor_type.value if inv.investor_type else "—").replace("_", " ").title())
    pdf.detail_row("Accredited:", "Yes" if inv.is_accredited else "No")
    pdf.ln(4)

    # ── Holdings Summary ───────────────────────────────────────────
    holdings = db.query(m.Holding).filter(
        m.Holding.investor_id == investor_id,
        m.Holding.status == "active",
    ).all()

    pdf.section_title("Holdings Summary")

    if not holdings:
        pdf.set_font("Helvetica", "I", 9)
        pdf.cell(0, 6, "No active holdings.", new_x="LMARGIN", new_y="NEXT")
    else:
        widths = [55, 25, 25, 30, 30, 25]
        pdf.table_header(
            ["LP Fund", "Units", "Ownership %", "Cost Basis", "Current Value", "NAV/Unit"],
            widths,
        )

        total_cost = 0.0
        total_value = 0.0

        for h in holdings:
            lp = db.query(m.LPEntity).get(h.lp_id)
            lp_name = lp.name if lp else f"LP #{h.lp_id}"
            units = _d(h.units_held)
            ownership = _d(h.ownership_percent)
            cost = _d(h.cost_basis)
            total_cost += cost

            # Compute NAV per unit for this LP
            nav_per_unit = _d(lp.unit_price) if lp else 0.0
            current_value = units * nav_per_unit
            total_value += current_value

            pdf.table_row([
                lp_name[:25],
                f"{units:,.0f}",
                f"{ownership:.1f}%",
                _fmt_currency(cost),
                _fmt_currency(current_value),
                _fmt_currency(nav_per_unit),
            ], widths)

        # Totals row
        pdf.table_row([
            "TOTAL", "", "",
            _fmt_currency(total_cost),
            _fmt_currency(total_value),
            "",
        ], widths, bold=True)

    pdf.ln(4)

    # ── Distribution History ───────────────────────────────────────
    holding_ids = [h.holding_id for h in holdings]
    holding_lp_map = {h.holding_id: h.lp_id for h in holdings}

    allocs = []
    if holding_ids:
        allocs = (
            db.query(m.DistributionAllocation, m.DistributionEvent)
            .join(m.DistributionEvent, m.DistributionAllocation.event_id == m.DistributionEvent.event_id)
            .filter(m.DistributionAllocation.holding_id.in_(holding_ids))
            .order_by(m.DistributionEvent.created_date.desc())
            .all()
        )

    pdf.section_title("Distribution History")

    if not allocs:
        pdf.set_font("Helvetica", "I", 9)
        pdf.cell(0, 6, "No distributions recorded.", new_x="LMARGIN", new_y="NEXT")
    else:
        widths = [35, 45, 30, 30, 25, 25]
        pdf.table_header(
            ["Period", "LP Fund", "Type", "Amount", "Status", "Paid Date"],
            widths,
        )

        lp_cache: dict[int, str] = {}
        total_dist = 0.0

        for alloc, event in allocs:
            lp_id = holding_lp_map.get(alloc.holding_id)
            if lp_id and lp_id not in lp_cache:
                lp = db.query(m.LPEntity).get(lp_id)
                lp_cache[lp_id] = lp.name if lp else f"LP #{lp_id}"

            amount = _d(alloc.amount)
            total_dist += amount

            pdf.table_row([
                (event.period_label or "—")[:15],
                (lp_cache.get(lp_id, "Unknown"))[:20],
                (alloc.distribution_type.value if alloc.distribution_type else "—").replace("_", " ").title()[:15],
                _fmt_currency(amount),
                (event.status.value if event.status else "—").title()[:10],
                _fmt_date(event.paid_date)[:10],
            ], widths)

        pdf.table_row([
            "TOTAL", "", "",
            _fmt_currency(total_dist),
            "", "",
        ], widths, bold=True)

    pdf.ln(4)

    # ── Subscriptions ──────────────────────────────────────────────
    subs = db.query(m.Subscription).filter(
        m.Subscription.investor_id == investor_id,
    ).all()

    pdf.section_title("Subscription History")

    if not subs:
        pdf.set_font("Helvetica", "I", 9)
        pdf.cell(0, 6, "No subscriptions recorded.", new_x="LMARGIN", new_y="NEXT")
    else:
        widths = [50, 30, 30, 30, 25, 25]
        pdf.table_header(
            ["LP Fund", "Committed", "Funded", "Units", "Status", "Date"],
            widths,
        )

        for s in subs:
            lp = db.query(m.LPEntity).get(s.lp_id)
            lp_name = lp.name if lp else f"LP #{s.lp_id}"

            pdf.table_row([
                lp_name[:22],
                _fmt_currency(s.commitment_amount),
                _fmt_currency(s.funded_amount),
                f"{_d(s.unit_quantity):,.0f}",
                (s.status.value if s.status else "—").replace("_", " ").title()[:10],
                _fmt_date(s.submitted_date)[:10],
            ], widths)

    pdf.ln(6)

    # ── Disclaimer ─────────────────────────────────────────────────
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(120, 120, 120)
    pdf.multi_cell(0, 3.5, (
        "This statement is provided for informational purposes only and does not constitute "
        "an offer to sell or a solicitation of an offer to buy any securities. Past performance "
        "is not indicative of future results. Values shown are based on the most recent available "
        "data and may not reflect real-time market conditions. Please consult your financial advisor "
        "for investment decisions."
    ))

    return pdf.output()
