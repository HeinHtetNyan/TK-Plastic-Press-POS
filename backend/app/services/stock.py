"""Stock bookkeeping: one StockItem per Size + Color + Gate, in lb, with a moving-average cost.

Rules
- Purchases / opening stock add lb and re-average the cost per lb.
- A sale takes lb at the current average cost and stores that cost on the sold Item (for profit).
- Undoing a sale (voucher edit / delete) puts the lb back at the cost it was taken at.
- Stock is allowed to go negative: the caller gets a warning instead of a refusal.
"""
import re
from typing import Optional, List
from sqlmodel import Session, select
from app.models.stock import StockItem, StockMovement, VoucherWaste
from app.models.customer import get_yangon_now


def norm(s: Optional[str]) -> str:
    """Trim and collapse inner whitespace so '4*/6  နီ' and '4*/6 နီ' are one key."""
    return " ".join((s or "").split())


def front_size(s: Optional[str]) -> str:
    """'4½ x 6' -> '4½'. Stock is kept per first number only; the second number of a voucher size is ignored."""
    return re.split(r"\s*[x×*]\s*", norm(s), maxsplit=1)[0].strip()


def find_stock(session: Session, size: str, color: str, gate: str, lock: bool = False) -> Optional[StockItem]:
    def _q(sz: str):
        q = select(StockItem).where(
            StockItem.size == sz, StockItem.color == norm(color), StockItem.gate == norm(gate)
        )
        return q.with_for_update() if lock else q

    # exact size first (older stock saved as '2 x 1'), then by first number only ('2 x 1' -> stock '2')
    stock = session.exec(_q(norm(size))).first()
    if stock is None and front_size(size) != norm(size):
        stock = session.exec(_q(front_size(size))).first()
    return stock


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


WASTE_KINDS = ("CORE", "DAMAGE")


def apply_wastes(session: Session, voucher_id: int, wastes: list, ref: str, take_stock: bool) -> List[str]:
    """Save the cardboard-core / damage rows of a voucher and (when the voucher takes stock) take their lb out of the
    chosen Size + Color + Thickness stock at its average cost. Stock value falls by lb x average cost; the average cost,
    the voucher price, revenue, profit and the cash figures are not touched. Returns plain-language warnings."""
    warnings: List[str] = []
    for w in wastes:
        kind = (w.kind or "").upper()
        label = f"{norm(w.size)} / {norm(w.color)}" + (f" / {norm(w.gate)}" if norm(w.gate) else "")
        title = "Cardboard core" if kind == "CORE" else "Damage"
        row = VoucherWaste(voucher_id=voucher_id, kind=kind, lb=w.lb, size=norm(w.size), color=norm(w.color), gate=norm(w.gate))
        if take_stock and norm(w.size) and norm(w.color):
            stock = find_stock(session, w.size, w.color, w.gate or "", lock=True)
            if stock is None:
                warnings.append(f"{title}: no stock record for {label} - stock not reduced.")
            else:
                row.stock_item_id = stock.id
                row.cost_per_lb = remove_stock(session, stock, w.lb, kind, ref, f"{title.lower()} {w.lb:g} lb")
                if stock.qty_lb < 0:
                    warnings.append(f"Stock for {label} is now {stock.qty_lb:g} lb (not enough in stock).")
        elif take_stock:
            warnings.append(f"{title}: pick a size and color to take it out of stock.")
        session.add(row)
    return warnings


def give_back_wastes(session: Session, voucher_id: int, ref: str):
    """Undo apply_wastes (voucher edited or deleted): put the lb back at the cost they were taken at, delete the rows."""
    for row in session.exec(select(VoucherWaste).where(VoucherWaste.voucher_id == voucher_id)).all():
        if row.stock_item_id is not None:
            stock = session.exec(select(StockItem).where(StockItem.id == row.stock_item_id).with_for_update()).first()
            if stock is not None:
                if row.cost_per_lb is not None and stock.qty_lb > 0:
                    add_stock(session, stock, row.lb, row.cost_per_lb, row.kind + "_REVERSE", ref)
                else:
                    _move(session, stock, row.kind + "_REVERSE", row.lb, row.cost_per_lb, ref)
        session.delete(row)
    session.flush()


def wastes_by_voucher(session: Session, voucher_ids: list) -> dict:
    out: dict = {}
    if not voucher_ids:
        return out
    for r in session.exec(select(VoucherWaste).where(VoucherWaste.voucher_id.in_(voucher_ids)).order_by(VoucherWaste.id)).all():
        out.setdefault(r.voucher_id, []).append({"id": r.id, "kind": r.kind, "lb": r.lb, "size": r.size, "color": r.color, "gate": r.gate or None})
    return out
