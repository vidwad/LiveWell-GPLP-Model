"""Add ancillary revenue streams, operating expense line items, and CMHC debt fields.

Revision ID: 007
Revises: 006
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. Ancillary Revenue Streams table ──────────────────────────────
    op.create_table(
        "ancillary_revenue_streams",
        sa.Column("stream_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "property_id",
            sa.Integer,
            sa.ForeignKey("properties.property_id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "development_plan_id",
            sa.Integer,
            sa.ForeignKey("development_plans.plan_id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("stream_type", sa.String(64), nullable=False),
        sa.Column("description", sa.String(256), nullable=True),
        sa.Column("total_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "utilization_pct",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="100",
        ),
        sa.Column(
            "monthly_rate",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "annual_escalation_pct",
            sa.Numeric(5, 2),
            nullable=True,
            server_default="0",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime,
            nullable=True,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ── 2. Operating Expense Line Items table ───────────────────────────
    op.create_table(
        "operating_expense_line_items",
        sa.Column("expense_item_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "property_id",
            sa.Integer,
            sa.ForeignKey("properties.property_id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "development_plan_id",
            sa.Integer,
            sa.ForeignKey("development_plans.plan_id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("description", sa.String(256), nullable=True),
        sa.Column(
            "calc_method",
            sa.Enum("fixed", "per_unit", "pct_egi", name="expensecalcmethod"),
            nullable=False,
            server_default="per_unit",
        ),
        sa.Column(
            "base_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "annual_escalation_pct",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="3",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime,
            nullable=True,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # ── 3. CMHC fields on debt_facilities ───────────────────────────────
    op.add_column(
        "debt_facilities",
        sa.Column("is_cmhc_insured", sa.Boolean, server_default="0"),
    )
    op.add_column(
        "debt_facilities",
        sa.Column("cmhc_insurance_premium_pct", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "debt_facilities",
        sa.Column("cmhc_insurance_premium_amount", sa.Numeric(15, 2), nullable=True),
    )
    op.add_column(
        "debt_facilities",
        sa.Column("cmhc_application_fee", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "debt_facilities",
        sa.Column("cmhc_program", sa.String(64), nullable=True),
    )
    op.add_column(
        "debt_facilities",
        sa.Column(
            "compounding_method",
            sa.String(20),
            server_default="semi_annual",
        ),
    )
    op.add_column(
        "debt_facilities",
        sa.Column("lender_fee_pct", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "debt_facilities",
        sa.Column(
            "capitalized_fees",
            sa.Numeric(15, 2),
            server_default="0",
        ),
    )


def downgrade():
    # Drop CMHC columns from debt_facilities
    op.drop_column("debt_facilities", "capitalized_fees")
    op.drop_column("debt_facilities", "lender_fee_pct")
    op.drop_column("debt_facilities", "compounding_method")
    op.drop_column("debt_facilities", "cmhc_program")
    op.drop_column("debt_facilities", "cmhc_application_fee")
    op.drop_column("debt_facilities", "cmhc_insurance_premium_amount")
    op.drop_column("debt_facilities", "cmhc_insurance_premium_pct")
    op.drop_column("debt_facilities", "is_cmhc_insured")

    # Drop new tables
    op.drop_table("operating_expense_line_items")
    op.execute("DROP TYPE IF EXISTS expensecalcmethod")
    op.drop_table("ancillary_revenue_streams")
