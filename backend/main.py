from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .data_access import get_adubacoes, get_cultivares, get_defensivos
from .settings import get_settings

logger = logging.getLogger("agroplan.api")

app = FastAPI(title="AgroPlan API", version="1.0.0")

settings = get_settings()

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]

allow_origins = settings.api_allowed_origins or default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/cultivares")
def api_cultivares(limit: int = Query(50, ge=1, le=500)) -> dict[str, list[dict]]:
    try:
        return {"items": get_cultivares(limit)}
    except Exception as exc:
        logger.exception("Failed to fetch cultivares data")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/adubacoes")
def api_adubacoes(limit: int = Query(50, ge=1, le=500)) -> dict[str, list[dict]]:
    try:
        return {"items": get_adubacoes(limit)}
    except Exception as exc:
        logger.exception("Failed to fetch adubacoes data")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/defensivos")
def api_defensivos(limit: int = Query(50, ge=1, le=500)) -> dict[str, list[dict]]:
    try:
        return {"items": get_defensivos(limit)}
    except Exception as exc:
        logger.exception("Failed to fetch defensivos data")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

