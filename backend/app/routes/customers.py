from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.db import get_session
from app.models import Customer
from app.schemas.customer import CustomerCreate, CustomerRead, CustomerBalance
from app.services.balance import calculate_customer_balance

router = APIRouter(prefix="/customers", tags=["customers"])

@router.post("/", response_model=CustomerRead)
def create_customer(customer: CustomerCreate, session: Session = Depends(get_session)):
    db_customer = Customer.from_orm(customer)
    session.add(db_customer)
    session.commit()
    session.refresh(db_customer)
    return db_customer

@router.get("/", response_model=List[CustomerRead])
def list_customers(session: Session = Depends(get_session)):
    customers = session.exec(select(Customer)).all()
    return customers

@router.get("/search", response_model=List[CustomerRead])
def search_customers(name: str = Query(..., min_length=1), session: Session = Depends(get_session)):
    statement = select(Customer).where(Customer.name.ilike(f"%{name}%"))
    customers = session.exec(statement).all()
    return customers

@router.get("/{customer_id}/balance", response_model=CustomerBalance)
def get_customer_balance(customer_id: int, session: Session = Depends(get_session)):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    balance = calculate_customer_balance(session, customer_id)
    return CustomerBalance(
        customer_id=customer.id,
        customer_name=customer.name,
        balance=balance
    )
