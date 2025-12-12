from __future__ import annotations

import os
import sys

from alembic import context
from sqlalchemy import create_engine

# === Ajuste para achar o pacote "server" ===
# BASE_DIR = /var/www/agro-plan-assist
BASE_DIR = os.path.dirname(os.path.abspath(os.path.join(__file__, "..", "..")))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

def get_url() -> str:
    # Agora o import funciona porque "server" está no sys.path
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
