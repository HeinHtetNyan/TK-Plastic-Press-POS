from datetime import datetime, date
from zoneinfo import ZoneInfo
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from .customer import get_yangon_date, get_yangon_now

class Payment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="customer.id")
    amount_paid: float = Field(ge=0)
    payment_date: date = Field(default_factory=get_yangon_date)
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=get_yangon_now)

    customer: "Customer" = Relationship(back_populates="payments")
