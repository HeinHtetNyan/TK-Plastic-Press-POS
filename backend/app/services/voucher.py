from fastapi import HTTPException
from sqlalchemy.exc import NoResultFound
from sqlmodel import Session, select
from app.models import Voucher, Item, Customer
from app.schemas.voucher import VoucherCreate
from app.services.balance import calculate_customer_balance
from app.models.customer import get_yangon_date
from app.services.audit import log_action

def create_voucher_service(session: Session, voucher_in: VoucherCreate, user_id: int, client_id: str = None) -> Voucher:
    # 1. Lock the customer record to prevent concurrent balance changes
    try:
        session.exec(select(Customer).where(Customer.id == voucher_in.customer_id).with_for_update()).one()
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # 2. Calculate previous balance
    previous_balance = calculate_customer_balance(session, voucher_in.customer_id)
    
    # 3. Prepare items and calculate items_total
    items_total = 0.0
    items_to_create = []
    
    for item_data in voucher_in.items:
        item_total_price = item_data.lb * (item_data.plastic_price + item_data.color_price)
        items_total += item_total_price
        items_to_create.append(Item(
            **item_data.dict(),
            total_price=item_total_price
        ))
        
    # 4. Calculate totals
    extra_charge = voucher_in.extra_charge_amount or 0.0
    discount = voucher_in.discount_amount or 0.0
    final_total = items_total + extra_charge - discount + previous_balance
    remaining_balance = final_total - (voucher_in.paid_amount or 0.0)

    # 5. Create voucher
    voucher = Voucher(
        client_id=client_id,
        customer_id=voucher_in.customer_id,
        voucher_number=voucher_in.voucher_number,
        voucher_date=voucher_in.voucher_date or get_yangon_date(),
        items_total=items_total,
        extra_charge_note=voucher_in.extra_charge_note or None,
        extra_charge_amount=extra_charge,
        discount_amount=discount,
        previous_balance=previous_balance,
        final_total=final_total,
        paid_amount=voucher_in.paid_amount or 0.0,
        payment_method=voucher_in.payment_method,
        remaining_balance=remaining_balance,
        note=voucher_in.note,
        items=items_to_create
    )
    
    session.add(voucher)
    log_action(session, user_id, "CREATE", "Voucher", str(voucher.voucher_number), f"Voucher #{voucher.voucher_number} created")
    session.commit()
    session.refresh(voucher)
    return voucher
