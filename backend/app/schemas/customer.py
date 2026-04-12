from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class CustomerBase(BaseModel):
    name: str

class CustomerCreate(CustomerBase):
    pass

class CustomerRead(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerBalance(BaseModel):
    customer_id: int
    customer_name: str
    balance: float
