from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


def _not_blank(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    if not v.strip():
        raise ValueError("Customer name is empty")
    return v.strip()

class CustomerBase(BaseModel):
    name: str
    phone_numbers: Optional[str] = None
    address: Optional[str] = None

class CustomerCreate(CustomerBase):
    client_id: Optional[str] = None
    _name = field_validator("name")(_not_blank)

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone_numbers: Optional[str] = None
    address: Optional[str] = None
    _name = field_validator("name")(_not_blank)

class CustomerRead(CustomerBase):
    id: int
    client_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerBalance(BaseModel):
    customer_id: int
    customer_name: str
    balance: float
