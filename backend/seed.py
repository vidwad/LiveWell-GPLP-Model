"""
Living Well Communities Platform — Seed Script
================================================
Phase 1 Foundation: Seeds the database with demo data that reflects the
correct GP → LP → Subscription → Holding → Property architecture.

Usage:
    cd backend
    python seed.py
"""
import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import engine, SessionLocal
from app.db.base import Base
import app.db.models as m  # noqa: F401 — registers all models


def seed():
    # Drop and recreate all tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # =================================================================
        # 1. USERS (6 demo accounts)
        # =================================================================
        from app.core.security import hash_password

        users = {
            "admin": m.User(
                email="admin@livingwell.ca",
                hashed_password=hash_password("Password1!"),
                full_name="Vidwad Patel (GP Admin)",
                role=m.UserRole.GP_ADMIN,
            ),
            "ops": m.User(
                email="ops@livingwell.ca",
                hashed_password=hash_password("Password1!"),
                full_name="Jordan Ops Manager",
                role=m.UserRole.OPERATIONS_MANAGER,
            ),
            "pm": m.User(
                email="pm@livingwell.ca",
                hashed_password=hash_password("Password1!"),
                full_name="Casey Property Manager",
                role=m.UserRole.PROPERTY_MANAGER,
            ),
            "investor1": m.User(
                email="investor1@example.com",
                hashed_password=hash_password("Password1!"),
                full_name="Sarah Mitchell",
                role=m.UserRole.INVESTOR,
            ),
            "investor2": m.User(
                email="investor2@example.com",
                hashed_password=hash_password("Password1!"),
                full_name="James Chen",
                role=m.UserRole.INVESTOR,
            ),
            "resident": m.User(
                email="resident@example.com",
                hashed_password=hash_password("Password1!"),
                full_name="Alex Resident",
                role=m.UserRole.RESIDENT,
            ),
        }
        for u in users.values():
            db.add(u)
        db.flush()

        # =================================================================
        # 2. GP ENTITY
        # =================================================================
        gp = m.GPEntity(
            legal_name="Alberta Multiplex GP Inc.",
            management_fee_percent=Decimal("2.00"),
            address="Suite 400, 123 Centre St SW, Calgary, AB T2P 0A5",
            contact_email="gp@albertamultiplex.ca",
            notes="General partner managing all Living Well LP funds.",
        )
        db.add(gp)
        db.flush()

        # =================================================================
        # 3. LP ENTITIES (2 funds)
        # =================================================================
        lp1 = m.LPEntity(
            gp_id=gp.gp_id,
            name="Living Well Fund I LP",
            legal_name="Living Well Fund I Limited Partnership",
            lp_number="LW-001",
            description="First fund — RecoverWell and StudyWell properties in Calgary and Edmonton.",
            city_focus="Calgary, Edmonton",
            community_focus="RecoverWell, StudyWell",
            purpose_type=m.LPPurposeType.mixed,
            status=m.LPStatus.operating,
            unit_price=Decimal("1000.00"),
            minimum_subscription=Decimal("50000.00"),
            target_raise=Decimal("5000000.00"),
            minimum_raise=Decimal("2000000.00"),
            maximum_raise=Decimal("6000000.00"),
            offering_date=date(2024, 6, 1),
            closing_date=date(2024, 12, 31),
            formation_costs=Decimal("75000.00"),
            offering_costs=Decimal("250000.00"),
            reserve_percent=Decimal("5.00"),
            preferred_return_rate=Decimal("8.00"),
            gp_promote_percent=Decimal("30.00"),
            gp_catchup_percent=Decimal("100.00"),
            lp_split_percent=Decimal("70.00"),
            management_fee_percent=Decimal("2.50"),
            asset_management_fee_percent=Decimal("2.50"),
            acquisition_fee_percent=Decimal("2.00"),
            selling_commission_percent=Decimal("10.00"),
            construction_management_fee_percent=Decimal("1.50"),
            refinancing_fee_percent=Decimal("2.50"),
            turnover_replacement_fee_percent=Decimal("2.00"),
            lp_profit_share_percent=Decimal("70.00"),
            gp_profit_share_percent=Decimal("30.00"),
            total_units_authorized=Decimal("5000"),
            notes="Fully funded and operating. Properties acquired in Calgary and Edmonton.",
        )
        lp2 = m.LPEntity(
            gp_id=gp.gp_id,
            name="Living Well Fund II LP",
            legal_name="Living Well Fund II Limited Partnership",
            lp_number="LW-002",
            description="Second fund — RetireWell properties in Red Deer and Lethbridge.",
            city_focus="Red Deer, Lethbridge",
            community_focus="RetireWell",
            purpose_type=m.LPPurposeType.retire_well,
            status=m.LPStatus.open_for_subscription,
            unit_price=Decimal("1000.00"),
            minimum_subscription=Decimal("100000.00"),
            target_raise=Decimal("8000000.00"),
            minimum_raise=Decimal("3000000.00"),
            maximum_raise=Decimal("10000000.00"),
            offering_date=date(2025, 3, 1),
            closing_date=date(2025, 9, 30),
            formation_costs=Decimal("100000.00"),
            offering_costs=Decimal("250000.00"),
            reserve_percent=Decimal("5.00"),
            preferred_return_rate=Decimal("8.00"),
            gp_promote_percent=Decimal("30.00"),
            gp_catchup_percent=Decimal("100.00"),
            lp_split_percent=Decimal("70.00"),
            management_fee_percent=Decimal("2.50"),
            asset_management_fee_percent=Decimal("2.50"),
            acquisition_fee_percent=Decimal("2.00"),
            selling_commission_percent=Decimal("10.00"),
            construction_management_fee_percent=Decimal("1.50"),
            refinancing_fee_percent=Decimal("2.50"),
            turnover_replacement_fee_percent=Decimal("2.00"),
            lp_profit_share_percent=Decimal("70.00"),
            gp_profit_share_percent=Decimal("30.00"),
            total_units_authorized=Decimal("10000"),
            notes="Currently raising capital. First tranche open.",
        )
        db.add_all([lp1, lp2])
        db.flush()

        # =================================================================
        # 3a-2. LP FEE SCHEDULE ITEMS (8 defaults per LP)
        # =================================================================
        def seed_fee_items(lp):
            """Seed the 8 required default fee items for an LP."""
            items = [
                m.LPFeeItem(
                    lp_id=lp.lp_id,
                    fee_name="Selling Commission",
                    fee_slug="selling_commission",
                    fee_type=m.FeeType.percentage,
                    rate=Decimal("10.0000"),
                    basis_type=m.BasisType.gross_raise,
                    basis_description="Gross capital raise / subscription amount",
                    timing_trigger="Upon subscription acceptance and funding",
                    calculation_description="10% of gross capital raised, deducted from offering proceeds before deployment",
                    is_active=True,
                    default_rate=Decimal("10.0000"),
                ),
                m.LPFeeItem(
                    lp_id=lp.lp_id,
                    fee_name="Offering / Setup Cost",
                    fee_slug="offering_setup_cost",
                    fee_type=m.FeeType.fixed,
                    fixed_amount=Decimal("250000.00"),
                    basis_type=m.BasisType.not_applicable,
                    basis_description="Fixed amount — legal, accounting, regulatory, and formation costs",
                    timing_trigger="Upon LP formation / offering launch",
                    calculation_description="Fixed $250,000 deducted from gross raise before capital deployment",
                    is_active=True,
                    default_fixed_amount=Decimal("250000.00"),
                ),
                m.LPFeeItem(
                    lp_id=lp.lp_id,
                    fee_name="Acquisition / Closing Fee",
                    fee_slug="acquisition_closing_fee",
                    fee_type=m.FeeType.percentage,
                    rate=Decimal("2.0000"),
                    basis_type=m.BasisType.acquisition_cost,
                    basis_description="Initial capital cost of acquired portfolio or configured acquisition basis",
                    timing_trigger="Upon acquisition / closing of each property",
                    calculation_description="2.0% of acquisition cost, paid to GP at closing",
                    is_active=True,
                    default_rate=Decimal("2.0000"),
                ),
                m.LPFeeItem(
                    lp_id=lp.lp_id,
                    fee_name="Ongoing Management Fee",
                    fee_slug="ongoing_management_fee",
                    fee_type=m.FeeType.percentage,
                    rate=Decimal("2.5000"),
                    basis_type=m.BasisType.gross_revenues,
                    basis_description="Gross revenues from property operations",
                    timing_trigger="Ongoing — calculated monthly/quarterly during operations",
                    calculation_description="2.5% of gross revenues, included in operating expenses",
                    is_active=True,
                    default_rate=Decimal("2.5000"),
                ),
                m.LPFeeItem(
                    lp_id=lp.lp_id,
                    fee_name="Construction Management Fee",
                    fee_slug="construction_management_fee",
                    fee_type=m.FeeType.percentage,
                    rate=Decimal("1.5000"),
                    basis_type=m.BasisType.construction_budget,
                    basis_description="Total construction / redevelopment budget",
                    timing_trigger="During construction / redevelopment phase",
                    calculation_description="1.5% of construction budget, included in total project capital requirement",
                    is_active=True,
                    default_rate=Decimal("1.5000"),
                ),
                m.LPFeeItem(
                    lp_id=lp.lp_id,
                    fee_name="Refinancing Fee",
                    fee_slug="refinancing_fee",
                    fee_type=m.FeeType.percentage,
                    rate=Decimal("2.5000"),
                    basis_type=m.BasisType.refinance_amount,
                    basis_description="Total refinance loan amount",
                    timing_trigger="Upon refinancing event",
                    calculation_description="2.5% of refinance amount, paid to GP at refinance closing",
                    is_active=True,
                    default_rate=Decimal("2.5000"),
                ),
                m.LPFeeItem(
                    lp_id=lp.lp_id,
                    fee_name="Turnover / Replacement Fee",
                    fee_slug="turnover_replacement_fee",
                    fee_type=m.FeeType.percentage,
                    rate=Decimal("2.0000"),
                    basis_type=m.BasisType.fair_market_value,
                    basis_description="Fair market value of the property at time of turnover",
                    timing_trigger="Upon property turnover or replacement event",
                    calculation_description="2.0% of fair market value, configurable LP fee",
                    is_active=True,
                    default_rate=Decimal("2.0000"),
                ),
                m.LPFeeItem(
                    lp_id=lp.lp_id,
                    fee_name="Profit Sharing After Priority Return",
                    fee_slug="profit_sharing",
                    fee_type=m.FeeType.percentage,
                    rate=Decimal("30.0000"),
                    basis_type=m.BasisType.sale_proceeds,
                    basis_description="Net profits after LP priority return / hurdle",
                    timing_trigger="Post-hurdle — applied to distributions, refinance proceeds, and sale proceeds",
                    calculation_description="70% to LP holders / 30% to GP after priority return is met",
                    is_active=True,
                    default_rate=Decimal("30.0000"),
                ),
            ]
            return items

        fee_items_lp1 = seed_fee_items(lp1)
        fee_items_lp2 = seed_fee_items(lp2)
        db.add_all(fee_items_lp1 + fee_items_lp2)
        db.flush()

        # =================================================================
        # 3b. LP TRANCHES / CLOSINGS
        # =================================================================
        # Fund I — single tranche (closed)
        tranche_f1 = m.LPTranche(
            lp_id=lp1.lp_id,
            tranche_number=1,
            tranche_name="Initial Close",
            opening_date=date(2024, 6, 1),
            closing_date=date(2024, 8, 31),
            status=m.TrancheStatus.closed,
            issue_price=Decimal("1000.00"),
            target_amount=Decimal("5000000.00"),
            notes="Fund I single tranche — fully subscribed.",
        )
        # Fund II — two tranches
        tranche_f2_1 = m.LPTranche(
            lp_id=lp2.lp_id,
            tranche_number=1,
            tranche_name="First Close",
            opening_date=date(2025, 3, 1),
            closing_date=date(2025, 6, 30),
            status=m.TrancheStatus.open,
            issue_price=Decimal("1000.00"),
            target_amount=Decimal("4000000.00"),
            notes="First close targeting $4M.",
        )
        tranche_f2_2 = m.LPTranche(
            lp_id=lp2.lp_id,
            tranche_number=2,
            tranche_name="Second Close",
            opening_date=date(2025, 7, 1),
            closing_date=date(2025, 9, 30),
            status=m.TrancheStatus.draft,
            issue_price=Decimal("1000.00"),
            target_amount=Decimal("4000000.00"),
            notes="Second close planned for Q3 2025.",
        )
        db.add_all([tranche_f1, tranche_f2_1, tranche_f2_2])
        db.flush()

        # =================================================================
        # 4. INVESTORS
        # =================================================================
        inv1 = m.Investor(
            user_id=users["investor1"].user_id,
            name="Sarah Mitchell",
            email="investor1@example.com",
            phone="403-555-0101",
            address="456 Investor Ave, Calgary, AB T2N 1N4",
            entity_type="individual",
            jurisdiction="Alberta",
            accredited_status="accredited",
            exemption_type="accredited_investor",
        )
        inv2 = m.Investor(
            user_id=users["investor2"].user_id,
            name="James Chen",
            email="investor2@example.com",
            phone="780-555-0202",
            address="789 Capital Blvd, Edmonton, AB T5J 0R1",
            entity_type="corporation",
            jurisdiction="Alberta",
            accredited_status="accredited",
            exemption_type="accredited_investor",
        )
        inv3 = m.Investor(
            name="Priya Sharma Family Trust",
            email="priya@sharmatrust.ca",
            phone="403-555-0303",
            address="321 Trust Lane, Calgary, AB T2P 2T2",
            entity_type="trust",
            jurisdiction="Alberta",
            accredited_status="accredited",
            exemption_type="accredited_investor",
        )
        db.add_all([inv1, inv2, inv3])
        db.flush()

        # =================================================================
        # 5. SUBSCRIPTIONS (investors committing to LPs)
        # =================================================================
        sub1 = m.Subscription(
            investor_id=inv1.investor_id,
            lp_id=lp1.lp_id,
            tranche_id=tranche_f1.tranche_id,
            commitment_amount=Decimal("250000.00"),
            funded_amount=Decimal("250000.00"),
            issue_price=Decimal("1000.00"),
            unit_quantity=Decimal("250.0000"),
            status=m.SubscriptionStatus.issued,
            submitted_date=date(2024, 7, 15),
            accepted_date=date(2024, 7, 22),
            funded_date=date(2024, 8, 1),
            issued_date=date(2024, 8, 5),
        )
        sub2 = m.Subscription(
            investor_id=inv2.investor_id,
            lp_id=lp1.lp_id,
            tranche_id=tranche_f1.tranche_id,
            commitment_amount=Decimal("500000.00"),
            funded_amount=Decimal("500000.00"),
            issue_price=Decimal("1000.00"),
            unit_quantity=Decimal("500.0000"),
            status=m.SubscriptionStatus.issued,
            submitted_date=date(2024, 7, 20),
            accepted_date=date(2024, 7, 28),
            funded_date=date(2024, 8, 10),
            issued_date=date(2024, 8, 15),
        )
        sub3 = m.Subscription(
            investor_id=inv3.investor_id,
            lp_id=lp1.lp_id,
            tranche_id=tranche_f1.tranche_id,
            commitment_amount=Decimal("200000.00"),
            funded_amount=Decimal("200000.00"),
            issue_price=Decimal("1000.00"),
            unit_quantity=Decimal("200.0000"),
            status=m.SubscriptionStatus.issued,
            submitted_date=date(2024, 8, 1),
            accepted_date=date(2024, 8, 8),
            funded_date=date(2024, 8, 20),
            issued_date=date(2024, 8, 25),
        )
        sub4 = m.Subscription(
            investor_id=inv1.investor_id,
            lp_id=lp2.lp_id,
            tranche_id=tranche_f2_1.tranche_id,
            commitment_amount=Decimal("300000.00"),
            funded_amount=Decimal("150000.00"),
            issue_price=Decimal("1000.00"),
            unit_quantity=Decimal("300.0000"),
            status=m.SubscriptionStatus.funded,
            submitted_date=date(2025, 4, 1),
            accepted_date=date(2025, 4, 10),
            funded_date=date(2025, 5, 1),
            notes="Partial funding — second tranche due Q3 2025.",
        )
        sub5 = m.Subscription(
            investor_id=inv2.investor_id,
            lp_id=lp2.lp_id,
            tranche_id=tranche_f2_1.tranche_id,
            commitment_amount=Decimal("750000.00"),
            funded_amount=Decimal("0.00"),
            issue_price=Decimal("1000.00"),
            unit_quantity=Decimal("750.0000"),
            status=m.SubscriptionStatus.accepted,
            submitted_date=date(2025, 4, 15),
            accepted_date=date(2025, 4, 25),
            notes="Awaiting first capital call.",
        )
        db.add_all([sub1, sub2, sub3, sub4, sub5])
        db.flush()

        # =================================================================
        # 6. HOLDINGS (equity positions — issued from funded subscriptions)
        # =================================================================
        # Fund I total funded: 250K + 500K + 200K = 950K (LP)
        # GP also holds a position in Fund I (5%)
        hold_gp_f1 = m.Holding(
            investor_id=inv1.investor_id,
            lp_id=lp1.lp_id,
            units_held=Decimal("50.0000"),
            average_issue_price=Decimal("1000.00"),
            total_capital_contributed=Decimal("50000.00"),
            initial_issue_date=date(2024, 8, 5),
            unreturned_capital=Decimal("50000.00"),
            unpaid_preferred=Decimal("0.00"),
            is_gp=True,
        )
        hold1 = m.Holding(
            investor_id=inv1.investor_id,
            lp_id=lp1.lp_id,
            subscription_id=sub1.subscription_id,
            units_held=Decimal("250.0000"),
            average_issue_price=Decimal("1000.00"),
            total_capital_contributed=Decimal("250000.00"),
            initial_issue_date=date(2024, 8, 5),
            unreturned_capital=Decimal("250000.00"),
            unpaid_preferred=Decimal("0.00"),
            is_gp=False,
        )
        hold2 = m.Holding(
            investor_id=inv2.investor_id,
            lp_id=lp1.lp_id,
            subscription_id=sub2.subscription_id,
            units_held=Decimal("500.0000"),
            average_issue_price=Decimal("1000.00"),
            total_capital_contributed=Decimal("500000.00"),
            initial_issue_date=date(2024, 8, 15),
            unreturned_capital=Decimal("500000.00"),
            unpaid_preferred=Decimal("0.00"),
            is_gp=False,
        )
        hold3 = m.Holding(
            investor_id=inv3.investor_id,
            lp_id=lp1.lp_id,
            subscription_id=sub3.subscription_id,
            units_held=Decimal("200.0000"),
            average_issue_price=Decimal("1000.00"),
            total_capital_contributed=Decimal("200000.00"),
            initial_issue_date=date(2024, 8, 25),
            unreturned_capital=Decimal("200000.00"),
            unpaid_preferred=Decimal("0.00"),
            is_gp=False,
        )
        # Fund II — only one holding so far (Sarah's partial funding)
        hold4 = m.Holding(
            investor_id=inv1.investor_id,
            lp_id=lp2.lp_id,
            subscription_id=sub4.subscription_id,
            units_held=Decimal("150.0000"),
            average_issue_price=Decimal("1000.00"),
            total_capital_contributed=Decimal("150000.00"),
            initial_issue_date=date(2025, 5, 1),
            unreturned_capital=Decimal("150000.00"),
            unpaid_preferred=Decimal("0.00"),
            is_gp=False,
        )
        db.add_all([hold_gp_f1, hold1, hold2, hold3, hold4])
        db.flush()

        # =================================================================
        # 7. DISTRIBUTION EVENT (Fund I Q4 2025)
        # =================================================================
        dist_event = m.DistributionEvent(
            lp_id=lp1.lp_id,
            period_label="Q4 2025",
            total_distributable=Decimal("50000.00"),
            status=m.DistributionEventStatus.paid,
            created_date=datetime(2025, 12, 15),
            approved_date=datetime(2025, 12, 20),
            paid_date=datetime(2025, 12, 28),
            notes="First quarterly distribution from stabilized operations.",
        )
        db.add(dist_event)
        db.flush()

        # Allocations proportional to LP ownership (25/50/20 out of 95% LP total)
        alloc1 = m.DistributionAllocation(
            event_id=dist_event.event_id,
            holding_id=hold1.holding_id,
            amount=Decimal("13157.89"),
            distribution_type=m.DistributionType.preferred_return,
            method=m.DistributionMethod.etransfer,
        )
        alloc2 = m.DistributionAllocation(
            event_id=dist_event.event_id,
            holding_id=hold2.holding_id,
            amount=Decimal("26315.79"),
            distribution_type=m.DistributionType.preferred_return,
            method=m.DistributionMethod.wire,
        )
        alloc3 = m.DistributionAllocation(
            event_id=dist_event.event_id,
            holding_id=hold3.holding_id,
            amount=Decimal("10526.32"),
            distribution_type=m.DistributionType.preferred_return,
            method=m.DistributionMethod.etransfer,
        )
        db.add_all([alloc1, alloc2, alloc3])
        db.flush()

        # =================================================================
        # 7b. TARGET / PIPELINE PROPERTIES (Fund II)
        # =================================================================
        tp1 = m.TargetProperty(
            lp_id=lp2.lp_id,
            address="45 Sunset Drive",
            city="Red Deer",
            province="AB",
            intended_community="RetireWell",
            status=m.TargetPropertyStatus.under_offer,
            estimated_acquisition_price=Decimal("750000.00"),
            lot_size=Decimal("6500.00"),
            zoning="R-CG",
            current_sqft=Decimal("1800.00"),
            current_bedrooms=4,
            current_bathrooms=2,
            current_condition="fair",
            current_assessed_value=Decimal("700000.00"),
            interim_monthly_revenue=Decimal("4500.00"),
            interim_monthly_expenses=Decimal("2200.00"),
            interim_occupancy_percent=Decimal("90.00"),
            interim_hold_months=12,
            planned_units=6,
            planned_beds=12,
            planned_sqft=Decimal("5400.00"),
            construction_budget=Decimal("1200000.00"),
            hard_costs=Decimal("900000.00"),
            soft_costs=Decimal("200000.00"),
            contingency_percent=Decimal("8.00"),
            construction_duration_months=14,
            stabilized_monthly_revenue=Decimal("18000.00"),
            stabilized_monthly_expenses=Decimal("7200.00"),
            stabilized_occupancy_percent=Decimal("95.00"),
            stabilized_annual_noi=Decimal("129600.00"),
            stabilized_cap_rate=Decimal("5.50"),
            stabilized_value=Decimal("2356364.00"),
            assumed_ltv_percent=Decimal("65.00"),
            assumed_interest_rate=Decimal("5.2500"),
            assumed_amortization_months=300,
            assumed_debt_amount=Decimal("1268000.00"),
            target_acquisition_date=date(2025, 7, 1),
            target_completion_date=date(2026, 9, 1),
            target_stabilization_date=date(2027, 3, 1),
            notes="Primary target for Fund II. Zoning approved for 6-plex.",
        )
        tp2 = m.TargetProperty(
            lp_id=lp2.lp_id,
            address="112 Heritage Lane",
            city="Red Deer",
            province="AB",
            intended_community="RetireWell",
            status=m.TargetPropertyStatus.identified,
            estimated_acquisition_price=Decimal("680000.00"),
            lot_size=Decimal("5800.00"),
            zoning="R-CG",
            current_sqft=Decimal("1600.00"),
            current_bedrooms=3,
            current_bathrooms=2,
            current_condition="good",
            current_assessed_value=Decimal("650000.00"),
            interim_monthly_revenue=Decimal("4000.00"),
            interim_monthly_expenses=Decimal("2000.00"),
            interim_occupancy_percent=Decimal("92.00"),
            interim_hold_months=18,
            planned_units=5,
            planned_beds=10,
            planned_sqft=Decimal("4500.00"),
            construction_budget=Decimal("1050000.00"),
            hard_costs=Decimal("800000.00"),
            soft_costs=Decimal("170000.00"),
            contingency_percent=Decimal("8.00"),
            construction_duration_months=12,
            stabilized_monthly_revenue=Decimal("15000.00"),
            stabilized_monthly_expenses=Decimal("6000.00"),
            stabilized_occupancy_percent=Decimal("95.00"),
            stabilized_annual_noi=Decimal("108000.00"),
            stabilized_cap_rate=Decimal("5.50"),
            stabilized_value=Decimal("1963636.00"),
            assumed_ltv_percent=Decimal("65.00"),
            assumed_interest_rate=Decimal("5.2500"),
            assumed_amortization_months=300,
            assumed_debt_amount=Decimal("1124000.00"),
            target_acquisition_date=date(2025, 10, 1),
            target_completion_date=date(2026, 10, 1),
            target_stabilization_date=date(2027, 4, 1),
            notes="Secondary target. Needs rezoning application.",
        )
        tp3 = m.TargetProperty(
            lp_id=lp2.lp_id,
            address="78 Lakeview Crescent",
            city="Lethbridge",
            province="AB",
            intended_community="RetireWell",
            status=m.TargetPropertyStatus.identified,
            estimated_acquisition_price=Decimal("620000.00"),
            lot_size=Decimal("7000.00"),
            zoning="R-2",
            current_sqft=Decimal("2000.00"),
            current_bedrooms=4,
            current_bathrooms=3,
            current_condition="good",
            current_assessed_value=Decimal("600000.00"),
            planned_units=8,
            planned_beds=16,
            planned_sqft=Decimal("6400.00"),
            construction_budget=Decimal("1500000.00"),
            hard_costs=Decimal("1100000.00"),
            soft_costs=Decimal("280000.00"),
            contingency_percent=Decimal("8.00"),
            construction_duration_months=16,
            stabilized_monthly_revenue=Decimal("24000.00"),
            stabilized_monthly_expenses=Decimal("9600.00"),
            stabilized_occupancy_percent=Decimal("93.00"),
            stabilized_annual_noi=Decimal("172800.00"),
            stabilized_cap_rate=Decimal("5.50"),
            stabilized_value=Decimal("3141818.00"),
            assumed_ltv_percent=Decimal("65.00"),
            assumed_interest_rate=Decimal("5.5000"),
            assumed_amortization_months=300,
            assumed_debt_amount=Decimal("1379000.00"),
            target_acquisition_date=date(2026, 1, 1),
            target_completion_date=date(2027, 5, 1),
            target_stabilization_date=date(2027, 11, 1),
            notes="Lethbridge expansion. Large lot suitable for 8-plex.",
        )
        db.add_all([tp1, tp2, tp3])
        db.flush()

        # =================================================================
        # 8. OPERATOR ENTITIES
        # =================================================================
        op_recover = m.OperatorEntity(
            name="RecoverWell Operations Inc.",
            contact_email="ops@recoverwell.ca",
            contact_phone="403-555-1000",
            address="Suite 200, 456 Recovery Rd, Calgary, AB",
            notes="Operates all RecoverWell sober living communities.",
        )
        op_study = m.OperatorEntity(
            name="StudyWell Housing Co.",
            contact_email="ops@studywell.ca",
            contact_phone="780-555-2000",
            address="Suite 100, 789 Campus Dr, Edmonton, AB",
            notes="Operates all StudyWell student housing communities.",
        )
        op_retire = m.OperatorEntity(
            name="RetireWell Living Corp.",
            contact_email="ops@retirewell.ca",
            contact_phone="403-555-3000",
            address="Suite 300, 321 Sunset Blvd, Red Deer, AB",
            notes="Operates all RetireWell retirement communities.",
        )
        db.add_all([op_recover, op_study, op_retire])
        db.flush()

        # =================================================================
        # 8b. PROPERTY MANAGERS
        # =================================================================
        pm_calgary = m.PropertyManagerEntity(
            name="Prairie Property Management Ltd.",
            contact_email="info@prairiepm.ca",
            contact_phone="403-555-4000",
            address="Suite 400, 100 Centre St S, Calgary, AB",
            management_fee_percent=Decimal("8.00"),
            contract_start_date=date(2024, 9, 1),
            notes="Manages all Calgary properties. Full-service: maintenance, inspections, rent collection.",
        )
        pm_edmonton = m.PropertyManagerEntity(
            name="Northern Realty Services Inc.",
            contact_email="info@northernrealty.ca",
            contact_phone="780-555-5000",
            address="Suite 200, 10123 99 St, Edmonton, AB",
            management_fee_percent=Decimal("7.50"),
            contract_start_date=date(2024, 11, 1),
            notes="Manages Edmonton-area properties.",
        )
        db.add_all([pm_calgary, pm_edmonton])
        db.flush()

        # =================================================================
        # 9. PROPERTY CLUSTERS
        # =================================================================
        cluster_ne = m.PropertyCluster(
            name="Calgary NE Cluster",
            city="Calgary",
            has_commercial_kitchen=True,
            kitchen_capacity_meals_per_day=200,
            notes="Serves 5 properties in NE Calgary.",
        )
        cluster_south = m.PropertyCluster(
            name="Calgary South Cluster",
            city="Calgary",
            has_commercial_kitchen=False,
            notes="Planned cluster — kitchen pending.",
        )
        db.add_all([cluster_ne, cluster_south])
        db.flush()

        # =================================================================
        # 10. PROPERTIES (5 properties across 2 LPs)
        # =================================================================
        prop1 = m.Property(
            lp_id=lp1.lp_id,
            cluster_id=cluster_ne.cluster_id,
            pm_id=pm_calgary.pm_id,
            address="123 Recovery Road NE",
            city="Calgary",
            province="Alberta",
            purchase_date=date(2024, 9, 15),
            purchase_price=Decimal("650000.00"),
            assessed_value=Decimal("620000.00"),
            current_market_value=Decimal("700000.00"),
            estimated_value=Decimal("4200000.00"),
            lot_size=Decimal("5500.00"),
            zoning="R-CG",
            max_buildable_area=Decimal("4400.00"),
            floor_area_ratio=Decimal("0.80"),
            development_stage=m.DevelopmentStage.stabilized,
        )
        prop2 = m.Property(
            lp_id=lp1.lp_id,
            cluster_id=cluster_ne.cluster_id,
            pm_id=pm_calgary.pm_id,
            address="456 Healing Avenue NE",
            city="Calgary",
            province="Alberta",
            purchase_date=date(2024, 10, 1),
            purchase_price=Decimal("580000.00"),
            assessed_value=Decimal("560000.00"),
            current_market_value=Decimal("610000.00"),
            lot_size=Decimal("5000.00"),
            zoning="R-CG",
            max_buildable_area=Decimal("4000.00"),
            floor_area_ratio=Decimal("0.80"),
            development_stage=m.DevelopmentStage.construction,
        )
        prop3 = m.Property(
            lp_id=lp1.lp_id,
            pm_id=pm_edmonton.pm_id,
            address="789 Campus Drive",
            city="Edmonton",
            province="Alberta",
            purchase_date=date(2024, 11, 15),
            purchase_price=Decimal("720000.00"),
            assessed_value=Decimal("700000.00"),
            current_market_value=Decimal("750000.00"),
            lot_size=Decimal("6200.00"),
            zoning="DC",
            max_buildable_area=Decimal("5580.00"),
            floor_area_ratio=Decimal("0.90"),
            development_stage=m.DevelopmentStage.lease_up,
        )
        prop4 = m.Property(
            lp_id=lp2.lp_id,
            pm_id=pm_calgary.pm_id,
            address="321 Sunset Boulevard",
            city="Red Deer",
            province="Alberta",
            purchase_date=date(2025, 3, 1),
            purchase_price=Decimal("480000.00"),
            assessed_value=Decimal("460000.00"),
            current_market_value=Decimal("490000.00"),
            lot_size=Decimal("7000.00"),
            zoning="R-2",
            max_buildable_area=Decimal("4900.00"),
            floor_area_ratio=Decimal("0.70"),
            development_stage=m.DevelopmentStage.acquisition,
        )
        prop5 = m.Property(
            lp_id=lp2.lp_id,
            address="555 Prairie View Lane",
            city="Lethbridge",
            province="Alberta",
            lot_size=Decimal("8000.00"),
            zoning="R-2",
            development_stage=m.DevelopmentStage.prospect,
        )
        db.add_all([prop1, prop2, prop3, prop4, prop5])
        db.flush()

        # =================================================================
        # 10b. DEBT FACILITIES
        # =================================================================
        # ── Debt Facilities ──────────────────────────────────────
        debt1 = m.DebtFacility(
            property_id=prop1.property_id,
            lender_name="ATB Financial",
            debt_type=m.DebtType.permanent_mortgage,
            status=m.DebtStatus.active,
            commitment_amount=Decimal("2400000.00"),
            drawn_amount=Decimal("2400000.00"),
            outstanding_balance=Decimal("2350000.00"),
            interest_rate=Decimal("5.2500"),
            rate_type="fixed",
            term_months=60,
            amortization_months=300,
            io_period_months=0,
            origination_date=date(2024, 6, 1),
            maturity_date=date(2029, 6, 1),
            ltv_covenant=Decimal("75.00"),
            dscr_covenant=Decimal("1.25"),
        )
        debt2 = m.DebtFacility(
            property_id=prop2.property_id,
            lender_name="First National Financial",
            debt_type=m.DebtType.construction_loan,
            status=m.DebtStatus.active,
            commitment_amount=Decimal("3500000.00"),
            drawn_amount=Decimal("1200000.00"),
            outstanding_balance=Decimal("1200000.00"),
            interest_rate=Decimal("6.7500"),
            rate_type="variable",
            term_months=24,
            amortization_months=0,
            io_period_months=24,
            origination_date=date(2025, 1, 15),
            maturity_date=date(2027, 1, 15),
            ltv_covenant=Decimal("80.00"),
            dscr_covenant=None,
        )
        debt3 = m.DebtFacility(
            property_id=prop3.property_id,
            lender_name="CMHC MLI Select",
            debt_type=m.DebtType.permanent_mortgage,
            status=m.DebtStatus.pending,
            commitment_amount=Decimal("4000000.00"),
            drawn_amount=Decimal("0.00"),
            outstanding_balance=Decimal("0.00"),
            interest_rate=Decimal("4.8500"),
            rate_type="fixed",
            term_months=120,
            amortization_months=300,
            io_period_months=0,
            origination_date=None,
            maturity_date=None,
            ltv_covenant=Decimal("80.00"),
            dscr_covenant=Decimal("1.10"),
            notes="CMHC MLI Select program — pending approval",
        )
        db.add_all([debt1, debt2, debt3])
        db.commit()
        print("  [ok] Debt facilities")

        # =================================================================
        # 11. DEVELOPMENT PLANS
        # =================================================================
        # (plans are created first so we can reference plan_id for plan-linked debt below)
        plan1 = m.DevelopmentPlan(
            property_id=prop1.property_id,
            version=1,
            plan_name="8-Plex Conversion",
            status=m.DevelopmentPlanStatus.active,
            planned_units=8,
            planned_beds=16,
            planned_sqft=Decimal("4200.00"),
            hard_costs=Decimal("1260000.00"),
            soft_costs=Decimal("252000.00"),
            site_costs=Decimal("75000.00"),
            financing_costs=Decimal("79350.00"),
            contingency_percent=Decimal("10.00"),
            cost_per_sqft=Decimal("300.00"),
            estimated_construction_cost=Decimal("1830885.00"),
            projected_annual_revenue=Decimal("230400.00"),
            projected_annual_noi=Decimal("161280.00"),
            development_start_date=date(2024, 10, 1),
            construction_duration_days=270,
            estimated_completion_date=date(2025, 6, 28),
            estimated_stabilization_date=date(2025, 9, 28),
            rent_pricing_mode=m.RentPricingMode.by_bed,
            annual_rent_increase_pct=Decimal("3.00"),
        )
        plan2 = m.DevelopmentPlan(
            property_id=prop2.property_id,
            version=1,
            plan_name="6-Unit Student Housing",
            status=m.DevelopmentPlanStatus.approved,
            planned_units=6,
            planned_beds=12,
            planned_sqft=Decimal("3600.00"),
            hard_costs=Decimal("1080000.00"),
            soft_costs=Decimal("216000.00"),
            site_costs=Decimal("75000.00"),
            financing_costs=Decimal("68550.00"),
            contingency_percent=Decimal("10.00"),
            cost_per_sqft=Decimal("300.00"),
            estimated_construction_cost=Decimal("1583505.00"),
            projected_annual_revenue=Decimal("172800.00"),
            projected_annual_noi=Decimal("120960.00"),
            development_start_date=date(2025, 1, 15),
            construction_duration_days=300,
            estimated_completion_date=date(2025, 11, 11),
            estimated_stabilization_date=date(2026, 2, 11),
        )
        plan3 = m.DevelopmentPlan(
            property_id=prop3.property_id,
            version=1,
            plan_name="10-Bed Recovery Home",
            status=m.DevelopmentPlanStatus.active,
            planned_units=10,
            planned_beds=20,
            planned_sqft=Decimal("5400.00"),
            hard_costs=Decimal("1620000.00"),
            soft_costs=Decimal("324000.00"),
            site_costs=Decimal("85000.00"),
            financing_costs=Decimal("101450.00"),
            contingency_percent=Decimal("10.00"),
            cost_per_sqft=Decimal("300.00"),
            estimated_construction_cost=Decimal("2343495.00"),
            projected_annual_revenue=Decimal("288000.00"),
            projected_annual_noi=Decimal("201600.00"),
            development_start_date=date(2025, 2, 1),
            construction_duration_days=240,
            estimated_completion_date=date(2025, 9, 29),
            estimated_stabilization_date=date(2025, 12, 29),
        )
        db.add_all([plan1, plan2, plan3])
        db.flush()

        # Plan-linked debt: construction loan for plan1 (prop1 redevelopment)
        debt_plan1_construction = m.DebtFacility(
            property_id=prop1.property_id,
            lender_name="ATB Financial",
            debt_type=m.DebtType.construction_loan,
            status=m.DebtStatus.active,
            commitment_amount=Decimal("1830000.00"),
            drawn_amount=Decimal("900000.00"),
            outstanding_balance=Decimal("900000.00"),
            interest_rate=Decimal("6.5000"),
            rate_type="variable",
            term_months=18,
            amortization_months=0,
            io_period_months=18,
            origination_date=date(2024, 10, 1),
            maturity_date=date(2026, 4, 1),
            ltv_covenant=Decimal("80.00"),
            dscr_covenant=None,
            debt_purpose="construction",
            development_plan_id=plan1.plan_id,
            notes="Construction financing for 8-plex redevelopment",
        )
        debt_plan1_perm = m.DebtFacility(
            property_id=prop1.property_id,
            lender_name="CMHC MLI Select",
            debt_type=m.DebtType.permanent_mortgage,
            status=m.DebtStatus.pending,
            commitment_amount=Decimal("2800000.00"),
            drawn_amount=Decimal("0.00"),
            outstanding_balance=Decimal("0.00"),
            interest_rate=Decimal("4.7500"),
            rate_type="fixed",
            term_months=120,
            amortization_months=300,
            io_period_months=0,
            origination_date=None,
            maturity_date=None,
            ltv_covenant=Decimal("75.00"),
            dscr_covenant=Decimal("1.20"),
            debt_purpose="refinancing",
            replaces_debt_id=debt1.debt_id,
            development_plan_id=plan1.plan_id,
            notes="Permanent take-out financing post-stabilization, replaces acquisition mortgage",
        )
        db.add_all([debt_plan1_construction, debt_plan1_perm])
        db.flush()
        print("  [ok] Plan-linked debt facilities")

        # =================================================================
        # 12. COMMUNITIES
        # =================================================================
        # Communities are city + purpose level — multiple properties can belong
        # to the same community.  E.g. both prop1 and prop2 are in the
        # "RecoverWell Calgary" community.
        comm1 = m.Community(
            operator_id=op_recover.operator_id,
            community_type=m.CommunityType.recover,
            name="RecoverWell Calgary",
            city="Calgary",
            province="Alberta",
            has_meal_plan=True,
            meal_plan_monthly_cost=Decimal("350.00"),
            target_occupancy_percent=Decimal("95.00"),
            description="Calgary-area recovery community supporting adults in addiction and mental health recovery.",
        )
        comm2 = m.Community(
            operator_id=op_study.operator_id,
            community_type=m.CommunityType.study,
            name="StudyWell Edmonton",
            city="Edmonton",
            province="Alberta",
            has_meal_plan=False,
            target_occupancy_percent=Decimal("90.00"),
            description="Edmonton student housing community near post-secondary campuses.",
        )
        comm3 = m.Community(
            operator_id=op_retire.operator_id,
            community_type=m.CommunityType.retire,
            name="RetireWell Red Deer",
            city="Red Deer",
            province="Alberta",
            has_meal_plan=True,
            meal_plan_monthly_cost=Decimal("500.00"),
            target_occupancy_percent=Decimal("92.00"),
            description="Red Deer seniors living community with full meal service.",
        )
        db.add_all([comm1, comm2, comm3])
        db.flush()

        # Assign properties to communities
        prop1.community_id = comm1.community_id  # 123 Recovery Rd → RecoverWell Calgary
        prop2.community_id = comm1.community_id  # 456 Healing Ave → RecoverWell Calgary
        prop3.community_id = comm2.community_id  # 789 Scholar Blvd → StudyWell Edmonton
        prop4.community_id = comm3.community_id  # 321 Sunset Dr → RetireWell Red Deer
        db.flush()

        # =================================================================
        # 13. UNITS & BEDS (for stabilized property prop1)
        # =================================================================
        # Units belong to properties (physical configuration of the house).
        # community_id is set for operational grouping.
        # prop1 = 123 Recovery Rd (stabilized, 8 units)
        units_data_prop1 = [
            ("101", m.UnitType.shared, 2, 450, "Main", False),
            ("102", m.UnitType.shared, 2, 450, "Main", False),
            ("103", m.UnitType.one_bed, 1, 500, "Main", False),
            ("104", m.UnitType.shared, 2, 450, "Main", False),
            ("201", m.UnitType.shared, 2, 450, "Upper", False),
            ("202", m.UnitType.shared, 2, 450, "Upper", False),
            ("203", m.UnitType.one_bed, 1, 500, "Upper", False),
            ("204", m.UnitType.suite, 2, 600, "Basement", True),
        ]
        units = []
        for unit_num, utype, beds, sqft, floor, is_suite in units_data_prop1:
            u = m.Unit(
                property_id=prop1.property_id,
                community_id=comm1.community_id,
                unit_number=unit_num,
                unit_type=utype,
                bed_count=beds,
                sqft=Decimal(str(sqft)),
                floor=floor,
                is_legal_suite=is_suite,
                is_occupied=True,
            )
            db.add(u)
            db.flush()
            units.append(u)

            # Create beds for each unit
            for b in range(1, beds + 1):
                rent = Decimal("1200.00") if utype == m.UnitType.shared else Decimal("1500.00")
                if utype == m.UnitType.suite:
                    rent = Decimal("1800.00")
                bed = m.Bed(
                    unit_id=u.unit_id,
                    bed_label=f"{unit_num}-B{b}",
                    monthly_rent=rent,
                    rent_type=m.RentType.private_pay,
                    status=m.BedStatus.occupied,
                )
                db.add(bed)
            db.flush()

        # ── Post-Development Units for prop1 ──
        # After redevelopment: 8-plex with 3 bedrooms each (24 beds total)
        post_reno_units_prop1 = [
            ("A1", m.UnitType.three_bed, 3, 750, "Main", False),
            ("A2", m.UnitType.three_bed, 3, 750, "Main", False),
            ("A3", m.UnitType.three_bed, 3, 700, "Main", False),
            ("A4", m.UnitType.three_bed, 3, 700, "Main", False),
            ("B1", m.UnitType.three_bed, 3, 750, "Upper", False),
            ("B2", m.UnitType.three_bed, 3, 750, "Upper", False),
            ("B3", m.UnitType.three_bed, 3, 700, "Upper", False),
            ("B4", m.UnitType.three_bed, 3, 700, "Upper", False),
        ]
        for unit_num, utype, beds, sqft, floor, is_suite in post_reno_units_prop1:
            u = m.Unit(
                property_id=prop1.property_id,
                community_id=comm1.community_id,
                unit_number=unit_num,
                unit_type=utype,
                bed_count=beds,
                sqft=Decimal(str(sqft)),
                floor=floor,
                is_legal_suite=is_suite,
                is_occupied=False,
                renovation_phase=m.RenovationPhase.post_renovation,
                bedroom_count=3,
                development_plan_id=plan1.plan_id,
            )
            db.add(u)
            db.flush()
            for b in range(1, beds + 1):
                bed = m.Bed(
                    unit_id=u.unit_id,
                    bed_label=f"{unit_num}-B{b}",
                    monthly_rent=Decimal("1400.00"),
                    rent_type=m.RentType.private_pay,
                    status=m.BedStatus.available,
                    bedroom_number=b,
                    is_post_renovation=True,
                )
                db.add(bed)
        db.flush()

        # prop2 = 456 Healing Ave (lease_up, 6 units)
        units_data_prop2 = [
            ("101", m.UnitType.shared, 2, 400, "Main", False),
            ("102", m.UnitType.one_bed, 1, 480, "Main", False),
            ("103", m.UnitType.shared, 2, 400, "Main", False),
            ("201", m.UnitType.shared, 2, 420, "Upper", False),
            ("202", m.UnitType.one_bed, 1, 480, "Upper", False),
            ("B01", m.UnitType.suite, 2, 550, "Basement", True),
        ]
        for unit_num, utype, beds, sqft, floor, is_suite in units_data_prop2:
            u = m.Unit(
                property_id=prop2.property_id,
                community_id=comm1.community_id,
                unit_number=unit_num,
                unit_type=utype,
                bed_count=beds,
                sqft=Decimal(str(sqft)),
                floor=floor,
                is_legal_suite=is_suite,
                is_occupied=False,
            )
            db.add(u)
            db.flush()
            for b in range(1, beds + 1):
                rent = Decimal("1100.00") if utype == m.UnitType.shared else Decimal("1400.00")
                if utype == m.UnitType.suite:
                    rent = Decimal("1700.00")
                bed = m.Bed(
                    unit_id=u.unit_id,
                    bed_label=f"{unit_num}-B{b}",
                    monthly_rent=rent,
                    rent_type=m.RentType.private_pay,
                    status=m.BedStatus.available,
                )
                db.add(bed)
        db.flush()

        # =================================================================
        # 14. RESIDENTS (7 residents in comm1)
        # =================================================================
        resident_data = [
            ("Michael Torres", "101", "B1", m.RentType.private_pay),
            ("David Kim", "101", "B2", m.RentType.private_pay),
            ("Rachel Green", "102", "B1", m.RentType.government_supported),
            ("Tom Wilson", "102", "B2", m.RentType.government_supported),
            ("Emma Davis", "103", "B1", m.RentType.private_pay),
            ("Chris Brown", "201", "B1", m.RentType.private_pay),
            ("Lisa Anderson", "201", "B2", m.RentType.transitional),
        ]
        residents = []
        for name, unit_num, bed_num, rent_type in resident_data:
            unit = next(u for u in units if u.unit_number == unit_num)
            bed = db.query(m.Bed).filter(
                m.Bed.unit_id == unit.unit_id,
                m.Bed.bed_label == f"{unit_num}-{bed_num}",
            ).first()
            res = m.Resident(
                community_id=comm1.community_id,
                unit_id=unit.unit_id,
                bed_id=bed.bed_id if bed else None,
                full_name=name,
                bed_number=f"{unit_num}-{bed_num}",
                rent_type=rent_type,
                move_in_date=date(2025, 7, 1),
                enrolled_meal_plan=True,
            )
            db.add(res)
            db.flush()
            residents.append(res)

        # =================================================================
        # 15. RENT PAYMENTS (last 3 months for all residents)
        # =================================================================
        for res in residents:
            for month_offset in range(3):
                month = 10 + month_offset  # Oct, Nov, Dec 2025
                payment = m.RentPayment(
                    resident_id=res.resident_id,
                    bed_id=res.bed_id,
                    amount=Decimal("1200.00") if res.rent_type != m.RentType.transitional else Decimal("800.00"),
                    payment_date=datetime(2025, month, 1),
                    period_month=month,
                    period_year=2025,
                    status=m.PaymentStatus.paid,
                    includes_meal_plan=res.enrolled_meal_plan,
                )
                db.add(payment)
        db.flush()

        # =================================================================
        # 16. MAINTENANCE REQUESTS
        # =================================================================
        maint1 = m.MaintenanceRequest(
            property_id=prop1.property_id,
            resident_id=residents[0].resident_id,
            description="Leaking faucet in bathroom",
            status=m.MaintenanceStatus.resolved,
            priority="medium",
            category="plumbing",
            created_at=datetime(2025, 11, 5),
            resolved_at=datetime(2025, 11, 7),
        )
        maint2 = m.MaintenanceRequest(
            property_id=prop1.property_id,
            resident_id=residents[2].resident_id,
            description="Heating not working in unit 102",
            status=m.MaintenanceStatus.in_progress,
            priority="high",
            category="hvac",
            created_at=datetime(2025, 12, 10),
        )
        maint3 = m.MaintenanceRequest(
            property_id=prop1.property_id,
            description="Exterior light out — parking lot",
            status=m.MaintenanceStatus.open,
            priority="low",
            category="electrical",
            created_at=datetime(2025, 12, 20),
        )
        db.add_all([maint1, maint2, maint3])
        db.flush()

        # =================================================================
        # 17. INVESTOR DOCUMENTS & MESSAGES
        # =================================================================
        doc1 = m.InvestorDocument(
            investor_id=inv1.investor_id,
            title="Fund I Subscription Agreement — Sarah Mitchell",
            document_type=m.DocumentType.subscription_agreement,
            file_url="/docs/fund1_sub_sarah.pdf",
            upload_date=datetime(2024, 7, 15),
            is_viewed=True,
        )
        doc2 = m.InvestorDocument(
            investor_id=inv1.investor_id,
            title="Q4 2025 Quarterly Report",
            document_type=m.DocumentType.quarterly_report,
            file_url="/docs/fund1_q4_2025_report.pdf",
            upload_date=datetime(2025, 12, 28),
            is_viewed=False,
        )
        doc3 = m.InvestorDocument(
            investor_id=inv2.investor_id,
            title="Fund I Subscription Agreement — James Chen",
            document_type=m.DocumentType.subscription_agreement,
            file_url="/docs/fund1_sub_james.pdf",
            upload_date=datetime(2024, 7, 20),
            is_viewed=True,
        )
        db.add_all([doc1, doc2, doc3])

        msg1 = m.InvestorMessage(
            investor_id=inv1.investor_id,
            sender_id=users["admin"].user_id,
            subject="Welcome to Living Well Fund I",
            body="Thank you for your investment. Your subscription has been processed and units have been issued.",
            sent_at=datetime(2024, 8, 5),
            is_read=True,
        )
        msg2 = m.InvestorMessage(
            investor_id=inv1.investor_id,
            sender_id=users["admin"].user_id,
            subject="Q4 2025 Distribution Notice",
            body="Your Q4 2025 distribution of $13,157.89 has been sent via eTransfer.",
            sent_at=datetime(2025, 12, 28),
            is_read=False,
        )
        db.add_all([msg1, msg2])
        db.flush()

        # =================================================================
        # 18. SCOPE ASSIGNMENTS
        # =================================================================
        # GP Admin gets implicit full access via role, no scope needed
        # Ops manager gets access to LP1 and LP2
        scope1 = m.ScopeAssignment(
            user_id=users["ops"].user_id,
            entity_type=m.ScopeEntityType.lp,
            entity_id=lp1.lp_id,
            permission_level=m.ScopePermissionLevel.manage,
        )
        scope2 = m.ScopeAssignment(
            user_id=users["ops"].user_id,
            entity_type=m.ScopeEntityType.lp,
            entity_id=lp2.lp_id,
            permission_level=m.ScopePermissionLevel.manage,
        )
        # Property manager gets access to prop1 and prop2 only
        scope3 = m.ScopeAssignment(
            user_id=users["pm"].user_id,
            entity_type=m.ScopeEntityType.property,
            entity_id=prop1.property_id,
            permission_level=m.ScopePermissionLevel.manage,
        )
        scope4 = m.ScopeAssignment(
            user_id=users["pm"].user_id,
            entity_type=m.ScopeEntityType.property,
            entity_id=prop2.property_id,
            permission_level=m.ScopePermissionLevel.manage,
        )
        # Investor1 gets scope to LP1 and LP2
        scope5 = m.ScopeAssignment(
            user_id=users["investor1"].user_id,
            entity_type=m.ScopeEntityType.lp,
            entity_id=lp1.lp_id,
            permission_level=m.ScopePermissionLevel.view,
        )
        scope6 = m.ScopeAssignment(
            user_id=users["investor1"].user_id,
            entity_type=m.ScopeEntityType.lp,
            entity_id=lp2.lp_id,
            permission_level=m.ScopePermissionLevel.view,
        )
        # Investor2 gets scope to LP1 only
        scope7 = m.ScopeAssignment(
            user_id=users["investor2"].user_id,
            entity_type=m.ScopeEntityType.lp,
            entity_id=lp1.lp_id,
            permission_level=m.ScopePermissionLevel.view,
        )
        db.add_all([scope1, scope2, scope3, scope4, scope5, scope6, scope7])
        db.flush()

        # =================================================================
        # 19. AUDIT LOG (sample entries)
        # =================================================================
        audit1 = m.AuditLog(
            user_id=users["admin"].user_id,
            action="distribution.approved",
            entity_type="DistributionEvent",
            entity_id=dist_event.event_id,
            details='{"period": "Q4 2025", "total": 50000.00}',
            timestamp=datetime(2025, 12, 20),
        )
        audit2 = m.AuditLog(
            user_id=users["admin"].user_id,
            action="subscription.issued",
            entity_type="Subscription",
            entity_id=sub1.subscription_id,
            details='{"investor": "Sarah Mitchell", "amount": 250000.00}',
            timestamp=datetime(2024, 8, 5),
        )
        db.add_all([audit1, audit2])
        db.flush()

        # =================================================================
        # 20. PHASE 3: PROPERTY STAGE TRANSITIONS (audit trail)
        # =================================================================
        # prop1 went: prospect → acquisition → planning → construction → lease_up → stabilized
        transitions = [
            m.PropertyStageTransition(
                property_id=prop1.property_id,
                from_stage=m.DevelopmentStage.prospect,
                to_stage=m.DevelopmentStage.acquisition,
                transitioned_by=users["admin"].user_id,
                transitioned_at=datetime(2024, 8, 1),
                notes="Site selected, purchase agreement signed.",
                validation_passed=True,
            ),
            m.PropertyStageTransition(
                property_id=prop1.property_id,
                from_stage=m.DevelopmentStage.acquisition,
                to_stage=m.DevelopmentStage.planning,
                transitioned_by=users["admin"].user_id,
                transitioned_at=datetime(2024, 9, 20),
                notes="Due diligence complete, moving to planning.",
                validation_passed=True,
            ),
            m.PropertyStageTransition(
                property_id=prop1.property_id,
                from_stage=m.DevelopmentStage.planning,
                to_stage=m.DevelopmentStage.construction,
                transitioned_by=users["admin"].user_id,
                transitioned_at=datetime(2024, 10, 1),
                notes="Development permit approved, construction financing secured.",
                validation_passed=True,
            ),
            m.PropertyStageTransition(
                property_id=prop1.property_id,
                from_stage=m.DevelopmentStage.construction,
                to_stage=m.DevelopmentStage.lease_up,
                transitioned_by=users["admin"].user_id,
                transitioned_at=datetime(2025, 6, 28),
                notes="Construction complete, occupancy permit received.",
                validation_passed=True,
            ),
            m.PropertyStageTransition(
                property_id=prop1.property_id,
                from_stage=m.DevelopmentStage.lease_up,
                to_stage=m.DevelopmentStage.stabilized,
                transitioned_by=users["admin"].user_id,
                transitioned_at=datetime(2025, 9, 28),
                notes="95% occupancy achieved, permanent financing in place.",
                validation_passed=True,
            ),
        ]
        db.add_all(transitions)
        db.flush()
        print("  [ok] Stage transitions")

        # =================================================================
        # 21. PHASE 3: PROPERTY MILESTONES
        # =================================================================
        milestones = [
            # Stabilized milestones for prop1
            m.PropertyMilestone(
                property_id=prop1.property_id,
                title="Permanent financing in place",
                status=m.MilestoneStatus.completed,
                stage=m.DevelopmentStage.stabilized,
                target_date=date(2025, 9, 1),
                actual_date=date(2025, 8, 28),
                sort_order=0,
            ),
            m.PropertyMilestone(
                property_id=prop1.property_id,
                title="First quarterly distribution",
                status=m.MilestoneStatus.completed,
                stage=m.DevelopmentStage.stabilized,
                target_date=date(2025, 12, 31),
                actual_date=date(2025, 12, 28),
                sort_order=1,
            ),
            m.PropertyMilestone(
                property_id=prop1.property_id,
                title="Annual budget approved",
                status=m.MilestoneStatus.in_progress,
                stage=m.DevelopmentStage.stabilized,
                target_date=date(2026, 1, 15),
                sort_order=2,
            ),
            m.PropertyMilestone(
                property_id=prop1.property_id,
                title="Property management review",
                status=m.MilestoneStatus.pending,
                stage=m.DevelopmentStage.stabilized,
                target_date=date(2026, 3, 31),
                sort_order=3,
            ),
            # Construction milestones for prop2
            m.PropertyMilestone(
                property_id=prop2.property_id,
                title="Construction commencement",
                status=m.MilestoneStatus.completed,
                stage=m.DevelopmentStage.construction,
                target_date=date(2025, 1, 15),
                actual_date=date(2025, 1, 15),
                sort_order=0,
            ),
            m.PropertyMilestone(
                property_id=prop2.property_id,
                title="Foundation and framing complete",
                status=m.MilestoneStatus.completed,
                stage=m.DevelopmentStage.construction,
                target_date=date(2025, 4, 15),
                actual_date=date(2025, 4, 20),
                sort_order=1,
            ),
            m.PropertyMilestone(
                property_id=prop2.property_id,
                title="Mechanical/electrical rough-in",
                status=m.MilestoneStatus.in_progress,
                stage=m.DevelopmentStage.construction,
                target_date=date(2025, 7, 1),
                sort_order=2,
            ),
            m.PropertyMilestone(
                property_id=prop2.property_id,
                title="Interior finishing",
                status=m.MilestoneStatus.pending,
                stage=m.DevelopmentStage.construction,
                target_date=date(2025, 9, 15),
                sort_order=3,
            ),
            m.PropertyMilestone(
                property_id=prop2.property_id,
                title="Final inspection and occupancy permit",
                status=m.MilestoneStatus.pending,
                stage=m.DevelopmentStage.construction,
                target_date=date(2025, 11, 11),
                sort_order=4,
            ),
            # Lease-up milestones for prop3
            m.PropertyMilestone(
                property_id=prop3.property_id,
                title="Marketing campaign launched",
                status=m.MilestoneStatus.completed,
                stage=m.DevelopmentStage.lease_up,
                target_date=date(2025, 10, 1),
                actual_date=date(2025, 9, 29),
                sort_order=0,
            ),
            m.PropertyMilestone(
                property_id=prop3.property_id,
                title="First resident move-in",
                status=m.MilestoneStatus.in_progress,
                stage=m.DevelopmentStage.lease_up,
                target_date=date(2025, 11, 1),
                sort_order=1,
            ),
            m.PropertyMilestone(
                property_id=prop3.property_id,
                title="50% occupancy achieved",
                status=m.MilestoneStatus.pending,
                stage=m.DevelopmentStage.lease_up,
                target_date=date(2026, 1, 15),
                sort_order=2,
            ),
        ]
        db.add_all(milestones)
        db.flush()
        print("  [ok] Property milestones")

        # =================================================================
        # 22. PHASE 3: eTRANSFER TRACKING
        # =================================================================
        et1 = m.ETransferTracking(
            allocation_id=alloc1.allocation_id,
            recipient_email="investor1@example.com",
            amount=Decimal("13157.89"),
            security_question="What is the fund name?",
            reference_number="ET-2025-001",
            status=m.ETransferStatus.accepted,
            initiated_at=datetime(2025, 12, 28, 10, 0),
            sent_at=datetime(2025, 12, 28, 10, 5),
            accepted_at=datetime(2025, 12, 28, 14, 30),
            expires_at=datetime(2026, 1, 27, 10, 0),
        )
        et2 = m.ETransferTracking(
            allocation_id=alloc3.allocation_id,
            recipient_email="priya@sharmatrust.ca",
            amount=Decimal("10526.32"),
            security_question="What is the fund name?",
            reference_number="ET-2025-003",
            status=m.ETransferStatus.sent,
            initiated_at=datetime(2025, 12, 28, 10, 0),
            sent_at=datetime(2025, 12, 28, 10, 5),
            expires_at=datetime(2026, 1, 27, 10, 0),
            notes="Awaiting acceptance.",
        )
        db.add_all([et1, et2])
        db.flush()
        print("  [ok] eTransfer tracking")

        # =================================================================
        # 23. PHASE 3: MESSAGE THREAD REPLIES
        # =================================================================
        reply1 = m.MessageThread(
            parent_message_id=msg1.message_id,
            sender_id=users["investor1"].user_id,
            body="Thank you! Excited to be part of this fund. When can I expect the first quarterly report?",
            sent_at=datetime(2024, 8, 6, 9, 0),
            is_read=True,
        )
        reply2 = m.MessageThread(
            parent_message_id=msg1.message_id,
            sender_id=users["admin"].user_id,
            body="You're welcome, Sarah! The first quarterly report will be available after Q4 2024. We'll notify you when it's published.",
            sent_at=datetime(2024, 8, 6, 14, 30),
            is_read=True,
        )
        reply3 = m.MessageThread(
            parent_message_id=msg2.message_id,
            sender_id=users["investor1"].user_id,
            body="Received the eTransfer, thank you! The fund is performing well.",
            sent_at=datetime(2025, 12, 29, 10, 0),
            is_read=False,
        )
        db.add_all([reply1, reply2, reply3])
        db.flush()
        print("  [ok] Message thread replies")

        # =================================================================
        # 24. PHASE 3: OPERATOR BUDGETS
        # =================================================================
        budget1 = m.OperatorBudget(
            operator_id=op_recover.operator_id,
            community_id=comm1.community_id,
            period_type=m.BudgetPeriodType.annual,
            period_label="2026",
            year=2026,
            budgeted_revenue=Decimal("230400.00"),
            budgeted_expenses=Decimal("69120.00"),
            budgeted_noi=Decimal("161280.00"),
            notes="Annual budget for RecoverWell Calgary NE — 16 beds at full occupancy.",
        )
        budget2 = m.OperatorBudget(
            operator_id=op_recover.operator_id,
            community_id=comm1.community_id,
            period_type=m.BudgetPeriodType.quarterly,
            period_label="Q4 2025",
            year=2025,
            quarter=4,
            budgeted_revenue=Decimal("57600.00"),
            budgeted_expenses=Decimal("17280.00"),
            budgeted_noi=Decimal("40320.00"),
            actual_revenue=Decimal("55200.00"),
            actual_expenses=Decimal("16850.00"),
            actual_noi=Decimal("38350.00"),
            notes="Q4 2025 actuals recorded — slightly below budget due to vacancy.",
        )
        budget3 = m.OperatorBudget(
            operator_id=op_study.operator_id,
            community_id=comm2.community_id,
            period_type=m.BudgetPeriodType.annual,
            period_label="2026",
            year=2026,
            budgeted_revenue=Decimal("288000.00"),
            budgeted_expenses=Decimal("86400.00"),
            budgeted_noi=Decimal("201600.00"),
            notes="Annual budget for StudyWell Edmonton Campus — 20 beds.",
        )
        db.add_all([budget1, budget2, budget3])
        db.flush()
        print("  [ok] Operator budgets")

        # =================================================================
        # 25. PHASE 3: OPERATING EXPENSES
        # =================================================================
        expenses = [
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.property_management,
                description="Property management fee — October",
                amount=Decimal("1920.00"),
                expense_date=date(2025, 10, 1),
                period_month=10,
                period_year=2025,
                vendor="RecoverWell Operations Inc.",
                is_recurring=True,
            ),
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.property_management,
                description="Property management fee — November",
                amount=Decimal("1920.00"),
                expense_date=date(2025, 11, 1),
                period_month=11,
                period_year=2025,
                vendor="RecoverWell Operations Inc.",
                is_recurring=True,
            ),
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.property_management,
                description="Property management fee — December",
                amount=Decimal("1920.00"),
                expense_date=date(2025, 12, 1),
                period_month=12,
                period_year=2025,
                vendor="RecoverWell Operations Inc.",
                is_recurring=True,
            ),
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.utilities,
                description="Natural gas — October",
                amount=Decimal("420.00"),
                expense_date=date(2025, 10, 15),
                period_month=10,
                period_year=2025,
                vendor="ATCO Gas",
                is_recurring=True,
            ),
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.utilities,
                description="Electricity — October",
                amount=Decimal("380.00"),
                expense_date=date(2025, 10, 15),
                period_month=10,
                period_year=2025,
                vendor="ENMAX",
                is_recurring=True,
            ),
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.meal_program,
                description="Meal program supplies — October",
                amount=Decimal("2100.00"),
                expense_date=date(2025, 10, 20),
                period_month=10,
                period_year=2025,
                vendor="Sysco Calgary",
                is_recurring=True,
            ),
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.maintenance_repairs,
                description="Plumbing repair — Unit 101 faucet",
                amount=Decimal("285.00"),
                expense_date=date(2025, 11, 7),
                period_month=11,
                period_year=2025,
                vendor="Calgary Plumbing Co.",
                invoice_ref="INV-2025-1107",
            ),
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.insurance,
                description="Property insurance — Q4 2025",
                amount=Decimal("1875.00"),
                expense_date=date(2025, 10, 1),
                period_month=10,
                period_year=2025,
                vendor="Intact Insurance",
                is_recurring=True,
            ),
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.staffing,
                description="House manager salary — October",
                amount=Decimal("3500.00"),
                expense_date=date(2025, 10, 31),
                period_month=10,
                period_year=2025,
                vendor="RecoverWell Operations Inc.",
                is_recurring=True,
            ),
            m.OperatingExpense(
                community_id=comm1.community_id,
                budget_id=budget2.budget_id,
                category=m.ExpenseCategory.supplies,
                description="Cleaning supplies and household items",
                amount=Decimal("530.00"),
                expense_date=date(2025, 11, 15),
                period_month=11,
                period_year=2025,
                vendor="Costco Business Centre",
            ),
        ]
        db.add_all(expenses)
        db.flush()
        print("  [ok] Operating expenses")

        # =================================================================
        # 26. PHASE 3: QUARTERLY REPORT (pre-generated for Q4 2025)
        # =================================================================
        qr1 = m.QuarterlyReport(
            lp_id=lp1.lp_id,
            period_label="Q4 2025",
            quarter=4,
            year=2025,
            status=m.QuarterlyReportStatus.published,
            total_revenue=Decimal("55200.00"),
            total_expenses=Decimal("16850.00"),
            net_operating_income=Decimal("38350.00"),
            total_distributions=Decimal("50000.00"),
            portfolio_value=Decimal("4200000.00"),
            portfolio_ltv=Decimal("55.95"),
            executive_summary=(
                "**Living Well Fund I LP — Q4 2025 Quarterly Report**\n\n"
                "During Q4 2025, the fund generated $55,200.00 in total revenue "
                "with a net operating income of $38,350.00. "
                "The portfolio is currently valued at $4,200,000.00 "
                "with a loan-to-value ratio of 55.9%. "
                "The first quarterly distribution of $50,000 was successfully paid to all investors. "
                "RecoverWell Calgary NE continues to operate at near-full occupancy."
            ),
            property_updates='[{"property_id": 1, "address": "123 Recovery Road NE", "city": "Calgary", "stage": "stabilized", "total_beds": 14, "occupied_beds": 14, "occupancy_percent": 100.0, "communities": ["RecoverWell Calgary NE"]}]',
            market_commentary=(
                "The Alberta multiplex housing market remains strong heading into 2026. "
                "Demand for specialized housing (sober living, student, retirement) continues to outpace supply. "
                "Construction costs have stabilized after two years of escalation, "
                "and interest rates are showing signs of easing."
            ),
            generated_at=datetime(2025, 12, 30),
            published_at=datetime(2025, 12, 31),
            generated_by=users["admin"].user_id,
        )
        db.add(qr1)
        db.flush()
        print("  [ok] Quarterly reports")

        # =================================================================
        # SPRINT 1.2: ENRICHED SEED DATA
        # =================================================================
        # Add 5 more properties to Fund II, more units, residents, payments,
        # operating expenses, and construction draws/expenses.
        print("  --- Sprint 1.2 Enrichment ---")

        # ── 5 New Properties for Fund II (RetireWell focus) ──
        new_props = []
        new_prop_data = [
            ("410 Maple Grove Way", "Red Deer", "AB", Decimal("520000.00"), m.DevelopmentStage.interim_operation),
            ("622 Willow Creek Drive", "Lethbridge", "AB", Decimal("445000.00"), m.DevelopmentStage.planning),
            ("88 Parkview Terrace", "Red Deer", "AB", Decimal("610000.00"), m.DevelopmentStage.acquisition),
            ("15 Lakeside Boulevard", "Medicine Hat", "AB", Decimal("390000.00"), m.DevelopmentStage.prospect),
            ("203 Heritage Crescent", "Lethbridge", "AB", Decimal("475000.00"), m.DevelopmentStage.interim_operation),
        ]
        for addr, city, prov, price, stage in new_prop_data:
            p = m.Property(
                lp_id=lp2.lp_id,
                cluster_id=cluster_south.cluster_id if city == "Red Deer" else None,
                address=addr,
                city=city,
                province=prov,
                purchase_date=date(2025, 6, 15) if stage != m.DevelopmentStage.prospect else None,
                purchase_price=price if stage != m.DevelopmentStage.prospect else None,
                assessed_value=price * Decimal("0.85") if price else None,
                lot_size=Decimal("6500.00"),
                zoning="R-CG" if "Red Deer" in city else "R-MH",
                development_stage=stage,
            )
            db.add(p)
            db.flush()
            new_props.append(p)

        # Assign new props to RetireWell Red Deer community
        for p in new_props:
            if p.city == "Red Deer":
                p.community_id = comm3.community_id
        db.flush()
        print(f"  [ok] 5 new Fund II properties")

        # ── 4 new communities for the new cities ──
        comm_leth = m.Community(
            operator_id=op_retire.operator_id,
            community_type=m.CommunityType.retire,
            name="RetireWell Lethbridge",
            city="Lethbridge",
            province="Alberta",
            has_meal_plan=True,
            meal_plan_monthly_cost=Decimal("475.00"),
            target_occupancy_percent=Decimal("90.00"),
            description="Lethbridge seniors living community with assisted services.",
        )
        comm_mh = m.Community(
            operator_id=op_retire.operator_id,
            community_type=m.CommunityType.retire,
            name="RetireWell Medicine Hat",
            city="Medicine Hat",
            province="Alberta",
            has_meal_plan=False,
            target_occupancy_percent=Decimal("85.00"),
            description="Medicine Hat independent retirement living.",
        )
        db.add_all([comm_leth, comm_mh])
        db.flush()
        for p in new_props:
            if p.city == "Lethbridge":
                p.community_id = comm_leth.community_id
            elif p.city == "Medicine Hat":
                p.community_id = comm_mh.community_id
        db.flush()
        print("  [ok] 2 new communities (Lethbridge, Medicine Hat)")

        # ── 20+ Units and Beds for the new properties (interim operations) ──
        enriched_units = []
        interim_props = [p for p in new_props if p.development_stage in (
            m.DevelopmentStage.interim_operation, m.DevelopmentStage.acquisition
        )]
        unit_configs = [
            # (unit_num, type, beds, sqft, floor)
            ("G1", m.UnitType.shared, 2, 420, "Main"),
            ("G2", m.UnitType.shared, 2, 420, "Main"),
            ("G3", m.UnitType.one_bed, 1, 480, "Main"),
            ("G4", m.UnitType.shared, 2, 400, "Upper"),
            ("G5", m.UnitType.suite, 2, 550, "Basement"),
        ]
        bed_counter = 0
        for prop in interim_props:
            comm_id = prop.community_id
            for unit_num, utype, num_beds, sqft, floor in unit_configs:
                u = m.Unit(
                    property_id=prop.property_id,
                    community_id=comm_id,
                    unit_number=f"{prop.property_id}-{unit_num}",
                    unit_type=utype,
                    bed_count=num_beds,
                    sqft=Decimal(str(sqft)),
                    floor=floor,
                    is_legal_suite=(utype == m.UnitType.suite),
                    is_occupied=True,
                )
                db.add(u)
                db.flush()
                enriched_units.append(u)
                for b in range(1, num_beds + 1):
                    rent = Decimal("1100.00") if utype == m.UnitType.shared else Decimal("1400.00")
                    if utype == m.UnitType.suite:
                        rent = Decimal("1650.00")
                    bed = m.Bed(
                        unit_id=u.unit_id,
                        bed_label=f"{prop.property_id}-{unit_num}-B{b}",
                        monthly_rent=rent,
                        rent_type=m.RentType.private_pay,
                        status=m.BedStatus.occupied if b <= num_beds - (1 if num_beds > 1 else 0) else m.BedStatus.available,
                    )
                    db.add(bed)
                    bed_counter += 1
            db.flush()
        print(f"  [ok] {len(enriched_units)} new units, {bed_counter} new beds")

        # ── 15 New Residents with 3-6 months of rent payments ──
        import random
        random.seed(42)
        resident_names = [
            "Dorothy Henderson", "Frank Williams", "Margaret Thompson",
            "Harold Baker", "Ruth Campbell", "George Stewart",
            "Evelyn Rogers", "Walter Morris", "Doris Murphy",
            "Arthur Cook", "Betty Richardson", "Ernest Howard",
            "Frances Ward", "Raymond Price", "Helen Bennett",
        ]
        new_residents = []
        all_enriched_beds = []
        for u in enriched_units:
            beds = db.query(m.Bed).filter(
                m.Bed.unit_id == u.unit_id,
                m.Bed.status == m.BedStatus.occupied,
            ).all()
            all_enriched_beds.extend(beds)

        for i, name in enumerate(resident_names):
            if i >= len(all_enriched_beds):
                break
            bed = all_enriched_beds[i]
            unit = db.query(m.Unit).filter(m.Unit.unit_id == bed.unit_id).first()
            move_in = date(2025, random.randint(1, 6), random.randint(1, 28))
            r = m.Resident(
                community_id=unit.community_id,
                unit_id=unit.unit_id,
                bed_id=bed.bed_id,
                full_name=name,
                email=f"{name.lower().replace(' ', '.')}@email.com",
                phone=f"403-555-{1000 + i:04d}",
                bed_number=bed.bed_label,
                rent_type=m.RentType.private_pay if i % 3 != 0 else m.RentType.government_supported,
                move_in_date=move_in,
                enrolled_meal_plan=(i % 4 == 0),
            )
            db.add(r)
            db.flush()
            new_residents.append(r)

            # Generate 3-6 months of rent payments
            months_of_payments = random.randint(3, 6)
            for mo_offset in range(months_of_payments):
                pay_month = move_in.month + mo_offset
                pay_year = move_in.year
                if pay_month > 12:
                    pay_month -= 12
                    pay_year += 1
                status = m.PaymentStatus.paid if random.random() < 0.85 else m.PaymentStatus.overdue
                payment = m.RentPayment(
                    resident_id=r.resident_id,
                    bed_id=bed.bed_id,
                    amount=bed.monthly_rent,
                    payment_date=datetime(pay_year, pay_month, random.randint(1, 5)),
                    period_month=pay_month,
                    period_year=pay_year,
                    status=status,
                    includes_meal_plan=r.enrolled_meal_plan,
                )
                db.add(payment)
        db.flush()
        print(f"  [ok] {len(new_residents)} new residents with rent payments")

        # ── Additional Operating Expenses ──
        expense_data = [
            (comm3.community_id, m.ExpenseCategory.utilities, "Natural gas heating", Decimal("2800.00"), 1),
            (comm3.community_id, m.ExpenseCategory.insurance, "Property insurance renewal", Decimal("4200.00"), 2),
            (comm3.community_id, m.ExpenseCategory.property_tax, "2025 property tax installment", Decimal("3600.00"), 1),
            (comm3.community_id, m.ExpenseCategory.maintenance_repairs, "Plumbing repair - Unit G2", Decimal("950.00"), 3),
            (comm3.community_id, m.ExpenseCategory.staffing, "Part-time caretaker wages", Decimal("3200.00"), 1),
            (comm_leth.community_id, m.ExpenseCategory.utilities, "Electricity Q1", Decimal("1800.00"), 1),
            (comm_leth.community_id, m.ExpenseCategory.property_management, "PM fee January", Decimal("2100.00"), 1),
            (comm_leth.community_id, m.ExpenseCategory.meal_program, "Meal service contract Q1", Decimal("5500.00"), 1),
            (comm_leth.community_id, m.ExpenseCategory.supplies, "Cleaning and office supplies", Decimal("650.00"), 2),
            (comm_leth.community_id, m.ExpenseCategory.maintenance_repairs, "Roof patch repair", Decimal("1200.00"), 3),
        ]
        for cid, cat, desc, amt, mo in expense_data:
            exp = m.OperatingExpense(
                community_id=cid,
                category=cat,
                description=desc,
                amount=amt,
                expense_date=date(2025, mo, 15),
                period_month=mo,
                period_year=2025,
                vendor="Various",
            )
            db.add(exp)
        db.flush()
        print("  [ok] 10 additional operating expenses")

        # ── Construction Draws for prop2 (construction stage) ──
        # prop2 has debt_id from First National construction loan
        constr_debt = db.query(m.DebtFacility).filter(
            m.DebtFacility.property_id == prop2.property_id,
            m.DebtFacility.debt_type == m.DebtType.construction_loan,
        ).first()
        if constr_debt:
            draws = [
                (1, Decimal("350000.00"), Decimal("350000.00"), "Foundation and excavation", m.ConstructionDrawStatus.funded, date(2025, 3, 1), date(2025, 3, 10), date(2025, 3, 15)),
                (2, Decimal("500000.00"), Decimal("480000.00"), "Framing and structural", m.ConstructionDrawStatus.funded, date(2025, 5, 1), date(2025, 5, 12), date(2025, 5, 20)),
                (3, Decimal("400000.00"), Decimal("400000.00"), "Mechanical, electrical, plumbing", m.ConstructionDrawStatus.approved, date(2025, 7, 15), date(2025, 7, 25), None),
                (4, Decimal("300000.00"), None, "Interior finishes", m.ConstructionDrawStatus.requested, date(2025, 9, 1), None, None),
                (5, Decimal("250000.00"), None, "Landscaping and final inspections", m.ConstructionDrawStatus.requested, date(2025, 11, 1), None, None),
            ]
            for draw_num, req_amt, appr_amt, desc, status, req_dt, appr_dt, fund_dt in draws:
                d = m.ConstructionDraw(
                    property_id=prop2.property_id,
                    debt_id=constr_debt.debt_id,
                    draw_number=draw_num,
                    requested_amount=req_amt,
                    approved_amount=appr_amt,
                    status=status,
                    description=desc,
                    requested_date=req_dt,
                    approved_date=appr_dt,
                    funded_date=fund_dt,
                )
                db.add(d)
            db.flush()
            print("  [ok] 5 construction draws for prop2")

        # ── Construction Expenses (budget vs actual) for prop2 ──
        plan2 = db.query(m.DevelopmentPlan).filter(
            m.DevelopmentPlan.property_id == prop2.property_id
        ).first()
        if plan2:
            constr_expenses = [
                ("hard_costs", "Excavation and foundation", Decimal("180000.00"), Decimal("175000.00"), "ABC Excavation", date(2025, 3, 20)),
                ("hard_costs", "Framing lumber and labour", Decimal("220000.00"), Decimal("235000.00"), "Prairie Framing Co.", date(2025, 5, 25)),
                ("hard_costs", "Roofing", Decimal("85000.00"), Decimal("82000.00"), "TopRoof Alberta", date(2025, 6, 10)),
                ("soft_costs", "Architecture and engineering", Decimal("65000.00"), Decimal("67500.00"), "CityPlan Architects", date(2025, 2, 1)),
                ("soft_costs", "Permits and fees", Decimal("12000.00"), Decimal("14200.00"), "City of Calgary", date(2025, 2, 15)),
                ("site_costs", "Demolition and site prep", Decimal("45000.00"), Decimal("42000.00"), "DemoCrew Ltd.", date(2025, 2, 28)),
                ("financing_costs", "Loan origination fee", Decimal("35000.00"), Decimal("35000.00"), "First National Financial", date(2025, 3, 1)),
                ("contingency", "Weather delay contingency", Decimal("25000.00"), Decimal("18000.00"), None, date(2025, 6, 30)),
            ]
            for cat, desc, budg, actual, vendor, exp_date in constr_expenses:
                ce = m.ConstructionExpense(
                    property_id=prop2.property_id,
                    plan_id=plan2.plan_id,
                    category=cat,
                    description=desc,
                    budgeted_amount=budg,
                    actual_amount=actual,
                    vendor=vendor,
                    expense_date=exp_date,
                )
                db.add(ce)
            db.flush()
            print("  [ok] 8 construction expense records for prop2")

        # =================================================================
        # SPRINT 8.1: SEED EMPTY TABLES
        # =================================================================
        print("  --- Sprint 8.1: Seeding empty tables ---")

        # ── Arrears Records ──
        overdue_payments = db.query(m.RentPayment).filter(
            m.RentPayment.status == m.PaymentStatus.overdue
        ).limit(3).all()
        for i, pay in enumerate(overdue_payments):
            days = [35, 52, 18][i] if i < 3 else 20
            bucket = "31-60" if days > 30 else "0-30"
            if days > 60:
                bucket = "61-90"
            arr = m.ArrearsRecord(
                resident_id=pay.resident_id,
                rent_payment_id=pay.payment_id,
                amount_overdue=pay.amount,
                due_date=date(pay.period_year, pay.period_month, 1),
                days_overdue=days,
                aging_bucket=bucket,
                follow_up_action="Phone call and written notice" if days > 30 else "Email reminder sent",
                follow_up_date=date(2025, 4, 15) if days > 30 else date(2025, 3, 20),
                is_resolved=False,
                notes=f"Resident notified on {date(2025, 3, 10)}",
            )
            db.add(arr)
        db.flush()
        print(f"  [ok] {len(overdue_payments)} arrears records")

        # ── Funding Opportunities ──
        fund_opps = [
            m.FundingOpportunity(
                operator_id=op_retire.operator_id,
                community_id=comm3.community_id,
                title="Alberta Seniors Housing Grant 2025",
                funding_source="Government of Alberta — Seniors & Housing",
                amount=Decimal("250000.00"),
                status=m.FundingStatus.submitted,
                submission_deadline=date(2025, 6, 30),
                reporting_deadline=date(2026, 3, 31),
                notes="Application submitted for RetireWell Red Deer expansion.",
            ),
            m.FundingOpportunity(
                operator_id=op_recover.operator_id,
                community_id=comm1.community_id,
                title="CMHC Rapid Housing Initiative — Round 4",
                funding_source="CMHC",
                amount=Decimal("500000.00"),
                status=m.FundingStatus.awarded,
                submission_deadline=date(2025, 3, 15),
                awarded_amount=Decimal("425000.00"),
                notes="Awarded for RecoverWell Calgary NE sober living beds.",
            ),
            m.FundingOpportunity(
                operator_id=op_retire.operator_id,
                title="United Way — Community Housing Innovation Fund",
                funding_source="United Way of Calgary",
                amount=Decimal("75000.00"),
                status=m.FundingStatus.draft,
                submission_deadline=date(2025, 9, 1),
                notes="Exploring application for meal program subsidy.",
            ),
        ]
        db.add_all(fund_opps)
        db.flush()
        print("  [ok] 3 funding opportunities")

        # ── Notifications ──
        notifs = [
            m.Notification(
                user_id=users["admin"].user_id,
                title="Q4 2025 Distribution Paid",
                message="The Q4 2025 distribution of $50,000 has been paid to all investors.",
                type=m.NotificationType.distribution,
                is_read=True,
                action_url="/investment/1",
                created_at=datetime(2025, 12, 31),
            ),
            m.Notification(
                user_id=users["investor1"].user_id,
                title="New Document: Q4 2025 Statement",
                message="Your quarterly investor statement for Q4 2025 is now available.",
                type=m.NotificationType.document_uploaded,
                is_read=False,
                action_url="/investors/1",
                created_at=datetime(2026, 1, 5),
            ),
            m.Notification(
                user_id=users["admin"].user_id,
                title="Property Stage Change: 456 Healing Ave",
                message="456 Healing Avenue NE has been transitioned from Planning to Construction.",
                type=m.NotificationType.stage_transition,
                is_read=True,
                action_url="/portfolio/2",
                created_at=datetime(2025, 2, 15),
            ),
            m.Notification(
                user_id=users["ops"].user_id,
                title="Maintenance Request — Urgent",
                message="A burst pipe has been reported at 123 Recovery Road NE, Unit 102.",
                type=m.NotificationType.general,
                is_read=False,
                action_url="/maintenance",
                created_at=datetime(2026, 1, 10),
            ),
            m.Notification(
                user_id=users["investor2"].user_id,
                title="eTransfer Sent: $6,250.00",
                message="Your Q4 2025 distribution of $6,250.00 has been sent via eTransfer.",
                type=m.NotificationType.etransfer,
                is_read=True,
                action_url="/etransfers",
                created_at=datetime(2025, 12, 31),
            ),
        ]
        db.add_all(notifs)
        db.flush()
        print("  [ok] 5 notifications")

        # ── Refinance Scenarios ──
        refi1 = m.RefinanceScenario(
            property_id=prop1.property_id,
            label="Year 3 Refinance — 5.5% Cap",
            assumed_new_valuation=Decimal("2200000.00"),
            new_ltv_percent=Decimal("65.00"),
            new_interest_rate=Decimal("4.75"),
            new_amortization_months=300,
            existing_debt_payout=Decimal("2400000.00"),
            closing_costs=Decimal("25000.00"),
            notes="Refinance after stabilization at 5.5% cap rate.",
        )
        refi2 = m.RefinanceScenario(
            property_id=prop1.property_id,
            label="Year 3 Refinance — 5.0% Cap (Optimistic)",
            assumed_new_valuation=Decimal("2500000.00"),
            new_ltv_percent=Decimal("70.00"),
            new_interest_rate=Decimal("4.50"),
            new_amortization_months=300,
            existing_debt_payout=Decimal("2400000.00"),
            closing_costs=Decimal("28000.00"),
            notes="Optimistic scenario with lower cap rate.",
        )
        db.add_all([refi1, refi2])
        db.flush()
        print("  [ok] 2 refinance scenarios")

        # ── Sale Scenarios ──
        sale1 = m.SaleScenario(
            property_id=prop1.property_id,
            label="Year 5 Exit — Market Sale",
            assumed_sale_price=Decimal("2400000.00"),
            selling_costs_percent=Decimal("4.00"),
            debt_payout=Decimal("2200000.00"),
            capital_gains_reserve=Decimal("15000.00"),
            notes="Exit at market value after 5-year hold.",
        )
        sale2 = m.SaleScenario(
            property_id=prop3.property_id,
            label="Year 7 Exit — Premium Sale",
            assumed_sale_price=Decimal("3200000.00"),
            selling_costs_percent=Decimal("3.50"),
            debt_payout=Decimal("2800000.00"),
            capital_gains_reserve=Decimal("25000.00"),
            notes="Premium exit for fully stabilized StudyWell Edmonton property.",
        )
        db.add_all([sale1, sale2])
        db.flush()
        print("  [ok] 2 sale scenarios")

        # ── Unit Turnovers ──
        # Get some units with residents for turnovers
        first_units = db.query(m.Unit).filter(
            m.Unit.community_id == comm1.community_id
        ).limit(3).all()
        for i, u in enumerate(first_units):
            resident = db.query(m.Resident).filter(m.Resident.unit_id == u.unit_id).first()
            to = m.UnitTurnover(
                unit_id=u.unit_id,
                vacated_by_resident_id=resident.resident_id if resident else None,
                move_out_date=date(2025, 11, 30) if i == 0 else date(2026, 1, 15) if i == 1 else None,
                target_ready_date=date(2025, 12, 15) if i == 0 else date(2026, 2, 1) if i == 1 else date(2026, 3, 1),
                actual_ready_date=date(2025, 12, 12) if i == 0 else None,
                status=m.TurnoverStatus.completed if i == 0 else m.TurnoverStatus.in_progress if i == 1 else m.TurnoverStatus.scheduled,
                inspection_notes="Unit in good condition, minor paint touch-up needed." if i == 0 else None,
                cleaning_complete=(i == 0),
                repairs_complete=(i == 0),
                painting_complete=(i == 0),
                inspection_passed=True if i == 0 else None,
                assigned_to=users["pm"].user_id,
            )
            db.add(to)
        db.flush()
        print(f"  [ok] {len(first_units)} unit turnovers")

        # ── Valuation History ──
        valuations = [
            m.ValuationHistory(
                property_id=prop1.property_id,
                valuation_date=date(2024, 8, 15),
                value=Decimal("650000.00"),
                method=m.ValuationMethod.purchase,
                notes="Purchase price at acquisition.",
                created_by=users["admin"].user_id,
            ),
            m.ValuationHistory(
                property_id=prop1.property_id,
                valuation_date=date(2025, 6, 1),
                value=Decimal("1850000.00"),
                method=m.ValuationMethod.appraisal,
                appraiser="Prairie Appraisal Group",
                notes="Post-renovation appraisal for refinance.",
                created_by=users["admin"].user_id,
            ),
            m.ValuationHistory(
                property_id=prop1.property_id,
                valuation_date=date(2025, 12, 15),
                value=Decimal("2100000.00"),
                method=m.ValuationMethod.cap_rate,
                notes="Income approach: NOI $120,000 / Cap Rate 5.7%",
                created_by=users["admin"].user_id,
            ),
            m.ValuationHistory(
                property_id=prop3.property_id,
                valuation_date=date(2025, 3, 1),
                value=Decimal("720000.00"),
                method=m.ValuationMethod.purchase,
                notes="Purchase price at acquisition.",
                created_by=users["admin"].user_id,
            ),
            m.ValuationHistory(
                property_id=prop4.property_id,
                valuation_date=date(2025, 7, 1),
                value=Decimal("510000.00"),
                method=m.ValuationMethod.assessment,
                notes="Municipal assessment value.",
                created_by=users["admin"].user_id,
            ),
        ]
        db.add_all(valuations)
        db.flush()
        print("  [ok] 5 valuation history records")

        # ── Periodic Snapshots (12 months of trend data) ──
        import random
        random.seed(42)

        for month_offset in range(12):
            yr = 2025 if month_offset < 7 else 2026
            mo = (month_offset + 4)  # Start from April 2025
            if mo > 12:
                mo -= 12

            # Community snapshots — simulate gradual occupancy ramp-up
            for ci, cid in enumerate([comm1.community_id, comm2.community_id]):
                base_occ = 60 + ci * 10  # comm1 starts at 60%, comm2 at 70%
                occ_rate = min(98, base_occ + month_offset * 3 + random.randint(-2, 4))
                total_beds_c = 14 if ci == 0 else 8
                occ_beds = int(total_beds_c * occ_rate / 100)
                base_rev = 8000 + ci * 2000
                monthly_rev = base_rev + month_offset * 200 + random.randint(-300, 500)
                monthly_exp = monthly_rev * (0.55 + random.uniform(-0.05, 0.05))

                snap = m.PeriodicSnapshot(
                    entity_type=m.SnapshotEntityType.community,
                    entity_id=cid,
                    year=yr,
                    month=mo,
                    total_beds=total_beds_c,
                    occupied_beds=occ_beds,
                    occupancy_rate=Decimal(str(occ_rate)),
                    gross_revenue=Decimal(str(round(monthly_rev, 2))),
                    collected_revenue=Decimal(str(round(monthly_rev * 0.92, 2))),
                    total_expenses=Decimal(str(round(monthly_exp, 2))),
                    noi=Decimal(str(round(monthly_rev * 0.92 - monthly_exp, 2))),
                )
                db.add(snap)

            # LP snapshots — simulate fund lifecycle
            for li, lid in enumerate([lp1.lp_id, lp2.lp_id]):
                base_funded = 950000 if li == 0 else 150000
                base_nav = 800000 if li == 0 else 120000
                funded = base_funded + (month_offset * 10000 if li == 1 else 0)
                deployed = base_funded * 0.7 + month_offset * 15000
                nav = base_nav + month_offset * 20000 + random.randint(-10000, 15000)
                units = 1000 if li == 0 else 150
                dist_total = 50000 if li == 0 and month_offset >= 6 else 0

                snap = m.PeriodicSnapshot(
                    entity_type=m.SnapshotEntityType.lp,
                    entity_id=lid,
                    year=yr,
                    month=mo,
                    total_funded=Decimal(str(funded)),
                    capital_deployed=Decimal(str(round(deployed, 2))),
                    nav=Decimal(str(round(nav, 2))),
                    nav_per_unit=Decimal(str(round(nav / units, 2))),
                    total_distributions=Decimal(str(dist_total)),
                    total_debt=Decimal(str(round(deployed * 0.65, 2))),
                    portfolio_ltv=Decimal("65.00"),
                    property_count=3 if li == 0 else 2 + (1 if month_offset > 4 else 0),
                    investor_count=3 if li == 0 else 1 + (1 if month_offset > 2 else 0),
                )
                db.add(snap)

        db.flush()
        print("  [ok] 48 periodic snapshots (12 months × 2 communities + 2 LPs)")

        # ── Decision Memory (institutional knowledge) ──
        decisions = [
            m.DecisionLog(
                category=m.DecisionCategory.acquisition,
                title="Acquired 123 Recovery Road NE at $650K",
                description="Purchased 4-bedroom bungalow in Calgary NE for RecoverWell sober living. Below-market price due to estate sale. Zoning R-CG supports 8-plex conversion.",
                property_id=prop1.property_id,
                lp_id=lp1.lp_id,
                decision_maker=users["admin"].user_id,
                decision_date=date(2024, 8, 1),
                amount=Decimal("650000"),
                outcome=m.DecisionOutcome.positive,
                outcome_notes="Property stabilized ahead of schedule. Interim revenue covered carrying costs.",
                lessons_learned="Estate sales in Calgary NE offer 10-15% below market. Move quickly — competition from other developers is increasing.",
                tags="calgary,acquisition,estate_sale,below_market",
            ),
            m.DecisionLog(
                category=m.DecisionCategory.construction,
                title="8-plex conversion at 456 Healing Ave — $1.58M budget",
                description="Approved 6-unit to 8-unit conversion plan. Hard costs $800K, soft costs $180K. 18-month timeline. Selected Prairie Framing Co. as GC after 3 bids.",
                property_id=prop2.property_id,
                lp_id=lp1.lp_id,
                decision_maker=users["admin"].user_id,
                decision_date=date(2025, 1, 15),
                amount=Decimal("1583505"),
                outcome=m.DecisionOutcome.neutral,
                outcome_notes="Construction underway. Framing 8% over budget due to lumber price spike. Timeline on track.",
                lessons_learned="Lock in lumber prices at permit stage. Alberta lumber costs swing 5-15% seasonally — buy in Q4 when demand is lowest.",
                tags="calgary,construction,over_budget,lumber,framing",
            ),
            m.DecisionLog(
                category=m.DecisionCategory.distribution,
                title="Q4 2025 distribution — $50K from Fund I",
                description="First distribution from Fund I. Waterfall: 100% return of capital (Tier 1). No preferred return or carried interest paid yet — all capital still unreturned.",
                lp_id=lp1.lp_id,
                decision_maker=users["admin"].user_id,
                decision_date=date(2025, 12, 28),
                amount=Decimal("50000"),
                outcome=m.DecisionOutcome.positive,
                outcome_notes="All 3 investors received eTransfers within 48 hours. Positive investor feedback.",
                lessons_learned="Send distribution notices 5 business days before payment. Investors appreciate the advance notice for tax planning.",
                tags="distribution,fund_i,etransfer,investor_relations",
            ),
            m.DecisionLog(
                category=m.DecisionCategory.acquisition,
                title="Acquired 321 Sunset Blvd, Red Deer at $480K",
                description="First Red Deer acquisition for Fund II. R-2 zoning limits to duplex initially but city indicated R-CG redesignation likely within 6 months. Higher risk but 15% below assessed value.",
                property_id=prop4.property_id,
                lp_id=lp2.lp_id,
                decision_maker=users["admin"].user_id,
                decision_date=date(2025, 3, 1),
                amount=Decimal("480000"),
                outcome=m.DecisionOutcome.pending,
                outcome_notes="Rezoning application submitted. Awaiting council decision in Q2 2026.",
                lessons_learned="Red Deer council is more conservative on rezoning than Calgary. Budget 6-9 months for the process, not 3-4.",
                tags="red_deer,acquisition,rezoning_risk,fund_ii",
            ),
            m.DecisionLog(
                category=m.DecisionCategory.refinancing,
                title="Explored CMHC MLI Select refinance for 123 Recovery Road",
                description="Applied for CMHC MLI Select insured mortgage at stabilized value. $2.8M commitment at 4.25% for 10-year term. Requires 12-month stabilized NOI track record.",
                property_id=prop1.property_id,
                lp_id=lp1.lp_id,
                decision_maker=users["admin"].user_id,
                decision_date=date(2025, 9, 1),
                amount=Decimal("2800000"),
                outcome=m.DecisionOutcome.pending,
                lessons_learned="CMHC MLI Select requires minimum 1.1x DSCR and 12 months of stabilized operations. Start the application 3 months before maturity of construction loan.",
                tags="refinancing,cmhc,mli_select,calgary",
            ),
            m.DecisionLog(
                category=m.DecisionCategory.operational,
                title="Switched to bed-level rent pricing for RecoverWell",
                description="Changed from per-unit to per-bed pricing model across all RecoverWell communities. Increases revenue density by 25-30% per property. Better matches sober living market where residents rent beds, not apartments.",
                decision_maker=users["admin"].user_id,
                decision_date=date(2025, 4, 1),
                outcome=m.DecisionOutcome.positive,
                outcome_notes="Average revenue per property increased from $6,200/mo to $8,100/mo. Occupancy rate maintained above 85%.",
                lessons_learned="Bed-level pricing is the standard for shared living. Per-unit pricing leaves 25-30% revenue on the table. Implement from day one on new properties.",
                tags="pricing,bed_level,revenue_optimization,recoverwell",
            ),
        ]
        db.add_all(decisions)
        db.flush()
        print("  [ok] 6 decision memory records")

        db.commit()
        print("=" * 60)
        print("  SEED COMPLETE — Phase 1 Foundation + Phase 3 Features")
        print("=" * 60)
        print()
        print("  GP Entity:           1 (Alberta Multiplex GP Inc.)")
        print("  LP Entities:         2 (Fund I — operating, Fund II — raising)")
        print("  Investors:           3")
        print("  Subscriptions:       5")
        print("  Holdings:            5 (4 LP + 1 GP)")
        print("  Distribution Events: 1 (Q4 2025, paid)")
        print("  Allocations:         3")
        print("  Operators:           3")
        print("  Clusters:            2")
        print("  Properties:          10 (3 in Fund I, 7 in Fund II)")
        print("  Debt Facilities:     5+")
        print("  Development Plans:   3")
        print("  Communities:         5 (Calgary, Edmonton, Red Deer, Lethbridge, Medicine Hat)")
        print("  Units:               23+ (8 original + 15 enriched)")
        print("  Beds:                40+")
        print("  Residents:           22 (7 original + 15 enriched)")
        print("  Rent Payments:       80+")
        print("  Maintenance:         3")
        print("  Documents:           3")
        print("  Messages:            2")
        print("  Scope Assignments:   7")
        print("  Audit Log:           2")
        print("  Users:               6")
        print("  --- Phase 3 ---")
        print("  Stage Transitions:   5")
        print("  Milestones:          12")
        print("  eTransfer Tracking:  2")
        print("  Message Replies:     3")
        print("  Operator Budgets:    3")
        print("  Operating Expenses:  20")
        print("  Quarterly Reports:   1")
        print("  --- Sprint 1.2 Enrichment ---")
        print("  Construction Draws:  5 (for prop2)")
        print("  Construction Exp:    8 (budget vs actual for prop2)")
        print("  --- Sprint 8.1: Previously Empty Tables ---")
        print("  Arrears Records:     3")
        print("  Funding Opps:        3")
        print("  Notifications:       5")
        print("  Refinance Scenarios: 2")
        print("  Sale Scenarios:      2")
        print("  Unit Turnovers:      3")
        print("  Valuation History:   5")
        print("  Periodic Snapshots:  48 (12 months × 4 entities)")
        print("  Decision Memory:     6 (institutional knowledge)")
        print()
        print("  Demo logins:")
        print("    admin@livingwell.ca / Password1!     (GP_ADMIN)")
        print("    ops@livingwell.ca / Password1!       (OPERATIONS_MANAGER)")
        print("    pm@livingwell.ca / Password1!        (PROPERTY_MANAGER)")
        print("    investor1@example.com / Password1!   (INVESTOR)")
        print("    investor2@example.com / Password1!   (INVESTOR)")
        print("    resident@example.com / Password1!    (RESIDENT)")
        print()

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
