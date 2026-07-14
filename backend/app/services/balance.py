from fastapi import HTTPException
from sqlmodel import Session, select
from app.models import Voucher, Payment
from app.models.customer import Customer

def calculate_customer_balance(session: Session, customer_id: int) -> float:
    if not session.get(Customer, customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")

    vouchers = session.exec(select(Voucher).where(Voucher.customer_id == customer_id)).all()
    total_items_cost = sum(v.items_total + v.extra_charge_amount - v.discount_amount for v in vouchers)
    total_paid_on_vouchers = sum(v.paid_amount for v in vouchers)

    payments = session.exec(select(Payment).where(Payment.customer_id == customer_id)).all()
    total_standalone_payments = sum(p.amount_paid + p.discount_amount for p in payments)

    return round(float(total_items_cost - total_paid_on_vouchers - total_standalone_payments), 2)
