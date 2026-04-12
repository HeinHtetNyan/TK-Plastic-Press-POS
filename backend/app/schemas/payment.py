from datetime import datetime, date
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator, field_serializer

class PaymentBase(BaseModel):
    customer_id: int
    amount_paid: float = Field(ge=0)
    payment_date: Optional[date] = None
    note: Optional[str] = None

    @field_validator("payment_date", mode="before")
    @classmethod
    def parse_payment_date(cls, v: Any) -> Any:
        if isinstance(v, str) and v:
            try:
                # Try parsing DD-MM-YYYY format
                return datetime.strptime(v, "%d-%m-%Y").date()
            except ValueError:
                pass
        return v

    @field_serializer("payment_date")
    def serialize_payment_date(self, v: date, _info):
        if v:
            return v.strftime("%d-%m-%Y")
        return v

class PaymentCreate(PaymentBase):
    pass

class PaymentRead(PaymentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
