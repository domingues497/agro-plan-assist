import os
from psycopg2.pool import SimpleConnectionPool
import psycopg2

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        dbname = os.environ.get("AGROPLAN_DB_NAME", "agroplan_assist")
        user = os.environ.get("AGROPLAN_DB_USER", "agroplan_user")
        password = os.environ.get("AGROPLAN_DB_PASS", "agroplan_pass")
        host = os.environ.get("AGROPLAN_DB_HOST", "localhost")
        port = int(os.environ.get("AGROPLAN_DB_PORT", "5432"))
        _pool = SimpleConnectionPool(1, 10, dbname=dbname, user=user, password=password, host=host, port=port)
    return _pool

def ensure_defensivos_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.defensivos_catalog (
                      cod_item TEXT PRIMARY KEY,
                      item TEXT,
                      grupo TEXT,
                      marca TEXT,
                      principio_ativo TEXT,
                      saldo NUMERIC,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_system_config_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.system_config (
                      config_key TEXT PRIMARY KEY,
                      config_value TEXT,
                      description TEXT,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def get_config_map(keys):
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT config_key, config_value
                FROM public.system_config
                WHERE config_key = ANY(%s)
                """,
                (keys,),
            )
            rows = cur.fetchall()
            out = {k: v for k, v in rows}
            return out
    finally:
        pool.putconn(conn)

def upsert_config_items(items):
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                for it in items:
                    cur.execute(
                        """
                        INSERT INTO public.system_config (config_key, config_value, description)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (config_key) DO UPDATE SET
                          config_value = EXCLUDED.config_value,
                          description = EXCLUDED.description,
                          updated_at = now()
                        """,
                        (it.get("config_key"), it.get("config_value"), it.get("description")),
                    )
    finally:
        pool.putconn(conn)
