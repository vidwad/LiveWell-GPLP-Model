import datetime
from decimal import Decimal, ROUND_HALF_UP

# Alberta CMHC Q1-2025 Benchmarks (Hard Costs per SqFt)
# Adjusted slightly to provide a range for the Living Well model
ALBERTA_BENCHMARKS = {
    "multiplex_standard": Decimal("280.00"),  # 4-plex to 6-plex base
    "multiplex_premium": Decimal("350.00"),   # 4-plex to 6-plex high-end (RetireWell)
    "shared_housing": Decimal("320.00"),      # RecoverWell / StudyWell specific buildout
    "commercial_kitchen_add": Decimal("150000.00"), # Flat add for cluster kitchen
}

class CostEstimator:
    """
    Calculates detailed construction costs based on Alberta benchmarks,
    soft costs, contingency, and time-based escalation.
    """

    @staticmethod
    def calculate_total_costs(
        planned_sqft: Decimal,
        building_type: str = "multiplex_standard",
        include_commercial_kitchen: bool = False,
        soft_cost_percent: Decimal = Decimal("20.00"),
        site_cost_flat: Decimal = Decimal("75000.00"),
        financing_cost_percent: Decimal = Decimal("5.00"),
        contingency_percent: Decimal = Decimal("10.00"),
        escalation_percent_per_year: Decimal = Decimal("4.00"),
        months_to_start: int = 0,
    ) -> dict:
        """
        Returns a detailed breakdown of estimated construction costs.
        """
        # 1. Hard Costs
        base_cost_per_sqft = ALBERTA_BENCHMARKS.get(building_type, ALBERTA_BENCHMARKS["multiplex_standard"])
        hard_costs = planned_sqft * base_cost_per_sqft

        if include_commercial_kitchen:
            hard_costs += ALBERTA_BENCHMARKS["commercial_kitchen_add"]

        # 2. Soft Costs (Architecture, Engineering, Permits, Legal)
        soft_costs = hard_costs * (soft_cost_percent / Decimal("100"))

        # 3. Site Costs (Excavation, Servicing, Landscaping)
        site_costs = site_cost_flat

        # Subtotal before financing and contingency
        subtotal_1 = hard_costs + soft_costs + site_costs

        # 4. Financing Costs (Interest reserve, loan fees)
        financing_costs = subtotal_1 * (financing_cost_percent / Decimal("100"))

        # Subtotal before contingency
        subtotal_2 = subtotal_1 + financing_costs

        # 5. Contingency
        contingency = subtotal_2 * (contingency_percent / Decimal("100"))

        # Total Current Cost
        total_current_cost = subtotal_2 + contingency

        # 6. Escalation (Inflation based on time to start)
        escalation_multiplier = Decimal("1")
        if months_to_start > 0:
            years_to_start = Decimal(months_to_start) / Decimal("12")
            # Compound interest formula: (1 + r)^t
            escalation_multiplier = (Decimal("1") + (escalation_percent_per_year / Decimal("100"))) ** years_to_start

        total_escalated_cost = total_current_cost * escalation_multiplier

        # Calculate effective cost per sqft
        effective_cost_per_sqft = total_escalated_cost / planned_sqft if planned_sqft > 0 else Decimal("0")

        return {
            "hard_costs": hard_costs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "soft_costs": soft_costs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "site_costs": site_costs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "financing_costs": financing_costs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "contingency": contingency.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "total_current_cost": total_current_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "escalation_amount": (total_escalated_cost - total_current_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "total_escalated_cost": total_escalated_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "effective_cost_per_sqft": effective_cost_per_sqft.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        }


# Keep existing functions for backward compatibility with other parts of the app
def calculate_construction_costs(unit_count: int, avg_cost_per_unit: Decimal) -> Decimal:
    return Decimal(unit_count) * avg_cost_per_unit

def calculate_noi(rent_income: Decimal, other_income: Decimal, operating_expenses: Decimal) -> Decimal:
    return rent_income + other_income - operating_expenses

def calculate_cap_rate(noi: Decimal, market_value: Decimal) -> Decimal:
    if market_value == 0:
        raise ValueError("market_value cannot be zero")
    return (noi / market_value) * Decimal(100)

def calculate_irr(cash_flow: list[Decimal]) -> Decimal:
    if not cash_flow:
        raise ValueError("cash_flow is empty")
    returns = []
    for t, cf in enumerate(cash_flow):
        returns.append(cf / (Decimal(1) + Decimal(0.1)) ** t)
    total = sum(returns)
    return (total - cash_flow[0]) / abs(cash_flow[0])
