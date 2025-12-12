from __future__ import annotations
import os
from alembic import context
from sqlalchemy import create_engine

def get_url() -> str:
    from server.db import get_database_url
    return get_database_url()

def run_migrations_offline() -> None:
    url = get_url()
    context.configure(url=url, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    engine = create_engine(get_url())
    with engine.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
