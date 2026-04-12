from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.routes import customers, vouchers, payments
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import os

# Configuration from environment
SHOW_DOCS = os.environ.get("SHOW_DOCS", "false").lower() == "true"

app = FastAPI(
    title="TK Plastic Press POS API",
    docs_url="/api/docs" if SHOW_DOCS else None,
    redoc_url="/api/redoc" if SHOW_DOCS else None,
    openapi_url="/api/openapi.json" if SHOW_DOCS else None
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all. You can restrict to ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized.")

app.include_router(customers.router, prefix="/api")
app.include_router(vouchers.router, prefix="/api")
app.include_router(payments.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to Plastic Press POS API"}
