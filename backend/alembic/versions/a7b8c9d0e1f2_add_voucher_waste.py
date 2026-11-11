"""add voucherwaste (cardboard core / damage lb per voucher, optionally taken from stock)

Revision ID: a7b8c9d0e1f2
Revises: e4f5a6b7c8d0
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = 'e4f5a6b7c8d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'voucherwaste',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('voucher_id', sa.Integer(), sa.ForeignKey('voucher.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('lb', sa.Float(), nullable=False),
        sa.Column('size', sa.String(), nullable=False, server_default=''),
        sa.Column('color', sa.String(), nullable=False, server_default=''),
        sa.Column('gate', sa.String(), nullable=False, server_default=''),
        sa.Column('stock_item_id', sa.Integer(), sa.ForeignKey('stockitem.id', ondelete='SET NULL'), nullable=True),
        sa.Column('cost_per_lb', sa.Float(), nullable=True),
    )
    op.create_index('ix_voucherwaste_voucher_id', 'voucherwaste', ['voucher_id'])


def downgrade() -> None:
    op.drop_index('ix_voucherwaste_voucher_id', table_name='voucherwaste')
    op.drop_table('voucherwaste')
