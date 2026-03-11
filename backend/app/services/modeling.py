from decimal import Decimal


def calculate_construction_costs(unit_count: int, avg_cost_per_unit: Decimal) -> Decimal:
    return Decimal(unit_count) * avg_cost_per_unit


def calculate_noi(rent_income: Decimal, other_income: Decimal, operating_expenses: Decimal) -> Decimal:
    return rent_income + other_income - operating_expenses


def calculate_cap_rate(noi: Decimal, market_value: Decimal) -> Decimal:
    if market_value == 0:
        raise ValueError("market_value cannot be zero")
    return (noi / market_value) * Decimal(100)


def calculate_irr(cash_flow: list[Decimal]) -> Decimal:
    # placeholder: implement proper IRR or use numpy_financial
    if not cash_flow:
        raise ValueError("cash_flow is empty")
    returns = []
    for t, cf in enumerate(cash_flow):
        returns.append(cf / (Decimal(1) + Decimal(0.1)) ** t)
    total = sum(returns)
    return (total - cash_flow[0]) / abs(cash_flow[0])
