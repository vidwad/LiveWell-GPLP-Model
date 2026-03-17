"""add lp/gp profit share columns to lp_entities

Revision ID: 002
Revises: 001
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lp_entities",
        sa.Column("lp_profit_share_percent", sa.Numeric(5, 2), nullable=True, server_default="70"),
    )
    op.add_column(
        "lp_entities",
        sa.Column("gp_profit_share_percent", sa.Numeric(5, 2), nullable=True, server_default="30"),
    )


def downgrade() -> None:
    op.drop_column("lp_entities", "gp_profit_share_percent")
    op.drop_column("lp_entities", "lp_profit_share_percent")
