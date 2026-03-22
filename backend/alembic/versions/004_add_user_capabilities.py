"""add user_capabilities table for fine-grained permissions

Revision ID: 004
Revises: 003
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_capabilities",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.user_id"), nullable=False, index=True),
        sa.Column("capability", sa.String(128), nullable=False, index=True),
        sa.Column("granted_by", sa.Integer, sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("granted_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    # Unique constraint: no duplicate capability grants per user
    op.create_unique_constraint(
        "uq_user_capability",
        "user_capabilities",
        ["user_id", "capability"],
    )


def downgrade() -> None:
    op.drop_table("user_capabilities")
