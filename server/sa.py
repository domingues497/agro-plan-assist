import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

_engine = None
SessionLocal = None
Base = declarative_base()

def get_database_url() -> str:
    dbname = os.environ.get("AGROPLAN_DB_NAME", "agroplan_assist")
    user = os.environ.get("AGROPLAN_DB_USER", "agroplan_user")
    password = os.environ.get("AGROPLAN_DB_PASS", "agroplan_pass")
    host = os.environ.get("AGROPLAN_DB_HOST", "localhost")
    port = os.environ.get("AGROPLAN_DB_PORT", "5432")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}"

def get_engine():
    global _engine, SessionLocal
    if _engine is None:
        url = get_database_url()
        _engine = create_engine(url, pool_pre_ping=True, future=True)
        SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False, future=True)
    return _engine

def get_session():
    get_engine()
    return SessionLocal()
