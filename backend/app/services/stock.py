"""Stock bookkeeping: one StockItem per Size + Color + Gate, in lb, with a moving-average cost.

Rules
- Purchases / opening stock add lb and re-average the cost per lb.
- A sale takes lb at the current average cost and stores that cost on the sold Item (for profit).
- Undoing a sale (voucher edit / delete) puts the lb back at the cost it was taken at.
- Stock is allowed to go negative: the caller gets a warning instead of a refusal.
"""
from typing import Optional, List
from sqlmodel import Session, select
from app.models.stock import StockItem, StockMovement
from app.models.customer import get_yangon_now


def norm(s: Optional[str]) -> str:
    """Trim and collapse inner whitespace so '4*/6  နီ' and '4*/6 နီ' are one key."""
    return " ".join((s or "").split())


def find_stock(session: Session, size: str, color: str, gate: str, lock: bool = False) -> Optional[StockItem]:
    q = select(StockItem).where(
        StockItem.size == norm(size), StockItem.color == norm(color), StockItem.gate == norm(gate)
    )
    if lock:
        q = q.with_for_update()
    return session.exec(q).first()


def get_or_create_stock(session: Session, size: str, color: str, gate: str) -> StockItem:
    stock = find_stock(session, size, color, gate, lock=True)
    if stock is None:
        stock = StockItem(size=norm(size), color=norm(color), gate=norm(gate))
        session.add(stock)
        session.flush()
    return stock


def _move(session: Session, stock: StockItem, kind: str, delta: float, cost: Optional[float], ref: Optional[str], note: Optional[str] = None):
    stock.qty_lb = round(stock.qty_lb + delta, 4)
    stock.updated_at = get_yangon_now()
    session.add(stock)
    session.add(StockMovement(stock_item_id=stock.id, kind=kind, delta_lb=delta, cost_per_lb=cost, ref=ref, note=note))


def add_stock(session: Session, stock: StockItem, lb: float, cost_per_lb: float, kind: str, ref: Optional[str] = None, note: Optional[str] = None):
    """Add lb at a known cost and re-average. If the stock was empty/negative, the new cost simply becomes the average."""
    if stock.qty_lb > 0:
        total = stock.qty_lb * stock.avg_cost_per_lb + lb * cost_per_lb
        new_qty = stock.qty_lb + lb
        stock.avg_cost_per_lb = round(total / new_qty, 4) if new_qty > 0 else cost_per_lb
    else:
        stock.avg_cost_per_lb = cost_per_lb
    _move(session, stock, kind, lb, cost_per_lb, ref, note)


def remove_stock(session: Session, stock: StockItem, lb: float, kind: str, ref: Optional[str] = None, note: Optional[str] = None) -> float:
    """Take lb out at the current average cost. Returns the cost per lb used."""
    cost = stock.avg_cost_per_lb
    _move(session, stock, kind, -lb, cost, ref, note)
    return cost


def take_stock_for_items(session: Session, items: list, ref: str) -> List[str]:
    """Deduct each sold Item from stock (sets item.stock_item_id / cost_per_lb). Returns plain-language warnings."""
    warnings: List[str] = []
    for it in items:
        label = f"{norm(it.plastic_size)} / {norm(it.color)}" + (f" / {norm(it.gate)}" if norm(it.gate) else "")
        stock = find_stock(session, it.plastic_size, it.color, it.gate or "", lock=True)
        if stock is None:
            warnings.append(f"No stock record for {label} - stock not reduced.")
            continue
        it.stock_item_id = stock.id
        it.cost_per_lb = remove_stock(session, stock, it.lb, "SALE", ref)
        if stock.qty_lb < 0:
            warnings.append(f"Stock for {label} is now {stock.qty_lb:g} lb (not enough in stock).")
    return warnings


def give_back_stock_for_items(session: Session, items: list, ref: str):
    """Undo take_stock_for_items for existing Items (before they are replaced or the voucher is deleted)."""
    for it in items:
        if it.stock_item_id is None:
            continue
        stock = session.exec(select(StockItem).where(StockItem.id == it.stock_item_id).with_for_update()).first()
        if stock is None:
            continue
        if it.cost_per_lb is not None and stock.qty_lb > 0:
            add_stock(session, stock, it.lb, it.cost_per_lb, "SALE_REVERSE", ref)
        else:
            _move(session, stock, "SALE_REVERSE", it.lb, it.cost_per_lb, ref)
