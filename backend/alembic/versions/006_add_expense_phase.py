"""Add phase column to operating_expenses table.

Revision ID: 006
Revises: 005
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "operating_expenses",
        sa.Column("phase", sa.String(20), nullable=True),
    )


def downgrade():
    op.drop_column("operating_expenses", "phase")
