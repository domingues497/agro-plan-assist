import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_pool, ensure_defensivos_schema, ensure_system_config_schema, get_config_map, upsert_config_items
from psycopg2.extras import execute_values
import time
import json
import hmac
import hashlib
import base64
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
from urllib.error import URLError, HTTPError
import threading

app = Flask(__name__)
# Abrir CORS para simplificar chamadas do front; sem credenciais
CORS(app, origins="*", supports_credentials=False)
try:
    ensure_system_config_schema()
    ensure_defensivos_schema()
except Exception:
    pass

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/db/health")
def db_health():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            row = cur.fetchone()
            ok = bool(row and row[0] == 1)
            return jsonify({"status": "ok" if ok else "error"})
    finally:
        pool.putconn(conn)

@app.route("/version")
def version():
    return jsonify({"app": "agro-plan-assist-api", "version": "0.1.0"})

@app.route("/defensivos")
def get_defensivos():
    ensure_defensivos_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cod_item, item, grupo, marca, principio_ativo, saldo, created_at, updated_at
                FROM public.defensivos_catalog
                ORDER BY item NULLS LAST, cod_item
                """
            )
            rows = cur.fetchall()
            cols = [desc[0] for desc in cur.description]
            data = [dict(zip(cols, row)) for row in rows]
            return jsonify({"items": data, "count": len(data)})
    finally:
        pool.putconn(conn)

@app.route("/defensivos/<cod_item>", methods=["PUT"])
def update_defensivo(cod_item: str):
    ensure_defensivos_schema()
    payload = request.get_json(silent=True) or {}
    fields = {k: payload.get(k) for k in ["item", "grupo", "marca", "principio_ativo", "saldo"]}

    set_parts = []
    values = []
    for col, val in fields.items():
        if col in ["item", "grupo", "marca", "principio_ativo", "saldo"]:
            set_parts.append(f"{col} = %s")
            values.append(val)

    if not set_parts:
        return jsonify({"error": "Nenhum campo para atualizar"}), 400

    set_sql = ", ".join(set_parts + ["updated_at = now()"])

    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE public.defensivos_catalog SET {set_sql} WHERE cod_item = %s",
                    values + [cod_item],
                )
        return jsonify({"ok": True, "cod_item": cod_item})
    finally:
        pool.putconn(conn)

@app.route("/config", methods=["GET"])
def list_config():
    ensure_system_config_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT config_key, config_value, description, created_at, updated_at FROM public.system_config ORDER BY config_key")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/config/bulk", methods=["POST"])
def upsert_config_bulk():
    ensure_system_config_schema()
    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        return jsonify({"error": "items vazio"}), 400
    if any(not it.get("config_key") for it in items):
        return jsonify({"error": "config_key obrigatório"}), 400
    upsert_config_items(items)
    return jsonify({"ok": True, "imported": len(items)})
def _b64url(data: bytes) -> bytes:
    return base64.urlsafe_b64encode(data).rstrip(b"=")

def _make_jwt(client_id: str, exp_ts: int, secret: str, audience: str | None = None) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"client_id": client_id, "exp": int(exp_ts)}
    h = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    to_sign = h + b"." + p
    sig = hmac.new(secret.encode("utf-8"), to_sign, hashlib.sha256).digest()
    s = _b64url(sig)
    return (to_sign + b"." + s).decode("utf-8")

@app.route("/defensivos/sync", methods=["GET", "POST", "OPTIONS"])
def sync_defensivos():
    if request.method == "OPTIONS":
        return ("", 204)
    ensure_system_config_schema()
    ensure_defensivos_schema()
    payload = request.get_json(silent=True) or {}
    limpar = bool(payload.get("limparAntes"))
    cfg = get_config_map([
        "api_defensivos_client_id",
        "api_defensivos_secret",
        "api_defensivos_url",
        "api_defensivos_exp",
    ])
    missing = [k for k in ["api_defensivos_client_id","api_defensivos_secret","api_defensivos_url","api_defensivos_exp"] if k not in cfg or not cfg[k]]
    if missing:
        return jsonify({"error": f"Config ausente: {', '.join(missing)}"}), 400
    try:
        url_cfg = (cfg["api_defensivos_url"] or "").strip().strip("`")
        token = _make_jwt(cfg["api_defensivos_client_id"], int(cfg["api_defensivos_exp"]), cfg["api_defensivos_secret"], None)
    except Exception as e:
        return jsonify({"error": f"Falha ao gerar JWT: {e}"}), 400
    url = url_cfg
    req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read()
            data = json.loads(raw.decode("utf-8"))
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({
            "error": "HTTPError",
            "status": e.code,
            "details": body or str(e),
            "url": url
        }), 502
    except URLError as e:
        return jsonify({
            "error": "URLError",
            "details": getattr(e, 'reason', str(e)),
            "url": url
        }), 502
    except Exception as e:
        return jsonify({"error": f"Erro ao ler resposta da API externa: {e}"}), 500

    # Esperamos lista ou objeto com campo items
    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return jsonify({"error": "Resposta da API externa inválida", "url": url, "preview": data}), 500

    def pick(obj, keys):
        for k in keys:
            if k in obj and obj[k] not in (None, ""):
                return obj[k]
        return None

    normalized = []
    ignored = 0
    for d in items:
        # aceitar múltiplas variações de nomes vindas da API externa
        cod_item = pick(d, ["cod_item", "COD_ITEM", "CODITEM", "COD ITEM", "COD. ITEM", "COD"])
        item_val = pick(d, ["item", "ITEM"]) or None
        grupo_val = pick(d, ["grupo", "GRUPO"]) or None
        marca_val = pick(d, ["marca", "MARCA"]) or None
        princ_val = pick(d, ["principio_ativo", "PRINCIPIO_ATIVO", "PRINCIPIO ATIVO"]) or None
        saldo_val = pick(d, ["saldo", "SALDO"]) or None

        if not cod_item:
            ignored += 1
            continue
        normalized.append([cod_item, item_val, grupo_val, marca_val, princ_val, saldo_val])

    valid_rows = normalized
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar:
                    cur.execute("DELETE FROM public.defensivos_catalog")
                if valid_rows:
                    execute_values(
                        cur,
                        """
                        INSERT INTO public.defensivos_catalog (cod_item, item, grupo, marca, principio_ativo, saldo)
                        VALUES %s
                        ON CONFLICT (cod_item) DO UPDATE SET
                          item = EXCLUDED.item,
                          grupo = EXCLUDED.grupo,
                          marca = EXCLUDED.marca,
                          principio_ativo = EXCLUDED.principio_ativo,
                          saldo = EXCLUDED.saldo,
                          updated_at = now()
                        """,
                        valid_rows,
                    )
        return jsonify({"ok": True, "imported": len(valid_rows), "ignored": ignored})
    finally:
        pool.putconn(conn)

@app.route("/defensivos/sync/test", methods=["GET"])
def sync_defensivos_test():
    ensure_system_config_schema()
    cfg = get_config_map(["api_defensivos_url"])
    url = (cfg.get("api_defensivos_url") or "").strip()
    if not url:
        return jsonify({"error": "Config api_defensivos_url ausente"}), 400
    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=15) as resp:
            return jsonify({"status": resp.status, "ok": True})
    except HTTPError as e:
        return jsonify({"error": "HTTPError", "status": e.code}), 502
    except URLError as e:
        return jsonify({"error": "URLError", "details": getattr(e, 'reason', str(e))}), 502

def run_sync_defensivos(limpar: bool = False):
    ensure_system_config_schema()
    ensure_defensivos_schema()
    cfg = get_config_map([
        "api_defensivos_client_id",
        "api_defensivos_secret",
        "api_defensivos_url",
        "api_defensivos_exp",
    ])
    missing = [k for k in ["api_defensivos_client_id","api_defensivos_secret","api_defensivos_url","api_defensivos_exp"] if k not in cfg or not cfg[k]]
    if missing:
        return {"error": f"Config ausente: {', '.join(missing)}", "status": 400}
    try:
        url_cfg = (cfg["api_defensivos_url"] or "").strip().strip("`")
        token = _make_jwt(cfg["api_defensivos_client_id"], int(cfg["api_defensivos_exp"]), cfg["api_defensivos_secret"], None)
    except Exception as e:
        return {"error": f"Falha ao gerar JWT: {e}", "status": 400}
    url = url_cfg
    req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read()
            data = json.loads(raw.decode("utf-8"))
    except Exception as e:
        return {"error": f"Erro ao consultar API externa: {e}", "status": 502}

    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return {"error": "Resposta da API externa inválida", "status": 500, "preview": data}

    def pick(obj, keys):
        for k in keys:
            if k in obj and obj[k] not in (None, ""):
                return obj[k]
        return None

    normalized = []
    ignored = 0
    for d in items:
        cod_item = pick(d, ["cod_item", "COD_ITEM", "CODITEM", "COD ITEM", "COD. ITEM", "COD"])
        item_val = pick(d, ["item", "ITEM"]) or None
        grupo_val = pick(d, ["grupo", "GRUPO"]) or None
        marca_val = pick(d, ["marca", "MARCA"]) or None
        princ_val = pick(d, ["principio_ativo", "PRINCIPIO_ATIVO", "PRINCIPIO ATIVO"]) or None
        saldo_val = pick(d, ["saldo", "SALDO"]) or None
        if not cod_item:
            ignored += 1
            continue
        normalized.append([cod_item, item_val, grupo_val, marca_val, princ_val, saldo_val])

    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar:
                    cur.execute("DELETE FROM public.defensivos_catalog")
                if normalized:
                    execute_values(
                        cur,
                        """
                        INSERT INTO public.defensivos_catalog (cod_item, item, grupo, marca, principio_ativo, saldo)
                        VALUES %s
                        ON CONFLICT (cod_item) DO UPDATE SET
                          item = EXCLUDED.item,
                          grupo = EXCLUDED.grupo,
                          marca = EXCLUDED.marca,
                          principio_ativo = EXCLUDED.principio_ativo,
                          saldo = EXCLUDED.saldo,
                          updated_at = now()
                        """,
                        normalized,
                    )
        return {"ok": True, "imported": len(normalized), "ignored": ignored}
    finally:
        pool.putconn(conn)

def _start_sync_scheduler():
    def loop():
        last_run = 0
        while True:
            try:
                ensure_system_config_schema()
                cfg = get_config_map(["defensivos_sync_enabled", "defensivos_sync_interval_minutes"])
                enabled = str(cfg.get("defensivos_sync_enabled", "")).strip().lower() in ("1", "true", "yes", "on")
                interval = int(str(cfg.get("defensivos_sync_interval_minutes", "30") or "30"))
                if interval < 1:
                    interval = 30
                now_ts = time.time()
                if enabled and now_ts - last_run >= interval * 60:
                    res = run_sync_defensivos(False)
                    print(f"[defensivos-sync] imported={res.get('imported')} ignored={res.get('ignored')}")
                    last_run = now_ts
            except Exception as e:
                print(f"[defensivos-sync] erro: {e}")
            time.sleep(30)
    t = threading.Thread(target=loop, daemon=True)
    t.start()

_start_sync_scheduler()
@app.route("/defensivos", methods=["POST"])
def upsert_defensivo():
    ensure_defensivos_schema()
    payload = request.get_json(silent=True) or {}
    cod_item = payload.get("cod_item")
    if not cod_item:
        return jsonify({"error": "cod_item obrigatório"}), 400
    item = payload.get("item")
    grupo = payload.get("grupo")
    marca = payload.get("marca")
    principio_ativo = payload.get("principio_ativo")
    saldo = payload.get("saldo")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.defensivos_catalog (cod_item, item, grupo, marca, principio_ativo, saldo)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (cod_item) DO UPDATE SET
                      item = EXCLUDED.item,
                      grupo = EXCLUDED.grupo,
                      marca = EXCLUDED.marca,
                      principio_ativo = EXCLUDED.principio_ativo,
                      saldo = EXCLUDED.saldo,
                      updated_at = now()
                    """,
                    [cod_item, item, grupo, marca, principio_ativo, saldo],
                )
                affected = cur.rowcount
        return jsonify({"ok": True, "cod_item": cod_item, "affected": affected})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/defensivos/bulk", methods=["POST"])
def upsert_defensivos_bulk():
    ensure_defensivos_schema()
    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    limpar = bool(payload.get("limparAntes"))
    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"error": "items vazio"}), 400
    rows = []
    for d in items:
        rows.append([
            d.get("cod_item"),
            d.get("item"),
            d.get("grupo"),
            d.get("marca"),
            d.get("principio_ativo"),
            d.get("saldo"),
        ])
    valid_rows = [r for r in rows if r[0]]
    if len(valid_rows) == 0:
        return jsonify({"error": "items sem cod_item válido"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar:
                    cur.execute("DELETE FROM public.defensivos_catalog")
                execute_values(
                    cur,
                    """
                    INSERT INTO public.defensivos_catalog (cod_item, item, grupo, marca, principio_ativo, saldo)
                    VALUES %s
                    ON CONFLICT (cod_item) DO UPDATE SET
                      item = EXCLUDED.item,
                      grupo = EXCLUDED.grupo,
                      marca = EXCLUDED.marca,
                      principio_ativo = EXCLUDED.principio_ativo,
                      saldo = EXCLUDED.saldo,
                      updated_at = now()
                    """,
                    valid_rows,
                )
                imported = cur.rowcount if cur.rowcount is not None else len(valid_rows)
        return jsonify({"ok": True, "imported": imported})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
