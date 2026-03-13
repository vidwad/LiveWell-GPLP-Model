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
            description="First fund — RecoverWell and StudyWell properties in Calgary and Edmonton.",
            status=m.LPStatus.operating,
            target_raise=Decimal("5000000.00"),
            minimum_investment=Decimal("50000.00"),
            offering_date=date(2024, 6, 1),
            closing_date=date(2024, 12, 31),
            preferred_return_rate=Decimal("8.00"),
            gp_promote_percent=Decimal("20.00"),
            gp_catchup_percent=Decimal("100.00"),
            asset_management_fee_percent=Decimal("1.50"),
            acquisition_fee_percent=Decimal("1.00"),
        )
        lp2 = m.LPEntity(
            gp_id=gp.gp_id,
            name="Living Well Fund II LP",
            description="Second fund — RetireWell properties in Red Deer and Lethbridge.",
            status=m.LPStatus.raising,
            target_raise=Decimal("8000000.00"),
            minimum_investment=Decimal("100000.00"),
            offering_date=date(2025, 3, 1),
            closing_date=date(2025, 9, 30),
            preferred_return_rate=Decimal("8.00"),
            gp_promote_percent=Decimal("20.00"),
            gp_catchup_percent=Decimal("100.00"),
            asset_management_fee_percent=Decimal("1.50"),
            acquisition_fee_percent=Decimal("1.00"),
        )
        db.add_all([lp1, lp2])
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
            accredited_status="accredited",
        )
        inv2 = m.Investor(
            user_id=users["investor2"].user_id,
            name="James Chen",
            email="investor2@example.com",
            phone="780-555-0202",
            address="789 Capital Blvd, Edmonton, AB T5J 0R1",
            entity_type="corporation",
            accredited_status="accredited",
        )
        inv3 = m.Investor(
            name="Priya Sharma Family Trust",
            email="priya@sharmatrust.ca",
            phone="403-555-0303",
            address="321 Trust Lane, Calgary, AB T2P 2T2",
            entity_type="trust",
            accredited_status="accredited",
        )
        db.add_all([inv1, inv2, inv3])
        db.flush()

        # =================================================================
        # 5. SUBSCRIPTIONS (investors committing to LPs)
        # =================================================================
        sub1 = m.Subscription(
            investor_id=inv1.investor_id,
            lp_id=lp1.lp_id,
            commitment_amount=Decimal("250000.00"),
            funded_amount=Decimal("250000.00"),
            status=m.SubscriptionStatus.issued,
            submitted_date=date(2024, 7, 15),
            accepted_date=date(2024, 7, 22),
            funded_date=date(2024, 8, 1),
            issued_date=date(2024, 8, 5),
        )
        sub2 = m.Subscription(
            investor_id=inv2.investor_id,
            lp_id=lp1.lp_id,
            commitment_amount=Decimal("500000.00"),
            funded_amount=Decimal("500000.00"),
            status=m.SubscriptionStatus.issued,
            submitted_date=date(2024, 7, 20),
            accepted_date=date(2024, 7, 28),
            funded_date=date(2024, 8, 10),
            issued_date=date(2024, 8, 15),
        )
        sub3 = m.Subscription(
            investor_id=inv3.investor_id,
            lp_id=lp1.lp_id,
            commitment_amount=Decimal("200000.00"),
            funded_amount=Decimal("200000.00"),
            status=m.SubscriptionStatus.issued,
            submitted_date=date(2024, 8, 1),
            accepted_date=date(2024, 8, 8),
            funded_date=date(2024, 8, 20),
            issued_date=date(2024, 8, 25),
        )
        sub4 = m.Subscription(
            investor_id=inv1.investor_id,
            lp_id=lp2.lp_id,
            commitment_amount=Decimal("300000.00"),
            funded_amount=Decimal("150000.00"),
            status=m.SubscriptionStatus.funded,
            submitted_date=date(2025, 4, 1),
            accepted_date=date(2025, 4, 10),
            funded_date=date(2025, 5, 1),
            notes="Partial funding — second tranche due Q3 2025.",
        )
        sub5 = m.Subscription(
            investor_id=inv2.investor_id,
            lp_id=lp2.lp_id,
            commitment_amount=Decimal("750000.00"),
            funded_amount=Decimal("0.00"),
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
            ownership_percent=Decimal("5.0000"),
            cost_basis=Decimal("50000.00"),
            unreturned_capital=Decimal("50000.00"),
            unpaid_preferred=Decimal("0.00"),
            is_gp=True,
        )
        hold1 = m.Holding(
            investor_id=inv1.investor_id,
            lp_id=lp1.lp_id,
            subscription_id=sub1.subscription_id,
            ownership_percent=Decimal("25.0000"),
            cost_basis=Decimal("250000.00"),
            unreturned_capital=Decimal("250000.00"),
            unpaid_preferred=Decimal("0.00"),
            is_gp=False,
        )
        hold2 = m.Holding(
            investor_id=inv2.investor_id,
            lp_id=lp1.lp_id,
            subscription_id=sub2.subscription_id,
            ownership_percent=Decimal("50.0000"),
            cost_basis=Decimal("500000.00"),
            unreturned_capital=Decimal("500000.00"),
            unpaid_preferred=Decimal("0.00"),
            is_gp=False,
        )
        hold3 = m.Holding(
            investor_id=inv3.investor_id,
            lp_id=lp1.lp_id,
            subscription_id=sub3.subscription_id,
            ownership_percent=Decimal("20.0000"),
            cost_basis=Decimal("200000.00"),
            unreturned_capital=Decimal("200000.00"),
            unpaid_preferred=Decimal("0.00"),
            is_gp=False,
        )
        # Fund II — only one holding so far (Sarah's partial funding)
        hold4 = m.Holding(
            investor_id=inv1.investor_id,
            lp_id=lp2.lp_id,
            subscription_id=sub4.subscription_id,
            ownership_percent=Decimal("18.7500"),
            cost_basis=Decimal("150000.00"),
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
        plan1 = m.DevelopmentPlan(
            property_id=prop1.property_id,
            version=1,
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
        )
        plan2 = m.DevelopmentPlan(
            property_id=prop2.property_id,
            version=1,
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

        # =================================================================
        # 12. COMMUNITIES
        # =================================================================
        comm1 = m.Community(
            property_id=prop1.property_id,
            operator_id=op_recover.operator_id,
            community_type=m.CommunityType.recover,
            name="RecoverWell Calgary NE",
            has_meal_plan=True,
            meal_plan_monthly_cost=Decimal("350.00"),
            target_occupancy_percent=Decimal("95.00"),
        )
        comm2 = m.Community(
            property_id=prop2.property_id,
            operator_id=op_recover.operator_id,
            community_type=m.CommunityType.recover,
            name="RecoverWell Calgary Healing",
            has_meal_plan=True,
            meal_plan_monthly_cost=Decimal("350.00"),
            target_occupancy_percent=Decimal("95.00"),
        )
        comm3 = m.Community(
            property_id=prop3.property_id,
            operator_id=op_study.operator_id,
            community_type=m.CommunityType.study,
            name="StudyWell Edmonton Campus",
            has_meal_plan=False,
            target_occupancy_percent=Decimal("90.00"),
        )
        comm4 = m.Community(
            property_id=prop4.property_id,
            operator_id=op_retire.operator_id,
            community_type=m.CommunityType.retire,
            name="RetireWell Red Deer",
            has_meal_plan=True,
            meal_plan_monthly_cost=Decimal("500.00"),
            target_occupancy_percent=Decimal("92.00"),
        )
        db.add_all([comm1, comm2, comm3, comm4])
        db.flush()

        # =================================================================
        # 13. UNITS & BEDS (for stabilized property prop1)
        # =================================================================
        units_data = [
            ("101", m.UnitType.shared, 2, 450),
            ("102", m.UnitType.shared, 2, 450),
            ("103", m.UnitType.one_bed, 1, 500),
            ("104", m.UnitType.shared, 2, 450),
            ("201", m.UnitType.shared, 2, 450),
            ("202", m.UnitType.shared, 2, 450),
            ("203", m.UnitType.one_bed, 1, 500),
            ("204", m.UnitType.suite, 2, 600),
        ]
        units = []
        for unit_num, utype, beds, sqft in units_data:
            u = m.Unit(
                community_id=comm1.community_id,
                unit_number=unit_num,
                unit_type=utype,
                bed_count=beds,
                sqft=Decimal(str(sqft)),
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
            community_id=comm3.community_id,
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
        print("  Properties:          5 (3 in Fund I, 2 in Fund II)")
        print("  Debt Facilities:     3")
        print("  Development Plans:   3")
        print("  Communities:         4")
        print("  Units:               8 (in RecoverWell Calgary NE)")
        print("  Beds:                14")
        print("  Residents:           7")
        print("  Rent Payments:       21")
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
        print("  Operating Expenses:  10")
        print("  Quarterly Reports:   1")
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
