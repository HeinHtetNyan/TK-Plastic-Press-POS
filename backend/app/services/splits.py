from typing import List, Optional, Tuple
from fastapi import HTTPException
from app.models.enums import PaymentMethod


def normalize_splits(splits, total: float) -> Tuple[Optional[list], Optional[PaymentMethod]]:
    """Validate a payment split against the amount actually paid.

    Returns (splits_for_storage, primary_method). Fewer than two methods is not a split:
    it is stored as NULL and the single method becomes the primary method.
    """
    if not splits:
        return None, None
    parts = {}
    for s in splits:
        method = s.method
        amount = round(float(s.amount), 2)
        if amount <= 0:
            continue
        parts[method] = round(parts.get(method, 0.0) + amount, 2)
    if not parts:
        return None, None
    if abs(sum(parts.values()) - round(float(total or 0.0), 2)) > 0.01:
        raise HTTPException(status_code=400, detail="Split amounts must add up to the amount paid.")
    primary = max(parts.items(), key=lambda kv: kv[1])[0]
    if len(parts) < 2:
        return None, primary
    return [{"method": m.value, "amount": a} for m, a in parts.items()], primary


def split_amounts(method, splits, amount: float) -> List[Tuple[str, float]]:
    """Per-method amounts of one voucher/payment, for reports. Old rows have no splits."""
    if splits:
        return [(str(s.get("method")), float(s.get("amount") or 0)) for s in splits]
    m = method.value if hasattr(method, "value") else (str(method) if method else "CASH")
    return [(m, float(amount or 0))]
