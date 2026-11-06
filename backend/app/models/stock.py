from datetime import datetime, date
from typing import Optional
from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlmodel import SQLModel, Field
from .customer import get_yangon_date, get_yangon_now


class PlasticOption(SQLModel, table=True):
    """One choice in the Size / Color / Gate pick-lists. kind = SIZE | COLOR | GATE."""
    __table_args__ = (UniqueConstraint("kind", "name", name="uq_plastic_option_kind_name"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    kind: str = Field(index=True)
    name: str
    created_at: datetime = Field(default_factory=get_yangon_now)


class StockItem(SQLModel, table=True):
    """Current stock (lb) and average cost per lb for one Size + Color + Gate combination."""
    __table_args__ = (UniqueConstraint("size", "color", "gate", name="uq_stock_combo"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    size: str
    color: str
    gate: str = Field(default="")
    qty_lb: float = Field(default=0.0)
    avg_cost_per_lb: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=get_yangon_now)
    updated_at: datetime = Field(default_factory=get_yangon_now)


class StockMovement(SQLModel, table=True):
    """Trail of every stock change. kind = OPENING | PURCHASE | PURCHASE_REVERSE | SALE | SALE_REVERSE | ADJUST."""
    id: Optional[int] = Field(default=None, primary_key=True)
    stock_item_id: int = Field(sa_column=Column(Integer, ForeignKey("stockitem.id", ondelete="CASCADE"), nullable=False, index=True))
    kind: str
    delta_lb: float
    cost_per_lb: Optional[float] = None
    ref: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=get_yangon_now)


class Purchase(SQLModel, table=True):
    """A voucher from the plastic factory (we buy from them)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    supplier: Optional[str] = None
    purchase_number: Optional[str] = None
    purchase_date: date = Field(default_factory=get_yangon_date)
    note: Optional[str] = None
    total_cost: float = Field(default=0.0)  # the factory voucher amount (lb x price), WITHOUT the extra costs
    extras_total: float = Field(default=0.0)  # transport, loading, ... for this purchase (spread into the cost per lb)
    created_at: datetime = Field(default_factory=get_yangon_now)
    updated_at: datetime = Field(default_factory=get_yangon_now)


class PurchaseExtra(SQLModel, table=True):
    """An extra cost that belongs to one factory purchase (transport, loading, ...). Not a Spending row."""
    id: Optional[int] = Field(default=None, primary_key=True)
    purchase_id: int = Field(sa_column=Column(Integer, ForeignKey("purchase.id", ondelete="CASCADE"), nullable=False, index=True))
    label: str
    amount: float = Field(ge=0)


class PurchaseLine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    purchase_id: int = Field(sa_column=Column(Integer, ForeignKey("purchase.id", ondelete="CASCADE"), nullable=False, index=True))
    size: str
    color: str
    gate: str = Field(default="")
    weight_lb: float = Field(gt=0)
    price_per_lb: float = Field(ge=0)
    line_cost: float = Field(default=0.0)
    extra_per_lb: float = Field(default=0.0)  # share of the purchase extras per lb (already added to the stock cost)
