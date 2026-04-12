from sqlmodel import Session
from app.models import Voucher, Item
from app.schemas.voucher import VoucherCreate
from app.services.balance import calculate_customer_balance
from datetime import datetime
from zoneinfo import ZoneInfo
from app.models.customer import get_yangon_date

def create_voucher_service(session: Session, voucher_in: VoucherCreate) -> Voucher:
    # 1. Calculate previous balance
    previous_balance = calculate_customer_balance(session, voucher_in.customer_id)
    
    # 2. Prepare items and calculate items_total
    items_total = 0.0
    items_to_create = []
    
    # Note: the items are not yet in the DB, they are in voucher_in.items
    for item_data in voucher_in.items:
        item_total_price = item_data.lb * (item_data.plastic_price + item_data.color_price)
        items_total += item_total_price
        items_to_create.append(Item(
            **item_data.dict(),
            total_price=item_total_price
        ))
        
    # 3. Calculate totals
    final_total = items_total + previous_balance
    remaining_balance = final_total - voucher_in.paid_amount
    
    # 4. Create voucher
    voucher = Voucher(
        customer_id=voucher_in.customer_id,
        voucher_number=voucher_in.voucher_number,
        voucher_date=voucher_in.voucher_date or get_yangon_date(),
        items_total=items_total,
        previous_balance=previous_balance,
        final_total=final_total,
        paid_amount=voucher_in.paid_amount,
        remaining_balance=remaining_balance,
        note=voucher_in.note,
        items=items_to_create
    )
    
    session.add(voucher)
    session.commit()
    session.refresh(voucher)
    return voucher
