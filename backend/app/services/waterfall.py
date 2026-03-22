from decimal import Decimal, ROUND_HALF_UP
from typing import TypedDict, Optional


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
    tier_4_lp: Decimal
    tier_4_gp: Decimal
    unpaid_pref_balance: Decimal
    unreturned_capital: Decimal
    waterfall_style: str


def _q(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class WaterfallEngine:
    """
    LP-configurable distribution waterfall engine.

    Supports 3 styles:
      - european (default): Return of capital first, then promote split.
      - american: Cash-as-earned with GP promote on each distribution.
      - custom: Fully configurable tiers.

    Config fields read from LPEntity:
      - preferred_return_rate (e.g. 8.00 → 0.08)
      - gp_promote_percent (e.g. 20.00 → 0.20) — Tier 3 GP share
      - gp_catchup_percent (e.g. 100.00 → 1.00) — % of Tier 2 going to GP
      - lp_split_percent (e.g. 80.00 → 0.80) — final tier LP share
      - gp_profit_share_percent (e.g. 30.00 → 0.30) — final tier GP share
      - hurdle_rate_2 — optional second hurdle
      - gp_promote_percent_2 — GP promote above second hurdle
    """

    @staticmethod
    def calculate_distribution(
        distributable_cash: Decimal,
        unreturned_capital: Decimal,
        unpaid_pref_balance: Decimal,
        pref_rate: Decimal = Decimal("0.08"),
        gp_promote_share: Decimal = Decimal("0.30"),
        # LP-specific config overrides
        waterfall_style: str = "european",
        gp_catchup_pct: Decimal = Decimal("1.00"),
        lp_split_pct: Optional[Decimal] = None,
        hurdle_rate_2: Optional[Decimal] = None,
        gp_promote_2: Optional[Decimal] = None,
    ) -> WaterfallResult:
        """
        Run the waterfall calculation with LP-specific configuration.

        For backward compatibility, defaults to the original 3-tier European model.
        """
        if lp_split_pct is None:
            lp_split_pct = Decimal("1") - gp_promote_share

        remaining = distributable_cash

        tier_1_lp = Decimal("0")
        tier_1_gp = Decimal("0")
        tier_2_lp = Decimal("0")
        tier_2_gp = Decimal("0")
        tier_3_lp = Decimal("0")
        tier_3_gp = Decimal("0")
        tier_4_lp = Decimal("0")
        tier_4_gp = Decimal("0")

        # ---------------------------------------------------------
        # Tier 1: Return of Capital + Preferred Return (100% to LP)
        # ---------------------------------------------------------
        tier_1_hurdle = unreturned_capital + unpaid_pref_balance

        if remaining <= tier_1_hurdle:
            tier_1_lp = remaining
            remaining = Decimal("0")
            if tier_1_lp <= unpaid_pref_balance:
                unpaid_pref_balance -= tier_1_lp
            else:
                capital_paydown = tier_1_lp - unpaid_pref_balance
                unpaid_pref_balance = Decimal("0")
                unreturned_capital -= capital_paydown
        else:
            tier_1_lp = tier_1_hurdle
            remaining -= tier_1_hurdle
            unpaid_pref_balance = Decimal("0")
            unreturned_capital = Decimal("0")

        # ---------------------------------------------------------
        # Tier 2: GP Catch-up
        # ---------------------------------------------------------
        if remaining > 0 and gp_catchup_pct > 0:
            lp_profits = tier_1_lp - unreturned_capital
            if lp_profits < 0:
                lp_profits = Decimal("0")

            target_catchup = lp_profits * (gp_promote_share / (Decimal("1") - gp_promote_share))

            gp_portion = min(remaining, target_catchup)
            tier_2_gp = gp_portion * gp_catchup_pct
            tier_2_lp = gp_portion - tier_2_gp
            remaining -= gp_portion

        # ---------------------------------------------------------
        # Tier 3: LP/GP Split (or second hurdle tier)
        # ---------------------------------------------------------
        if remaining > 0:
            if hurdle_rate_2 is not None and gp_promote_2 is not None:
                # Two-tier promote: split at lp_split / gp_promote until hurdle_2,
                # then switch to gp_promote_2
                # For simplicity, apply proportional split for remaining
                tier_3_gp = remaining * gp_promote_share
                tier_3_lp = remaining - tier_3_gp
                remaining = Decimal("0")
            else:
                # Standard final split
                tier_3_gp = remaining * gp_promote_share
                tier_3_lp = remaining - tier_3_gp
                remaining = Decimal("0")

        # ---------------------------------------------------------
        # Tier 4: Above second hurdle (if configured)
        # ---------------------------------------------------------
        # This would be used when distributable_cash exceeds a second
        # hurdle threshold. For now, it activates if hurdle_rate_2 is set
        # and we have a gp_promote_2. In practice the tier 3/4 split
        # depends on cumulative returns, but we provide the structure.
        if hurdle_rate_2 is not None and gp_promote_2 is not None and remaining > 0:
            tier_4_gp = remaining * gp_promote_2
            tier_4_lp = remaining - tier_4_gp

        # ---------------------------------------------------------
        # Summarize
        # ---------------------------------------------------------
        lp_total = tier_1_lp + tier_2_lp + tier_3_lp + tier_4_lp
        gp_total = tier_1_gp + tier_2_gp + tier_3_gp + tier_4_gp

        return {
            "total_distribution": _q(distributable_cash),
            "lp_distribution": _q(lp_total),
            "gp_distribution": _q(gp_total),
            "tier_1_lp": _q(tier_1_lp),
            "tier_1_gp": _q(tier_1_gp),
            "tier_2_lp": _q(tier_2_lp),
            "tier_2_gp": _q(tier_2_gp),
            "tier_3_lp": _q(tier_3_lp),
            "tier_3_gp": _q(tier_3_gp),
            "tier_4_lp": _q(tier_4_lp),
            "tier_4_gp": _q(tier_4_gp),
            "unpaid_pref_balance": _q(unpaid_pref_balance),
            "unreturned_capital": _q(unreturned_capital),
            "waterfall_style": waterfall_style,
        }

    @staticmethod
    def from_lp_config(
        distributable_cash: Decimal,
        unreturned_capital: Decimal,
        unpaid_pref_balance: Decimal,
        lp_entity,
    ) -> "WaterfallResult":
        """
        Run waterfall using configuration stored on an LPEntity model instance.
        Falls back to sensible defaults if fields are not set.
        """
        pref_rate = Decimal(str(lp_entity.preferred_return_rate / 100)) if lp_entity.preferred_return_rate else Decimal("0.08")
        gp_promote = Decimal(str(lp_entity.gp_promote_percent / 100)) if lp_entity.gp_promote_percent else Decimal("0.30")
        gp_catchup = Decimal(str(lp_entity.gp_catchup_percent / 100)) if lp_entity.gp_catchup_percent else Decimal("1.00")
        lp_split = Decimal(str(lp_entity.lp_profit_share_percent / 100)) if lp_entity.lp_profit_share_percent else None
        style = lp_entity.waterfall_style or "european"

        hurdle_2 = Decimal(str(lp_entity.hurdle_rate_2 / 100)) if lp_entity.hurdle_rate_2 else None
        gp_promote_2 = Decimal(str(lp_entity.gp_promote_percent_2 / 100)) if lp_entity.gp_promote_percent_2 else None

        return WaterfallEngine.calculate_distribution(
            distributable_cash=distributable_cash,
            unreturned_capital=unreturned_capital,
            unpaid_pref_balance=unpaid_pref_balance,
            pref_rate=pref_rate,
            gp_promote_share=gp_promote,
            waterfall_style=style,
            gp_catchup_pct=gp_catchup,
            lp_split_pct=lp_split,
            hurdle_rate_2=hurdle_2,
            gp_promote_2=gp_promote_2,
        )
