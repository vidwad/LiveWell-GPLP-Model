from decimal import Decimal, ROUND_HALF_UP
from typing import TypedDict

class WaterfallResult(TypedDict):
    total_distribution: Decimal
    lp_distribution: Decimal
    gp_distribution: Decimal
    tier_1_lp: Decimal
    tier_1_gp: Decimal
    tier_2_lp: Decimal
    tier_2_gp: Decimal
    tier_3_lp: Decimal
    tier_3_gp: Decimal
    unpaid_pref_balance: Decimal
    unreturned_capital: Decimal

class WaterfallEngine:
    """
    Calculates GP/LP distributions based on a 3-tier waterfall structure:
    Tier 1: Return of Capital + 8% Preferred Return (100% to LP)
    Tier 2: GP Catch-up (100% to GP until 80/20 split achieved)
    Tier 3: 80/20 LP/GP Split
    """

    @staticmethod
    def calculate_distribution(
        distributable_cash: Decimal,
        unreturned_capital: Decimal,
        unpaid_pref_balance: Decimal,
        pref_rate: Decimal = Decimal("0.08"),
        gp_promote_share: Decimal = Decimal("0.20")
    ) -> WaterfallResult:

        remaining_cash = distributable_cash

        # Initialize buckets
        tier_1_lp = Decimal("0")
        tier_1_gp = Decimal("0")
        tier_2_lp = Decimal("0")
        tier_2_gp = Decimal("0")
        tier_3_lp = Decimal("0")
        tier_3_gp = Decimal("0")

        # ---------------------------------------------------------
        # Tier 1: Return of Capital + Preferred Return (100% to LP)
        # ---------------------------------------------------------
        tier_1_hurdle = unreturned_capital + unpaid_pref_balance

        if remaining_cash <= tier_1_hurdle:
            tier_1_lp = remaining_cash
            remaining_cash = Decimal("0")

            # Pay down pref first, then capital
            if tier_1_lp <= unpaid_pref_balance:
                unpaid_pref_balance -= tier_1_lp
            else:
                capital_paydown = tier_1_lp - unpaid_pref_balance
                unpaid_pref_balance = Decimal("0")
                unreturned_capital -= capital_paydown
        else:
            tier_1_lp = tier_1_hurdle
            remaining_cash -= tier_1_hurdle
            unpaid_pref_balance = Decimal("0")
            unreturned_capital = Decimal("0")

        # ---------------------------------------------------------
        # Tier 2: GP Catch-up (100% to GP until split achieved)
        # ---------------------------------------------------------
        if remaining_cash > 0:
            # How much does GP need to catch up to the promote share?
            # If GP gets 20% of total profits, GP = 0.2 * (LP_Profits + GP_Profits)
            # GP = (0.2 / 0.8) * LP_Profits

            lp_profits_so_far = tier_1_lp - unreturned_capital # Only pref is profit
            if lp_profits_so_far < 0:
                lp_profits_so_far = Decimal("0")

            target_gp_catchup = lp_profits_so_far * (gp_promote_share / (Decimal("1") - gp_promote_share))

            if remaining_cash <= target_gp_catchup:
                tier_2_gp = remaining_cash
                remaining_cash = Decimal("0")
            else:
                tier_2_gp = target_gp_catchup
                remaining_cash -= target_gp_catchup

        # ---------------------------------------------------------
        # Tier 3: 80/20 Split
        # ---------------------------------------------------------
        if remaining_cash > 0:
            tier_3_gp = remaining_cash * gp_promote_share
            tier_3_lp = remaining_cash - tier_3_gp

        # ---------------------------------------------------------
        # Summarize
        # ---------------------------------------------------------
        lp_total = tier_1_lp + tier_2_lp + tier_3_lp
        gp_total = tier_1_gp + tier_2_gp + tier_3_gp

        return {
            "total_distribution": distributable_cash.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "lp_distribution": lp_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "gp_distribution": gp_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_1_lp": tier_1_lp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_1_gp": tier_1_gp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_2_lp": tier_2_lp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_2_gp": tier_2_gp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_3_lp": tier_3_lp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "tier_3_gp": tier_3_gp.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "unpaid_pref_balance": unpaid_pref_balance.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "unreturned_capital": unreturned_capital.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        }
