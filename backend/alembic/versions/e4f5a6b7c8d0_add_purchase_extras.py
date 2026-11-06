"""extra costs (transport, loading, ...) on factory purchases

Revision ID: e4f5a6b7c8d0
Revises: d3e4f5a6b7c9
Create Date: 2026-11-06 00:00:00.000000

Additive only: a new table purchaseextra, plus purchase.extras_total and purchaseline.extra_per_lb
(both default 0, so every existing purchase keeps its numbers). No existing row is changed.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e4f5a6b7c8d0'
down_revision: Union[str, Sequence[str], None] = 'd3e4f5a6b7c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('purchase', sa.Column('extras_total', sa.Float(), nullable=False, server_default='0'))
    op.add_column('purchaseline', sa.Column('extra_per_lb', sa.Float(), nullable=False, server_default='0'))
    op.create_table(
        'purchaseextra',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('purchase_id', sa.Integer(), sa.ForeignKey('purchase.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('purchaseextra')
    op.drop_column('purchaseline', 'extra_per_lb')
    op.drop_column('purchase', 'extras_total')
