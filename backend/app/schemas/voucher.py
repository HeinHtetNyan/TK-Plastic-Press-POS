from datetime import datetime, date
from typing import List, Optional, Any
from pydantic import BaseModel, Field, field_validator, field_serializer

class ItemBase(BaseModel):
    lb: float = Field(gt=0)
    plastic_size: str
    plastic_price: float = Field(ge=0)
    color: str
    color_price: float = Field(ge=0)

class ItemCreate(ItemBase):
    pass

class ItemRead(ItemBase):
    id: int
    voucher_id: int
    total_price: float

    class Config:
        from_attributes = True

class VoucherBase(BaseModel):
    customer_id: int
    voucher_number: str
    voucher_date: Optional[date] = None
    paid_amount: float = Field(default=0.0, ge=0)
    note: Optional[str] = None

    @field_validator("voucher_date", mode="before")
    @classmethod
    def parse_voucher_date(cls, v: Any) -> Any:
        if isinstance(v, str) and v:
            try:
                return datetime.strptime(v, "%d-%m-%Y").date()
            except ValueError:
                pass
        return v

    @field_serializer("voucher_date")
    def serialize_voucher_date(self, v: date, _info):
        if v:
            return v.strftime("%d-%m-%Y")
        return v

class VoucherCreate(VoucherBase):
    items: List[ItemCreate]

class VoucherRead(VoucherBase):
    id: int
    customer_name: Optional[str] = None
    customer_balance: Optional[float] = None
    items_total: float
    previous_balance: float
    final_total: float
    remaining_balance: float
    created_at: datetime
    updated_at: datetime
    items: List[ItemRead]

    class Config:
        from_attributes = True
