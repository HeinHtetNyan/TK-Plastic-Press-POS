from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from app.db import get_session
from app.models import Voucher, Customer, Payment, User
from app.dependencies.auth import require_staff_or_admin
from app.services.balance import calculate_customer_balance
from datetime import datetime, timedelta, date

router = APIRouter(tags=["analytics"])

@router.get("/analytics/dashboard")
def get_dashboard_data(
    period: str = Query(default="month", pattern="^(month|3months)$"),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_staff_or_admin)
):
    today = datetime.now().date()

    if period == "3months":
        start_date = today - timedelta(days=90)
    else:
        start_date = today.replace(day=1)

    # 1. Daily Sales (last 30 days — fixed, not affected by period toggle)
    thirty_days_ago = today - timedelta(days=30)
    sales_query = select(Voucher.voucher_date, func.sum(Voucher.items_total)).where(
        Voucher.voucher_date >= thirty_days_ago
    ).group_by(Voucher.voucher_date).order_by(Voucher.voucher_date)
    sales_results = session.exec(sales_query).all()
    daily_sales = [{"date": str(d), "amount": amount} for d, amount in sales_results]

    # 2. Total Debt (always all-time — debt is cumulative)
    total_revenue_alltime = session.exec(select(func.sum(Voucher.items_total + Voucher.extra_charge_amount))).first() or 0.0
    total_paid_vouchers_alltime = session.exec(select(func.sum(Voucher.paid_amount))).first() or 0.0
    total_standalone_alltime = session.exec(select(func.sum(Payment.amount_paid))).first() or 0.0
    total_debt = round(float(total_revenue_alltime - total_paid_vouchers_alltime - total_standalone_alltime), 2)

    # 3. Total Revenue for selected period
    total_revenue = session.exec(
        select(func.sum(Voucher.items_total)).where(Voucher.voucher_date >= start_date)
    ).first() or 0.0

    # 4. Income by Payment Method for selected period
    voucher_payments = session.exec(
        select(Voucher.payment_method, func.sum(Voucher.paid_amount)).where(
            Voucher.paid_amount > 0,
            Voucher.payment_method.isnot(None),
            Voucher.voucher_date >= start_date,
        ).group_by(Voucher.payment_method)
    ).all()

    standalone_payments = session.exec(
        select(Payment.payment_method, func.sum(Payment.amount_paid)).where(
            Payment.payment_method.isnot(None),
            Payment.payment_date >= start_date,
        ).group_by(Payment.payment_method)
    ).all()

    income_by_method: dict = {}

    def process_results(results):
        for method, amount in results:
            m_str = method.value if hasattr(method, "value") else (str(method) if method else "CASH")
            income_by_method[m_str] = income_by_method.get(m_str, 0) + (amount or 0)

    process_results(voucher_payments)
    process_results(standalone_payments)
    income_list = [{"method": m, "amount": a} for m, a in income_by_method.items()]

    # 5. Top Customers by Revenue for selected period
    top_customers_results = session.exec(
        select(Customer.name, func.sum(Voucher.items_total).label("revenue"))
        .join(Voucher)
        .where(Voucher.voucher_date >= start_date)
        .group_by(Customer.id, Customer.name)
        .order_by(func.sum(Voucher.items_total).desc())
        .limit(5)
    ).all()
    top_customers = [{"name": name, "revenue": revenue} for name, revenue in top_customers_results]

    # 6. All Customer Debts — always all-time
    all_customers = session.exec(select(Customer)).all()
    debt_list = sorted(
        [{"name": c.name, "debt": calculate_customer_balance(session, c.id)} for c in all_customers],
        key=lambda x: x["debt"],
        reverse=True,
    )

    return {
        "daily_sales": daily_sales,
        "total_debt": total_debt,
        "top_customers": top_customers,
        "total_revenue": total_revenue,
        "income_by_method": income_list,
        "debt_list": debt_list,
        "period": period,
    }
