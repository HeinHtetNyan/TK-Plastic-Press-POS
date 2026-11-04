"""plastic options, stock, purchases, gate, core weight

Revision ID: b1c2d3e4f5a7
Revises: a4b5c6d7e8f9
Create Date: 2026-11-03 00:00:00.000000

Purely additive: new tables + nullable columns. No existing row is changed.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b1c2d3e4f5a7'
down_revision: Union[str, Sequence[str], None] = 'a4b5c6d7e8f9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('plasticoption',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('kind', sa.String(), nullable=False, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('kind', 'name', name='uq_plastic_option_kind_name'))
    op.create_table('stockitem',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('size', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=False),
        sa.Column('gate', sa.String(), nullable=False, server_default=''),
        sa.Column('qty_lb', sa.Float(), nullable=False, server_default='0'),
        sa.Column('avg_cost_per_lb', sa.Float(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('size', 'color', 'gate', name='uq_stock_combo'))
    op.create_table('stockmovement',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('stock_item_id', sa.Integer(), sa.ForeignKey('stockitem.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('delta_lb', sa.Float(), nullable=False),
        sa.Column('cost_per_lb', sa.Float(), nullable=True),
        sa.Column('ref', sa.String(), nullable=True),
        sa.Column('note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_table('purchase',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('supplier', sa.String(), nullable=True),
        sa.Column('purchase_number', sa.String(), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=False),
        sa.Column('note', sa.String(), nullable=True),
        sa.Column('total_cost', sa.Float(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False))
    op.create_table('purchaseline',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('purchase_id', sa.Integer(), sa.ForeignKey('purchase.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('size', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=False),
        sa.Column('gate', sa.String(), nullable=False, server_default=''),
        sa.Column('weight_lb', sa.Float(), nullable=False),
        sa.Column('price_per_lb', sa.Float(), nullable=False),
        sa.Column('line_cost', sa.Float(), nullable=False, server_default='0'))
    op.add_column('item', sa.Column('gate', sa.String(), nullable=True))
    op.add_column('item', sa.Column('stock_item_id', sa.Integer(), sa.ForeignKey('stockitem.id', ondelete='SET NULL'), nullable=True))
    op.add_column('item', sa.Column('cost_per_lb', sa.Float(), nullable=True))
    op.add_column('voucher', sa.Column('core_weight_lb', sa.Float(), nullable=True))
    op.add_column('voucher', sa.Column('stock_tracked', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('voucher', 'stock_tracked')
    op.drop_column('voucher', 'core_weight_lb')
    op.drop_column('item', 'cost_per_lb')
    op.drop_column('item', 'stock_item_id')
    op.drop_column('item', 'gate')
    op.drop_table('purchaseline')
    op.drop_table('purchase')
    op.drop_table('stockmovement')
    op.drop_table('stockitem')
    op.drop_table('plasticoption')
