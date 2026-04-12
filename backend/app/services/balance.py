from sqlmodel import Session, select, func
from app.models import Voucher, Payment, Item

def calculate_customer_balance(session: Session, customer_id: int) -> float:
    # 1. Sum of all items_total from all vouchers
    # Note: items_total in my model is stored in Voucher table.
    # It represents the sum of item total_prices for THAT voucher.
    vouchers = session.exec(select(Voucher).where(Voucher.customer_id == customer_id)).all()
    total_items_cost = sum(v.items_total for v in vouchers)
    
    # 2. Sum of all paid_amount from all vouchers
    total_paid_on_vouchers = sum(v.paid_amount for v in vouchers)
    
    # 3. Sum of all standalone payments
    payments = session.exec(select(Payment).where(Payment.customer_id == customer_id)).all()
    total_standalone_payments = sum(p.amount_paid for p in payments)
    
    balance = total_items_cost - total_paid_on_vouchers - total_standalone_payments
    return float(balance)
