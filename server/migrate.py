import os
import sys
from alembic.config import Config
from alembic import command
from db import get_database_url

def run_migrations():
    print(">>> Iniciando migrações Alembic (migrate.py)...")
    try:
        url = get_database_url()
        # Directory where migrate.py is located
        base_dir = os.path.dirname(os.path.abspath(__file__))
        script_location = os.path.join(base_dir, "migrations")
        
        print(f"    Script location: {script_location}")
        # Mask password in URL for printing
        safe_url = url
        if "@" in safe_url:
            prefix, suffix = safe_url.split("@", 1)
            if ":" in prefix:
                scheme, auth = prefix.split("://", 1)
                if ":" in auth:
                    user, _ = auth.split(":", 1)
                    safe_url = f"{scheme}://{user}:***@{suffix}"
        print(f"    Database URL: {safe_url}")

        cfg = Config()
        cfg.set_main_option("script_location", script_location)
        cfg.set_main_option("sqlalchemy.url", url)
        
        command.upgrade(cfg, "head")
        print(">>> Migrações Alembic concluídas com sucesso.")
    except Exception as e:
        print(f"!!! Erro ao executar migrações: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
