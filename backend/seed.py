"""
Seed script — populate the database with realistic Alberta demo data.

Usage (from the backend/ directory):
    python seed.py

Idempotent: running it twice will skip rows that already exist.
"""

import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import engine, SessionLocal
import app.db.models  # noqa: F401

# ── helpers ────────────────────────────────────────────────────────────────

def _try_add(db, obj):
    """Add obj to session; roll back silently on integrity error."""
    try:
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
    except Exception:
        db.rollback()
        return None


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    from app.db.models import (
        User, Property, PropertyCluster, DevelopmentPlan, Community, Unit, Bed,
        Resident, RentPayment, MaintenanceRequest, EconomicEntity,
        Investor, CapitalContribution, Ownership, Distribution,
        UserRole, DevelopmentStage, CommunityType, UnitType, RentType,
        BedStatus, PaymentStatus, MaintenanceStatus, DistributionMethod,
        DistributionType, EntityType,
    )

    # ── Users ──────────────────────────────────────────────────────────
    print("Seeding users ...")
    users = {}
    for email, full_name, role in [
        ("admin@livingwell.ca",     "Alex Chen",       UserRole.GP_ADMIN),
        ("ops@livingwell.ca",       "Maria Santos",    UserRole.OPERATIONS_MANAGER),
        ("pm@livingwell.ca",        "James Okafor",    UserRole.PROPERTY_MANAGER),
        ("investor1@example.ca",    "Sarah Mitchell",  UserRole.INVESTOR),
        ("investor2@example.ca",    "David Nguyen",    UserRole.INVESTOR),
        ("resident1@example.ca",    "Tom Clarke",      UserRole.RESIDENT),
    ]:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            users[email] = existing
            continue
        u = User(
            email=email,
            hashed_password=hash_password("Password1!"),
            full_name=full_name,
            role=role,
        )
        result = _try_add(db, u)
        users[email] = result or db.query(User).filter(User.email == email).first()
    print(f"  {len(users)} users ready")

    # ── Property Clusters ──────────────────────────────────────────────
    print("Seeding property clusters ...")
    cluster = db.query(PropertyCluster).filter(PropertyCluster.name == "Edmonton Central Cluster").first()
    if not cluster:
        cluster = _try_add(db, PropertyCluster(
            name="Edmonton Central Cluster",
            city="Edmonton",
            has_commercial_kitchen=True,
            kitchen_capacity_meals_per_day=150,
            notes="Commercial kitchen at 142 Whyte Ave serves 5 nearby properties",
        ))
    print(f"  cluster ready: {cluster.name if cluster else 'N/A'}")

    # ── Properties ─────────────────────────────────────────────────────
    print("Seeding properties ...")
    props_data = [
        {
            "address": "142 Whyte Ave",
            "city": "Edmonton",
            "province": "AB",
            "purchase_date": date(2021, 6, 15),
            "purchase_price": Decimal("1850000"),
            "lot_size": Decimal("6200"),
            "zoning": "RF3",
            "max_buildable_area": Decimal("4800"),
            "floor_area_ratio": Decimal("0.80"),
            "development_stage": DevelopmentStage.stabilized,
            "cluster_id": cluster.cluster_id if cluster else None,
        },
        {
            "address": "89 Bow Trail SW",
            "city": "Calgary",
            "province": "AB",
            "purchase_date": date(2022, 2, 28),
            "purchase_price": Decimal("2100000"),
            "lot_size": Decimal("5400"),
            "zoning": "M-C2",
            "max_buildable_area": Decimal("4200"),
            "floor_area_ratio": Decimal("0.78"),
            "development_stage": DevelopmentStage.stabilized,
            "cluster_id": None,
        },
        {
            "address": "310 Gaetz Ave",
            "city": "Red Deer",
            "province": "AB",
            "purchase_date": date(2023, 9, 1),
            "purchase_price": Decimal("780000"),
            "lot_size": Decimal("8100"),
            "zoning": "R2",
            "max_buildable_area": Decimal("6500"),
            "floor_area_ratio": Decimal("0.80"),
            "development_stage": DevelopmentStage.construction,
            "cluster_id": None,
        },
        {
            "address": "55 University Dr",
            "city": "Lethbridge",
            "province": "AB",
            "purchase_date": date(2024, 1, 20),
            "purchase_price": Decimal("920000"),
            "lot_size": Decimal("4900"),
            "zoning": "C-N",
            "max_buildable_area": Decimal("3800"),
            "floor_area_ratio": Decimal("0.78"),
            "development_stage": DevelopmentStage.planning,
            "cluster_id": None,
        },
        {
            "address": "220 Jasper Ave",
            "city": "Edmonton",
            "province": "AB",
            "purchase_date": date(2024, 8, 1),
            "purchase_price": Decimal("1450000"),
            "lot_size": Decimal("5800"),
            "zoning": "RF3",
            "max_buildable_area": Decimal("4500"),
            "floor_area_ratio": Decimal("0.78"),
            "development_stage": DevelopmentStage.acquisition,
            "cluster_id": cluster.cluster_id if cluster else None,
        },
    ]
    props = []
    for pd in props_data:
        existing = db.query(Property).filter(
            Property.address == pd["address"],
            Property.city == pd["city"],
        ).first()
        if existing:
            props.append(existing)
            continue
        p = Property(**pd)
        result = _try_add(db, p)
        props.append(result or existing)
    print(f"  {len(props)} properties ready")

    # ── Economic Entities ──────────────────────────────────────────────
    print("Seeding economic entities ...")
    for prop in props[:2]:  # Only for stabilized properties
        if not prop:
            continue
        for etype, lname, desc, share in [
            (EntityType.property_lp, f"Alberta Multiplex LP - {prop.address}",
             "Property ownership entity receiving rental income", Decimal("100.00")),
            (EntityType.operating_company, f"RecoverWell Operations - {prop.address}",
             "Manages day-to-day community operations", None),
            (EntityType.property_management, f"Living Well PM - {prop.address}",
             "Handles maintenance, building ops, compliance", None),
        ]:
            existing = db.query(EconomicEntity).filter(
                EconomicEntity.property_id == prop.property_id,
                EconomicEntity.entity_type == etype,
            ).first()
            if not existing:
                _try_add(db, EconomicEntity(
                    property_id=prop.property_id,
                    entity_type=etype,
                    legal_name=lname,
                    description=desc,
                    revenue_share_percent=share,
                ))
    print("  economic entities ready")

    # ── Development Plans ──────────────────────────────────────────────
    print("Seeding development plans ...")
    plan_specs = [
        (props[0], 1, 12, 24, Decimal("6400"), Decimal("1200000"), Decimal("280000"),
         Decimal("120000"), Decimal("80000"), Decimal("10.00"), Decimal("4.00"),
         Decimal("262.50"), Decimal("1920000"), date(2020, 3, 1), 480, date(2021, 6, 24)),
        (props[1], 1, 10, 18, Decimal("5200"), Decimal("980000"), Decimal("220000"),
         Decimal("100000"), Decimal("60000"), Decimal("10.00"), Decimal("4.00"),
         Decimal("261.54"), Decimal("1560000"), date(2021, 6, 1), 420, date(2022, 7, 26)),
        (props[2], 1, 8, 14, Decimal("4800"), Decimal("860000"), Decimal("200000"),
         Decimal("90000"), Decimal("50000"), Decimal("10.00"), Decimal("4.50"),
         Decimal("250.00"), Decimal("1440000"), date(2023, 11, 1), 365, date(2024, 11, 1)),
        (props[3], 1, 6, 10, Decimal("3200"), Decimal("580000"), Decimal("140000"),
         Decimal("70000"), Decimal("40000"), Decimal("10.00"), Decimal("4.50"),
         Decimal("259.38"), Decimal("960000"), date(2024, 6, 1), 300, date(2025, 3, 28)),
    ]
    for (prop, ver, units, beds, sqft, hard, soft, site, fin,
         cont_pct, esc_pct, cpsf, total, start, days, completion) in plan_specs:
        if not prop:
            continue
        if not db.query(DevelopmentPlan).filter(DevelopmentPlan.property_id == prop.property_id).first():
            _try_add(db, DevelopmentPlan(
                property_id=prop.property_id,
                version=ver,
                planned_units=units,
                planned_beds=beds,
                planned_sqft=sqft,
                hard_costs=hard,
                soft_costs=soft,
                site_costs=site,
                financing_costs=fin,
                contingency_percent=cont_pct,
                cost_escalation_percent_per_year=esc_pct,
                cost_per_sqft=cpsf,
                estimated_construction_cost=total,
                development_start_date=start,
                construction_duration_days=days,
                estimated_completion_date=completion,
            ))
    print("  development plans ready")

    # ── Communities ────────────────────────────────────────────────────
    print("Seeding communities ...")
    communities = []
    community_specs = [
        (props[0], CommunityType.recover, "RecoverWell Whyte Ave", True, Decimal("350.00")),
        (props[1], CommunityType.retire,  "RetireWell Bow Trail", True, Decimal("500.00")),
        (props[1], CommunityType.study,   "StudyWell Bow Trail", False, None),
        (props[3], CommunityType.study,   "StudyWell University", False, None),
    ]
    for prop, ctype, name, meal, meal_cost in community_specs:
        if not prop:
            communities.append(None)
            continue
        existing = db.query(Community).filter(Community.name == name).first()
        if existing:
            communities.append(existing)
            continue
        c = Community(
            property_id=prop.property_id, community_type=ctype, name=name,
            has_meal_plan=meal, meal_plan_monthly_cost=meal_cost,
        )
        result = _try_add(db, c)
        communities.append(result or db.query(Community).filter(Community.name == name).first())
    print(f"  {len([c for c in communities if c])} communities ready")

    # ── Units & Beds ───────────────────────────────────────────────────
    print("Seeding units and beds ...")
    unit_map = {}  # community_id -> list of units
    # (community_idx, unit_number, type, bed_count, sqft, bed_rents)
    # bed_rents is a list of (label, monthly_rent, rent_type)
    unit_specs = [
        # RecoverWell Whyte Ave -- shared rooms common in recovery housing
        (0, "101", UnitType.shared, 2, Decimal("400"),
         [("A", Decimal("1100"), RentType.private_pay),
          ("B", Decimal("1100"), RentType.government_supported)]),
        (0, "102", UnitType.shared, 2, Decimal("400"),
         [("A", Decimal("1100"), RentType.private_pay),
          ("B", Decimal("1100"), RentType.shared_room)]),
        (0, "103", UnitType.one_bed, 1, Decimal("480"),
         [("A", Decimal("1800"), RentType.private_pay)]),
        (0, "104", UnitType.one_bed, 1, Decimal("480"),
         [("A", Decimal("1800"), RentType.transitional)]),
        (0, "201", UnitType.two_bed, 2, Decimal("720"),
         [("A", Decimal("1400"), RentType.private_pay),
          ("B", Decimal("1400"), RentType.private_pay)]),
        (0, "202", UnitType.two_bed, 2, Decimal("720"),
         [("A", Decimal("1400"), RentType.government_supported),
          ("B", Decimal("1400"), RentType.government_supported)]),
        # RetireWell Bow Trail -- suites for seniors
        (1, "101", UnitType.suite, 1, Decimal("550"),
         [("A", Decimal("2600"), RentType.private_pay)]),
        (1, "102", UnitType.suite, 1, Decimal("550"),
         [("A", Decimal("2600"), RentType.private_pay)]),
        (1, "103", UnitType.two_bed, 2, Decimal("750"),
         [("A", Decimal("1800"), RentType.private_pay),
          ("B", Decimal("1800"), RentType.private_pay)]),
        (1, "104", UnitType.two_bed, 2, Decimal("750"),
         [("A", Decimal("1800"), RentType.government_supported),
          ("B", Decimal("1800"), RentType.government_supported)]),
        # StudyWell Bow Trail -- student rooms
        (2, "101", UnitType.shared, 2, Decimal("310"),
         [("A", Decimal("850"), RentType.private_pay),
          ("B", Decimal("850"), RentType.private_pay)]),
        (2, "102", UnitType.studio, 1, Decimal("310"),
         [("A", Decimal("1200"), RentType.private_pay)]),
        (2, "103", UnitType.one_bed, 1, Decimal("460"),
         [("A", Decimal("1500"), RentType.private_pay)]),
    ]

    bed_map = {}  # unit_id -> list of beds

    for ci, unit_number, utype, beds, sqft, bed_rents in unit_specs:
        comm = communities[ci]
        if not comm:
            continue
        existing = db.query(Unit).filter(
            Unit.community_id == comm.community_id,
            Unit.unit_number == unit_number,
        ).first()
        if existing:
            unit_map.setdefault(comm.community_id, []).append(existing)
            # Load existing beds
            existing_beds = db.query(Bed).filter(Bed.unit_id == existing.unit_id).all()
            bed_map[existing.unit_id] = existing_beds
            continue
        u = Unit(
            community_id=comm.community_id,
            unit_number=unit_number,
            unit_type=utype,
            bed_count=beds,
            sqft=sqft,
            is_occupied=False,
        )
        result = _try_add(db, u)
        if result:
            unit_map.setdefault(comm.community_id, []).append(result)
            # Create beds for this unit
            unit_beds = []
            for label, rent, rtype in bed_rents:
                bed = _try_add(db, Bed(
                    unit_id=result.unit_id,
                    bed_label=label,
                    monthly_rent=rent,
                    rent_type=rtype,
                    status=BedStatus.available,
                ))
                if bed:
                    unit_beds.append(bed)
            bed_map[result.unit_id] = unit_beds

    total_units = sum(len(v) for v in unit_map.values())
    total_beds = sum(len(v) for v in bed_map.values())
    print(f"  {total_units} units, {total_beds} beds ready")

    # ── Residents ──────────────────────────────────────────────────────
    print("Seeding residents ...")
    resident_specs = [
        # (community_idx, unit_idx, bed_idx_in_unit, name, email, rent_type, move_in, meal_plan)
        (0, 0, 0, "Tom Clarke",    "resident1@example.ca", RentType.private_pay,          date(2022, 3, 1), True),
        (0, 0, 1, "Linda Park",    "linda@example.ca",     RentType.government_supported, date(2022, 5, 1), True),
        (0, 2, 0, "Michael Brown", "michael@example.ca",   RentType.private_pay,          date(2022, 7, 1), False),
        (1, 0, 0, "Grace Kim",     "grace@example.ca",     RentType.private_pay,          date(2022, 9, 1), True),
        (1, 1, 0, "Robert Davis",  "robert@example.ca",    RentType.private_pay,          date(2023, 1, 1), True),
        (2, 0, 0, "Emma Wilson",   "emma@example.ca",      RentType.private_pay,          date(2023, 3, 1), False),
        (2, 0, 1, "Noah Taylor",   "noah@example.ca",      RentType.private_pay,          date(2023, 5, 1), False),
    ]
    residents = []
    for ci, ui, bi, name, email, rtype, move_in, meal in resident_specs:
        comm = communities[ci]
        if not comm:
            residents.append(None)
            continue
        comm_units = unit_map.get(comm.community_id, [])
        if ui >= len(comm_units) or not comm_units[ui]:
            residents.append(None)
            continue
        unit = comm_units[ui]
        unit_beds = bed_map.get(unit.unit_id, [])
        bed = unit_beds[bi] if bi < len(unit_beds) else None

        existing = db.query(Resident).filter(Resident.email == email).first()
        if existing:
            residents.append(existing)
            continue
        r = Resident(
            community_id=comm.community_id,
            unit_id=unit.unit_id,
            bed_id=bed.bed_id if bed else None,
            full_name=name,
            email=email,
            bed_number=bed.bed_label if bed else "1",
            rent_type=rtype,
            move_in_date=move_in,
            enrolled_meal_plan=meal,
        )
        result = _try_add(db, r)
        if result:
            unit.is_occupied = True
            if bed:
                bed.status = BedStatus.occupied
            db.commit()
        residents.append(result or db.query(Resident).filter(Resident.email == email).first())
    print(f"  {len([r for r in residents if r])} residents ready")

    # ── Rent Payments ──────────────────────────────────────────────────
    print("Seeding rent payments ...")
    now = datetime.utcnow()
    payment_count = 0
    for resident in residents:
        if not resident:
            continue
        existing = db.query(RentPayment).filter(
            RentPayment.resident_id == resident.resident_id
        ).count()
        if existing > 0:
            continue
        # Get the bed rent amount
        bed = db.query(Bed).filter(Bed.bed_id == resident.bed_id).first() if resident.bed_id else None
        amount = bed.monthly_rent if bed else Decimal("1500")
        # Add meal plan cost if enrolled
        meal_included = False
        if resident.enrolled_meal_plan:
            comm = db.query(Community).filter(
                Community.community_id == resident.community_id
            ).first()
            if comm and comm.meal_plan_monthly_cost:
                amount += comm.meal_plan_monthly_cost
                meal_included = True

        for months_ago in range(3, 0, -1):
            pay_date = now - timedelta(days=months_ago * 30)
            rp = RentPayment(
                resident_id=resident.resident_id,
                bed_id=resident.bed_id,
                amount=amount,
                payment_date=pay_date,
                period_month=pay_date.month,
                period_year=pay_date.year,
                status=PaymentStatus.paid,
                includes_meal_plan=meal_included,
            )
            p = _try_add(db, rp)
            if p:
                payment_count += 1
    print(f"  {payment_count} payments seeded")

    # ── Maintenance Requests ───────────────────────────────────────────
    print("Seeding maintenance requests ...")
    maint_specs = [
        (props[0], None, "HVAC unit in room 101 making loud noise", MaintenanceStatus.resolved,
         datetime.utcnow() - timedelta(days=45), datetime.utcnow() - timedelta(days=40)),
        (props[0], None, "Leaking faucet in unit 202 bathroom", MaintenanceStatus.resolved,
         datetime.utcnow() - timedelta(days=20), datetime.utcnow() - timedelta(days=18)),
        (props[1], None, "Elevator requires annual inspection", MaintenanceStatus.in_progress,
         datetime.utcnow() - timedelta(days=10), None),
        (props[0], None, "Common area carpet cleaning needed", MaintenanceStatus.open,
         datetime.utcnow() - timedelta(days=3), None),
        (props[1], None, "Parking lot lighting replacement", MaintenanceStatus.open,
         datetime.utcnow() - timedelta(days=1), None),
    ]
    for prop, res, desc, mstatus, created, resolved in maint_specs:
        if not prop:
            continue
        existing = db.query(MaintenanceRequest).filter(
            MaintenanceRequest.property_id == prop.property_id,
            MaintenanceRequest.description == desc,
        ).first()
        if existing:
            continue
        _try_add(db, MaintenanceRequest(
            property_id=prop.property_id,
            resident_id=None,
            description=desc,
            status=mstatus,
            created_at=created,
            resolved_at=resolved,
        ))
    print("  maintenance requests ready")

    # ── Investors ──────────────────────────────────────────────────────
    print("Seeding investors ...")
    investor_map = {}
    for email, user_email, name, accredited, pref_return in [
        ("sarah.mitchell@investors.ca", "investor1@example.ca", "Sarah Mitchell", "accredited", Decimal("8.00")),
        ("david.nguyen@investors.ca",   "investor2@example.ca", "David Nguyen",   "accredited", Decimal("8.00")),
        ("wei.zhang@investors.ca",      None,                   "Wei Zhang",       "accredited", Decimal("10.00")),
    ]:
        existing = db.query(Investor).filter(Investor.email == email).first()
        if existing:
            investor_map[email] = existing
            continue
        linked_user = users.get(user_email) if user_email else None
        inv = Investor(
            user_id=linked_user.user_id if linked_user else None,
            name=name,
            email=email,
            accredited_status=accredited,
            preferred_return_rate=pref_return,
        )
        result = _try_add(db, inv)
        investor_map[email] = result or db.query(Investor).filter(Investor.email == email).first()
    print(f"  {len(investor_map)} investors ready")

    # ── Capital Contributions ──────────────────────────────────────────
    print("Seeding capital contributions ...")
    contrib_count = 0
    contrib_specs = [
        ("sarah.mitchell@investors.ca", Decimal("500000"), datetime(2021, 7, 1),  "Initial capital raise"),
        ("sarah.mitchell@investors.ca", Decimal("250000"), datetime(2022, 3, 15), "Second tranche"),
        ("david.nguyen@investors.ca",   Decimal("350000"), datetime(2021, 8, 1),  "Initial capital raise"),
        ("david.nguyen@investors.ca",   Decimal("150000"), datetime(2022, 6, 1),  "Top-up"),
        ("wei.zhang@investors.ca",      Decimal("600000"), datetime(2021, 7, 15), "Initial capital raise"),
    ]
    for inv_email, amount, dt, notes in contrib_specs:
        inv = investor_map.get(inv_email)
        if not inv:
            continue
        existing = db.query(CapitalContribution).filter(
            CapitalContribution.investor_id == inv.investor_id,
            CapitalContribution.amount == amount,
            CapitalContribution.notes == notes,
        ).first()
        if existing:
            continue
        result = _try_add(db, CapitalContribution(
            investor_id=inv.investor_id,
            amount=amount,
            date=dt,
            notes=notes,
        ))
        if result:
            contrib_count += 1
    print(f"  {contrib_count} contributions seeded")

    # ── Ownership ──────────────────────────────────────────────────────
    print("Seeding ownership ...")
    ownership_specs = [
        # GP ownership
        ("sarah.mitchell@investors.ca", props[0], Decimal("5.00"), True),   # GP carry
        # LP ownership
        ("sarah.mitchell@investors.ca", props[0], Decimal("25.00"), False),
        ("sarah.mitchell@investors.ca", props[1], Decimal("20.00"), False),
        ("david.nguyen@investors.ca",   props[0], Decimal("15.00"), False),
        ("david.nguyen@investors.ca",   props[1], Decimal("10.00"), False),
        ("wei.zhang@investors.ca",      props[0], Decimal("30.00"), False),
        ("wei.zhang@investors.ca",      props[1], Decimal("25.00"), False),
    ]
    for inv_email, prop, pct, is_gp in ownership_specs:
        inv = investor_map.get(inv_email)
        if not inv or not prop:
            continue
        existing = db.query(Ownership).filter(
            Ownership.investor_id == inv.investor_id,
            Ownership.property_id == prop.property_id,
            Ownership.is_gp == is_gp,
        ).first()
        if not existing:
            _try_add(db, Ownership(
                investor_id=inv.investor_id,
                property_id=prop.property_id,
                ownership_percent=pct,
                is_gp=is_gp,
            ))
    print("  ownership records ready")

    # ── Distributions ──────────────────────────────────────────────────
    print("Seeding distributions ...")
    dist_count = 0
    dist_specs = [
        ("sarah.mitchell@investors.ca", Decimal("18750"), datetime(2022, 12, 31),
         DistributionMethod.etransfer, DistributionType.preferred_return, "Q4 2022 preferred return"),
        ("sarah.mitchell@investors.ca", Decimal("18750"), datetime(2023, 6, 30),
         DistributionMethod.etransfer, DistributionType.preferred_return, "Q2 2023 preferred return"),
        ("sarah.mitchell@investors.ca", Decimal("8000"), datetime(2023, 12, 31),
         DistributionMethod.etransfer, DistributionType.profit_share, "Q4 2023 profit share"),
        ("david.nguyen@investors.ca",   Decimal("12500"), datetime(2022, 12, 31),
         DistributionMethod.wire, DistributionType.preferred_return, "Q4 2022 preferred return"),
        ("david.nguyen@investors.ca",   Decimal("12500"), datetime(2023, 6, 30),
         DistributionMethod.wire, DistributionType.preferred_return, "Q2 2023 preferred return"),
        ("wei.zhang@investors.ca",      Decimal("22500"), datetime(2022, 12, 31),
         DistributionMethod.ach, DistributionType.preferred_return, "Q4 2022 preferred return"),
        ("wei.zhang@investors.ca",      Decimal("22500"), datetime(2023, 12, 31),
         DistributionMethod.ach, DistributionType.preferred_return, "Q4 2023 preferred return"),
    ]
    for inv_email, amount, dt, method, dtype, notes in dist_specs:
        inv = investor_map.get(inv_email)
        if not inv:
            continue
        existing = db.query(Distribution).filter(
            Distribution.investor_id == inv.investor_id,
            Distribution.amount == amount,
            Distribution.notes == notes,
        ).first()
        if existing:
            continue
        result = _try_add(db, Distribution(
            investor_id=inv.investor_id,
            amount=amount,
            payment_date=dt,
            method=method,
            distribution_type=dtype,
            notes=notes,
        ))
        if result:
            dist_count += 1
    print(f"  {dist_count} distributions seeded")

    db.close()
    print("\nSeed complete.")
    print("\nDemo accounts (all passwords: Password1!)")
    print("  admin@livingwell.ca       -- GP Admin (full access)")
    print("  ops@livingwell.ca         -- Operations Manager")
    print("  pm@livingwell.ca          -- Property Manager")
    print("  investor1@example.ca      -- Investor (Sarah Mitchell)")
    print("  investor2@example.ca      -- Investor (David Nguyen)")
    print("  resident1@example.ca      -- Resident (Tom Clarke)")


if __name__ == "__main__":
    run()
