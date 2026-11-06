from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from app.db import get_session
from app.models import Voucher, Customer, Payment, User, Spending, Item, UserRole
from app.models.stock import StockItem, Purchase
from app.dependencies.auth import require_staff_or_admin
from app.services.balance import calculate_customer_balance
from app.services.splits import split_amounts
from app.models.customer import get_yangon_date
from datetime import datetime, timedelta, date

router = APIRouter(tags=["analytics"])

@router.get("/analytics/dashboard")
def get_dashboard_data(
    period: str = Query(default="month", pattern="^(month|3months|6months|1year)$"),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_staff_or_admin)
):
    today = get_yangon_date()  # the shop's own date (Asia/Yangon), not the server's clock

    if period == "3months":
        start_date = today - timedelta(days=90)
    elif period == "6months":
        start_date = today - timedelta(days=180)
    elif period == "1year":
        start_date = today - timedelta(days=365)
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
    total_revenue_alltime = session.exec(
        select(func.sum(Voucher.items_total + Voucher.extra_charge_amount - Voucher.discount_amount))
    ).first() or 0.0
    total_paid_vouchers_alltime = session.exec(select(func.sum(Voucher.paid_amount))).first() or 0.0
    total_standalone_alltime = session.exec(select(func.sum(Payment.amount_paid + Payment.discount_amount))).first() or 0.0
    total_debt = round(float(total_revenue_alltime - total_paid_vouchers_alltime - total_standalone_alltime), 2)

    # 3. Total Revenue for selected period (net of discounts granted on vouchers and standalone payments)
    voucher_revenue = session.exec(
        select(func.sum(Voucher.items_total + Voucher.extra_charge_amount - Voucher.discount_amount)).where(
            Voucher.voucher_date >= start_date
        )
    ).first() or 0.0
    payment_discounts = session.exec(
        select(func.sum(Payment.discount_amount)).where(Payment.payment_date >= start_date)
    ).first() or 0.0
    total_revenue = voucher_revenue - payment_discounts

    # 4. Income by Payment Method for selected period
    voucher_payments = session.exec(
        select(Voucher.payment_method, Voucher.payment_splits, Voucher.paid_amount).where(
            Voucher.paid_amount > 0,
            Voucher.payment_method.isnot(None),
            Voucher.voucher_date >= start_date,
        )
    ).all()

    standalone_payments = session.exec(
        select(Payment.payment_method, Payment.payment_splits, Payment.amount_paid).where(
            Payment.payment_method.isnot(None),
            Payment.payment_date >= start_date,
        )
    ).all()

    income_by_method: dict = {}

    def process_results(results):
        # A split row counts each method for its own part; older rows count their single method.
        for method, splits, amount in results:
            for m_str, part in split_amounts(method, splits, amount):
                income_by_method[m_str] = income_by_method.get(m_str, 0) + part

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

    # 6. Total Spending for selected period
    total_spending = float(session.exec(
        select(func.sum(Spending.amount)).where(Spending.spending_date >= start_date)
    ).first() or 0.0)

    # 7. All Customer Debts — always all-time
    all_customers = session.exec(select(Customer)).all()
    debt_list = sorted(
        [{"name": c.name, "debt": calculate_customer_balance(session, c.id)} for c in all_customers],
        key=lambda x: x["debt"],
        reverse=True,
    )

    # 8. Admin only: profit on the plastic sold in this period and the value of stock on hand.
    # Profit counts only items that took stock (they carry the average cost at the time of sale);
    # sales without a cost are reported separately instead of being treated as pure profit.
    profit = None
    stock_value = None
    if current_user.role == UserRole.ADMIN:
        base = (Voucher.stock_tracked == True, Voucher.voucher_date >= start_date)  # noqa: E712
        sales, cost = session.exec(
            select(func.coalesce(func.sum(Item.total_price), 0.0), func.coalesce(func.sum(Item.lb * Item.cost_per_lb), 0.0))
            .join(Voucher, Voucher.id == Item.voucher_id).where(*base, Item.cost_per_lb > 0)
        ).one()
        nc_sales, nc_count = session.exec(
            select(func.coalesce(func.sum(Item.total_price), 0.0), func.count(Item.id))
            .join(Voucher, Voucher.id == Item.voucher_id).where(*base, (Item.cost_per_lb.is_(None)) | (Item.cost_per_lb <= 0))
        ).one()
        gross = float(sales) - float(cost)
        profit = {
            "sales": round(float(sales), 2), "cost": round(float(cost), 2), "gross_profit": round(gross, 2),
            "spending": round(total_spending, 2), "net_profit": round(gross - total_spending, 2),
            "sales_without_cost": round(float(nc_sales), 2), "items_without_cost": int(nc_count),
        }
        qty_avg = session.exec(select(StockItem.qty_lb, StockItem.avg_cost_per_lb)).all()
        stock_value = round(sum(max(q, 0.0) * a for q, a in qty_avg), 2)

    # 9. Admin only: CASH view for the same period = money really received - money really paid out.
    # In: paid on vouchers + customer payments (credit sales count only when the customer pays).
    # Out: factory purchases (voucher amount + transport/loading extras) + Spending. Opening stock is not cash.
    # Profit above is unchanged: it counts the plastic cost only when the plastic is sold.
    cash = None
    if current_user.role == UserRole.ADMIN:
        in_vouchers = float(session.exec(
            select(func.coalesce(func.sum(Voucher.paid_amount), 0.0)).where(Voucher.voucher_date >= start_date)
        ).one() or 0.0)
        in_payments = float(session.exec(
            select(func.coalesce(func.sum(Payment.amount_paid), 0.0)).where(Payment.payment_date >= start_date)
        ).one() or 0.0)
        factory_out = float(session.exec(
            select(func.coalesce(func.sum(Purchase.total_cost + Purchase.extras_total), 0.0)).where(Purchase.purchase_date >= start_date)
        ).one() or 0.0)
        money_in = in_vouchers + in_payments
        cash = {
            "money_in": round(money_in, 2), "factory_out": round(factory_out, 2),
            "spending": round(total_spending, 2), "cash": round(money_in - factory_out - total_spending, 2),
        }

    return {
        "profit": profit,
        "cash": cash,
        "stock_value": stock_value,
        "daily_sales": daily_sales,
        "total_debt": total_debt,
        "top_customers": top_customers,
        "total_revenue": total_revenue,
        "income_by_method": income_list,
        "debt_list": debt_list,
        "total_spending": total_spending,
        "period": period,
    }
