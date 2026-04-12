from datetime import datetime, date
from zoneinfo import ZoneInfo
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from .customer import get_yangon_date, get_yangon_now

class Voucher(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="customer.id")
    voucher_number: str = Field(unique=True, index=True)
    voucher_date: date = Field(default_factory=get_yangon_date)
    items_total: float = Field(default=0.0)
    previous_balance: float = Field(default=0.0)
    final_total: float = Field(default=0.0)
    paid_amount: float = Field(default=0.0)
    remaining_balance: float = Field(default=0.0)
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=get_yangon_now)
    updated_at: datetime = Field(default_factory=get_yangon_now)

    customer: "Customer" = Relationship(back_populates="vouchers")
    items: List["Item"] = Relationship(back_populates="voucher", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
