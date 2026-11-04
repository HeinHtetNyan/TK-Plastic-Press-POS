from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import logging
from app.db import init_db
from app.core.limiter import limiter
from app.routes import customers, vouchers, payments, auth, users, analytics, audit, spendings, stock

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment
SHOW_DOCS = os.environ.get("SHOW_DOCS", "false").lower() == "true"
logger.info(f"Swagger documentation enabled: {SHOW_DOCS}")

app = FastAPI(
    title="TK Plastic Press POS API",
    docs_url="/api/docs" if SHOW_DOCS else None,
    redoc_url="/api/redoc" if SHOW_DOCS else None,
    openapi_url="/api/openapi.json" if SHOW_DOCS else None
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware
# Set ALLOWED_ORIGINS in .env as a comma-separated list, e.g.:
#   ALLOWED_ORIGINS=http://localhost:5173,https://yourtunnel.trycloudflare.com
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'"
    )
    return response

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized.")

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(vouchers.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(spendings.router, prefix="/api")
app.include_router(stock.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to Plastic Press POS API"}
