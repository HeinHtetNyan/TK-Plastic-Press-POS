from datetime import datetime, date
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .customer import get_yangon_date, get_yangon_now
from .enums import PaymentMethod

if TYPE_CHECKING:
    from .customer import Customer

class Payment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # UUID sent by the client for idempotent offline sync.
    client_id: Optional[str] = Field(default=None, unique=True, index=True)
    customer_id: int = Field(foreign_key="customer.id")
    amount_paid: float = Field(ge=0)
    discount_amount: float = Field(default=0.0)
    payment_method: PaymentMethod
    payment_date: date = Field(default_factory=get_yangon_date)
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=get_yangon_now)

    customer: "Customer" = Relationship(back_populates="payments")
