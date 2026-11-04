"""add payment_splits to voucher and payment

Revision ID: a4b5c6d7e8f9
Revises: b7c8d9e0f1a2
Create Date: 2026-10-24 00:00:00.000000

Adds a nullable JSON column that can split a paid amount across several payment
methods, e.g. [{"method": "CASH", "amount": 500000}, {"method": "KBZPAY", "amount": 300000}].
NULL means the whole amount was paid with payment_method (every row that exists today).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a4b5c6d7e8f9'
down_revision: Union[str, Sequence[str], None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('voucher', sa.Column('payment_splits', sa.JSON(), nullable=True))
    op.add_column('payment', sa.Column('payment_splits', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('payment', 'payment_splits')
    op.drop_column('voucher', 'payment_splits')
