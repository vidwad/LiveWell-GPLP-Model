#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════
LiveWell GPLP Model — Complete Test Scenario Seed Script
═══════════════════════════════════════════════════════════════════════

Replicates the fully validated 1847 Bowness Road NW test scenario on
any fresh database (SQLite or PostgreSQL).

Phases seeded:
  1. As-Is Baseline  — 6BR / 8-bed house, $59,100 GPR, $465,000 mortgage @ 5.5%
  2. Post-Renovation — Kitchen reno ($31,350), +$50/bed/month rent bump
  3. Full Development — 6-unit / 18-BR / 24-bed build, CMHC MLI Select 75% LTV

Usage:
  cd LiveWell-GPLP-Model/backend
  PYTHONPATH=. python3 seed_test_scenario.py

Prerequisites:
  - Database must be migrated to revision 007 (run db_update.sh first)
  - An admin user must exist, OR the script will create one
  - An LP entity must exist, OR the script will create one
═══════════════════════════════════════════════════════════════════════
"""

import sys
import os

# Ensure we can import the app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import date, datetime
from decimal import Decimal

from app.db.session import SessionLocal, engine
from app.db.models import (
    User, GPEntity, LPEntity, Property, Unit, Bed,
    DevelopmentPlan, DebtFacility, AncillaryRevenueStream,
    OperatingExpenseLineItem,
)

# ── Helpers ───────────────────────────────────────────────────────────

def get_or_create_admin(db):
    """Ensure an admin user exists and return it."""
    admin = db.query(User).filter(User.email == "admin@livingwell.ca").first()
    if admin:
        print(f"  ✓ Admin user exists (id={admin.user_id})")
        return admin

    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

    admin = User(
        email="admin@livingwell.ca",
        hashed_password=pwd_ctx.hash("Password1!"),
        full_name="Admin User",
        role="GP_ADMIN",
        is_active=True,
    )
    db.add(admin)
    db.flush()
    print(f"  + Created admin user (id={admin.user_id})")
    return admin


def get_or_create_gp(db):
    """Ensure a GP entity exists and return it."""
    gp = db.query(GPEntity).first()
    if gp:
        print(f"  ✓ GP entity exists (id={gp.gp_id})")
        return gp

    gp = GPEntity(
        legal_name="Living Well Capital Corp.",
    )
    db.add(gp)
    db.flush()
    print(f"  + Created GP entity (id={gp.gp_id})")
    return gp


def get_or_create_lp(db, gp_id):
    """Ensure an LP entity exists and return it."""
    lp = db.query(LPEntity).filter(LPEntity.name == "Living Well Fund I LP").first()
    if lp:
        print(f"  ✓ LP entity exists (id={lp.lp_id})")
        return lp

    lp = LPEntity(
        gp_id=gp_id,
        name="Living Well Fund I LP",
        legal_name="Living Well Fund I Limited Partnership",
        lp_number="LW-001",
        description="First fund — RecoverWell sober living properties in Calgary.",
        city_focus="Calgary",
        community_focus="RecoverWell",
        purpose_type="recover_well",
        status="operating",
        unit_price=Decimal("1000"),
        minimum_subscription=Decimal("50000"),
        target_raise=Decimal("5000000"),
        minimum_raise=Decimal("2000000"),
        maximum_raise=Decimal("6000000"),
        offering_date=date(2024, 6, 1),
        closing_date=date(2024, 12, 31),
        formation_costs=Decimal("75000"),
        offering_costs=Decimal("250000"),
        reserve_percent=Decimal("5"),
        waterfall_style="european",
        preferred_return_rate=Decimal("8"),
        gp_promote_percent=Decimal("30"),
        gp_catchup_percent=Decimal("100"),
        lp_split_percent=Decimal("70"),
        management_fee_percent=Decimal("2.5"),
        asset_management_fee_percent=Decimal("2.5"),
        acquisition_fee_percent=Decimal("2"),
        selling_commission_percent=Decimal("10"),
        construction_management_fee_percent=Decimal("1.5"),
        refinancing_fee_percent=Decimal("2.5"),
        turnover_replacement_fee_percent=Decimal("2"),
        lp_profit_share_percent=Decimal("70"),
        gp_profit_share_percent=Decimal("30"),
        total_units_authorized=5000,
        notes="Fully funded and operating. Properties acquired in Calgary and Edmonton.",
    )
    db.add(lp)
    db.flush()
    print(f"  + Created LP entity (id={lp.lp_id})")
    return lp


# ── Main Seed Logic ───────────────────────────────────────────────────

def seed():
    db = SessionLocal()
    try:
        print("═" * 60)
        print("  LiveWell Test Scenario Seeder")
        print("═" * 60)

        # ── Prerequisites ──
        print("\n[1/8] Checking prerequisites...")
        admin = get_or_create_admin(db)
        gp = get_or_create_gp(db)
        lp = get_or_create_lp(db, gp.gp_id)

        # ── Check if property already exists ──
        existing = db.query(Property).filter(
            Property.address == "1847 Bowness Road NW",
            Property.lp_id == lp.lp_id,
        ).first()
        if existing:
            print(f"\n  ⚠ Property '1847 Bowness Road NW' already exists (id={existing.property_id}).")
            print("  To re-seed, delete it first or use a different database.")
            db.close()
            return

        # ══════════════════════════════════════════════════════════════
        # PHASE 1: PROPERTY + BASELINE
        # ══════════════════════════════════════════════════════════════
        print("\n[2/8] Creating property: 1847 Bowness Road NW...")
        prop = Property(
            lp_id=lp.lp_id,
            address="1847 Bowness Road NW",
            city="Calgary",
            province="Alberta",
            purchase_date=date(2025, 1, 15),
            purchase_price=Decimal("465000"),
            assessed_value=Decimal("445000"),
            current_market_value=Decimal("465000"),
            lot_size=Decimal("6000"),
            zoning="RF-2",
            max_buildable_area=Decimal("4200"),
            floor_area_ratio=Decimal("0.7"),
            development_stage="interim_operation",
            rent_pricing_mode="by_bed",
            annual_rent_increase_pct=Decimal("5"),
            year_built=1962,
            property_type="Single Family",
            building_sqft=Decimal("2000"),
            bedrooms=6,
            bathrooms=2,
            property_style="Bungalow",
            garage="Single Detached",
            neighbourhood="Bowness",
            latitude=Decimal("51.0886"),
            longitude=Decimal("-114.1891"),
        )
        db.add(prop)
        db.flush()
        pid = prop.property_id
        print(f"  ✓ Property created (id={pid})")

        # ── Baseline Unit (6BR house, 8 beds) ──
        print("\n[3/8] Creating baseline unit and beds...")
        baseline_unit = Unit(
            property_id=pid,
            unit_number="Main",
            unit_type="house",
            bed_count=8,
            bedroom_count=6,
            sqft=Decimal("2000"),
            floor="main",
            is_occupied=True,
        )
        db.add(baseline_unit)
        db.flush()

        baseline_beds = [
            ("BR1-A", 750, 1), ("BR2-A", 550, 2), ("BR2-B", 550, 2),
            ("BR3-A", 700, 3), ("BR4-A", 650, 4), ("BR5-A", 550, 5),
            ("BR5-B", 550, 5), ("BR6-A", 625, 6),
        ]
        for label, rent, br_num in baseline_beds:
            db.add(Bed(
                unit_id=baseline_unit.unit_id,
                bed_label=label,
                monthly_rent=Decimal(str(rent)),
                status="occupied",
                bedroom_number=br_num,
                is_post_renovation=False,
            ))
        db.flush()
        total_baseline_rent = sum(r for _, r, _ in baseline_beds)
        print(f"  ✓ Baseline: 1 unit, 8 beds, GPR=${total_baseline_rent * 12:,}/yr")

        # ── Baseline Ancillary Revenue ──
        print("\n[4/8] Creating ancillary revenue streams...")
        baseline_ancillary = [
            ("parking",  "Driveway Parking (2 spots)",   2, 100, 50, 3),
            ("pet_fee",  "Pet Fees (2 residents)",        2, 100, 50, 0),
            ("storage",  "Garage Storage Lockers",        3,  67, 75, 3),
            ("laundry",  "Shared Coin-Op Laundry",        1, 100, 100, 0),
        ]
        for stype, desc, count, util, rate, esc in baseline_ancillary:
            db.add(AncillaryRevenueStream(
                property_id=pid,
                stream_type=stype,
                description=desc,
                total_count=count,
                utilization_pct=Decimal(str(util)),
                monthly_rate=Decimal(str(rate)),
                annual_escalation_pct=Decimal(str(esc)),
            ))
        db.flush()
        print("  ✓ 4 baseline ancillary streams created")

        # ── Baseline Operating Expenses ──
        baseline_opex = [
            ("property_tax",       "Municipal Property Tax",          "fixed",   3800, 2),
            ("insurance",          "Property & Liability Insurance",  "fixed",   2400, 2),
            ("utilities",          "All Utilities (owner-paid)",      "fixed",  12000, 2),
            ("repairs_maintenance","Maintenance & Repairs",           "fixed",   4000, 2),
            ("management_fee",     "Property Management (8% of EGI)","pct_egi",    8, 0),
            ("other",              "Landscaping & Snow Removal",      "fixed",   2400, 2),
            ("reserves",           "Capital Reserves ($300/bed/yr)",  "fixed",   2400, 2),
        ]
        for cat, desc, method, amount, esc in baseline_opex:
            db.add(OperatingExpenseLineItem(
                property_id=pid,
                category=cat,
                description=desc,
                calc_method=method,
                base_amount=Decimal(str(amount)),
                annual_escalation_pct=Decimal(str(esc)),
            ))
        db.flush()
        print("  ✓ 7 baseline expense line items created")

        # ── Baseline Debt (Mortgage) ──
        baseline_debt = DebtFacility(
            property_id=pid,
            lender_name="RFA Mortgage",
            debt_type="permanent_mortgage",
            status="active",
            debt_purpose="acquisition",
            commitment_amount=Decimal("465000"),
            drawn_amount=Decimal("465000"),
            outstanding_balance=Decimal("465000"),
            interest_rate=Decimal("5.5"),
            rate_type="fixed",
            term_months=60,
            amortization_months=300,
            io_period_months=0,
            origination_date=date(2025, 1, 15),
            maturity_date=date(2030, 1, 15),
            compounding_method="semi_annual",
        )
        db.add(baseline_debt)
        db.flush()
        baseline_debt_id = baseline_debt.debt_id
        print(f"  ✓ Baseline mortgage created (id={baseline_debt_id})")

        # ══════════════════════════════════════════════════════════════
        # PHASE 2: POST-RENOVATION (Kitchen Reno)
        # ══════════════════════════════════════════════════════════════
        print("\n[5/8] Creating Phase 2: Kitchen Renovation plan...")
        reno_plan = DevelopmentPlan(
            property_id=pid,
            plan_name="Kitchen Renovation",
            status="active",
            estimated_construction_cost=Decimal("31350"),
            planned_units=1,
            planned_beds=8,
            planned_sqft=Decimal("2000"),
        )
        db.add(reno_plan)
        db.flush()
        reno_plan_id = reno_plan.plan_id

        # Post-reno unit
        reno_unit = Unit(
            property_id=pid,
            unit_number="Main-Reno",
            unit_type="house",
            bed_count=8,
            bedroom_count=6,
            sqft=Decimal("2000"),
            floor="main",
            is_occupied=True,
            renovation_phase="post_renovation",
            development_plan_id=reno_plan_id,
        )
        db.add(reno_unit)
        db.flush()

        reno_beds = [
            ("BR1-A", 800, 1), ("BR2-A", 600, 2), ("BR2-B", 600, 2),
            ("BR3-A", 750, 3), ("BR4-A", 700, 4), ("BR5-A", 600, 5),
            ("BR5-B", 600, 5), ("BR6-A", 675, 6),
        ]
        for label, rent, br_num in reno_beds:
            db.add(Bed(
                unit_id=reno_unit.unit_id,
                bed_label=label,
                monthly_rent=Decimal(str(rent)),
                status="occupied",
                bedroom_number=br_num,
                is_post_renovation=True,
            ))
        db.flush()
        total_reno_rent = sum(r for _, r, _ in reno_beds)
        print(f"  ✓ Post-reno: 1 unit, 8 beds, GPR=${total_reno_rent * 12:,}/yr")

        # Post-reno ancillary (same as baseline)
        reno_ancillary = [
            ("parking",  "Driveway parking (2 spots)",   2, 100, 50, 0),
            ("pet_fee",  "Pet deposit/fee (2 pets)",      2, 100, 50, 0),
            ("storage",  "Storage lockers (3 available)", 3,  67, 75, 0),
            ("laundry",  "Coin laundry revenue",          1, 100, 100, 0),
        ]
        for stype, desc, count, util, rate, esc in reno_ancillary:
            db.add(AncillaryRevenueStream(
                property_id=pid,
                development_plan_id=reno_plan_id,
                stream_type=stype,
                description=desc,
                total_count=count,
                utilization_pct=Decimal(str(util)),
                monthly_rate=Decimal(str(rate)),
                annual_escalation_pct=Decimal(str(esc)),
            ))

        # Post-reno expenses
        reno_opex = [
            ("property_tax",       "Municipal Property Tax",          "fixed",   3800, 3),
            ("insurance",          "Property & Liability Insurance",  "fixed",   2400, 3),
            ("utilities",          "All Utilities (owner-paid)",      "fixed",  12000, 3),
            ("repairs_maintenance","Maintenance & Repairs",           "fixed",   4000, 3),
            ("management_fee",     "Property Management (8% of EGI)","pct_egi",    8, 3),
            ("other",              "Landscaping & Snow Removal",      "fixed",   2400, 3),
            ("reserves",           "Capital Reserves ($300/bed/yr)",  "fixed",   2400, 3),
        ]
        for cat, desc, method, amount, esc in reno_opex:
            db.add(OperatingExpenseLineItem(
                property_id=pid,
                development_plan_id=reno_plan_id,
                category=cat,
                description=desc,
                calc_method=method,
                base_amount=Decimal(str(amount)),
                annual_escalation_pct=Decimal(str(esc)),
            ))
        db.flush()
        print(f"  ✓ Reno plan created (id={reno_plan_id})")

        # ══════════════════════════════════════════════════════════════
        # PHASE 3: FULL DEVELOPMENT (6-unit / 24-bed)
        # ══════════════════════════════════════════════════════════════
        print("\n[6/8] Creating Phase 3: Full Development plan...")
        dev_plan = DevelopmentPlan(
            property_id=pid,
            plan_name="Full Development 6-Unit/18-BR/24-Bed",
            status="active",
            estimated_construction_cost=Decimal("1800000"),
            hard_costs=Decimal("1500000"),
            soft_costs=Decimal("200000"),
            site_costs=Decimal("100000"),
            development_start_date=date(2025, 9, 1),
            construction_duration_days=365,
            estimated_completion_date=date(2026, 9, 1),
            estimated_stabilization_date=date(2027, 3, 1),
            planned_units=6,
            planned_beds=24,
            planned_sqft=Decimal("6000"),
        )
        db.add(dev_plan)
        db.flush()
        dev_plan_id = dev_plan.plan_id

        # 6x 3BR units (4 beds each: 2 single-occ + 1 double-occ bedroom)
        # Rents are 15% above as-is rates for new construction
        unit_beds = [
            ("BR1-A", 863, 1),   # single occupancy
            ("BR2-A", 805, 2),   # single occupancy
            ("BR3-A", 650, 3),   # double occupancy bed A
            ("BR3-B", 650, 3),   # double occupancy bed B
        ]
        for i in range(1, 7):
            floor_num = (i - 1) // 2 + 1  # floors 1,1,2,2,3,3
            u = Unit(
                property_id=pid,
                unit_number=f"Unit {i}",
                unit_type="3br",
                bed_count=4,
                bedroom_count=3,
                sqft=Decimal("1000"),
                floor=str(floor_num),
                is_occupied=True,
                renovation_phase="post_renovation",
                development_plan_id=dev_plan_id,
            )
            db.add(u)
            db.flush()
            for label, rent, br_num in unit_beds:
                db.add(Bed(
                    unit_id=u.unit_id,
                    bed_label=label,
                    monthly_rent=Decimal(str(rent)),
                    status="occupied",
                    bedroom_number=br_num,
                    is_post_renovation=True,
                ))

        db.flush()
        print(f"  ✓ 6 units, 24 beds created for development plan (id={dev_plan_id})")

        # Dev plan ancillary revenue (laundry in-unit, no revenue)
        dev_ancillary = [
            ("parking",  "Surface Parking (6 stalls)",    6, 100, 50, 0),
            ("pet_fee",  "Pet Fees (6 units @ 50% util)", 6,  50, 50, 0),
            ("storage",  "Storage Lockers (6 available)", 6,  67, 75, 0),
        ]
        for stype, desc, count, util, rate, esc in dev_ancillary:
            db.add(AncillaryRevenueStream(
                property_id=pid,
                development_plan_id=dev_plan_id,
                stream_type=stype,
                description=desc,
                total_count=count,
                utilization_pct=Decimal(str(util)),
                monthly_rate=Decimal(str(rate)),
                annual_escalation_pct=Decimal(str(esc)),
            ))

        # Dev plan operating expenses
        # Fixed total: $48,869 + 8% mgmt of $211,578 EGI ($16,926) = $65,795
        # NOI target: $211,578 - $65,795 = $145,783
        dev_opex = [
            ("property_tax",       "Municipal Property Tax",          "fixed",  10800, 2),
            ("insurance",          "Property & Liability Insurance",  "fixed",   5400, 2),
            ("utilities",          "All Utilities (owner-paid)",      "fixed",  14400, 2),
            ("repairs_maintenance","Maintenance & Repairs",           "fixed",   6000, 2),
            ("management_fee",     "Property Management (8% of EGI)","pct_egi",    8, 0),
            ("other",              "Common Area & Admin",             "fixed",   5069, 2),
            ("reserves",           "Capital Reserves ($300/bed/yr)",  "fixed",   7200, 2),
        ]
        for cat, desc, method, amount, esc in dev_opex:
            db.add(OperatingExpenseLineItem(
                property_id=pid,
                development_plan_id=dev_plan_id,
                category=cat,
                description=desc,
                calc_method=method,
                base_amount=Decimal(str(amount)),
                annual_escalation_pct=Decimal(str(esc)),
            ))
        db.flush()
        print("  ✓ Development ancillary & expenses created")

        # ── Debt: Construction Loan ──
        print("\n[7/8] Creating debt facilities...")
        construction_loan = DebtFacility(
            property_id=pid,
            lender_name="ATB Financial",
            debt_type="construction",
            status="active",
            debt_purpose="construction",
            replaces_debt_id=baseline_debt_id,
            development_plan_id=dev_plan_id,
            commitment_amount=Decimal("1350000"),
            drawn_amount=Decimal("0"),
            outstanding_balance=Decimal("0"),
            interest_rate=Decimal("7.5"),
            rate_type="variable",
            term_months=24,
            amortization_months=0,
            io_period_months=24,
            origination_date=date(2025, 9, 1),
            maturity_date=date(2027, 9, 1),
            compounding_method="monthly",
            notes="Construction loan, 75% LTC, IO during construction",
        )
        db.add(construction_loan)
        db.flush()
        construction_debt_id = construction_loan.debt_id

        # ── Debt: CMHC MLI Select Take-Out Mortgage (75% LTV) ──
        # Stabilized value: $145,783 / 4.5% cap = $3,240,000
        # Loan: $3,240,000 × 75% = $2,430,000
        # CMHC premium: 2.75% = $66,825
        # Total insured mortgage: $2,496,825
        # Annual debt service: ~$132,800 → DSCR = 1.10x
        cmhc_mortgage = DebtFacility(
            property_id=pid,
            lender_name="First National",
            debt_type="permanent_mortgage",
            status="pending",
            debt_purpose="refinancing",
            replaces_debt_id=construction_debt_id,
            development_plan_id=dev_plan_id,
            commitment_amount=Decimal("2430000"),
            drawn_amount=Decimal("2496825"),
            outstanding_balance=Decimal("2496825"),
            interest_rate=Decimal("3.85"),
            rate_type="fixed",
            term_months=120,
            amortization_months=420,
            io_period_months=0,
            origination_date=date(2027, 3, 1),
            maturity_date=date(2037, 3, 1),
            is_cmhc_insured=True,
            cmhc_insurance_premium_pct=Decimal("2.75"),
            cmhc_insurance_premium_amount=Decimal("66825"),
            cmhc_application_fee=Decimal("3500"),
            cmhc_program="MLI Select",
            compounding_method="semi_annual",
            lender_fee_pct=Decimal("0.5"),
            capitalized_fees=Decimal("78975"),
            lender_fee_amount=Decimal("12150"),
            notes="CMHC MLI Select insured mortgage, 75% LTV, 10-year term, 35-year amortization",
        )
        db.add(cmhc_mortgage)
        db.flush()
        print(f"  ✓ Construction loan (id={construction_debt_id})")
        print(f"  ✓ CMHC mortgage (id={cmhc_mortgage.debt_id})")

        # ── Commit Everything ──
        print("\n[8/8] Committing all data...")
        db.commit()

        print("\n" + "═" * 60)
        print("  ✓ SEED COMPLETE")
        print("═" * 60)
        print(f"\n  Property ID:        {pid}")
        print(f"  LP ID:              {lp.lp_id}")
        print(f"  Baseline Unit:      {baseline_unit.unit_id} (8 beds, GPR=${total_baseline_rent * 12:,}/yr)")
        print(f"  Reno Plan ID:       {reno_plan_id} (8 beds, GPR=${total_reno_rent * 12:,}/yr)")
        print(f"  Dev Plan ID:        {dev_plan_id} (24 beds, GPR=$213,696/yr)")
        print(f"  Baseline Debt ID:   {baseline_debt_id}")
        print(f"  Construction Debt:  {construction_debt_id}")
        print(f"  CMHC Mortgage:      {cmhc_mortgage.debt_id}")

        print("\n  Expected validated results:")
        print("  ─────────────────────────────────────────────")
        print("  Baseline NOI:       $29,381     |  CF: -$4,219 (negative, pre-reno)")
        print("  Post-Reno NOI:      $33,544     |  CF: -$56 (breakeven)")
        print("  Stabilized NOI:     $145,783    |  DSCR: 1.10x (CMHC min)")
        print("  Refi Distribution:  $1,055,000  |  Exit Cap: 4.75%")
        print("  Sale (Yr 7) NOI:    $185,956    |  Sale Price: $3,915,000")
        print("  Net Sale Proceeds:  $1,417,550  |  Rent Growth: 5%/yr")

    except Exception as e:
        db.rollback()
        print(f"\n  ✗ ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
