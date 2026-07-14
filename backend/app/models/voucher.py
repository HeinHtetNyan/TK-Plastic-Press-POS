from datetime import datetime, date
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .customer import get_yangon_date, get_yangon_now
from .enums import PaymentMethod

if TYPE_CHECKING:
    from .customer import Customer
    from .item import Item

class Voucher(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # UUID sent by the client for idempotent offline sync.
    client_id: Optional[str] = Field(default=None, unique=True, index=True)
    customer_id: int = Field(foreign_key="customer.id")
    voucher_number: str = Field(unique=True, index=True)
    voucher_date: date = Field(default_factory=get_yangon_date)
    items_total: float = Field(default=0.0)
    previous_balance: float = Field(default=0.0)
    final_total: float = Field(default=0.0)
    paid_amount: float = Field(default=0.0)
    payment_method: Optional[PaymentMethod] = Field(default=None) # Used if paid_amount > 0
    remaining_balance: float = Field(default=0.0)
    note: Optional[str] = None
    extra_charge_note: Optional[str] = None
    extra_charge_amount: float = Field(default=0.0)
    discount_amount: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=get_yangon_now)
    updated_at: datetime = Field(default_factory=get_yangon_now)

    customer: "Customer" = Relationship(back_populates="vouchers")
    items: List["Item"] = Relationship(back_populates="voucher", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
