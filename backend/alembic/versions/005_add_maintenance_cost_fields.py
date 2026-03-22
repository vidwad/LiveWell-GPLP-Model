"""add cost tracking fields to maintenance_requests

Revision ID: 005
Revises: 004
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("maintenance_requests", sa.Column("estimated_cost", sa.Numeric(10, 2), nullable=True))
    op.add_column("maintenance_requests", sa.Column("actual_cost", sa.Numeric(10, 2), nullable=True))
    op.add_column("maintenance_requests", sa.Column("vendor", sa.String(256), nullable=True))

    # Also add accreditation tracking to investors (from 1.3.12)
    op.add_column("investors", sa.Column("accreditation_verified_at", sa.Date, nullable=True))
    op.add_column("investors", sa.Column("accreditation_expires_at", sa.Date, nullable=True))
    op.add_column("investors", sa.Column("accreditation_document_id", sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column("maintenance_requests", "estimated_cost")
    op.drop_column("maintenance_requests", "actual_cost")
    op.drop_column("maintenance_requests", "vendor")
    op.drop_column("investors", "accreditation_verified_at")
    op.drop_column("investors", "accreditation_expires_at")
    op.drop_column("investors", "accreditation_document_id")
