from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from app.db import get_session
from app.models import Voucher, Customer, User
from app.schemas.voucher import VoucherCreate, VoucherRead
from app.services.voucher import create_voucher_service
from app.dependencies.auth import require_staff_or_admin, require_admin
from app.services.balance import calculate_customer_balance
from app.services.audit import log_action

router = APIRouter(tags=["vouchers"])

@router.post("/vouchers", response_model=VoucherRead)
def create_voucher(
    voucher_in: VoucherCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_staff_or_admin)
):
    # Idempotency: if a client_id was provided and this voucher already exists, return it
    if voucher_in.client_id:
        existing = session.exec(
            select(Voucher).where(Voucher.client_id == voucher_in.client_id)
        ).first()
        if existing:
            v_data = existing.model_dump()
            v_data["customer_name"] = existing.customer.name
            v_data["customer_balance"] = calculate_customer_balance(session, existing.customer_id)
            v_data["items"] = existing.items
            return v_data

    customer = session.get(Customer, voucher_in.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        return create_voucher_service(session, voucher_in, current_user.id, client_id=voucher_in.client_id)
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Voucher number already exists. Please use a unique number.")

@router.get("/vouchers", response_model=List[VoucherRead])
def list_all_vouchers(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_staff_or_admin)
):
    results = session.exec(select(Voucher)).all()
    vouchers = []
    # Pre-calculate balances to avoid redundant queries in loops
    balance_cache = {}
    
    for v in results:
        v_data = v.model_dump()
        v_data["customer_name"] = v.customer.name
        
        if v.customer_id not in balance_cache:
            balance_cache[v.customer_id] = calculate_customer_balance(session, v.customer_id)
        
        v_data["customer_balance"] = balance_cache[v.customer_id]
        v_data["items"] = v.items
        vouchers.append(v_data)
    return vouchers

@router.get("/vouchers/{voucher_id}", response_model=VoucherRead)
def get_voucher(
    voucher_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(require_staff_or_admin)
):
    voucher = session.get(Voucher, voucher_id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    v_data = voucher.model_dump()
    v_data["customer_name"] = voucher.customer.name
    v_data["customer_balance"] = calculate_customer_balance(session, voucher.customer_id)
    v_data["items"] = voucher.items
    return v_data

@router.get("/customers/{customer_id}/vouchers", response_model=List[VoucherRead])
def get_customer_vouchers(
    customer_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(require_staff_or_admin)
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    results = session.exec(select(Voucher).where(Voucher.customer_id == customer_id)).all()
    vouchers = []
    current_balance = calculate_customer_balance(session, customer_id)
    
    for v in results:
        v_data = v.model_dump()
        v_data["customer_name"] = customer.name
        v_data["customer_balance"] = current_balance
        v_data["items"] = v.items
        vouchers.append(v_data)
    return vouchers

@router.delete("/vouchers/{voucher_id}")
def delete_voucher(
    voucher_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    voucher = session.get(Voucher, voucher_id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    log_action(session, current_user.id, "DELETE", "Voucher", str(voucher_id), f"Voucher #{voucher.voucher_number} deleted")
    session.delete(voucher)
    session.commit()
    return {"message": "Voucher deleted successfully"}
