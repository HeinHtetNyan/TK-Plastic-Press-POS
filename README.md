![TK Plastic Press POS screenshot](https://github.com/HeinHtetNyan/TK-Plastic-Press-POS/blob/4fedf02afd4a83e8598ba07a98a7998247747c7d/Screenshot%202026-04-20%20022638.png)

# TK Plastic Press POS System

A Point of Sale system built for TK Plastic Press, a plastic-sheet retail business. It manages customer accounts, plastic-sheet sale vouchers (priced by weight/lb with per-item plastic and color pricing), standalone payments, running customer debt balances, spending/expense tracking, and sales analytics. The system is **live in production**, with a FastAPI backend, a React frontend that works offline-first via IndexedDB, and a native Android app that wraps the web frontend.

## Key Features

- **Customer & Voucher Management**: Create customers and plastic-sheet sale vouchers. Each voucher line item captures weight (lb), plastic size/price, and color/color price; the backend computes `total_price = lb * (plastic_price + color_price)` per item.
- **Running Debt Balance**: Every customer has a running balance computed as `(all voucher items_total + extra_charges - discounts) - (all voucher paid_amounts) - (all standalone payments + their discounts)`. This is recalculated from source records on every read (see Architecture Notes below).
- **Standalone Payments**: Payments can be recorded against a customer independently of any specific voucher (e.g., bulk debt repayment), with amount, discount, method (Cash / Bank Transfer / KBZPay), and date.
- **Offline-First Sync (Frontend)**: Customers, vouchers, payments, and spendings can be created while offline; they're queued in IndexedDB (Dexie.js) and synced to the backend when connectivity returns, using client-generated UUIDs (`client_id`) for idempotent retries. An offline balance estimate is computed client-side from the last cached server balance plus any not-yet-synced local deltas.
- **Expense/Spending Tracking**: CRUD for business spendings, offline-sync capable like the rest of the app.
- **Analytics Dashboard**: 30-day daily sales trend, all-time total debt, period-scoped revenue, income breakdown by payment method, top-5 customers by revenue, and an all-customer debt list.
- **Audit Log**: Every create/update/delete on vouchers, payments, etc. is logged with the acting user, action, and target (admin-only endpoint to view).
- **Role-Based Auth**: JWT (python-jose) login with ADMIN and STAFF roles; STAFF can do day-to-day operations, ADMIN-only endpoints include payment/voucher deletion and audit log access.
- **Rate Limiting & Security Headers**: SlowAPI rate limiting; responses carry HSTS, CSP, X-Frame-Options, X-Content-Type-Options, etc.

Note: the previous README claimed automatic "FIFO Payment Settlement" (bulk payments auto-applied to oldest outstanding vouchers). No such logic exists in the backend — payments are simple standalone records that reduce the customer's overall running balance. A `settle_oldest` translation string exists in the frontend's language file but is not referenced/used anywhere in the UI, so this appears to be an unimplemented/planned feature, not a shipped one.

## Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **ORM**: SQLModel (SQLAlchemy + Pydantic)
- **Database**: PostgreSQL 15 (via `psycopg2-binary`); a local `database.db` SQLite file also exists in `backend/` from local/dev use — not meaningful beyond that
- **Migrations**: Alembic
- **Auth/Security**: Passlib (Bcrypt) for password hashing, python-jose for JWT
- **Rate Limiting**: SlowAPI

### Frontend
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS 4
- **Offline Storage**: Dexie.js (IndexedDB)
- **Routing**: React Router 7
- **Charts**: Recharts 3
- **Icons**: Lucide React
- **HTTP**: Axios

### Android
- **Language**: Kotlin, minSdk 24 / compileSdk 34
- **Nature**: Confirmed thin WebView wrapper — `MainActivity.kt` is the app's only source file. It loads a configurable URL (`pos.url` from `android/local.properties`, injected via `BuildConfig.POS_URL`) into an Android `WebView` with JS/DOM storage/IndexedDB enabled, adds pull-to-refresh, back-button navigation within the WebView, network-availability listeners (so `navigator.onLine` and the frontend's sync engine behave correctly), and opens genuinely external links in the system browser. There is no native business logic, native data storage, or native API calls — all app logic lives in the React frontend.

## Project Structure

```text
TK-Project/
├── android/              # Native Android WebView wrapper (Kotlin)
│   └── app/src/main/java/com/tkplasticpress/pos/MainActivity.kt
├── backend/               # FastAPI application
│   ├── app/
│   │   ├── main.py        # App setup, CORS, security headers, router registration
│   │   ├── models/        # SQLModel tables: customer, voucher, item, payment, spending, user, audit_log, enums
│   │   ├── routes/        # auth, users, customers, vouchers, payments, analytics, audit, spendings
│   │   ├── services/      # balance.py (running balance calc), voucher.py, audit.py
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── core/          # security.py (JWT/password), limiter.py (rate limiting)
│   │   └── dependencies/  # auth.py (get_current_user, require_admin, require_staff_or_admin)
│   └── alembic/           # DB migrations
├── frontend/               # React application
│   ├── src/
│   │   ├── pages/          # Home, Voucher, Payment, Spending, Reports, History, Users, AuditLogs, Login
│   │   ├── services/       # api.js (Axios client), syncService.js (offline sync engine)
│   │   ├── lib/db.js        # Dexie/IndexedDB schema
│   │   └── context/        # AuthContext, LanguageContext (English/Burmese)
│   └── vercel.json          # Frontend deployment config
├── nginx/                   # nginx.conf — reverse proxy for /api to backend + SPA static serving
├── scripts/rclone-sync.sh   # Hourly rclone sync of ./backups → Cloudflare R2
├── docker-compose.yml        # Local/dev stack (backend + frontend + Postgres)
└── docker-compose.prod.yml   # Production stack (backend + Postgres + hourly db-backup + backup-uploader)
```

## Getting Started / Local Dev

### 1. Environment Setup
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```
Fill in `.env` (Postgres credentials, `SECRET_KEY`, `ALLOWED_ORIGINS`, R2 backup credentials if testing backups).

### 2. Run the full stack
```bash
docker-compose up -d --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8001` (mapped from container port 8000)
- API docs: `http://localhost:8001/api/docs` (only if `SHOW_DOCS=true`)

### 3. Database migrations
```bash
docker-compose exec backend alembic upgrade head
```

### 4. Production deployment
Handled by `deploy.sh` on the VPS: pulls latest `main`, rebuilds via `docker-compose.prod.yml`, waits for the backend healthcheck, then runs `alembic upgrade head`. Production binds Postgres and the backend to `127.0.0.1` only; external access goes through a reverse proxy/tunnel in front of nginx.

### 5. Android build
1. Open `android/` in Android Studio.
2. Create `android/local.properties` with:
   ```properties
   pos.url=https://your-deployed-frontend-url
   ```
3. Build and install the APK. Rebuild whenever the deployed frontend URL changes (e.g. a tunnel URL rotates).

## Backups

- **Local**: `docker-compose.prod.yml` runs `postgres-backup-local` on an hourly schedule (`SCHEDULE=@hourly`), writing gzip'd `pg_dump`s into `./backups/{last,daily,weekly,monthly}/` with retention of 7 days / 4 weeks / 6 months, confirmed present on disk.
- **Offsite**: The `backup-uploader` service (`rclone/rclone` image) runs `scripts/rclone-sync.sh`, which waits 5 minutes on startup (to let an in-progress backup finish) then loops hourly, `rclone sync`-ing `./backups` to a Cloudflare R2 bucket (`R2:${R2_BUCKET}/postgres-backups`) using S3-compatible credentials injected via environment variables. Sync failures are logged but don't crash the loop — local backups remain the source of truth and the next hourly attempt retries.
- **Restore**:
  ```bash
  gunzip -c ./backups/daily/plastic_press_db-latest.sql.gz | docker exec -i plastic_press_db psql -U $POSTGRES_USER -d $POSTGRES_DB
  ```

## Architecture Notes

### Voucher balance: recomputed balance vs. frozen per-voucher snapshots

The customer's *current* debt balance (`calculate_customer_balance` in `backend/app/services/balance.py`) is **never stored** — it's recomputed from scratch on every request by summing across *all* of that customer's vouchers (`items_total + extra_charge_amount - discount_amount - paid_amount`) and *all* standalone payments (`amount_paid + discount_amount`). This means the balance shown anywhere in the UI is always accurate as of the moment it's requested.

However, each `Voucher` row also stores three **frozen snapshot fields** — `previous_balance`, `final_total`, and `remaining_balance` — captured at the moment that voucher was created (`create_voucher_service` in `backend/app/services/voucher.py`), representing "what the customer's balance was right before this voucher, and what it became after."

**The gotcha**: these snapshot fields are not recalculated or cascaded when history changes:
- Editing a voucher (`PUT /vouchers/{id}`) recomputes `final_total`/`remaining_balance` from the new item lines, but reuses the voucher's *existing* `previous_balance` as-is — it does not re-derive it from `calculate_customer_balance`.
- Editing or deleting an *earlier* voucher or payment for a customer does **not** touch the `previous_balance`/`final_total`/`remaining_balance` stored on that customer's *later* vouchers. Those later vouchers keep showing the balance snapshot that was true at creation time, which can now be inconsistent with the customer's true (recomputed) current balance.

In practice: the live balance the app displays is always correct, but a printed/historical voucher's "previous balance" / "remaining balance" fields can silently drift out of sync with reality after an earlier record in that customer's history is edited or deleted. Any future work that reconciles or audits historical vouchers against the live balance should account for this rather than assuming the two always agree.

## License

Proprietary — TK Plastic Press. All rights reserved.
