from datetime import datetime, date
from zoneinfo import ZoneInfo
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

def get_yangon_date():
    return datetime.now(ZoneInfo("Asia/Yangon")).date()

def get_yangon_now():
    return datetime.now(ZoneInfo("Asia/Yangon"))

class Customer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    created_at: datetime = Field(default_factory=get_yangon_now)

    vouchers: List["Voucher"] = Relationship(back_populates="customer")
    payments: List["Payment"] = Relationship(back_populates="customer")
