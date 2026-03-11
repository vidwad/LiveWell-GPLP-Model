"""
Seed script — populate the database with realistic demo data.

Usage (from the backend/ directory):
    python seed.py

It is idempotent: running it twice will skip rows that already exist
(unique-constraint violations are caught and skipped).
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
import app.db.models  # noqa: F401 — registers all models with Base

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
        User, Property, DevelopmentPlan, Community, Unit, Resident,
        RentPayment, MaintenanceRequest, Investor, CapitalContribution,
        Ownership, Distribution,
        UserRole, DevelopmentStage, CommunityType, UnitType, RentType,
        PaymentStatus, MaintenanceStatus, DistributionMethod,
    )

    print("Seeding users …")
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

    print("Seeding properties …")
    props_data = [
        {
            "address": "142 Elmwood Ave",
            "city": "Toronto",
            "province": "ON",
            "purchase_date": date(2021, 6, 15),
            "purchase_price": Decimal("2_450_000"),
            "lot_size": Decimal("6200"),
            "zoning": "R3",
            "max_buildable_area": Decimal("4800"),
            "development_stage": DevelopmentStage.operational,
        },
        {
            "address": "89 Riverside Dr",
            "city": "Hamilton",
            "province": "ON",
            "purchase_date": date(2022, 2, 28),
            "purchase_price": Decimal("1_850_000"),
            "lot_size": Decimal("5400"),
            "zoning": "C2",
            "max_buildable_area": Decimal("4200"),
            "development_stage": DevelopmentStage.operational,
        },
        {
            "address": "310 Lakeview Blvd",
            "city": "Barrie",
            "province": "ON",
            "purchase_date": date(2023, 9, 1),
            "purchase_price": Decimal("980_000"),
            "lot_size": Decimal("8100"),
            "zoning": "R2",
            "max_buildable_area": Decimal("6500"),
            "development_stage": DevelopmentStage.construction,
        },
        {
            "address": "55 University Ave",
            "city": "Waterloo",
            "province": "ON",
            "purchase_date": date(2024, 1, 20),
            "purchase_price": Decimal("1_200_000"),
            "lot_size": Decimal("4900"),
            "zoning": "MU1",
            "max_buildable_area": Decimal("3800"),
            "development_stage": DevelopmentStage.planning,
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

    print("Seeding development plans …")
    for prop, units, beds, sqft, cost, start, days in [
        (props[0], 12, 18, Decimal("6400"), Decimal("1_920_000"), date(2020, 3, 1), 480),
        (props[1], 10, 14, Decimal("5200"), Decimal("1_560_000"), date(2021, 6, 1), 420),
        (props[2], 8,  12, Decimal("4800"), Decimal("1_440_000"), date(2023, 11, 1), 365),
        (props[3], 6,  8,  Decimal("3200"), Decimal("960_000"),   date(2024, 6, 1), 300),
    ]:
        if not prop:
            continue
        if not db.query(DevelopmentPlan).filter(DevelopmentPlan.property_id == prop.property_id).first():
            _try_add(db, DevelopmentPlan(
                property_id=prop.property_id,
                planned_units=units,
                planned_beds=beds,
                planned_sqft=sqft,
                estimated_construction_cost=cost,
                development_start_date=start,
                construction_duration_days=days,
            ))

    print("Seeding communities …")
    communities = []
    community_specs = [
        (props[0], CommunityType.recover, "RecoverWell Elmwood"),
        (props[1], CommunityType.retire,  "RetireWell Riverside"),
        (props[1], CommunityType.study,   "StudyWell Riverside"),
        (props[3], CommunityType.study,   "StudyWell University"),
    ]
    for prop, ctype, name in community_specs:
        if not prop:
            communities.append(None)
            continue
        existing = db.query(Community).filter(Community.name == name).first()
        if existing:
            communities.append(existing)
            continue
        c = Community(property_id=prop.property_id, community_type=ctype, name=name)
        result = _try_add(db, c)
        communities.append(result or db.query(Community).filter(Community.name == name).first())
    print(f"  {len([c for c in communities if c])} communities ready")

    print("Seeding units …")
    unit_map = {}  # community_id -> list of units
    unit_specs = [
        # (community_idx, unit_number, type, beds, sqft, rent)
        (0, "101", UnitType.studio, 1, Decimal("320"), Decimal("2200")),
        (0, "102", UnitType.studio, 1, Decimal("320"), Decimal("2200")),
        (0, "103", UnitType.one_bed, 1, Decimal("480"), Decimal("2800")),
        (0, "104", UnitType.one_bed, 1, Decimal("480"), Decimal("2800")),
        (0, "201", UnitType.two_bed, 2, Decimal("720"), Decimal("3400")),
        (0, "202", UnitType.two_bed, 2, Decimal("720"), Decimal("3400")),
        (1, "101", UnitType.one_bed, 1, Decimal("500"), Decimal("2600")),
        (1, "102", UnitType.one_bed, 1, Decimal("500"), Decimal("2600")),
        (1, "103", UnitType.two_bed, 2, Decimal("750"), Decimal("3200")),
        (1, "104", UnitType.two_bed, 2, Decimal("750"), Decimal("3200")),
        (2, "101", UnitType.studio, 1, Decimal("310"), Decimal("1900")),
        (2, "102", UnitType.studio, 1, Decimal("310"), Decimal("1900")),
        (2, "103", UnitType.one_bed, 1, Decimal("460"), Decimal("2400")),
    ]
    for ci, unit_number, utype, beds, sqft, rent in unit_specs:
        comm = communities[ci]
        if not comm:
            continue
        existing = db.query(Unit).filter(
            Unit.community_id == comm.community_id,
            Unit.unit_number == unit_number,
        ).first()
        if existing:
            unit_map.setdefault(comm.community_id, []).append(existing)
            continue
        u = Unit(
            community_id=comm.community_id,
            unit_number=unit_number,
            unit_type=utype,
            bed_count=beds,
            sqft=sqft,
            monthly_rent=rent,
            is_occupied=False,
        )
        result = _try_add(db, u)
        unit_map.setdefault(comm.community_id, []).append(
            result or db.query(Unit).filter(
                Unit.community_id == comm.community_id,
                Unit.unit_number == unit_number
            ).first()
        )
    print(f"  {sum(len(v) for v in unit_map.values())} units ready")

    print("Seeding residents …")
    resident_specs = [
        # (community_idx, unit_idx_in_community, full_name, email, rent_type, move_in)
        (0, 0, "Tom Clarke",    "resident1@example.ca", RentType.private_pay,          date(2022, 3, 1)),
        (0, 1, "Linda Park",    "linda@example.ca",     RentType.government_supported, date(2022, 5, 1)),
        (0, 2, "Michael Brown", "michael@example.ca",   RentType.private_pay,          date(2022, 7, 1)),
        (1, 0, "Grace Kim",     "grace@example.ca",     RentType.private_pay,          date(2022, 9, 1)),
        (1, 1, "Robert Davis",  "robert@example.ca",    RentType.private_pay,          date(2023, 1, 1)),
        (2, 0, "Emma Wilson",   "emma@example.ca",      RentType.government_supported, date(2023, 3, 1)),
        (2, 1, "Noah Taylor",   "noah@example.ca",      RentType.private_pay,          date(2023, 5, 1)),
    ]
    residents = []
    for ci, ui, name, email, rtype, move_in in resident_specs:
        comm = communities[ci]
        if not comm:
            residents.append(None)
            continue
        comm_units = unit_map.get(comm.community_id, [])
        if ui >= len(comm_units) or not comm_units[ui]:
            residents.append(None)
            continue
        unit = comm_units[ui]
        existing = db.query(Resident).filter(Resident.email == email).first()
        if existing:
            residents.append(existing)
            continue
        r = Resident(
            community_id=comm.community_id,
            unit_id=unit.unit_id,
            full_name=name,
            email=email,
            bed_number="1",
            rent_type=rtype,
            move_in_date=move_in,
        )
        result = _try_add(db, r)
        if result:
            unit.is_occupied = True
            db.commit()
        residents.append(result or db.query(Resident).filter(Resident.email == email).first())
    print(f"  {len([r for r in residents if r])} residents ready")

    print("Seeding rent payments …")
    now = datetime.utcnow()
    payment_count = 0
    for resident in residents:
        if not resident:
            continue
        # Check if payments already exist
        existing = db.query(RentPayment).filter(RentPayment.resident_id == resident.resident_id).first()
        if existing:
            continue
        # seed last 3 months of payments
        for months_ago in range(3, 0, -1):
            pay_date = now - timedelta(days=months_ago * 30)
            unit = db.query(Unit).filter(Unit.unit_id == resident.unit_id).first()
            amount = unit.monthly_rent if unit else Decimal("2500")
            rp = RentPayment(
                resident_id=resident.resident_id,
                amount=amount,
                payment_date=pay_date,
                period_month=pay_date.month,
                period_year=pay_date.year,
                status=PaymentStatus.paid,
            )
            p = _try_add(db, rp)
            if p:
                payment_count += 1
    print(f"  {payment_count} payments seeded")

    print("Seeding maintenance requests …")
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
    for prop, res, desc, status, created, resolved in maint_specs:
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
            status=status,
            created_at=created,
            resolved_at=resolved,
        ))
    print("  maintenance requests ready")

    print("Seeding investors …")
    investor_map = {}
    for email, user_email, name, accredited in [
        ("sarah.mitchell@investors.ca", "investor1@example.ca", "Sarah Mitchell", "accredited"),
        ("david.nguyen@investors.ca",   "investor2@example.ca", "David Nguyen",   "accredited"),
        ("wei.zhang@investors.ca",      None,                   "Wei Zhang",       "accredited"),
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
        )
        result = _try_add(db, inv)
        investor_map[email] = result or db.query(Investor).filter(Investor.email == email).first()
    print(f"  {len(investor_map)} investors ready")

    print("Seeding capital contributions …")
    contrib_count = 0
    contrib_specs = [
        ("sarah.mitchell@investors.ca", Decimal("500_000"), datetime(2021, 7, 1),  "Initial capital raise"),
        ("sarah.mitchell@investors.ca", Decimal("250_000"), datetime(2022, 3, 15), "Second tranche"),
        ("david.nguyen@investors.ca",   Decimal("350_000"), datetime(2021, 8, 1),  "Initial capital raise"),
        ("david.nguyen@investors.ca",   Decimal("150_000"), datetime(2022, 6, 1),  "Top-up"),
        ("wei.zhang@investors.ca",      Decimal("600_000"), datetime(2021, 7, 15), "Initial capital raise"),
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

    print("Seeding ownership …")
    ownership_specs = [
        ("sarah.mitchell@investors.ca", props[0], Decimal("25.00")),
        ("sarah.mitchell@investors.ca", props[1], Decimal("20.00")),
        ("david.nguyen@investors.ca",   props[0], Decimal("15.00")),
        ("david.nguyen@investors.ca",   props[1], Decimal("10.00")),
        ("wei.zhang@investors.ca",      props[0], Decimal("30.00")),
        ("wei.zhang@investors.ca",      props[1], Decimal("25.00")),
    ]
    for inv_email, prop, pct in ownership_specs:
        inv = investor_map.get(inv_email)
        if not inv or not prop:
            continue
        existing = db.query(Ownership).filter(
            Ownership.investor_id == inv.investor_id,
            Ownership.property_id == prop.property_id,
        ).first()
        if not existing:
            _try_add(db, Ownership(
                investor_id=inv.investor_id,
                property_id=prop.property_id,
                ownership_percent=pct,
            ))
    print("  ownership records ready")

    print("Seeding distributions …")
    dist_count = 0
    dist_specs = [
        ("sarah.mitchell@investors.ca", Decimal("18_750"), datetime(2022, 12, 31), DistributionMethod.etransfer, "Q4 2022 distribution"),
        ("sarah.mitchell@investors.ca", Decimal("18_750"), datetime(2023, 6, 30),  DistributionMethod.etransfer, "Q2 2023 distribution"),
        ("sarah.mitchell@investors.ca", Decimal("20_000"), datetime(2023, 12, 31), DistributionMethod.etransfer, "Q4 2023 distribution"),
        ("david.nguyen@investors.ca",   Decimal("12_500"), datetime(2022, 12, 31), DistributionMethod.wire,      "Q4 2022 distribution"),
        ("david.nguyen@investors.ca",   Decimal("12_500"), datetime(2023, 6, 30),  DistributionMethod.wire,      "Q2 2023 distribution"),
        ("wei.zhang@investors.ca",      Decimal("22_500"), datetime(2022, 12, 31), DistributionMethod.ach,       "Q4 2022 distribution"),
        ("wei.zhang@investors.ca",      Decimal("22_500"), datetime(2023, 12, 31), DistributionMethod.ach,       "Q4 2023 distribution"),
    ]
    for inv_email, amount, dt, method, notes in dist_specs:
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
            notes=notes,
        ))
        if result:
            dist_count += 1
    print(f"  {dist_count} distributions seeded")

    db.close()
    print("\nSeed complete.")
    print("\nDemo accounts (all passwords: Password1!)")
    print("  admin@livingwell.ca       — GP Admin (full access)")
    print("  ops@livingwell.ca         — Operations Manager")
    print("  pm@livingwell.ca          — Property Manager")
    print("  investor1@example.ca      — Investor (Sarah Mitchell)")
    print("  investor2@example.ca      — Investor (David Nguyen)")
    print("  resident1@example.ca      — Resident (Tom Clarke)")


if __name__ == "__main__":
    run()
