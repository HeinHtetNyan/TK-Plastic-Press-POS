"""add discount to voucher and payment

Revision ID: b7c8d9e0f1a2
Revises: f3a4b5c6d7e8
Create Date: 2026-07-14 00:00:00.000000

Adds discount_amount columns to the voucher and payment tables so a
flat-amount discount can be recorded and subtracted from totals/balance.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, Sequence[str], None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('voucher', sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0'))
    op.add_column('payment', sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('payment', 'discount_amount')
    op.drop_column('voucher', 'discount_amount')
