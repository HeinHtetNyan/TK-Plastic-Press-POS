import os
import time
import logging
from sqlmodel import create_engine, Session, SQLModel
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(DATABASE_URL, echo=True)

def init_db():
    from app import models
    
    max_retries = 5
    retry_delay = 5
    
    for i in range(max_retries):
        try:
            logger.info(f"Attempting to connect to database (attempt {i+1}/{max_retries})...")
            SQLModel.metadata.create_all(engine)
            logger.info("Database connection successful and tables created.")
            break
        except Exception as e:
            if i < max_retries - 1:
                logger.warning(f"Database connection failed: {e}. Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error("Could not connect to the database after several attempts.")
                raise e

def get_session():
    with Session(engine) as session:
        yield session
