from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from app.db import get_session
from app.models import AuditLog, User
from app.dependencies.auth import require_admin

router = APIRouter(tags=["audit"])

@router.get("/audit-logs")
def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    total = session.exec(select(func.count(AuditLog.id))).one()
    pages = max(1, -(-total // page_size))
    page = min(page, pages)
    results = session.exec(
        select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()

    user_ids = {log.user_id for log in results}
    users = {
        u.id: u.username
        for u in session.exec(select(User).where(User.id.in_(user_ids))).all()
    }

    logs = []
    for log in results:
        log_data = log.model_dump()
        log_data["username"] = users.get(log.user_id, "Unknown")
        logs.append(log_data)

    return {"items": logs, "total": total, "page": page, "pages": pages}
