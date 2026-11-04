![image alt](https://github.com/HeinHtetNyan/TK-Plastic-Press-POS/blob/4fedf02afd4a83e8598ba07a98a7998247747c7d/Screenshot%202026-04-20%20022638.png)
# TK Plastic Press POS System

A modern, professional-grade Point of Sale (POS) system specifically engineered for TK Plastic Press. This full-stack solution features an offline-first architecture with a FastAPI backend, a React 19 frontend, and a native Android integration.

## 🚀 Key Features

- **Offline-First Resilience**: Full capability to create vouchers, manage customers, and process payments without an internet connection. Data is automatically synchronized via a custom sync engine (Dexie.js/IndexedDB) when connectivity is restored.
- **Idempotent Synchronization**: Prevents duplicate records during sync retries using `client_id` UUID tracking.
- **Smart Financial Management**:
  - **FIFO Payment Settlement**: Automatically applies bulk payments to the oldest outstanding vouchers.
  - **Expense Tracking**: Comprehensive logging of business spendings.
  - **Balance Tracking**: Real-time customer balance and debt management.
- **Deep Analytics Dashboard**: Visualizes 30-day sales trends, income by payment method (Cash, Bank Transfer, KBZPay), and top customer performance.
- **Enterprise-Grade Infrastructure**:
  - **Hybrid Deployment**: Frontend on Vercel for high availability; Backend on VPS via Docker.
  - **Automated Backups**: Hourly PostgreSQL dumps with local rotation (7 days/4 weeks/6 months).
  - **Disaster Recovery**: Automatic mirroring of backups to Cloudflare R2 storage using `rclone`.
- **Native Android App**: Custom WebView wrapper with network-aware synchronization, pull-to-refresh, and optimized performance.
- **Audit Logging**: Complete traceability of all system mutations for security and accountability.

## 🛠 Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **ORM**: SQLModel (SQLAlchemy + Pydantic)
- **Database**: PostgreSQL 15
- **Migrations**: Alembic
- **Security**: Passlib (Bcrypt) & python-jose (JWT)
- **Rate Limiting**: SlowAPI

### Frontend
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS 4
- **Storage**: Dexie.js (IndexedDB)
- **Routing**: React Router 7
- **Charts**: Recharts 3
- **Icons**: Lucide React

### Mobile & Infrastructure
- **Android**: Kotlin (API 24+) Native WebView
- **Deployment**: Docker Compose (Production Stack)
- **Hosting**: Vercel (Frontend)
- **Backups**: `postgres-backup-local` + `rclone` (Cloudflare R2)

## 📂 Project Structure

```text
TK-Project/
├── android/              # Native Android App (Kotlin)
│   └── app/src/main/     # WebView logic and network listeners
├── backend/              # FastAPI Application
│   ├── app/              # Core logic (models, routes, schemas, services)
│   └── alembic/          # DB Migration scripts
├── frontend/             # React Application
│   ├── src/              # UI components, sync engine, and hooks
│   ├── public/           # PWA assets and manifest
│   └── vercel.json       # Frontend deployment config
├── scripts/              # Utility scripts (rclone-sync.sh)
├── docker-compose.yml    # Development stack
└── docker-compose.prod.yml # Production stack (API + DB + Backups)
```

## ⚙️ Quick Start

### 1. Environment Setup
Create a `.env` file in the root directory based on `.env.example`:

```bash
cp .env.example .env
```

### 2. Development (Local)
Launch the full stack (Backend + Frontend + DB):
```bash
docker-compose up -d --build
```
- Frontend: `http://localhost:5173`
- API Docs: `http://localhost:8001/api/docs` (if `SHOW_DOCS=true`)

### 3. Production Deployment (VPS)
Deploy the backend infrastructure:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
docker-compose exec backend alembic upgrade head
```

### 4. Android Build
1. Open `android/` in Android Studio.
2. Set your frontend URL in `android/local.properties`:
   ```properties
   pos.url=https://your-app.vercel.app
   ```
3. Build and install the APK.

## 💾 Backup & Recovery

- **Local Storage**: Backups are stored in `./backups/` on the host machine.
- **Cloud Sync**: The `backup-uploader` service syncs `./backups/` to Cloudflare R2 every hour.
- **Restoration**:
  ```bash
  cat ./backups/latest.sql | docker exec -i plastic_press_db psql -U $POSTGRES_USER -d $POSTGRES_DB
  ```

## 📝 License
Proprietary — TK Plastic Press. All rights reserved.
