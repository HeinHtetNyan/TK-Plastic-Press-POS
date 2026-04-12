from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import Payment, Customer
from app.schemas.payment import PaymentCreate, PaymentRead

router = APIRouter(tags=["payments"])

@router.post("/payments", response_model=PaymentRead)
def create_payment(payment_in: PaymentCreate, session: Session = Depends(get_session)):
    customer = session.get(Customer, payment_in.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    db_payment = Payment.from_orm(payment_in)
    session.add(db_payment)
    session.commit()
    session.refresh(db_payment)
    return db_payment

@router.get("/payments", response_model=List[PaymentRead])
def list_all_payments(session: Session = Depends(get_session)):
    payments = session.exec(select(Payment)).all()
    return payments

@router.get("/customers/{customer_id}/payments", response_model=List[PaymentRead])
def get_customer_payments(customer_id: int, session: Session = Depends(get_session)):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    payments = session.exec(select(Payment).where(Payment.customer_id == customer_id)).all()
    return payments

@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, session: Session = Depends(get_session)):
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    session.delete(payment)
    session.commit()
    return {"message": "Payment deleted successfully"}
