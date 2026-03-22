"""add staff, shifts, community_events tables and grant workflow columns

Revision ID: 003
Revises: 002
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Staff table ──────────────────────────────────────────────────
    op.create_table(
        "staff",
        sa.Column("staff_id", sa.Integer, primary_key=True, index=True),
        sa.Column("community_id", sa.Integer, sa.ForeignKey("communities.community_id"), nullable=False, index=True),
        sa.Column("first_name", sa.String(128), nullable=False),
        sa.Column("last_name", sa.String(128), nullable=False),
        sa.Column("email", sa.String(256), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("role", sa.String(32), nullable=False, server_default="support_worker"),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("hourly_rate", sa.Numeric(8, 2), nullable=True),
        sa.Column("hire_date", sa.Date, nullable=True),
        sa.Column("termination_date", sa.Date, nullable=True),
        sa.Column("emergency_contact_name", sa.String(256), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ── Shifts table ─────────────────────────────────────────────────
    op.create_table(
        "shifts",
        sa.Column("shift_id", sa.Integer, primary_key=True, index=True),
        sa.Column("staff_id", sa.Integer, sa.ForeignKey("staff.staff_id"), nullable=False, index=True),
        sa.Column("community_id", sa.Integer, sa.ForeignKey("communities.community_id"), nullable=False, index=True),
        sa.Column("shift_date", sa.Date, nullable=False, index=True),
        sa.Column("start_time", sa.String(5), nullable=False),
        sa.Column("end_time", sa.String(5), nullable=False),
        sa.Column("hours", sa.Numeric(5, 2), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="scheduled"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ── Community Events table ───────────────────────────────────────
    op.create_table(
        "community_events",
        sa.Column("event_id", sa.Integer, primary_key=True, index=True),
        sa.Column("community_id", sa.Integer, sa.ForeignKey("communities.community_id"), nullable=False, index=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("event_type", sa.String(32), nullable=False, server_default="other"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("event_date", sa.Date, nullable=False),
        sa.Column("start_time", sa.String(5), nullable=True),
        sa.Column("end_time", sa.String(5), nullable=True),
        sa.Column("location", sa.String(256), nullable=True),
        sa.Column("facilitator", sa.String(256), nullable=True),
        sa.Column("max_participants", sa.Integer, nullable=True),
        sa.Column("actual_participants", sa.Integer, nullable=True),
        sa.Column("cost", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_recurring", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("recurrence_pattern", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ── Grant workflow columns on funding_opportunities ───────────────
    op.add_column("funding_opportunities", sa.Column("application_date", sa.Date, nullable=True))
    op.add_column("funding_opportunities", sa.Column("application_ref", sa.String(128), nullable=True))
    op.add_column("funding_opportunities", sa.Column("program_name", sa.String(256), nullable=True))
    op.add_column("funding_opportunities", sa.Column("contact_name", sa.String(256), nullable=True))
    op.add_column("funding_opportunities", sa.Column("contact_email", sa.String(256), nullable=True))
    op.add_column("funding_opportunities", sa.Column("reporting_frequency", sa.String(64), nullable=True))
    op.add_column("funding_opportunities", sa.Column("next_report_date", sa.Date, nullable=True))
    op.add_column("funding_opportunities", sa.Column("requirements", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_table("community_events")
    op.drop_table("shifts")
    op.drop_table("staff")

    op.drop_column("funding_opportunities", "application_date")
    op.drop_column("funding_opportunities", "application_ref")
    op.drop_column("funding_opportunities", "program_name")
    op.drop_column("funding_opportunities", "contact_name")
    op.drop_column("funding_opportunities", "contact_email")
    op.drop_column("funding_opportunities", "reporting_frequency")
    op.drop_column("funding_opportunities", "next_report_date")
    op.drop_column("funding_opportunities", "requirements")
