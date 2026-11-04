"""print colour on items + first Print Color choices

Revision ID: d3e4f5a6b7c9
Revises: c2d3e4f5a6b8
Create Date: 2026-11-03 00:00:00.000000

Additive only: one nullable column on item and a few rows in the pick-list table (skipped if they exist).
The print colours are the single colours that already appear most often in the old vouchers' Color field.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd3e4f5a6b7c9'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b8'
branch_labels = None
depends_on = None

PRINT_COLORS = [
    "နီ", "စိမ်း", "ဖြူ", "ဝါ", "ပြာ", "ခရမ်း", "နက်ပြာ",
    # two-colour prints used in the old vouchers
    "ဝါ+နီ", "ဖြူ+နီ", "ဝါ+စိမ်း", "နီ+စိမ်း", "ဖြူ+စိမ်း", "ဝါ+ဖြူ", "စိမ်း+နက်ပြာ", "စိမ်း+ပြာ",
]


def upgrade() -> None:
    op.add_column('item', sa.Column('print_color', sa.String(), nullable=True))
    conn = op.get_bind()
    insert = sa.text(
        "INSERT INTO plasticoption (kind, name, created_at) VALUES ('PRINT', :name, now()) "
        "ON CONFLICT (kind, name) DO NOTHING"
    )
    for name in PRINT_COLORS:
        conn.execute(insert, {"name": name})


def downgrade() -> None:
    conn = op.get_bind()
    for name in PRINT_COLORS:
        conn.execute(sa.text("DELETE FROM plasticoption WHERE kind = 'PRINT' AND name = :n"), {"n": name})
    op.drop_column('item', 'print_color')
