"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("user_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("email", sa.String(256), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(256), nullable=False),
        sa.Column("full_name", sa.String(256), nullable=True),
        sa.Column(
            "role",
            sa.Enum(
                "GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER", "INVESTOR", "RESIDENT",
                name="userrole",
            ),
            nullable=False,
            server_default="INVESTOR",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )

    op.create_table(
        "properties",
        sa.Column("property_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("address", sa.String(256), nullable=False),
        sa.Column("city", sa.String(128), nullable=False),
        sa.Column("province", sa.String(64), nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("purchase_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("lot_size", sa.Numeric(14, 2), nullable=True),
        sa.Column("zoning", sa.String(128), nullable=True),
        sa.Column("max_buildable_area", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "development_stage",
            sa.Enum(
                "acquisition", "planning", "construction", "operational",
                name="developmentstage",
            ),
            nullable=False,
            server_default="acquisition",
        ),
    )

    op.create_table(
        "development_plans",
        sa.Column("plan_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("properties.property_id"), nullable=False),
        sa.Column("planned_units", sa.Integer(), nullable=False),
        sa.Column("planned_beds", sa.Integer(), nullable=False),
        sa.Column("planned_sqft", sa.Numeric(14, 2), nullable=False),
        sa.Column("estimated_construction_cost", sa.Numeric(16, 2), nullable=False),
        sa.Column("development_start_date", sa.Date(), nullable=False),
        sa.Column("construction_duration_days", sa.Integer(), nullable=False),
    )

    op.create_table(
        "communities",
        sa.Column("community_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("properties.property_id"), nullable=False),
        sa.Column(
            "community_type",
            sa.Enum("RecoverWell", "StudyWell", "RetireWell", name="communitytype"),
            nullable=False,
        ),
        sa.Column("name", sa.String(256), nullable=False),
    )

    op.create_table(
        "units",
        sa.Column("unit_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("community_id", sa.Integer(), sa.ForeignKey("communities.community_id"), nullable=False),
        sa.Column("unit_number", sa.String(32), nullable=False),
        sa.Column(
            "unit_type",
            sa.Enum("studio", "1br", "2br", name="unittype"),
            nullable=False,
        ),
        sa.Column("bed_count", sa.Integer(), nullable=False),
        sa.Column("sqft", sa.Numeric(10, 2), nullable=False),
        sa.Column("monthly_rent", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_occupied", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.create_table(
        "residents",
        sa.Column("resident_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("community_id", sa.Integer(), sa.ForeignKey("communities.community_id"), nullable=False),
        sa.Column("unit_id", sa.Integer(), sa.ForeignKey("units.unit_id"), nullable=False),
        sa.Column("full_name", sa.String(256), nullable=False),
        sa.Column("email", sa.String(256), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("bed_number", sa.String(16), nullable=False),
        sa.Column(
            "rent_type",
            sa.Enum("private_pay", "government_supported", name="renttype"),
            nullable=False,
        ),
        sa.Column("move_in_date", sa.Date(), nullable=False),
        sa.Column("move_out_date", sa.Date(), nullable=True),
    )

    op.create_table(
        "rent_payments",
        sa.Column("payment_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("resident_id", sa.Integer(), sa.ForeignKey("residents.resident_id"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_date", sa.DateTime(), nullable=False),
        sa.Column("period_month", sa.Integer(), nullable=False),
        sa.Column("period_year", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "paid", "overdue", name="paymentstatus"),
            nullable=False,
            server_default="pending",
        ),
    )

    op.create_table(
        "maintenance_requests",
        sa.Column("request_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("properties.property_id"), nullable=False),
        sa.Column("resident_id", sa.Integer(), sa.ForeignKey("residents.resident_id"), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("open", "in_progress", "resolved", name="maintenancestatus"),
            nullable=False,
            server_default="open",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "investors",
        sa.Column("investor_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True, unique=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("email", sa.String(256), nullable=False, unique=True),
        sa.Column("accredited_status", sa.String(32), nullable=False),
        sa.Column("phone", sa.String(64), nullable=True),
    )

    op.create_table(
        "capital_contributions",
        sa.Column("contribution_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("investor_id", sa.Integer(), sa.ForeignKey("investors.investor_id"), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "ownership",
        sa.Column("ownership_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("investor_id", sa.Integer(), sa.ForeignKey("investors.investor_id"), nullable=False),
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("properties.property_id"), nullable=True),
        sa.Column("ownership_percent", sa.Numeric(5, 2), nullable=False),
    )

    op.create_table(
        "distributions",
        sa.Column("distribution_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("investor_id", sa.Integer(), sa.ForeignKey("investors.investor_id"), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("payment_date", sa.DateTime(), nullable=False),
        sa.Column(
            "method",
            sa.Enum("eTransfer", "Wire", "ACH", name="distributionmethod"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("distributions")
    op.drop_table("ownership")
    op.drop_table("capital_contributions")
    op.drop_table("investors")
    op.drop_table("maintenance_requests")
    op.drop_table("rent_payments")
    op.drop_table("residents")
    op.drop_table("units")
    op.drop_table("communities")
    op.drop_table("development_plans")
    op.drop_table("properties")
    op.drop_table("users")

    for name in (
        "userrole", "developmentstage", "communitytype",
        "unittype", "renttype", "paymentstatus", "maintenancestatus", "distributionmethod",
    ):
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
