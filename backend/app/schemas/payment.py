from datetime import datetime, date
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator, field_serializer
from app.models.enums import PaymentMethod

class PaymentBase(BaseModel):
    customer_id: int
    amount_paid: float = Field(ge=0)
    payment_method: Optional[PaymentMethod] = Field(default=None)
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
    client_id: Optional[str] = None
    payment_method: PaymentMethod  # required for standalone payments

class PaymentUpdate(BaseModel):
    amount_paid: Optional[float] = None
    payment_method: Optional[PaymentMethod] = None
    payment_date: Optional[date] = None
    note: Optional[str] = None

    @field_validator("payment_date", mode="before")
    @classmethod
    def parse_payment_date(cls, v: Any) -> Any:
        if isinstance(v, str) and v:
            try:
                return datetime.strptime(v, "%d-%m-%Y").date()
            except ValueError:
                pass
        return v

class PaymentRead(PaymentBase):
    id: int
    client_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
