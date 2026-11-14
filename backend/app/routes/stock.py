"""Pick-lists (Size / Color / Gate), stock, factory purchases, and the core-weight / profit reports."""
from datetime import date, datetime
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select, func
from app.db import get_session
from app.models import Voucher, Item, Customer, User, UserRole
from app.models.stock import PlasticOption, StockItem, StockMovement, Purchase, PurchaseLine, PurchaseExtra
from app.models.customer import get_yangon_now
from app.dependencies.auth import require_staff_or_admin, require_admin
from app.services.audit import log_action
from app.services.stock import norm, get_or_create_stock, add_stock, _move

router = APIRouter(tags=["stock"])
KINDS = ("SIZE", "COLOR", "GATE", "PRINT")


def _date(v: Any) -> Any:
    """Accept dd-mm-yyyy (what the app sends) or yyyy-mm-dd."""
    if isinstance(v, str) and v:
        for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(v, fmt).date()
            except ValueError:
                pass
    return v


# ---------------------------------------------------------------- pick-lists
class OptionIn(BaseModel):
    kind: str
    name: str


class OptionRename(BaseModel):
    name: str


def _option_out(o: PlasticOption):
    return {"id": o.id, "kind": o.kind, "name": o.name}


@router.get("/options")
def list_options(session: Session = Depends(get_session), user: User = Depends(require_staff_or_admin)):
    rows = session.exec(select(PlasticOption).order_by(PlasticOption.name)).all()
    return {k.lower() + "s": [_option_out(o) for o in rows if o.kind == k] for k in KINDS}


@router.post("/options")
def add_option(body: OptionIn, session: Session = Depends(get_session), user: User = Depends(require_staff_or_admin)):
    kind = body.kind.upper()
    name = norm(body.name)
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail="Kind must be SIZE, COLOR, GATE or PRINT")
    if not name:
        raise HTTPException(status_code=400, detail="Name is empty")
    existing = session.exec(select(PlasticOption).where(PlasticOption.kind == kind, PlasticOption.name == name)).first()
    if existing:
        return _option_out(existing)
    opt = PlasticOption(kind=kind, name=name)
    session.add(opt)
    log_action(session, user.id, "CREATE", "PlasticOption", f"{kind}:{name}", f"Added {kind.lower()} '{name}'")
    session.commit()
    session.refresh(opt)
    return _option_out(opt)


@router.put("/options/{option_id}")
def rename_option(option_id: int, body: OptionRename, session: Session = Depends(get_session), user: User = Depends(require_admin)):
    opt = session.get(PlasticOption, option_id)
    if not opt:
        raise HTTPException(status_code=404, detail="Not found")
    name = norm(body.name)
    if not name:
        raise HTTPException(status_code=400, detail="Name is empty")
    old = opt.name
    opt.name = name
    log_action(session, user.id, "UPDATE", "PlasticOption", str(option_id), f"Renamed {opt.kind.lower()} '{old}' to '{name}'")
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="That name already exists")
    session.refresh(opt)
    return _option_out(opt)


@router.delete("/options/{option_id}")
def delete_option(option_id: int, session: Session = Depends(get_session), user: User = Depends(require_admin)):
    opt = session.get(PlasticOption, option_id)
    if not opt:
        raise HTTPException(status_code=404, detail="Not found")
    log_action(session, user.id, "DELETE", "PlasticOption", str(option_id), f"Removed {opt.kind.lower()} '{opt.name}' from the list")
    session.delete(opt)
    session.commit()
    return {"message": "Removed from the list (old vouchers and stock keep their text)"}


# ---------------------------------------------------------------- stock
class OpeningIn(BaseModel):
    size: str
    color: str
    gate: str = ""
    weight_lb: float = Field(gt=0)
    cost_per_lb: float = Field(ge=0)


class AdjustIn(BaseModel):
    new_qty_lb: float
    note: Optional[str] = None


def _stock_out(s: StockItem, admin: bool):
    d = {"id": s.id, "size": s.size, "color": s.color, "gate": s.gate, "qty_lb": s.qty_lb}
    if admin:
        d["avg_cost_per_lb"] = s.avg_cost_per_lb
        d["value"] = round(max(s.qty_lb, 0) * s.avg_cost_per_lb, 2)
    return d


@router.get("/stock")
def list_stock(session: Session = Depends(get_session), user: User = Depends(require_staff_or_admin)):
    admin = user.role == UserRole.ADMIN
    rows = session.exec(select(StockItem).order_by(StockItem.size, StockItem.color, StockItem.gate)).all()
    out = {"items": [_stock_out(s, admin) for s in rows], "total_lb": round(sum(s.qty_lb for s in rows), 2)}
    if admin:
        out["total_value"] = round(sum(max(s.qty_lb, 0) * s.avg_cost_per_lb for s in rows), 2)
    return out


@router.post("/stock/opening")
def add_opening_stock(body: OpeningIn, session: Session = Depends(get_session), user: User = Depends(require_admin)):
    if not (norm(body.size) and norm(body.color)):
        raise HTTPException(status_code=400, detail="Size and color are required")
    stock = get_or_create_stock(session, body.size, body.color, body.gate)
    add_stock(session, stock, body.weight_lb, body.cost_per_lb, "OPENING", "opening stock")
    log_action(session, user.id, "CREATE", "Stock", str(stock.id), f"Opening stock {stock.size}/{stock.color}/{stock.gate}: {body.weight_lb} lb @ {body.cost_per_lb}")
    session.commit()
    session.refresh(stock)
    return _stock_out(stock, True)


@router.post("/stock/{stock_id}/adjust")
def adjust_stock(stock_id: int, body: AdjustIn, session: Session = Depends(get_session), user: User = Depends(require_admin)):
    stock = session.exec(select(StockItem).where(StockItem.id == stock_id).with_for_update()).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Not found")
    delta = round(body.new_qty_lb - stock.qty_lb, 4)
    _move(session, stock, "ADJUST", delta, stock.avg_cost_per_lb, "manual count", body.note)
    log_action(session, user.id, "UPDATE", "Stock", str(stock_id), f"Stock {stock.size}/{stock.color}/{stock.gate} set to {body.new_qty_lb} lb ({delta:+g})")
    session.commit()
    session.refresh(stock)
    return _stock_out(stock, True)


@router.delete("/stock/{stock_id}")
def delete_stock(stock_id: int, session: Session = Depends(get_session), user: User = Depends(require_admin)):
    stock = session.exec(select(StockItem).where(StockItem.id == stock_id).with_for_update()).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Not found")
    log_action(session, user.id, "DELETE", "Stock", str(stock_id), f"Stock row {stock.size}/{stock.color}/{stock.gate} deleted ({stock.qty_lb:g} lb)")
    session.delete(stock)  # its history is removed with it; old vouchers keep their text
    session.commit()
    return {"message": "Stock row deleted"}


@router.get("/stock/{stock_id}/movements")
def stock_movements(
    stock_id: int, page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session), user: User = Depends(require_admin),
):
    total = session.exec(select(func.count(StockMovement.id)).where(StockMovement.stock_item_id == stock_id)).one()
    pages = max(1, -(-total // page_size))
    page = min(page, pages)
    rows = session.exec(select(StockMovement).where(StockMovement.stock_item_id == stock_id).order_by(StockMovement.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": m.id, "kind": m.kind, "delta_lb": m.delta_lb, "cost_per_lb": m.cost_per_lb, "ref": m.ref, "note": m.note, "created_at": m.created_at} for m in rows],
            "total": total, "page": page, "pages": pages}


# ---------------------------------------------------------------- factory purchases
class LineIn(BaseModel):
    size: str
    color: str
    gate: str = ""
    weight_lb: float = Field(gt=0)
    price_per_lb: float = Field(ge=0)


class ExtraIn(BaseModel):
    label: str = ""
    amount: float = Field(ge=0)


class PurchaseIn(BaseModel):
    supplier: Optional[str] = None
    purchase_number: Optional[str] = None
    purchase_date: Optional[date] = None
    note: Optional[str] = None
    lines: List[LineIn] = Field(min_length=1)
    extras: List[ExtraIn] = Field(default_factory=list)  # transport, loading, ... (kept with the stock, not in Spending)

    @field_validator("purchase_date", mode="before")
    @classmethod
    def _pd(cls, v):
        return _date(v)


def _purchase_out(p: Purchase, lines: List[PurchaseLine], extras: Optional[List[PurchaseExtra]] = None):
    extras = extras or []
    return {
        "id": p.id, "supplier": p.supplier, "purchase_number": p.purchase_number,
        "purchase_date": p.purchase_date.strftime("%d-%m-%Y"), "note": p.note, "total_cost": p.total_cost,
        "extras_total": p.extras_total or 0.0, "grand_total": round((p.total_cost or 0.0) + (p.extras_total or 0.0), 2),
        "extras": [{"id": x.id, "label": x.label, "amount": x.amount} for x in extras],
        "lines": [{"id": l.id, "size": l.size, "color": l.color, "gate": l.gate, "weight_lb": l.weight_lb,
                   "price_per_lb": l.price_per_lb, "line_cost": l.line_cost, "extra_per_lb": l.extra_per_lb or 0.0} for l in lines],
    }


def _clean_extras(extras_in: List[ExtraIn]) -> List[tuple]:
    """Keep only rows with an amount; an empty name becomes 'Extra cost'."""
    return [((x.label or "").strip() or "Extra cost", round(x.amount, 2)) for x in extras_in if x.amount and x.amount > 0]


def _apply_lines(session: Session, purchase: Purchase, lines_in: List[LineIn], extras_in: Optional[List[ExtraIn]] = None):
    """Add every line to stock. The purchase extras (transport...) are spread by weight over all lb of this purchase
    and added to each line's cost per lb, so the average cost and the profit see the real cost."""
    extras = _clean_extras(extras_in or [])
    extras_total = round(sum(a for _, a in extras), 2)
    total_w = sum(l.weight_lb for l in lines_in)
    per_lb = round(extras_total / total_w, 6) if total_w > 0 else 0.0
    out, total = [], 0.0
    ref = f"purchase:{purchase.purchase_number or purchase.id}"
    for l in lines_in:
        if not (norm(l.size) and norm(l.color)):
            raise HTTPException(status_code=400, detail="Every line needs a size and a color")
        cost = round(l.weight_lb * l.price_per_lb, 2)
        total += cost
        line = PurchaseLine(purchase_id=purchase.id, size=norm(l.size), color=norm(l.color), gate=norm(l.gate),
                            weight_lb=l.weight_lb, price_per_lb=l.price_per_lb, line_cost=cost, extra_per_lb=per_lb)
        session.add(line)
        out.append(line)
        stock = get_or_create_stock(session, l.size, l.color, l.gate)
        add_stock(session, stock, l.weight_lb, l.price_per_lb + per_lb, "PURCHASE", ref)
    purchase.total_cost = round(total, 2)
    purchase.extras_total = extras_total
    rows = _replace_extra_rows(session, purchase, extras)
    return out, rows


def _replace_extra_rows(session: Session, purchase: Purchase, extras: List[tuple]) -> List[PurchaseExtra]:
    for old in session.exec(select(PurchaseExtra).where(PurchaseExtra.purchase_id == purchase.id)).all():
        session.delete(old)
    session.flush()
    rows = []
    for label, amount in extras:
        row = PurchaseExtra(purchase_id=purchase.id, label=label, amount=amount)
        session.add(row)
        rows.append(row)
    return rows


def _reverse_lines(session: Session, purchase: Purchase):
    ref = f"purchase:{purchase.purchase_number or purchase.id} removed"
    for l in session.exec(select(PurchaseLine).where(PurchaseLine.purchase_id == purchase.id)).all():
        stock = session.exec(select(StockItem).where(StockItem.size == l.size, StockItem.color == l.color, StockItem.gate == l.gate).with_for_update()).first()
        if stock:
            _move(session, stock, "PURCHASE_REVERSE", -l.weight_lb, l.price_per_lb + (l.extra_per_lb or 0.0), ref)
        session.delete(l)
    for x in session.exec(select(PurchaseExtra).where(PurchaseExtra.purchase_id == purchase.id)).all():
        session.delete(x)
    session.flush()


def _same_lines(session: Session, purchase: Purchase, lines_in: List[LineIn]) -> bool:
    cur = sorted((l.size, l.color, l.gate, round(l.weight_lb, 4), round(l.price_per_lb, 4))
                 for l in session.exec(select(PurchaseLine).where(PurchaseLine.purchase_id == purchase.id)).all())
    new = sorted((norm(l.size), norm(l.color), norm(l.gate), round(l.weight_lb, 4), round(l.price_per_lb, 4)) for l in lines_in)
    return cur == new


def _change_extras_only(session: Session, purchase: Purchase, extras_in: List[ExtraIn]) -> List[PurchaseLine]:
    """Lines did not change, only the extra costs. The change goes ONLY into the plastic of this purchase that is still
    in stock (the average cost moves); plastic already sold keeps the cost it was sold at, so past profit does not change."""
    extras = _clean_extras(extras_in)
    extras_total = round(sum(a for _, a in extras), 2)
    lines = session.exec(select(PurchaseLine).where(PurchaseLine.purchase_id == purchase.id)).all()
    total_w = sum(l.weight_lb for l in lines)
    per_lb = round(extras_total / total_w, 6) if total_w > 0 else 0.0
    ref = f"purchase:{purchase.purchase_number or purchase.id} extras"
    for l in lines:
        delta = round(per_lb - (l.extra_per_lb or 0.0), 6)
        if delta == 0:
            continue
        stock = session.exec(select(StockItem).where(StockItem.size == l.size, StockItem.color == l.color, StockItem.gate == l.gate).with_for_update()).first()
        if stock and stock.qty_lb > 0:
            applied = min(l.weight_lb, stock.qty_lb)
            stock.avg_cost_per_lb = round(max(0.0, stock.avg_cost_per_lb + delta * applied / stock.qty_lb), 4)
            _move(session, stock, "EXTRA_COST", 0.0, stock.avg_cost_per_lb, ref, f"extra costs {delta:+g} per lb on {applied:g} lb still in stock")
        l.extra_per_lb = per_lb
        session.add(l)
    purchase.extras_total = extras_total
    _replace_extra_rows(session, purchase, extras)
    return lines


@router.get("/purchases")
def list_purchases(
    page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session), user: User = Depends(require_admin),
):
    total = session.exec(select(func.count(Purchase.id))).one()
    pages = max(1, -(-total // page_size))
    page = min(page, pages)
    ps = session.exec(
        select(Purchase).order_by(Purchase.purchase_date.desc(), Purchase.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    by_p: dict = {}
    ex_by_p: dict = {}
    if ps:
        ids = [p.id for p in ps]
        for l in session.exec(select(PurchaseLine).where(PurchaseLine.purchase_id.in_(ids))).all():
            by_p.setdefault(l.purchase_id, []).append(l)
        for x in session.exec(select(PurchaseExtra).where(PurchaseExtra.purchase_id.in_(ids)).order_by(PurchaseExtra.id)).all():
            ex_by_p.setdefault(x.purchase_id, []).append(x)
    return {"items": [_purchase_out(p, by_p.get(p.id, []), ex_by_p.get(p.id, [])) for p in ps], "total": total, "page": page, "pages": pages}


@router.post("/purchases")
def create_purchase(body: PurchaseIn, session: Session = Depends(get_session), user: User = Depends(require_admin)):
    p = Purchase(supplier=body.supplier, purchase_number=body.purchase_number, note=body.note)
    if body.purchase_date:
        p.purchase_date = body.purchase_date
    session.add(p)
    session.flush()
    lines, extra_rows = _apply_lines(session, p, body.lines, body.extras)
    log_action(session, user.id, "CREATE", "Purchase", str(p.id), f"Factory purchase {p.purchase_number or p.id}: {p.total_cost:g} + extras {p.extras_total:g}")
    session.commit()
    session.refresh(p)
    return _purchase_out(p, lines, extra_rows)


@router.put("/purchases/{purchase_id}")
def update_purchase(purchase_id: int, body: PurchaseIn, session: Session = Depends(get_session), user: User = Depends(require_admin)):
    p = session.get(Purchase, purchase_id)
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    lines_same = _same_lines(session, p, body.lines)
    if not lines_same:
        _reverse_lines(session, p)
    p.supplier, p.purchase_number, p.note = body.supplier, body.purchase_number, body.note
    if body.purchase_date:
        p.purchase_date = body.purchase_date
    p.updated_at = get_yangon_now()
    if lines_same:
        # only the header / extra costs changed: stock quantities stay, only the plastic still in stock gets the extra cost
        lines = _change_extras_only(session, p, body.extras)
        extra_rows = session.exec(select(PurchaseExtra).where(PurchaseExtra.purchase_id == p.id).order_by(PurchaseExtra.id)).all()
    else:
        lines, extra_rows = _apply_lines(session, p, body.lines, body.extras)
    log_action(session, user.id, "UPDATE", "Purchase", str(p.id), f"Factory purchase {p.purchase_number or p.id} edited: {p.total_cost:g} + extras {p.extras_total:g}")
    session.commit()
    session.refresh(p)
    return _purchase_out(p, lines, extra_rows)


@router.delete("/purchases/{purchase_id}")
def delete_purchase(purchase_id: int, session: Session = Depends(get_session), user: User = Depends(require_admin)):
    p = session.get(Purchase, purchase_id)
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    _reverse_lines(session, p)
    log_action(session, user.id, "DELETE", "Purchase", str(p.id), f"Factory purchase {p.purchase_number or p.id} deleted")
    session.delete(p)
    session.commit()
    return {"message": "Purchase deleted and its lb taken out of stock"}


# ---------------------------------------------------------------- reports
def _range(start: Optional[str], end: Optional[str]):
    s, e = _date(start), _date(end)
    return (s if isinstance(s, date) else None), (e if isinstance(e, date) else None)


@router.get("/analytics/core-weight")
def core_weight_report(
    start: Optional[str] = Query(default=None), end: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=100),
    group: Optional[str] = Query(default=None, pattern="^customer$"),
    session: Session = Depends(get_session), user: User = Depends(require_staff_or_admin),
):
    """Cardboard-core weights. Totals cover the whole date range; `vouchers` is only the requested page (newest first)."""
    s, e = _range(start, end)
    cond = [Voucher.core_weight_lb.isnot(None), Voucher.core_weight_lb > 0]
    if s:
        cond.append(Voucher.voucher_date >= s)
    if e:
        cond.append(Voucher.voucher_date <= e)
    count, total = session.exec(select(func.count(Voucher.id), func.coalesce(func.sum(Voucher.core_weight_lb), 0.0)).where(*cond)).one()
    if group == "customer":
        groups = session.exec(select(func.count(func.distinct(Voucher.customer_id))).where(*cond)).one()
        gpages = max(1, -(-groups // page_size))
        gpage = min(page, gpages)
        grows = session.exec(
            select(Voucher.customer_id, Customer.name, func.count(Voucher.id), func.sum(Voucher.core_weight_lb))
            .join(Customer, Customer.id == Voucher.customer_id).where(*cond)
            .group_by(Voucher.customer_id, Customer.name)
            .order_by(func.sum(Voucher.core_weight_lb).desc(), Customer.name).offset((gpage - 1) * page_size).limit(page_size)
        ).all()
        return {
            "total_lb": round(float(total), 4), "count": count, "groups": groups, "page": gpage, "pages": gpages, "page_size": page_size,
            "customers": [{"customer_id": cid, "customer": name, "vouchers": n, "lb": round(float(lb), 4)} for cid, name, n, lb in grows],
        }
    pages = max(1, -(-count // page_size))
    page = min(page, pages)
    rows = session.exec(
        select(Voucher, Customer.name).join(Customer, Customer.id == Voucher.customer_id).where(*cond)
        .order_by(Voucher.voucher_date.desc(), Voucher.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {
        "total_lb": round(float(total), 4), "count": count, "page": page, "pages": pages, "page_size": page_size,
        "vouchers": [{"id": v.id, "voucher_number": v.voucher_number, "date": v.voucher_date.strftime("%d-%m-%Y"),
                      "customer": name, "customer_id": v.customer_id, "core_weight_lb": v.core_weight_lb} for v, name in rows],
    }


@router.get("/analytics/profit")
def profit_report(
    start: Optional[str] = Query(default=None), end: Optional[str] = Query(default=None),
    session: Session = Depends(get_session), user: User = Depends(require_admin),
):
    """Profit on plastic sold = item sale price minus (lb x average cost at the time of sale). Only items that took stock have a cost."""
    s, e = _range(start, end)
    q = select(Item.plastic_size, Item.color, Item.gate, Item.lb, Item.total_price, Item.cost_per_lb).join(Voucher, Voucher.id == Item.voucher_id).where(Voucher.stock_tracked == True)  # noqa: E712
    if s:
        q = q.where(Voucher.voucher_date >= s)
    if e:
        q = q.where(Voucher.voucher_date <= e)
    rows = session.exec(q).all()
    sales = cost = 0.0
    no_cost_sales = 0.0
    no_cost_items = 0
    for size, color, gate, lb, total_price, cpl in rows:
        if cpl is None or cpl <= 0:
            no_cost_sales += total_price
            no_cost_items += 1
            continue
        sales += total_price
        cost += lb * cpl
    return {
        "sales": round(sales, 2), "cost": round(cost, 2), "profit": round(sales - cost, 2),
        "margin_pct": round((sales - cost) / sales * 100, 1) if sales else None,
        "items_without_cost": no_cost_items, "sales_without_cost": round(no_cost_sales, 2),
    }


# ---------------------------------------------------------------- stock alerts (everyone) + profit breakdown (admin)
LOW_STOCK_LB = 20.0


@router.get("/stock/alerts")
def stock_alerts(session: Session = Depends(get_session), user: User = Depends(require_staff_or_admin)):
    """Items that are below zero (sold more than recorded) or running low (LOW_STOCK_LB or less). No costs here, staff may see it."""
    rows = session.exec(select(StockItem).where(StockItem.qty_lb <= LOW_STOCK_LB).order_by(StockItem.qty_lb, StockItem.size)).all()
    items = [{"id": r.id, "size": r.size, "color": r.color, "gate": r.gate, "qty_lb": r.qty_lb, "kind": "NEGATIVE" if r.qty_lb < 0 else "LOW"} for r in rows]
    return {
        "low_lb": LOW_STOCK_LB, "negative": sum(1 for i in items if i["kind"] == "NEGATIVE"), "low": sum(1 for i in items if i["kind"] == "LOW"),
        "total": len(items), "items": items[:12],
    }


@router.get("/analytics/profit-breakdown")
def profit_breakdown(
    by: str = Query(default="customer", pattern="^(customer|size)$"),
    start: Optional[str] = Query(default=None), end: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1), page_size: int = Query(default=10, ge=1, le=100),
    session: Session = Depends(get_session), user: User = Depends(require_admin),
):
    """Profit on plastic sold, grouped by customer or by size. Only items that took stock (they carry a cost) are counted."""
    s, e = _range(start, end)
    cond = [Voucher.stock_tracked == True, Item.cost_per_lb > 0]  # noqa: E712
    if s:
        cond.append(Voucher.voucher_date >= s)
    if e:
        cond.append(Voucher.voucher_date <= e)
    if by == "customer":
        key_cols, joins = (Customer.id, Customer.name), True
    else:
        key_cols, joins = (Item.plastic_size,), False
    sales = func.sum(Item.total_price)
    cost = func.sum(Item.lb * Item.cost_per_lb)

    def base(q):
        q = q.join(Voucher, Voucher.id == Item.voucher_id)
        if joins:
            q = q.join(Customer, Customer.id == Voucher.customer_id)
        return q.where(*cond)

    sub = select(*key_cols).select_from(Item).join(Voucher, Voucher.id == Item.voucher_id)
    if joins:
        sub = sub.join(Customer, Customer.id == Voucher.customer_id)
    sub = sub.where(*cond).group_by(*key_cols).subquery()
    groups = session.exec(select(func.count()).select_from(sub)).one()
    pages = max(1, -(-groups // page_size))
    page = min(page, pages)
    q = base(select(*key_cols, sales, cost, func.count(Item.id))).group_by(*key_cols).order_by((sales - cost).desc()).offset((page - 1) * page_size).limit(page_size)
    out = []
    for row in session.exec(q).all():
        name = row[1] if by == "customer" else row[0]
        sv, cv, n = float(row[-3]), float(row[-2]), int(row[-1])
        out.append({"name": name, "sales": round(sv, 2), "cost": round(cv, 2), "profit": round(sv - cv, 2),
                    "margin_pct": round((sv - cv) / sv * 100, 1) if sv else None, "items": n})
    return {"by": by, "rows": out, "groups": groups, "page": page, "pages": pages}
