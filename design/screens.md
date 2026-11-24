# TK Plastic Press POS: screen inventory

Product: offline-first POS for a plastic-bag printing shop in Myanmar. Languages EN + MM (Myanmar script needs taller lines).
Roles: **Admin** (everything) and **Staff** (no Spending, Settings, Buy from factory, cost/profit figures, Edit/Delete in History).
Devices: P = phone (<600), T = tablet (600-1023), L = laptop (>=1024). Today the shell is a blue sidebar (L) / blue top bar + bottom tabs (P).

## Shell (all roles)
| # | Screen | Devices | Notes |
|---|---|---|---|
| S1 | App shell: logo, name, EN/MM switch, user + role, sync pill, nav, logout | P T L | Nav: Home, Stock, Reports; admin adds Spending, Settings |
| S2 | Sync pill states: Online, Syncing, Pending(n), Offline(n) | P T L | |
| S3 | Demo-mode pill (bottom, "Demo mode - sample data only" + Exit demo) | P T L | |

## Public
| # | Screen | Devices | States |
|---|---|---|---|
| A1 | Login | P T L | connecting, server unreachable (Retry), first-run Initial Setup (create Super Admin), sign in, error, demo login box |

## Home / customers (all roles)
| # | Screen | Devices | States |
|---|---|---|---|
| H1 | Select Customer: search + Add, results, selected card | P T L | no results, offline/Local badge |
| H2 | Browse all customers list (20/page, edit, admin delete) | P T L | load error, empty |
| H3 | Dashboard (nothing selected): period pills, revenue, debt, net income, money left, profit (admin), stock value, stock alerts, income by method, daily sales chart, top customers, outstanding debts | P T L | loading, empty, admin vs staff |
| H4 | Customer selected: balance card (Owes / Credit), 3 actions: Create Voucher, Add Payment, History | P T L | offline estimated balance |
| H5 | New / Edit Customer modal (name, phone, address) | P T L | offline notice, saving |

## Vouchers and payments (all roles)
| # | Screen | Devices | States |
|---|---|---|---|
| V1 | Create Voucher: number (own / auto), date, items (size, thickness, plastic colour, print colour, lb, plastic price, colour price), note, cardboard core / damage box, extra charge, discount, totals panel, paid, payment method, save bar | P T L | offline, stock-negative warning, success, errors |
| V2 | Payment method picker: one method / split with Rest buttons | P T L | split mismatch errors |
| P1 | Add Payment: current debt, amount, discount, date, method, note | P T L | offline, success, error |
| R0 | A5 printed voucher preview (Myanmar paper-book template) | P T L | multi-page |

## History (all roles; edit/delete admin)
| # | Screen | Devices | States |
|---|---|---|---|
| Y1 | History sheet (spreadsheet table, 16 columns, sticky first column) | T L (phone = swipe or restack) | loading, empty, pending tag, paid-later |
| Y2 | History list (expandable cards, Reprint A5) | P T L | |
| Y3 | Edit Voucher modal / Edit Payment modal (admin) | P T L | |

## Reports (all roles; profit admin)
| # | Screen | Devices | States |
|---|---|---|---|
| X1 | Reports: stats, income by method, Cardboard Core + Profit (period pills, profit by customer/size), daily sales chart, debts, vouchers list | P T L | loading, empty |
| X2 | Cardboard Core history sheet (Vouchers / By customer) | P T L | empty |

## Stock
| # | Screen | Devices | States |
|---|---|---|---|
| T1 | Stock list: totals, search, rows with qty, cost/value (admin), actions | P T L | negative stock, empty |
| T2 | Add opening stock form (admin) | P T L | |
| T3 | Stock movement history sheet | P T L | |
| T4 | Buy from factory: list + New/Edit factory voucher (rolls, extra costs, totals) (admin) | P T L | empty |
| T5 | Lists: Size, Thickness, Plastic Color, Print Color (add, search, delete admin) | P T L | |

## Admin
| # | Screen | Devices | States |
|---|---|---|---|
| M1 | Spending: total, add/edit form, list | P T L | offline, empty |
| M2 | Settings > Users: add staff, accounts table, disable/delete | P T L | access denied |
| M3 | Settings > Audit trail table | T L (phone = cards) | empty |

## Cross-cutting
- Confirm dialogs (currently native confirm): delete customer / voucher / payment / spending / user.
- Toasts / success / error banners (currently inline alerts).
- Myanmar script variants of every screen.
