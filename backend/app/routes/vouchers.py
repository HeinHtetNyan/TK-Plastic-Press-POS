from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from sqlalchemy.exc import IntegrityError
from app.db import get_session
from app.models import Voucher, Customer, User
from app.schemas.voucher import VoucherCreate, VoucherRead, VoucherUpdate
from app.models.item import Item
from app.services.voucher import create_voucher_service
from app.dependencies.auth import require_staff_or_admin, require_admin
from app.services.balance import calculate_customer_balance
from app.services.audit import log_action
from app.services.splits import normalize_splits
from app.services.stock import take_stock_for_items, give_back_stock_for_items, apply_wastes, give_back_wastes, wastes_by_voucher
from app.services.voucher import core_total
from app.models.stock import VoucherWaste

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
            v_data["wastes"] = wastes_by_voucher(session, [existing.id]).get(existing.id, [])
            return v_data

    customer = session.get(Customer, voucher_in.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        voucher, warnings = create_voucher_service(session, voucher_in, current_user.id, client_id=voucher_in.client_id)
        v_data = voucher.model_dump()
        v_data["customer_name"] = customer.name
        v_data["customer_balance"] = calculate_customer_balance(session, voucher.customer_id)
        v_data["items"] = voucher.items
        v_data["wastes"] = wastes_by_voucher(session, [voucher.id]).get(voucher.id, [])
        v_data["stock_warnings"] = warnings
        return v_data
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Voucher number already exists. Please use a unique number.")

@router.get("/vouchers/page")
def list_vouchers_page(
    month: Optional[str] = Query(default=None, description="MM-YYYY"),
    date: Optional[str] = Query(default=None, description="DD-MM-YYYY"),
    sort: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_staff_or_admin),
):
    """Reports list: one page of vouchers for a month or a day, plus totals for the whole filter and the months that have data."""
    cond = []
    try:
        if date:
            cond.append(Voucher.voucher_date == datetime.strptime(date, "%d-%m-%Y").date())
        elif month:
            m, y = month.split("-")
            m, y = int(m), int(y)
            first = datetime(y, m, 1).date()
            nxt = datetime(y + (m == 12), (m % 12) + 1, 1).date()
            cond += [Voucher.voucher_date >= first, Voucher.voucher_date < nxt]
    except ValueError:
        raise HTTPException(status_code=400, detail="Bad date")

    count, items_sum = session.exec(select(func.count(Voucher.id), func.coalesce(func.sum(Voucher.items_total), 0.0)).where(*cond)).one()
    pages = max(1, -(-count // page_size))
    page = min(page, pages)
    order = (Voucher.created_at.desc(), Voucher.id.desc()) if sort == "desc" else (Voucher.created_at.asc(), Voucher.id.asc())
    rows = session.exec(select(Voucher).where(*cond).order_by(*order).offset((page - 1) * page_size).limit(page_size)).all()

    balance_cache = {}
    out = []
    wmap = wastes_by_voucher(session, [v.id for v in rows])
    for v in rows:
        d = v.model_dump()
        d["wastes"] = wmap.get(v.id, [])
        d["customer_name"] = v.customer.name
        if v.customer_id not in balance_cache:
            balance_cache[v.customer_id] = calculate_customer_balance(session, v.customer_id)
        d["customer_balance"] = balance_cache[v.customer_id]
        d["items"] = v.items
        out.append(VoucherRead.model_validate(d).model_dump(mode="json"))

    month_rows = session.exec(
        select(func.to_char(Voucher.voucher_date, "MM-YYYY"), func.max(Voucher.voucher_date)).group_by(func.to_char(Voucher.voucher_date, "MM-YYYY")).order_by(func.max(Voucher.voucher_date).desc())
    ).all()
    return {"items": out, "total": count, "items_total_sum": float(items_sum), "page": page, "pages": pages, "months": [m for m, _ in month_rows]}

@router.get("/vouchers", response_model=List[VoucherRead])
def list_all_vouchers(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_staff_or_admin)
):
    results = session.exec(select(Voucher)).all()
    vouchers = []
    # Pre-calculate balances to avoid redundant queries in loops
    balance_cache = {}
    wmap = wastes_by_voucher(session, [v.id for v in results])
    
    for v in results:
        v_data = v.model_dump()
        v_data["wastes"] = wmap.get(v.id, [])
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
    v_data["wastes"] = wastes_by_voucher(session, [voucher.id]).get(voucher.id, [])
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
    wmap = wastes_by_voucher(session, [v.id for v in results])
    
    for v in results:
        v_data = v.model_dump()
        v_data["wastes"] = wmap.get(v.id, [])
        v_data["customer_name"] = customer.name
        v_data["customer_balance"] = current_balance
        v_data["items"] = v.items
        vouchers.append(v_data)
    return vouchers

@router.put("/vouchers/{voucher_id}", response_model=VoucherRead)
def update_voucher(
    voucher_id: int,
    voucher_in: VoucherUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_staff_or_admin)
):
    voucher = session.get(Voucher, voucher_id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")

    items_total = sum(i.lb * (i.plastic_price + i.color_price) for i in voucher_in.items)
    extra_charge = voucher_in.extra_charge_amount or 0.0
    discount = voucher_in.discount_amount or 0.0
    final_total = items_total + extra_charge - discount + voucher.previous_balance
    remaining_balance = final_total - (voucher_in.paid_amount or 0.0)

    # Vouchers made before the stock feature never took stock, so editing them must not touch it.
    ref = f"voucher:{voucher.voucher_number}"
    if voucher.stock_tracked:
        give_back_stock_for_items(session, list(voucher.items), ref)
    if voucher_in.wastes is not None:
        give_back_wastes(session, voucher.id, ref)  # old app (wastes not sent) keeps the existing rows as they are
    for old_item in list(voucher.items):
        session.delete(old_item)
    session.flush()
    session.expire(voucher, ['items'])

    new_items = [
        Item(
            voucher_id=voucher.id,
            lb=i.lb,
            plastic_size=i.plastic_size,
            plastic_price=i.plastic_price,
            color=i.color,
            color_price=i.color_price,
            gate=i.gate or None,
            print_color=i.print_color or None,
            total_price=i.lb * (i.plastic_price + i.color_price),
        )
        for i in voucher_in.items
    ]

    voucher.voucher_number = voucher_in.voucher_number
    voucher.voucher_date = voucher_in.voucher_date or voucher.voucher_date
    voucher.items_total = items_total
    voucher.extra_charge_note = voucher_in.extra_charge_note or None
    voucher.extra_charge_amount = extra_charge
    voucher.discount_amount = discount
    voucher.final_total = final_total
    voucher.paid_amount = voucher_in.paid_amount or 0.0
    splits, primary = normalize_splits(voucher_in.payment_splits, voucher.paid_amount)
    voucher.payment_method = primary or voucher_in.payment_method
    voucher.payment_splits = splits
    voucher.remaining_balance = remaining_balance
    voucher.note = voucher_in.note
    if voucher_in.wastes is not None:
        voucher.core_weight_lb = core_total(voucher_in.wastes, voucher_in.core_weight_lb if not voucher_in.wastes else None)
    elif not session.exec(select(VoucherWaste.id).where(VoucherWaste.voucher_id == voucher.id, VoucherWaste.kind == "CORE")).first():
        voucher.core_weight_lb = voucher_in.core_weight_lb or None

    for item in new_items:
        session.add(item)
    session.flush()
    warnings = []
    if voucher.stock_tracked:
        warnings = take_stock_for_items(session, new_items, f"voucher:{voucher.voucher_number}")
    if voucher_in.wastes is not None:
        warnings += apply_wastes(session, voucher.id, voucher_in.wastes, f"voucher:{voucher.voucher_number}", take_stock=bool(voucher.stock_tracked))

    try:
        session.add(voucher)
        log_action(session, current_user.id, "UPDATE", "Voucher", str(voucher_id), f"Voucher #{voucher.voucher_number} updated")
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Voucher number already exists.")

    session.refresh(voucher)
    v_data = voucher.model_dump()
    v_data["customer_name"] = voucher.customer.name
    v_data["customer_balance"] = calculate_customer_balance(session, voucher.customer_id)
    v_data["items"] = voucher.items
    v_data["wastes"] = wastes_by_voucher(session, [voucher.id]).get(voucher.id, [])
    v_data["stock_warnings"] = warnings
    return v_data

@router.delete("/vouchers/{voucher_id}")
def delete_voucher(
    voucher_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    voucher = session.get(Voucher, voucher_id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    if voucher.stock_tracked:
        give_back_stock_for_items(session, list(voucher.items), f"voucher:{voucher.voucher_number} deleted")
        give_back_wastes(session, voucher.id, f"voucher:{voucher.voucher_number} deleted")
    log_action(session, current_user.id, "DELETE", "Voucher", str(voucher_id), f"Voucher #{voucher.voucher_number} deleted")
    session.delete(voucher)
    session.commit()
    return {"message": "Voucher deleted successfully"}
