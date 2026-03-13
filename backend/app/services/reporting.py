from sqlalchemy.orm import Session
from app.db.models import Property, LPEntity, DebtFacility
from app.services.calculations import calculate_noi, calculate_annual_debt_service, calculate_ltv


def generate_fund_performance_report(db: Session) -> dict:
    """
    Generate a performance report rolled up by LP Entity.
    """
    lps = db.query(LPEntity).all()
    report = []

    for lp in lps:
        properties = db.query(Property).filter(Property.lp_id == lp.lp_id).all()
        
        total_value = 0.0
        total_debt = 0.0
        total_noi = 0.0
        total_debt_service = 0.0

        for prop in properties:
            # Value
            val = float(prop.estimated_value or prop.purchase_price or 0)
            total_value += val

            # Debt
            debts = db.query(DebtFacility).filter(
                DebtFacility.property_id == prop.property_id,
                DebtFacility.status == "active"
            ).all()
            
            prop_debt = sum(float(d.outstanding_balance or 0) for d in debts)
            total_debt += prop_debt

            for d in debts:
                if d.outstanding_balance and d.interest_rate:
                    ds = calculate_annual_debt_service(
                        float(d.outstanding_balance),
                        float(d.interest_rate),
                        d.amortization_months or 0,
                        d.io_period_months or 0
                    )
                    total_debt_service += ds

            # NOI from development plans (projected) or estimate from planned units
            active_plans = [p for p in prop.development_plans if p.status.value in ("active", "approved")]
            if active_plans:
                plan = active_plans[0]
                if plan.projected_annual_noi:
                    total_noi += float(plan.projected_annual_noi)
                elif plan.planned_units and plan.planned_units > 0:
                    gross_rev = plan.planned_units * 1500 * 12
                    noi_dict = calculate_noi(gross_potential_revenue=gross_rev, operating_expenses=gross_rev * 0.3)
                    total_noi += noi_dict["noi"]

        # Fund level metrics
        fund_ltv = (total_debt / total_value * 100) if total_value > 0 else 0
        fund_dscr = (total_noi / total_debt_service) if total_debt_service > 0 else None

        report.append({
            "lp_id": lp.lp_id,
            "lp_name": lp.name,
            "property_count": len(properties),
            "total_value": round(total_value, 2),
            "total_debt": round(total_debt, 2),
            "total_equity": round(total_value - total_debt, 2),
            "total_noi": round(total_noi, 2),
            "portfolio_ltv": round(fund_ltv, 2),
            "portfolio_dscr": round(fund_dscr, 2) if fund_dscr else None
        })

    return {"funds": report}
