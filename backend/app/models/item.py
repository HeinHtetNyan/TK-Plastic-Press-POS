from typing import Optional
from sqlmodel import SQLModel, Field, Relationship

class Item(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    voucher_id: int = Field(foreign_key="voucher.id")
    lb: float = Field(gt=0)
    plastic_size: str
    plastic_price: float = Field(ge=0)
    color: str
    color_price: float = Field(ge=0)
    total_price: float = Field(default=0.0)

    voucher: "Voucher" = Relationship(back_populates="items")
