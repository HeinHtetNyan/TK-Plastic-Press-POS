"""seed the first Size and Plastic Color choices

Revision ID: c2d3e4f5a6b8
Revises: b1c2d3e4f5a7
Create Date: 2026-11-03 00:00:00.000000

Only adds rows to the new pick-list table (skips any that already exist). No existing data is touched.
Sizes come from the printed size table photos plus a few handwritten ones; colors were given by the owner.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c2d3e4f5a6b8'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a7'
branch_labels = None
depends_on = None

SIZES = [
    # printed table
    "2½ x 4", "3 x 4", "3 x 5", "3½ x 4", "3½ x 5", "3½ x 5½", "3½ x 6", "3½ x 7", "3½ x 8",
    "4 x 4", "4 x 5", "4 x 5½", "4 x 6", "4 x 7", "4 x 8", "4 x 9",
    "4½ x 5", "4½ x 5½", "4½ x 6", "4½ x 7", "4½ x 8", "4½ x 8½", "4½ x 9",
    "5 x 6", "5 x 7", "5 x 8", "5 x 9", "5½ x 7", "5½ x 8", "5½ x 9",
    "6 x 8", "6 x 8½", "6 x 9", "6 x 10", "6 x 11", "6 x 15", "6½ x 8½",
    "7 x 9", "7 x 12", "7 x 16", "8 x 12", "8 x 16", "9 x 13", "9 x 15",
    # handwritten on the sheet
    "4 x 8½", "7½ x 12", "7½ x 16", "8 x 15", "10 x 15", "12 x 18",
    # used in the old vouchers (found by checking the whole database)
    "2 x 7", "4½ x 7½", "5 x 11", "5½ x 10", "6 x 16", "7 x 10", "7 x 13", "8 x 8",
    "9 x 12", "10 x 20", "11 x 12", "14 x 22",
]

COLORS = [
    "ကြည်ကြွပ်", "ကြည်ပျော့", "နို့ကြွပ်", "ဝါကြွပ်", "စိမ်းကြွပ်", "နီကြွပ်", "ပြာကြွပ်",
]


def upgrade() -> None:
    conn = op.get_bind()
    insert = sa.text(
        "INSERT INTO plasticoption (kind, name, created_at) VALUES (:kind, :name, now()) "
        "ON CONFLICT (kind, name) DO NOTHING"
    )
    for name in SIZES:
        conn.execute(insert, {"kind": "SIZE", "name": name})
    for name in COLORS:
        conn.execute(insert, {"kind": "COLOR", "name": name})


def downgrade() -> None:
    conn = op.get_bind()
    for kind, names in (("SIZE", SIZES), ("COLOR", COLORS)):
        for name in names:
            conn.execute(sa.text("DELETE FROM plasticoption WHERE kind = :k AND name = :n"), {"k": kind, "n": name})
