from __future__ import annotations

import logging
from typing import Any, Iterable, Sequence

from .oracle_conn import get_connection
from .settings import get_settings

logger = logging.getLogger("agroplan.data")


def _normalize_value(value: Any) -> Any:
    """
    Convert Java types returned by jaydebeapi into serialisable Python values.
    """
    if value is None:
        return None

    value_class = getattr(value, "__class__", None)
    if value_class and "java" in str(value_class):
        # Convert java.sql.Timestamp/Date/etc. to ISO strings
        return str(value)

    return value


def _rows_to_dicts(columns: Sequence[str], rows: Iterable[Sequence[Any]]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for row in rows:
        item = {str(col): _normalize_value(val) for col, val in zip(columns, row)}
        results.append(item)
    return results


def run_query(base_query: str, params: Sequence[Any] | None = None, limit: int = 50) -> list[dict[str, Any]]:
    """
    Execute *base_query* wrapped with a LIMIT (ROWNUM) constraint.

    Parameters:
        base_query: SQL statement without a terminating semicolon.
        params: Sequence of bind parameters for *base_query*.
        limit: Maximum number of records to return.
    """
    limit = max(1, min(int(limit), 500))
    wrapped_query = f"SELECT * FROM ({base_query}) WHERE ROWNUM <= ?"

    parameters: list[Any] = []
    if params:
        parameters.extend(params)
    parameters.append(limit)

    logger.debug("Running query with limit %s", limit)

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(wrapped_query, tuple(parameters))
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        logger.debug("Fetched %s rows.", len(rows))
        return _rows_to_dicts(columns, rows)
    finally:
        cursor.close()
        conn.close()


def get_cultivares(limit: int = 50) -> list[dict[str, Any]]:
    settings = get_settings()
    return run_query(settings.query_cultivares, limit=limit)


def get_adubacoes(limit: int = 50) -> list[dict[str, Any]]:
    settings = get_settings()
    return run_query(settings.query_adubacoes, limit=limit)


def get_defensivos(limit: int = 50) -> list[dict[str, Any]]:
    settings = get_settings()
    return run_query(settings.query_defensivos, limit=limit)

