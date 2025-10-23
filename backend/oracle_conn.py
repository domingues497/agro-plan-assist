from __future__ import annotations

import logging
import os
import urllib.request
from pathlib import Path
from threading import Lock

import jaydebeapi
from jpype import getDefaultJVMPath, isJVMStarted, startJVM

from .settings import get_settings

logger = logging.getLogger("agroplan.oracle")

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s - %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

_jvm_lock = Lock()


def _download_driver_if_needed(jar_path: Path, jar_url: str) -> None:
    if jar_path.exists():
        return

    jar_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading Oracle JDBC driver to %s", jar_path)
    with urllib.request.urlopen(jar_url) as response, open(jar_path, "wb") as target:
        target.write(response.read())
    logger.info("Download completed.")


def _ensure_jvm(jar_path: Path) -> None:
    if isJVMStarted():
        return

    with _jvm_lock:
        if isJVMStarted():
            return

        jvm_path = getDefaultJVMPath()
        classpath = os.path.normpath(str(jar_path))
        logger.info("Starting JVM for Oracle JDBC driver.")
        startJVM(jvm_path, f"-Djava.class.path={classpath}")
        logger.info("JVM started successfully.")


def get_connection(user: str | None = None, password: str | None = None, dsn: str | None = None):
    """
    Return a new jaydebeapi connection using the configured Oracle credentials.
    """
    settings = get_settings()

    jar_path = Path(settings.oracle_jar_path)
    _download_driver_if_needed(jar_path, settings.oracle_jar_url)
    _ensure_jvm(jar_path)

    user_to_use = user or settings.oracle_user
    password_to_use = password or settings.oracle_password
    dsn_to_use = dsn or settings.oracle_dsn

    if not user_to_use or not password_to_use:
        raise RuntimeError(
            "Oracle credentials are not configured. "
            "Set ORACLE_USER and ORACLE_PASSWORD (via environment variables or backend/.env)."
        )

    logger.debug("Creating Oracle connection for user %s", user_to_use)
    conn = jaydebeapi.connect(
        "oracle.jdbc.OracleDriver",
        dsn_to_use,
        [user_to_use, password_to_use],
        str(jar_path),
    )
    conn.jconn.setAutoCommit(False)
    return conn

