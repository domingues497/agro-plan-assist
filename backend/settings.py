import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable


def _load_env_file(paths: Iterable[Path]) -> None:
    """
    Load simple KEY=VALUE pairs from the first existing file in *paths*.
    Does not override variables that are already present in the environment.
    """
    for env_path in paths:
        if not env_path.exists():
            continue

        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = value.strip().strip('"').strip("'")
        break


@dataclass(frozen=True)
class Settings:
    oracle_user: str
    oracle_password: str
    oracle_dsn: str
    oracle_jar_path: str
    oracle_jar_url: str
    query_cultivares: str
    query_adubacoes: str
    query_defensivos: str
    api_allowed_origins: list[str]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    base_dir = Path(__file__).resolve().parent
    repo_root = base_dir.parent

    _load_env_file(
        (
            base_dir / ".env",
            repo_root / ".env.backend",
        )
    )

    default_dsn = (
        "jdbc:oracle:thin:@(description=(SOURCE_ROUTE=YES)"
        "(ADDRESS=(PROTOCOL=TCP)(HOST=cmancloud.viasoftcloud.com.br)(PORT=1921))"
        "(address=(HOST=viasoft-scan.vms.com.br)(protocol=tcp)(port=1521))"
        "(connect_data=(SERVICE_NAME=ccag)))"
    )

    default_jar_path = "C:/AppCoopagricola/ojdbc8.jar"
    default_jar_url = (
        "https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc8/19.3.0.0/ojdbc8-19.3.0.0.jar"
    )

    sample_cultivares_query = """
        SELECT
            'Soja TMG 7067 IPRO' AS cultivar,
            'Talhao A' AS area,
            850 AS quantidade,
            TO_DATE('2024-10-15', 'YYYY-MM-DD') AS data_plantio,
            '2024/2025' AS safra
        FROM dual
        CONNECT BY LEVEL <= 5
    """

    sample_adubacoes_query = """
        SELECT
            'NPK 10-20-20' AS formulacao,
            'Talhao B' AS area,
            350 AS dose,
            13475 AS total,
            TO_DATE('2024-10-20', 'YYYY-MM-DD') AS data_aplicacao,
            'Joao Silva' AS responsavel
        FROM dual
        CONNECT BY LEVEL <= 5
    """

    sample_defensivos_query = """
        SELECT
            'Inseticida Lambda' AS defensivo,
            'Talhao C' AS area,
            150 AS dose,
            TO_DATE('2024-10-25', 'YYYY-MM-DD') AS data_aplicacao,
            'Mancha-alvo' AS alvo
        FROM dual
        CONNECT BY LEVEL <= 5
    """

    allowed_origins = os.getenv("AGROPLAN_API_ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in allowed_origins.split(",") if origin.strip()]

    return Settings(
        oracle_user=os.getenv("ORACLE_USER", ""),
        oracle_password=os.getenv("ORACLE_PASSWORD", ""),
        oracle_dsn=os.getenv("ORACLE_DSN", default_dsn),
        oracle_jar_path=os.getenv("ORACLE_JAR_PATH", default_jar_path),
        oracle_jar_url=os.getenv("ORACLE_JAR_URL", default_jar_url),
        query_cultivares=os.getenv("AGROPLAN_QUERY_CULTIVARES", sample_cultivares_query.strip()),
        query_adubacoes=os.getenv("AGROPLAN_QUERY_ADUBACOES", sample_adubacoes_query.strip()),
        query_defensivos=os.getenv("AGROPLAN_QUERY_DEFENSIVOS", sample_defensivos_query.strip()),
        api_allowed_origins=origins,
    )
