from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import Voucher, Customer
from app.schemas.voucher import VoucherCreate, VoucherRead
from app.services.voucher import create_voucher_service

from sqlalchemy.exc import IntegrityError

router = APIRouter(tags=["vouchers"])

@router.post("/vouchers", response_model=VoucherRead)
def create_voucher(voucher_in: VoucherCreate, session: Session = Depends(get_session)):
    customer = session.get(Customer, voucher_in.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    try:
        return create_voucher_service(session, voucher_in)
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Voucher number already exists. Please use a unique number.")

from app.services.balance import calculate_customer_balance

@router.get("/vouchers", response_model=List[VoucherRead])
def list_all_vouchers(session: Session = Depends(get_session)):
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
def get_voucher(voucher_id: int, session: Session = Depends(get_session)):
    voucher = session.get(Voucher, voucher_id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    v_data = voucher.model_dump()
    v_data["customer_name"] = voucher.customer.name
    v_data["customer_balance"] = calculate_customer_balance(session, voucher.customer_id)
    v_data["items"] = voucher.items
    return v_data

@router.get("/customers/{customer_id}/vouchers", response_model=List[VoucherRead])
def get_customer_vouchers(customer_id: int, session: Session = Depends(get_session)):
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
def delete_voucher(voucher_id: int, session: Session = Depends(get_session)):
    voucher = session.get(Voucher, voucher_id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    session.delete(voucher)
    session.commit()
    return {"message": "Voucher deleted successfully"}
