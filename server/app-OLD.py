import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_pool, ensure_defensivos_schema, ensure_system_config_schema, get_config_map, upsert_config_items, ensure_fertilizantes_schema, ensure_safras_schema, ensure_programacao_schema, ensure_consultores_schema, ensure_import_history_schema, ensure_calendario_aplicacoes_schema, ensure_epocas_schema, ensure_justificativas_adubacao_schema, ensure_produtores_schema, ensure_fazendas_schema, ensure_talhoes_schema, ensure_cultivares_catalog_schema, ensure_tratamentos_sementes_schema, ensure_cultivares_tratamentos_schema, ensure_aplicacoes_defensivos_schema, ensure_gestor_consultores_schema, ensure_app_versions_schema, ensure_embalagens_schema
from psycopg2.extras import execute_values
import uuid
import time
import json
import hmac
import hashlib
import base64
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
from urllib.error import URLError, HTTPError
import threading
import json as _json

app = Flask(__name__)
# Abrir CORS para simplificar chamadas do front; sem credenciais
CORS(app, origins="*", supports_credentials=False)

# Compatibilidade: aceitar prefixo '/api' nas rotas sem alterar endpoints
class StripApiPrefixMiddleware:
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "") or ""
        if path == "/api":
            environ["PATH_INFO"] = "/"
        elif path.startswith("/api/"):
            environ["PATH_INFO"] = path[4:]
        return self.app(environ, start_response)

app.wsgi_app = StripApiPrefixMiddleware(app.wsgi_app)
try:
    ensure_system_config_schema()
    ensure_defensivos_schema()
    ensure_aplicacoes_defensivos_schema()
    ensure_fertilizantes_schema()
    ensure_safras_schema()
    ensure_programacao_schema()
    ensure_consultores_schema()
    ensure_import_history_schema()
    ensure_calendario_aplicacoes_schema()
    ensure_epocas_schema()
    ensure_justificativas_adubacao_schema()
    ensure_produtores_schema()
    ensure_fazendas_schema()
    ensure_talhoes_schema()
    ensure_cultivares_catalog_schema()
    ensure_tratamentos_sementes_schema()
    ensure_cultivares_tratamentos_schema()
    ensure_gestor_consultores_schema()
    ensure_app_versions_schema()
    ensure_embalagens_schema()
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


@app.route("/debug/routes")
def debug_routes():
    try:
        routes = [str(r) for r in app.url_map.iter_rules()]
        return jsonify({"routes": routes})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# execução do servidor está no final do arquivo


@app.route("/talhoes/import", methods=["POST"])
def import_talhoes():
    ensure_talhoes_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    limpar_antes = bool(payload.get("limpar_antes")) or bool(payload.get("limparAntes"))
    user_id = payload.get("user_id")
    arquivo_nome = payload.get("arquivo_nome")
    pool = get_pool()
    conn = pool.getconn()
    deleted = 0
    imported = 0
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar_antes:
                    cur.execute("SELECT COUNT(*) FROM public.talhoes")
                    deleted = cur.fetchone()[0] or 0
                    cur.execute("DELETE FROM public.talhoes")
                values = []
                for it in (items or []):
                    fazenda_id = it.get("fazenda_id")
                    nome = it.get("nome")
                    area = it.get("area")
                    arrendado = bool(it.get("arrendado", False))
                    if not fazenda_id or not nome or area is None:
                        continue
                    values.append([str(uuid.uuid4()), fazenda_id, nome, area, arrendado])
                if values:
                    execute_values(
                        cur,
                        """
                        INSERT INTO public.talhoes (id, fazenda_id, nome, area, arrendado)
                        VALUES %s
                        """,
                        values,
                    )
                    imported = len(values)
                cur.execute(
                    """
                    INSERT INTO public.import_history (id, user_id, tabela_nome, registros_importados, registros_deletados, arquivo_nome, limpar_antes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    [f"ih{int(time.time()*1000)}", user_id, "talhoes", imported, deleted, arquivo_nome, limpar_antes]
                )
        return jsonify({"ok": True, "imported": imported, "deleted": deleted})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

## removed misplaced __main__ block (moved to file end)
@app.route("/fazendas", methods=["GET"])
def list_fazendas():
    ensure_fazendas_schema()
    ensure_talhoes_schema()
    numerocm = request.args.get("numerocm")
    numerocm_consultor = request.args.get("numerocm_consultor")
    safra_id = request.args.get("safra_id")
    auth = request.headers.get("Authorization") or ""
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            base = (
                "SELECT f.id, f.numerocm, f.idfazenda, f.nomefazenda, f.numerocm_consultor, f.created_at, f.updated_at, "
                "COALESCE(SUM(t.area), 0) AS area_cultivavel "
                "FROM public.fazendas f "
                "LEFT JOIN public.talhoes t ON t.fazenda_id = f.id "
                + ("AND (t.safras_todas OR EXISTS (SELECT 1 FROM public.talhao_safras ts WHERE ts.talhao_id = t.id AND ts.safra_id = %s))" if safra_id else "")
            )
            params = []
            where = []
            # RLS-like: filtrar por role e associações
            role = None
            user_id = None
            cm_token = None
            if auth.lower().startswith("bearer "):
                try:
                    payload = verify_jwt(auth.split(" ", 1)[1])
                    role = (payload.get("role") or "consultor").lower()
                    user_id = payload.get("user_id")
                    cm_token = payload.get("numerocm_consultor")
                except Exception:
                    role = None
            allowed_numerocm = []
            allowed_fazendas = []
            allowed_consultores = []
            if user_id and role in ("gestor", "consultor"):
                cur.execute("SELECT produtor_numerocm FROM public.user_produtores WHERE user_id = %s", [user_id])
                allowed_numerocm = [r[0] for r in cur.fetchall()]
                cur.execute("SELECT fazenda_id FROM public.user_fazendas WHERE user_id = %s", [user_id])
                allowed_fazendas = [r[0] for r in cur.fetchall()]
                if role == "gestor":
                    cur.execute("SELECT numerocm_consultor FROM public.gestor_consultores WHERE user_id = %s", [user_id])
                    allowed_consultores = [r[0] for r in cur.fetchall()]
            if role == "consultor":
                if allowed_numerocm:
                    where.append("f.numerocm = ANY(%s)")
                    params.append(allowed_numerocm)
                else:
                    cm_val = numerocm_consultor or cm_token
                    if cm_val:
                        where.append("f.numerocm_consultor = %s")
                        params.append(cm_val)
            elif role == "gestor":
                if allowed_numerocm or allowed_fazendas or allowed_consultores:
                    subconds = []
                    if allowed_numerocm:
                        subconds.append("f.numerocm = ANY(%s)")
                        params.append(allowed_numerocm)
                    if allowed_fazendas:
                        subconds.append("f.id = ANY(%s)")
                        params.append(allowed_fazendas)
                    if allowed_consultores:
                        subconds.append("f.numerocm_consultor = ANY(%s)")
                        params.append(allowed_consultores)
                    where.append("(" + " OR ".join(subconds) + ")")
            # Admin: sem restrição
            if numerocm:
                where.append("numerocm = %s")
                params.append(numerocm)
            if numerocm_consultor:
                where.append("numerocm_consultor = %s")
                params.append(numerocm_consultor)
            if safra_id:
                where.append("EXISTS (SELECT 1 FROM public.talhoes t2 WHERE t2.fazenda_id = f.id AND (t2.safras_todas OR EXISTS (SELECT 1 FROM public.talhao_safras ts2 WHERE ts2.talhao_id = t2.id AND ts2.safra_id = %s)))")
                params.append(safra_id)
            sql = base + (" WHERE " + " AND ".join(where) if where else "") + " GROUP BY f.id ORDER BY f.nomefazenda"
            # Se houve safra_id no JOIN, precisa entrar como primeiro parâmetro
            if safra_id:
                cur.execute(sql, [safra_id] + params)
            else:
                cur.execute(sql, params)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/fazendas/bulk", methods=["POST"])
def import_fazendas():
    ensure_fazendas_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True) or {}
    limpar = bool(payload.get("limparAntes")) or bool(payload.get("limpar_antes"))
    items = payload.get("items") or payload.get("data") or payload.get("rows") or []
    user_id = payload.get("user_id")
    arquivo_nome = payload.get("arquivo_nome")
    pool = get_pool()
    conn = pool.getconn()
    deleted = 0
    imported = 0
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar:
                    cur.execute("SELECT COUNT(*) FROM public.fazendas")
                    deleted = cur.fetchone()[0] or 0
                    cur.execute("DELETE FROM public.fazendas")
                values = []
                seen = set()
                for it in (items or []):
                    numerocm = (it.get("numerocm") or "").strip()
                    idfazenda = (it.get("idfazenda") or "").strip()
                    nomefazenda = (it.get("nomefazenda") or "").strip()
                    cm_cons = (it.get("numerocm_consultor") or "").strip()
                    if not numerocm or not idfazenda or not nomefazenda or not cm_cons:
                        continue
                    key = numerocm + "|" + idfazenda
                    if key in seen:
                        continue
                    seen.add(key)
                    values.append([str(uuid.uuid4()), numerocm, idfazenda, nomefazenda, cm_cons])
                if values:
                    execute_values(
                        cur,
                        """
                        INSERT INTO public.fazendas (id, numerocm, idfazenda, nomefazenda, numerocm_consultor)
                        VALUES %s
                        ON CONFLICT (numerocm, idfazenda) DO UPDATE SET
                          nomefazenda = EXCLUDED.nomefazenda,
                          numerocm_consultor = EXCLUDED.numerocm_consultor,
                          updated_at = now()
                        """,
                        values,
                    )
                    imported = len(values)
                cur.execute(
                    """
                    INSERT INTO public.import_history (id, user_id, tabela_nome, registros_importados, registros_deletados, arquivo_nome, limpar_antes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    [f"ih{int(time.time()*1000)}", user_id, "fazendas", imported, deleted, arquivo_nome, limpar]
                )
        return jsonify({"ok": True, "imported": imported, "deleted": deleted})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/fazendas/by_key", methods=["PUT"])
def update_fazenda_by_key():
    ensure_fazendas_schema()
    payload = request.get_json(silent=True) or {}
    numerocm = (payload.get("numerocm") or "").strip()
    idfazenda = (payload.get("idfazenda") or "").strip()
    nomefazenda = payload.get("nomefazenda")
    numerocm_consultor = payload.get("numerocm_consultor")
    if not numerocm or not idfazenda:
        return jsonify({"error": "chave ausente"}), 400
    set_parts = []
    values = []
    for col, val in [("nomefazenda", nomefazenda), ("numerocm_consultor", numerocm_consultor)]:
        if val is not None:
            set_parts.append(f"{col} = %s")
            values.append(val)
    if not set_parts:
        return jsonify({"error": "nenhum campo para atualizar"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE public.fazendas SET {', '.join(set_parts)}, updated_at = now() WHERE numerocm = %s AND idfazenda = %s",
                    values + [numerocm, idfazenda]
                )
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/fazendas/by_key", methods=["DELETE"])
def delete_fazenda_by_key():
    ensure_fazendas_schema()
    payload = request.get_json(silent=True) or {}
    numerocm = (payload.get("numerocm") or request.args.get("numerocm") or "").strip()
    idfazenda = (payload.get("idfazenda") or request.args.get("idfazenda") or "").strip()
    if not numerocm or not idfazenda:
        return jsonify({"error": "chave ausente"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM public.fazendas WHERE numerocm = %s AND idfazenda = %s",
                    [numerocm, idfazenda]
                )
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/justificativas_adubacao", methods=["GET"])
def list_justificativas():
    ensure_justificativas_adubacao_schema()
    only_ativas = str(request.args.get("ativas", "")).strip().lower() in ("1", "true", "yes", "on")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            if only_ativas:
                cur.execute("SELECT id, descricao, ativo, created_at, updated_at FROM public.justificativas_adubacao WHERE ativo = true ORDER BY descricao")
            else:
                cur.execute("SELECT id, descricao, ativo, created_at, updated_at FROM public.justificativas_adubacao ORDER BY descricao")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/justificativas_adubacao", methods=["POST"])
def create_justificativa():
    ensure_justificativas_adubacao_schema()
    payload = request.get_json(silent=True) or {}
    id_val = str(uuid.uuid4())
    descricao = payload.get("descricao")
    ativo = bool(payload.get("ativo", True))
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.justificativas_adubacao (id, descricao, ativo)
                    VALUES (%s, %s, %s)
                    """,
                    [id_val, descricao, ativo]
                )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/justificativas_adubacao/<id>", methods=["PUT"])
def update_justificativa(id: str):
    ensure_justificativas_adubacao_schema()
    payload = request.get_json(silent=True) or {}
    descricao = payload.get("descricao")
    ativo = payload.get("ativo")
    set_parts = []
    values = []
    for col, val in [("descricao", descricao), ("ativo", ativo)]:
        if val is not None:
            set_parts.append(f"{col} = %s")
            values.append(val)
    if not set_parts:
        return jsonify({"error": "nenhum campo para atualizar"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE public.justificativas_adubacao SET {', '.join(set_parts)}, updated_at = now() WHERE id = %s",
                    values + [id]
                )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/justificativas_adubacao/<id>", methods=["DELETE"])
def delete_justificativa(id: str):
    ensure_justificativas_adubacao_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.justificativas_adubacao WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/produtores", methods=["GET"])
def list_produtores():
    ensure_produtores_schema()
    numerocm_consultor = request.args.get("numerocm_consultor")
    auth = request.headers.get("Authorization") or ""
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            base = (
                "SELECT id, numerocm, nome, numerocm_consultor, consultor, "
                "tipocooperado, assistencia, compra_insumos, entrega_producao, entrega_producao_destino, paga_assistencia, observacao_flags, cod_empresa, "
                "created_at, updated_at FROM public.produtores"
            )
            params = []
            where = []
            role = None
            user_id = None
            cm_token = None
            if auth.lower().startswith("bearer "):
                try:
                    payload = verify_jwt(auth.split(" ", 1)[1])
                    role = (payload.get("role") or "consultor").lower()
                    user_id = payload.get("user_id")
                    cm_token = payload.get("numerocm_consultor")
                except Exception:
                    role = None
            allowed_numerocm = []
            allowed_consultores = []
            if user_id and role in ("gestor", "consultor"):
                cur.execute("SELECT produtor_numerocm FROM public.user_produtores WHERE user_id = %s", [user_id])
                allowed_numerocm = [r[0] for r in cur.fetchall()]
                if role == "gestor":
                    cur.execute("SELECT numerocm_consultor FROM public.gestor_consultores WHERE user_id = %s", [user_id])
                    allowed_consultores = [r[0] for r in cur.fetchall()]
            if role == "consultor":
                if allowed_numerocm:
                    where.append("numerocm = ANY(%s)")
                    params.append(allowed_numerocm)
                else:
                    # fallback: permitir que o consultor veja produtores do seu próprio CM
                    cm_val = numerocm_consultor or cm_token
                    if cm_val:
                        where.append("numerocm_consultor = %s")
                        params.append(cm_val)
                    else:
                        where.append("1=0")
            elif role == "gestor":
                if allowed_numerocm or allowed_consultores:
                    subconds = []
                    if allowed_numerocm:
                        subconds.append("numerocm = ANY(%s)")
                        params.append(allowed_numerocm)
                    if allowed_consultores:
                        subconds.append("numerocm_consultor = ANY(%s)")
                        params.append(allowed_consultores)
                    where.append("(" + " OR ".join(subconds) + ")")
            # Admin: sem restrição
            if numerocm_consultor:
                where.append("numerocm_consultor = %s")
                params.append(numerocm_consultor)
            sql = base + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY nome"
            cur.execute(sql, params)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/produtores/bulk", methods=["POST"])
def import_produtores():
    ensure_produtores_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True) or {}
    limpar = bool(payload.get("limparAntes")) or bool(payload.get("limpar_antes"))
    items = payload.get("items") or payload.get("data") or payload.get("rows") or []
    user_id = payload.get("user_id")
    arquivo_nome = payload.get("arquivo_nome")
    pool = get_pool()
    conn = pool.getconn()
    deleted = 0
    imported = 0
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar:
                    cur.execute("SELECT COUNT(*) FROM public.produtores")
                    deleted = cur.fetchone()[0] or 0
                    cur.execute("DELETE FROM public.produtores")
                values = []
                seen = set()
                for it in (items or []):
                    numerocm = (it.get("numerocm") or "").strip()
                    nome = (it.get("nome") or "").strip()
                    cm_cons = (it.get("numerocm_consultor") or "").strip()
                    consultor = it.get("consultor")
                    if not numerocm or not nome or not cm_cons:
                        continue
                    if numerocm in seen:
                        continue
                    seen.add(numerocm)
                    values.append([str(uuid.uuid4()), numerocm, nome, cm_cons, consultor])
                if values:
                    execute_values(
                        cur,
                        """
                        INSERT INTO public.produtores (id, numerocm, nome, numerocm_consultor, consultor)
                        VALUES %s
                        ON CONFLICT (numerocm) DO UPDATE SET
                          nome = EXCLUDED.nome,
                          numerocm_consultor = EXCLUDED.numerocm_consultor,
                          consultor = EXCLUDED.consultor,
                          updated_at = now()
                        """,
                        values,
                    )
                    imported = len(values)
                cur.execute(
                    """
                    INSERT INTO public.import_history (id, user_id, tabela_nome, registros_importados, registros_deletados, arquivo_nome, limpar_antes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    [f"ih{int(time.time()*1000)}", user_id, "produtores", imported, deleted, arquivo_nome, limpar]
                )
        return jsonify({"ok": True, "imported": imported, "deleted": deleted})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/produtores/<id>", methods=["DELETE"])
def delete_produtor(id: str):
    ensure_produtores_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.produtores WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/epocas", methods=["GET"])
def list_epocas():
    ensure_epocas_schema()
    only_ativas = str(request.args.get("ativas", "")).strip().lower() in ("1", "true", "yes", "on")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            if only_ativas:
                cur.execute("SELECT id, nome, descricao, ativa, created_at, updated_at FROM public.epocas WHERE ativa = true ORDER BY nome")
            else:
                cur.execute("SELECT id, nome, descricao, ativa, created_at, updated_at FROM public.epocas ORDER BY nome")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/epocas", methods=["POST"])
def create_epoca():
    ensure_epocas_schema()
    payload = request.get_json(silent=True) or {}
    id_val = str(uuid.uuid4())
    nome = payload.get("nome")
    descricao = payload.get("descricao")
    ativa = bool(payload.get("ativa", True))
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.epocas (id, nome, descricao, ativa)
                    VALUES (%s, %s, %s, %s)
                    """,
                    [id_val, nome, descricao, ativa]
                )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/epocas/<id>", methods=["PUT"])
def update_epoca(id: str):
    ensure_epocas_schema()
    payload = request.get_json(silent=True) or {}
    nome = payload.get("nome")
    descricao = payload.get("descricao")
    ativa = payload.get("ativa")
    set_parts = []
    values = []
    for col, val in [("nome", nome), ("descricao", descricao), ("ativa", ativa)]:
        if val is not None:
            set_parts.append(f"{col} = %s")
            values.append(val)
    if not set_parts:
        return jsonify({"error": "nenhum campo para atualizar"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE public.epocas SET {', '.join(set_parts)}, updated_at = now() WHERE id = %s",
                    values + [id]
                )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/epocas/<id>", methods=["DELETE"])
def delete_epoca(id: str):
    ensure_epocas_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.epocas WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/calendario_aplicacoes", methods=["GET"])
def list_calendario_aplicacoes():
    ensure_calendario_aplicacoes_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, cod_aplic, descr_aplicacao, cod_aplic_ger, cod_classe, descricao_classe, trat_sementes, created_at, updated_at
                FROM public.calendario_aplicacoes
                ORDER BY descricao_classe ASC
                """
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/calendario_aplicacoes/<id>", methods=["PUT"])
def update_calendario_aplicacao(id: str):
    ensure_calendario_aplicacoes_schema()
    payload = request.get_json(silent=True) or {}
    descr_aplicacao = payload.get("descr_aplicacao")
    cod_classe = payload.get("cod_classe")
    descricao_classe = payload.get("descricao_classe")
    trat_sementes = payload.get("trat_sementes")
    cod_aplic_ger = payload.get("cod_aplic_ger")
    set_parts = []
    values = []
    for col, val in [
        ("descr_aplicacao", descr_aplicacao),
        ("cod_classe", cod_classe),
        ("descricao_classe", descricao_classe),
        ("trat_sementes", trat_sementes),
        ("cod_aplic_ger", cod_aplic_ger),
    ]:
        if val is not None:
            set_parts.append(f"{col} = %s")
            values.append(val)
    if not set_parts:
        return jsonify({"error": "nenhum campo para atualizar"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE public.calendario_aplicacoes SET {', '.join(set_parts)}, updated_at = now() WHERE id = %s",
                    values + [id]
                )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/calendario_aplicacoes/<id>", methods=["DELETE"])
def delete_calendario_aplicacao(id: str):
    ensure_calendario_aplicacoes_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.calendario_aplicacoes WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/calendario_aplicacoes/import", methods=["POST"])
def import_calendario_aplicacoes():
    ensure_calendario_aplicacoes_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True) or {}
    limpar_antes = bool(payload.get("limpar_antes") or payload.get("limparAntes"))
    items = payload.get("items") or []
    user_id = payload.get("user_id")
    arquivo_nome = payload.get("arquivo_nome")
    pool = get_pool()
    conn = pool.getconn()
    deleted_count = 0
    imported_count = 0
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar_antes:
                    cur.execute("SELECT COUNT(*) FROM public.calendario_aplicacoes")
                    deleted_count = cur.fetchone()[0] or 0
                    cur.execute("DELETE FROM public.calendario_aplicacoes")
                for it in items:
                    cur.execute(
                        """
                        INSERT INTO public.calendario_aplicacoes (id, cod_aplic, descr_aplicacao, cod_aplic_ger, cod_classe, descricao_classe, trat_sementes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (cod_aplic) DO UPDATE SET
                          descr_aplicacao = EXCLUDED.descr_aplicacao,
                          cod_aplic_ger = EXCLUDED.cod_aplic_ger,
                          cod_classe = EXCLUDED.cod_classe,
                          descricao_classe = EXCLUDED.descricao_classe,
                          trat_sementes = EXCLUDED.trat_sementes,
                          updated_at = now()
                        """,
                        [str(uuid.uuid4()), str(it.get("cod_aplic") or "").strip(), it.get("descr_aplicacao"), it.get("cod_aplic_ger"), it.get("cod_classe"), it.get("descricao_classe"), it.get("trat_sementes")]
                    )
                    imported_count += 1
                cur.execute(
                    """
                    INSERT INTO public.import_history (id, user_id, tabela_nome, registros_importados, registros_deletados, arquivo_nome, limpar_antes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    [f"ih{int(time.time()*1000)}", user_id, "calendario_aplicacoes", imported_count, deleted_count, arquivo_nome, limpar_antes]
                )
        return jsonify({"imported": imported_count, "deleted": deleted_count})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/version")
def version():
    return jsonify({"app": "agro-plan-assist-api", "version": "0.1.0"})

@app.route("/import_history", methods=["GET"])
def list_import_history():
    ensure_import_history_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, user_id, tabela_nome, registros_importados, registros_deletados, arquivo_nome, limpar_antes, created_at
                FROM public.import_history
                ORDER BY created_at DESC
                LIMIT 100
                """
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/consultores", methods=["GET"])
def list_consultores():
    ensure_consultores_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, numerocm_consultor, consultor, email, pode_editar_programacao, created_at, updated_at FROM public.consultores ORDER BY consultor ASC")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/consultores", methods=["POST"])
def create_consultor():
    ensure_consultores_schema()
    payload = request.get_json(silent=True) or {}
    id_val = str(uuid.uuid4())
    numerocm_consultor = payload.get("numerocm_consultor")
    consultor = payload.get("consultor")
    email = (payload.get("email") or "").strip().lower()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.consultores (id, numerocm_consultor, consultor, email)
                    VALUES (%s, %s, %s, %s)
                    """,
                    [id_val, numerocm_consultor, consultor, email]
                )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/consultores/<id>", methods=["PUT"])
def update_consultor(id: str):
    ensure_consultores_schema()
    payload = request.get_json(silent=True) or {}
    consultor = payload.get("consultor")
    email = payload.get("email")
    numerocm_consultor = payload.get("numerocm_consultor")
    pode_editar_programacao = payload.get("pode_editar_programacao")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                set_parts = []
                values = []
                if consultor is not None:
                    set_parts.append("consultor = %s")
                    values.append(consultor)
                if email is not None:
                    set_parts.append("email = %s")
                    values.append((email or "").strip().lower())
                if numerocm_consultor is not None:
                    set_parts.append("numerocm_consultor = %s")
                    values.append(numerocm_consultor)
                if pode_editar_programacao is not None:
                    set_parts.append("pode_editar_programacao = %s")
                    values.append(bool(pode_editar_programacao))
                set_parts.append("updated_at = now()")
                cur.execute(
                    f"UPDATE public.consultores SET {', '.join(set_parts)} WHERE id = %s",
                    values + [id]
                )
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/consultores/<id>", methods=["DELETE"])
def delete_consultor(id: str):
    ensure_consultores_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.consultores WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/consultores/by_email", methods=["GET"])
def get_consultor_by_email():
    ensure_consultores_schema()
    email = (request.args.get("email") or "").strip().lower()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, numerocm_consultor, consultor, email FROM public.consultores WHERE lower(btrim(email)) = %s", [email])
            row = cur.fetchone()
            if not row:
                return jsonify({"item": None})
            cols = [d[0] for d in cur.description]
            item = dict(zip(cols, row))
            return jsonify({"item": item})
    finally:
        pool.putconn(conn)

@app.route("/consultores/import", methods=["POST"])
def import_consultores():
    ensure_consultores_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True) or {}
    limpar_antes = bool(payload.get("limpar_antes"))
    items = payload.get("items") or []
    user_id = payload.get("user_id")
    arquivo_nome = payload.get("arquivo_nome")
    pool = get_pool()
    conn = pool.getconn()
    deleted_count = 0
    imported_count = 0
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar_antes:
                    cur.execute("SELECT COUNT(*) FROM public.consultores")
                    deleted_count = cur.fetchone()[0] or 0
                    cur.execute("DELETE FROM public.consultores")
                for it in items:
                    cur.execute(
                        """
                        INSERT INTO public.consultores (id, numerocm_consultor, consultor, email)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (email) DO UPDATE SET
                          numerocm_consultor = EXCLUDED.numerocm_consultor,
                          consultor = EXCLUDED.consultor,
                          updated_at = now()
                        """,
                        [str(uuid.uuid4()), it.get("numerocm_consultor"), it.get("consultor"), (it.get("email") or "").lower()]
                    )
                    imported_count += 1
                cur.execute(
                    """
                    INSERT INTO public.import_history (id, user_id, tabela_nome, registros_importados, registros_deletados, arquivo_nome, limpar_antes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    [f"ih{int(time.time()*1000)}", user_id, "consultores", imported_count, deleted_count, arquivo_nome, limpar_antes]
                )
        return jsonify({"imported": imported_count, "deleted": deleted_count})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacoes", methods=["GET"])
def list_programacoes():
    ensure_programacao_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            base = (
                "SELECT p.id, p.user_id, p.produtor_numerocm, p.fazenda_idfazenda, p.area, p.area_hectares, p.safra_id, p.created_at, p.updated_at "
                "FROM public.programacoes p"
            )
            auth = request.headers.get("Authorization") or ""
            role = None
            user_id = None
            cm_token = None
            where = []
            params = []
            if auth.lower().startswith("bearer "):
                try:
                    payload = verify_jwt(auth.split(" ", 1)[1])
                    role = (payload.get("role") or "consultor").lower()
                    user_id = payload.get("user_id")
                    cm_token = payload.get("numerocm_consultor")
                except Exception:
                    role = None
            if user_id and role in ("gestor", "consultor"):
                cur.execute("SELECT produtor_numerocm FROM public.user_produtores WHERE user_id = %s", [user_id])
                allowed_numerocm = [r[0] for r in cur.fetchall()]
                cur.execute("SELECT fazenda_id FROM public.user_fazendas WHERE user_id = %s", [user_id])
                allowed_fazendas = [r[0] for r in cur.fetchall()]
                if role == "consultor":
                    if allowed_numerocm:
                        where.append("p.produtor_numerocm = ANY(%s)")
                        params.append(allowed_numerocm)
                    if cm_token:
                        where.append("(EXISTS (SELECT 1 FROM public.programacao_cultivares pc WHERE pc.programacao_id = p.id AND pc.numerocm_consultor = %s) OR EXISTS (SELECT 1 FROM public.programacao_adubacao pa WHERE pa.programacao_id = p.id AND pa.numerocm_consultor = %s))")
                        params.append(cm_token)
                        params.append(cm_token)
                    else:
                        where.append("1=0")
                else:
                    subconds = []
                    if allowed_numerocm:
                        subconds.append("p.produtor_numerocm = ANY(%s)")
                        params.append(allowed_numerocm)
                    if allowed_fazendas:
                        subconds.append("p.fazenda_idfazenda = ANY(%s)")
                        params.append(allowed_fazendas)
                    if subconds:
                        where.append("(" + " OR ".join(subconds) + ")")
            sql = base + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY p.created_at DESC"
            cur.execute(sql, params)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            data = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": data, "count": len(data)})
    finally:
        pool.putconn(conn)

@app.route("/programacoes", methods=["POST"])
def create_programacao():
    ensure_programacao_schema()
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    produtor_numerocm = payload.get("produtor_numerocm")
    fazenda_idfazenda = payload.get("fazenda_idfazenda")
    area = payload.get("area")
    area_hectares = payload.get("area_hectares")
    safra_id = payload.get("safra_id")
    epoca_id = payload.get("epoca_id")
    talhao_ids = payload.get("talhao_ids") or []
    cultivares = payload.get("cultivares") or []
    adubacao = payload.get("adubacao") or []
    auth = request.headers.get("Authorization") or ""
    cm_token = None
    if auth.lower().startswith("bearer "):
        try:
            payload_jwt = verify_jwt(auth.split(" ", 1)[1])
            cm_token = payload_jwt.get("numerocm_consultor")
        except Exception:
            pass
    if not (produtor_numerocm and fazenda_idfazenda and area):
        return jsonify({"error": "Campos obrigatórios ausentes"}), 400
    prog_id = str(int(time.time() * 1000))
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cm_cons = cm_token
                if not cm_cons:
                    try:
                        cur.execute("SELECT numerocm_consultor FROM public.fazendas WHERE idfazenda = %s AND numerocm = %s", [fazenda_idfazenda, produtor_numerocm])
                        r = cur.fetchone()
                        cm_cons = r[0] if r else None
                    except Exception:
                        cm_cons = None
                if safra_id and talhao_ids:
                    cur.execute(
                        """
                        SELECT pt.talhao_id, t.nome
                        FROM public.programacoes p
                        JOIN public.programacao_talhoes pt ON pt.programacao_id = p.id
                        LEFT JOIN public.talhoes t ON t.id = pt.talhao_id
                        WHERE p.safra_id = %s AND p.fazenda_idfazenda = %s AND pt.talhao_id = ANY(%s)
                        """,
                        [safra_id, fazenda_idfazenda, talhao_ids],
                    )
                    rows_conf = cur.fetchall()
                    if rows_conf:
                        return jsonify({
                            "error": "talhao já possui programação nesta safra",
                            "talhoes": [r[0] for r in rows_conf],
                            "talhoes_nomes": [r[1] for r in rows_conf if r[1] is not None]
                        }), 400
                cur.execute(
                    """
                    INSERT INTO public.programacoes (id, user_id, produtor_numerocm, fazenda_idfazenda, area, area_hectares, safra_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    [prog_id, user_id, produtor_numerocm, fazenda_idfazenda, area, area_hectares, safra_id]
                )
                for item in cultivares:
                    cult_id = item.get("id") or f"c{int(time.time()*1000)}"
                    tr_ids = item.get("tratamento_ids") or ([item.get("tratamento_id")] if item.get("tratamento_id") else [])
                    first_tr = None if str(item.get("tipo_tratamento")).upper() == "NÃO" else (tr_ids[0] if tr_ids else None)
                    cur.execute(
                        """
                        INSERT INTO public.programacao_cultivares (
                          id, programacao_id, user_id, produtor_numerocm, area, area_hectares, numerocm_consultor, cultivar, quantidade, unidade,
                          percentual_cobertura, tipo_embalagem, tipo_tratamento, tratamento_id, data_plantio, populacao_recomendada,
                          semente_propria, referencia_rnc_mapa, sementes_por_saca, safra, epoca_id, porcentagem_salva
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [cult_id, prog_id, user_id, produtor_numerocm, area, area_hectares, cm_cons, item.get("cultivar"), 0, "kg",
                         item.get("percentual_cobertura"), item.get("tipo_embalagem"), item.get("tipo_tratamento"), first_tr,
                         item.get("data_plantio"), item.get("populacao_recomendada") or 0, bool(item.get("semente_propria")),
                         item.get("referencia_rnc_mapa"), item.get("sementes_por_saca") or 0, safra_id, epoca_id, 0]
                    )
                    for tid in (tr_ids or []):
                        if not tid: continue
                        cur.execute(
                            """
                            INSERT INTO public.programacao_cultivares_tratamentos (id, programacao_cultivar_id, tratamento_id)
                            VALUES (%s, %s, %s)
                            """,
                            [f"t{int(time.time()*1000)}", cult_id, tid]
                        )
                    if str(item.get("tipo_tratamento")).upper() == "NA FAZENDA":
                        for d in (item.get("defensivos_fazenda") or []):
                            cur.execute(
                                """
                                INSERT INTO public.programacao_cultivares_defensivos
                                (id, programacao_cultivar_id, classe, aplicacao, defensivo, dose, cobertura, total, produto_salvo)
                                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                                """,
                                [f"d{int(time.time()*1000)}", cult_id, d.get("classe"), d.get("aplicacao"), d.get("defensivo"),
                                 d.get("dose"), d.get("cobertura"), d.get("total"), bool(d.get("produto_salvo"))]
                            )
                for a in adubacao:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_adubacao (
                          id, programacao_id, user_id, produtor_numerocm, area, numerocm_consultor, formulacao, dose, percentual_cobertura,
                          data_aplicacao, embalagem, justificativa_nao_adubacao_id, fertilizante_salvo, deve_faturar,
                          porcentagem_salva, total, safra_id
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [f"a{int(time.time()*1000)}", prog_id, user_id, produtor_numerocm, area, cm_cons, a.get("formulacao"), a.get("dose"), a.get("percentual_cobertura"),
                         a.get("data_aplicacao"), a.get("embalagem"), a.get("justificativa_nao_adubacao_id"), bool(a.get("fertilizante_salvo")),
                         bool(a.get("deve_faturar", True)), float(a.get("porcentagem_salva") or 0), None, safra_id]
                    )
                for tid in talhao_ids:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_talhoes (id, programacao_id, talhao_id, safra_id, fazenda_idfazenda)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        [f"pt{int(time.time()*1000)}", prog_id, tid, safra_id, fazenda_idfazenda]
                    )
        return jsonify({"id": prog_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacoes/<id>", methods=["DELETE"])
def delete_programacao(id: str):
    ensure_programacao_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT produtor_numerocm, area, safra_id FROM public.programacoes WHERE id = %s", [id])
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "programacao nao encontrada"}), 404
                produtor_numerocm, area, safra_id = row[0], row[1], row[2]
                if safra_id and area:
                    cur.execute(
                        """
                        SELECT COUNT(*)
                        FROM public.programacao_defensivos pd
                        JOIN public.aplicacoes_defensivos ad ON ad.id = pd.aplicacao_id
                        WHERE ad.area = %s AND pd.safra_id = %s
                        """,
                        [area, safra_id],
                    )
                    cnt = (cur.fetchone() or [0])[0] or 0
                    if cnt > 0:
                        cur.execute(
                            """
                            SELECT t.nome
                            FROM public.programacao_talhoes pt
                            LEFT JOIN public.talhoes t ON t.id = pt.talhao_id
                            WHERE pt.programacao_id = %s
                            """,
                            [id],
                        )
                        talhoes_nomes = [r[0] for r in cur.fetchall() if r and r[0]]
                        return jsonify({
                            "error": "programacao_defensivos_existente",
                            "message": "Não é possível excluir: existem defensivos cadastrados para esta fazenda/safra",
                            "talhoes_nomes": talhoes_nomes,
                            "count": cnt,
                        }), 400
                cur.execute("DELETE FROM public.programacoes WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacoes/<id>/children", methods=["GET"])
def get_programacao_children(id: str):
    ensure_programacao_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT talhao_id FROM public.programacao_talhoes WHERE programacao_id = %s", [id])
            talhoes = [r[0] for r in cur.fetchall()]
            cur.execute("SELECT * FROM public.programacao_cultivares WHERE programacao_id = %s", [id])
            cols = [d[0] for d in cur.description]
            cults = [dict(zip(cols, r)) for r in cur.fetchall()]
            cur.execute("SELECT programacao_cultivar_id, tratamento_id FROM public.programacao_cultivares_tratamentos WHERE programacao_cultivar_id IN (SELECT id FROM public.programacao_cultivares WHERE programacao_id = %s)", [id])
            trat_rows = cur.fetchall()
            tratamentos = {}
            for pcid, tid in trat_rows:
                tratamentos.setdefault(pcid, []).append(tid)
            cur.execute("SELECT * FROM public.programacao_cultivares_defensivos WHERE programacao_cultivar_id IN (SELECT id FROM public.programacao_cultivares WHERE programacao_id = %s)", [id])
            def_cols = [d[0] for d in cur.description]
            def_rows = cur.fetchall()
            defensivos = [dict(zip(def_cols, r)) for r in def_rows] if def_rows else []
            cur.execute("SELECT * FROM public.programacao_adubacao WHERE programacao_id = %s", [id])
            ad_cols = [d[0] for d in cur.description]
            ad_rows = cur.fetchall()
            adubacao = [dict(zip(ad_cols, r)) for r in ad_rows] if ad_rows else []
            return jsonify({"talhoes": talhoes, "cultivares": cults, "tratamentos": tratamentos, "defensivos": defensivos, "adubacao": adubacao})
    finally:
        pool.putconn(conn)

@app.route("/programacoes/<id>", methods=["PUT"])
def update_programacao(id: str):
    ensure_programacao_schema()
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    produtor_numerocm = payload.get("produtor_numerocm")
    fazenda_idfazenda = payload.get("fazenda_idfazenda")
    area = payload.get("area")
    area_hectares = payload.get("area_hectares")
    safra_id = payload.get("safra_id")
    epoca_id = payload.get("epoca_id")
    talhao_ids = payload.get("talhao_ids") or []
    cultivares = payload.get("cultivares") or []
    adubacao = payload.get("adubacao") or []
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                if safra_id and talhao_ids:
                    cur.execute(
                        """
                        SELECT pt.talhao_id, t.nome
                        FROM public.programacoes p
                        JOIN public.programacao_talhoes pt ON pt.programacao_id = p.id
                        LEFT JOIN public.talhoes t ON t.id = pt.talhao_id
                        WHERE p.safra_id = %s AND p.fazenda_idfazenda = %s AND pt.talhao_id = ANY(%s) AND p.id <> %s
                        """,
                        [safra_id, fazenda_idfazenda, talhao_ids, id],
                    )
                    rows_conf = cur.fetchall()
                    if rows_conf:
                        return jsonify({
                            "error": "talhao já possui programação nesta safra",
                            "talhoes": [r[0] for r in rows_conf],
                            "talhoes_nomes": [r[1] for r in rows_conf if r[1] is not None]
                        }), 400
                cur.execute(
                    """
                    UPDATE public.programacoes
                    SET user_id = %s, produtor_numerocm = %s, fazenda_idfazenda = %s, area = %s, area_hectares = %s, safra_id = %s, updated_at = now()
                    WHERE id = %s
                    """,
                    [user_id, produtor_numerocm, fazenda_idfazenda, area, area_hectares, safra_id, id]
                )
                cur.execute("DELETE FROM public.programacao_cultivares WHERE programacao_id = %s", [id])
                cur.execute("DELETE FROM public.programacao_talhoes WHERE programacao_id = %s", [id])
                cur.execute("DELETE FROM public.programacao_adubacao WHERE programacao_id = %s", [id])
                for item in cultivares:
                    cult_id = item.get("id") or f"c{int(time.time()*1000)}"
                    tr_ids = item.get("tratamento_ids") or ([item.get("tratamento_id")] if item.get("tratamento_id") else [])
                    first_tr = None if str(item.get("tipo_tratamento") or "").upper() == "NÃO" else (tr_ids[0] if tr_ids else None)
                    cur.execute(
                        """
                        INSERT INTO public.programacao_cultivares (
                          id, programacao_id, user_id, produtor_numerocm, area, area_hectares, cultivar, quantidade, unidade,
                          percentual_cobertura, tipo_embalagem, tipo_tratamento, tratamento_id, data_plantio, populacao_recomendada,
                          semente_propria, referencia_rnc_mapa, sementes_por_saca, safra, epoca_id, porcentagem_salva
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [cult_id, id, user_id, produtor_numerocm, area, area_hectares, item.get("cultivar"), 0, "kg",
                         item.get("percentual_cobertura"), item.get("tipo_embalagem"), item.get("tipo_tratamento"), first_tr,
                         item.get("data_plantio"), item.get("populacao_recomendada") or 0, bool(item.get("semente_propria")),
                         item.get("referencia_rnc_mapa"), item.get("sementes_por_saca") or 0, safra_id, epoca_id, 0]
                    )
                    for tid in (tr_ids or []):
                        if not tid: continue
                        cur.execute(
                            """
                            INSERT INTO public.programacao_cultivares_tratamentos (id, programacao_cultivar_id, tratamento_id)
                            VALUES (%s, %s, %s)
                            """,
                            [f"t{int(time.time()*1000)}", cult_id, tid]
                        )
                    if str(item.get("tipo_tratamento") or "").upper() == "NA FAZENDA":
                        for d in (item.get("defensivos_fazenda") or []):
                            cur.execute(
                                """
                                INSERT INTO public.programacao_cultivares_defensivos
                                (id, programacao_cultivar_id, classe, aplicacao, defensivo, dose, cobertura, total, produto_salvo)
                                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                                """,
                                [f"d{int(time.time()*1000)}", cult_id, d.get("classe"), d.get("aplicacao"), d.get("defensivo"),
                                 d.get("dose"), d.get("cobertura"), d.get("total"), bool(d.get("produto_salvo"))]
                            )
                for a in adubacao:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_adubacao (
                          id, programacao_id, user_id, produtor_numerocm, area, formulacao, dose, percentual_cobertura,
                          data_aplicacao, embalagem, justificativa_nao_adubacao_id, fertilizante_salvo, deve_faturar,
                          porcentagem_salva, total, safra_id
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [f"a{int(time.time()*1000)}", id, user_id, produtor_numerocm, area, a.get("formulacao"), a.get("dose"), a.get("percentual_cobertura"),
                         a.get("data_aplicacao"), a.get("embalagem"), a.get("justificativa_nao_adubacao_id"), bool(a.get("fertilizante_salvo")),
                         bool(a.get("deve_faturar", True)), float(a.get("porcentagem_salva") or 0), None, safra_id]
                    )
                for tid in talhao_ids:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_talhoes (id, programacao_id, talhao_id, safra_id, fazenda_idfazenda)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        [f"pt{int(time.time()*1000)}", id, tid, safra_id, fazenda_idfazenda]
                    )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacao_cultivares", methods=["GET"])
def list_programacao_cultivares():
    ensure_programacao_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM public.programacao_cultivares ORDER BY created_at DESC")
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            items = [dict(zip(cols, r)) for r in rows]
            ids = [it.get("id") for it in items if it.get("id")]
            tratamentos_map = {}
            defensivos_map = {}
            if ids:
                cur.execute(
                    """
                    SELECT programacao_cultivar_id, tratamento_id
                    FROM public.programacao_cultivares_tratamentos
                    WHERE programacao_cultivar_id = ANY(%s)
                    """,
                    (ids,),
                )
                for pcid, tid in cur.fetchall():
                    tratamentos_map.setdefault(pcid, []).append(tid)
                cur.execute(
                    """
                    SELECT id, programacao_cultivar_id, classe, aplicacao, defensivo, dose, cobertura, total, produto_salvo
                    FROM public.programacao_cultivares_defensivos
                    WHERE programacao_cultivar_id = ANY(%s)
                    """,
                    (ids,),
                )
                def_cols = [d[0] for d in cur.description]
                def_rows = cur.fetchall()
                for r in def_rows:
                    d = dict(zip(def_cols, r))
                    defensivos_map.setdefault(d["programacao_cultivar_id"], []).append(d)
            enriched = []
            for it in items:
                it2 = dict(it)
                it2["tratamento_ids"] = tratamentos_map.get(it.get("id"), [])
                it2["defensivos_fazenda"] = defensivos_map.get(it.get("id"), [])
                enriched.append(it2)
            return jsonify({"items": enriched, "count": len(enriched)})
    finally:
        pool.putconn(conn)

@app.route("/programacao_cultivares", methods=["POST"])
def create_programacao_cultivar():
    ensure_programacao_schema()
    payload = request.get_json(silent=True) or {}
    id_val = payload.get("id") or f"pc{int(time.time()*1000)}"
    programacao_id = payload.get("programacao_id")
    user_id = payload.get("user_id")
    produtor_numerocm = payload.get("produtor_numerocm")
    area = payload.get("area")
    area_hectares = payload.get("area_hectares")
    cultivar = payload.get("cultivar")
    percentual_cobertura = payload.get("percentual_cobertura")
    tipo_embalagem = payload.get("tipo_embalagem")
    tipo_tratamento = payload.get("tipo_tratamento")
    tratamento_ids = payload.get("tratamento_ids") or []
    tratamento_id = payload.get("tratamento_id")
    data_plantio = payload.get("data_plantio")
    populacao_recomendada = payload.get("populacao_recomendada")
    semente_propria = bool(payload.get("semente_propria"))
    referencia_rnc_mapa = payload.get("referencia_rnc_mapa")
    sementes_por_saca = payload.get("sementes_por_saca")
    safra = payload.get("safra")
    epoca_id = payload.get("epoca_id")
    porcentagem_salva = payload.get("porcentagem_salva")
    defensivos_fazenda = payload.get("defensivos_fazenda") or []
    first_tr = None if str(tipo_tratamento or "").upper() == "NÃO" else (tratamento_id or (tratamento_ids[0] if tratamento_ids else None))
    auth = request.headers.get("Authorization") or ""
    cm_token = None
    if auth.lower().startswith("bearer "):
        try:
            payload_jwt = verify_jwt(auth.split(" ", 1)[1])
            cm_token = payload_jwt.get("numerocm_consultor")
        except Exception:
            pass
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.programacao_cultivares (
                      id, programacao_id, user_id, produtor_numerocm, area, area_hectares, numerocm_consultor, cultivar, quantidade, unidade,
                      percentual_cobertura, tipo_embalagem, tipo_tratamento, tratamento_id, data_plantio, populacao_recomendada,
                      semente_propria, referencia_rnc_mapa, sementes_por_saca, safra, epoca_id, porcentagem_salva
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    [id_val, programacao_id, user_id, produtor_numerocm, area, area_hectares, cm_token, cultivar, 0, "kg",
                     percentual_cobertura, tipo_embalagem, tipo_tratamento, first_tr, data_plantio, populacao_recomendada or 0,
                     semente_propria, referencia_rnc_mapa, sementes_por_saca or 0, safra, epoca_id, porcentagem_salva or 0]
                )
                if str(tipo_tratamento or "").upper() != "NÃO":
                    for tid in (tratamento_ids or []):
                        if not tid:
                            continue
                        cur.execute(
                            """
                            INSERT INTO public.programacao_cultivares_tratamentos (id, programacao_cultivar_id, tratamento_id)
                            VALUES (%s, %s, %s)
                            """,
                            [f"t{int(time.time()*1000)}", id_val, tid]
                        )
                for d in defensivos_fazenda:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_cultivares_defensivos
                        (id, programacao_cultivar_id, classe, aplicacao, defensivo, dose, cobertura, total, produto_salvo)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [f"d{int(time.time()*1000)}", id_val, d.get("classe"), d.get("aplicacao"), d.get("defensivo"),
                         d.get("dose"), d.get("cobertura"), d.get("total"), bool(d.get("produto_salvo"))]
                    )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacao_cultivares/<id>", methods=["PUT"])
def update_programacao_cultivar(id: str):
    ensure_programacao_schema()
    payload = request.get_json(silent=True) or {}
    fields = {k: payload.get(k) for k in [
        "programacao_id","user_id","produtor_numerocm","area","area_hectares","cultivar","quantidade","unidade",
        "percentual_cobertura","tipo_embalagem","tipo_tratamento","tratamento_id","data_plantio","populacao_recomendada",
        "semente_propria","referencia_rnc_mapa","sementes_por_saca","safra","epoca_id","porcentagem_salva","numerocm_consultor"
    ]}
    auth = request.headers.get("Authorization") or ""
    cm_token = None
    if auth.lower().startswith("bearer "):
        try:
            payload_jwt = verify_jwt(auth.split(" ", 1)[1])
            cm_token = payload_jwt.get("numerocm_consultor")
        except Exception:
            pass
    tratamento_ids = payload.get("tratamento_ids") or []
    defensivos_fazenda = payload.get("defensivos_fazenda") or []
    tipo_tratamento = payload.get("tipo_tratamento")
    first_tr = None if str(tipo_tratamento or "").upper() == "NÃO" else (payload.get("tratamento_id") or (tratamento_ids[0] if tratamento_ids else None))
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                set_parts = []
                values = []
                for col, val in fields.items():
                    if val is not None:
                        set_parts.append(f"{col} = %s")
                        values.append(val)
                if cm_token is not None:
                    set_parts.append("numerocm_consultor = %s")
                    values.append(cm_token)
                set_parts.append("tratamento_id = %s")
                values.append(first_tr)
                cur.execute(
                    f"UPDATE public.programacao_cultivares SET {', '.join(set_parts)}, updated_at = now() WHERE id = %s",
                    values + [id]
                )
                cur.execute("DELETE FROM public.programacao_cultivares_tratamentos WHERE programacao_cultivar_id = %s", [id])
                if str(tipo_tratamento or "").upper() != "NÃO":
                    for tid in (tratamento_ids or []):
                        if not tid:
                            continue
                        cur.execute(
                            """
                            INSERT INTO public.programacao_cultivares_tratamentos (id, programacao_cultivar_id, tratamento_id)
                            VALUES (%s, %s, %s)
                            """,
                            [f"t{int(time.time()*1000)}", id, tid]
                        )
                cur.execute("DELETE FROM public.programacao_cultivares_defensivos WHERE programacao_cultivar_id = %s", [id])
                for d in defensivos_fazenda:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_cultivares_defensivos
                        (id, programacao_cultivar_id, classe, aplicacao, defensivo, dose, cobertura, total, produto_salvo)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [f"d{int(time.time()*1000)}", id, d.get("classe"), d.get("aplicacao"), d.get("defensivo"),
                         d.get("dose"), d.get("cobertura"), d.get("total"), bool(d.get("produto_salvo"))]
                    )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacao_cultivares/<id>", methods=["DELETE"])
def delete_programacao_cultivar(id: str):
    ensure_programacao_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.programacao_cultivares WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacao_adubacao", methods=["GET"])
def list_programacao_adubacao():
    ensure_programacao_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM public.programacao_adubacao ORDER BY created_at DESC")
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/programacao_adubacao", methods=["POST"])
def create_programacao_adub():
    ensure_programacao_schema()
    payload = request.get_json(silent=True) or {}
    id_val = payload.get("id") or f"pa{int(time.time()*1000)}"
    programacao_id = payload.get("programacao_id")
    user_id = payload.get("user_id")
    produtor_numerocm = payload.get("produtor_numerocm")
    area = payload.get("area")
    formulacao = payload.get("formulacao")
    dose = payload.get("dose")
    percentual_cobertura = payload.get("percentual_cobertura")
    data_aplicacao = payload.get("data_aplicacao")
    embalagem = payload.get("embalagem")
    justificativa_nao_adubacao_id = payload.get("justificativa_nao_adubacao_id")
    fertilizante_salvo = bool(payload.get("fertilizante_salvo"))
    deve_faturar = bool(payload.get("deve_faturar", True))
    porcentagem_salva = float(payload.get("porcentagem_salva") or 0)
    safra_id = payload.get("safra_id")
    auth = request.headers.get("Authorization") or ""
    cm_token = None
    if auth.lower().startswith("bearer "):
        try:
            payload_jwt = verify_jwt(auth.split(" ", 1)[1])
            cm_token = payload_jwt.get("numerocm_consultor")
        except Exception:
            pass
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.programacao_adubacao (
                      id, programacao_id, user_id, produtor_numerocm, area, numerocm_consultor, formulacao, dose, percentual_cobertura,
                      data_aplicacao, embalagem, justificativa_nao_adubacao_id, fertilizante_salvo, deve_faturar,
                      porcentagem_salva, total, safra_id
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    [id_val, programacao_id, user_id, produtor_numerocm, area, cm_token, formulacao, dose, percentual_cobertura,
                     data_aplicacao, embalagem, justificativa_nao_adubacao_id, fertilizante_salvo, deve_faturar,
                     porcentagem_salva, None, safra_id]
                )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacao_adubacao/<id>", methods=["PUT"])
def update_programacao_adub(id: str):
    ensure_programacao_schema()
    payload = request.get_json(silent=True) or {}
    fields = {k: payload.get(k) for k in [
        "programacao_id","user_id","produtor_numerocm","area","formulacao","dose","percentual_cobertura",
        "data_aplicacao","embalagem","justificativa_nao_adubacao_id","fertilizante_salvo","deve_faturar",
        "porcentagem_salva","total","safra_id","numerocm_consultor"
    ]}
    auth = request.headers.get("Authorization") or ""
    cm_token = None
    if auth.lower().startswith("bearer "):
        try:
            payload_jwt = verify_jwt(auth.split(" ", 1)[1])
            cm_token = payload_jwt.get("numerocm_consultor")
        except Exception:
            pass
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                set_parts = []
                values = []
                for col, val in fields.items():
                    if val is not None:
                        set_parts.append(f"{col} = %s")
                        values.append(val)
                if cm_token is not None:
                    set_parts.append("numerocm_consultor = %s")
                    values.append(cm_token)
                cur.execute(
                    f"UPDATE public.programacao_adubacao SET {', '.join(set_parts)}, updated_at = now() WHERE id = %s",
                    values + [id]
                )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/safras", methods=["GET"])
def get_safras():
    ensure_safras_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, nome, is_default, ativa, ano_inicio, ano_fim, created_at, updated_at
                FROM public.safras
                ORDER BY nome DESC
                """
            )
            rows = cur.fetchall()
            cols = [desc[0] for desc in cur.description]
            data = [dict(zip(cols, row)) for row in rows]
            return jsonify({"items": data, "count": len(data)})
    finally:
        pool.putconn(conn)

@app.route("/safras", methods=["POST"])
def create_safra():
    ensure_safras_schema()
    payload = request.get_json(silent=True) or {}
    nome = (payload.get("nome") or "").strip()
    if not nome:
        return jsonify({"error": "nome obrigatório"}), 400
    is_default = bool(payload.get("is_default"))
    ativa = bool(payload.get("ativa", True))
    ano_inicio = payload.get("ano_inicio")
    ano_fim = payload.get("ano_fim")
    id_val = (payload.get("id") or "").strip() or str(int(time.time()*1000))
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                if is_default:
                    cur.execute("UPDATE public.safras SET is_default = false")
                cur.execute(
                    """
                    INSERT INTO public.safras (id, nome, is_default, ativa, ano_inicio, ano_fim)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                      nome = EXCLUDED.nome,
                      is_default = EXCLUDED.is_default,
                      ativa = EXCLUDED.ativa,
                      ano_inicio = EXCLUDED.ano_inicio,
                      ano_fim = EXCLUDED.ano_fim,
                      updated_at = now()
                    """,
                    [id_val, nome, is_default, ativa, ano_inicio, ano_fim]
                )
        return jsonify({"ok": True, "id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/safras/<id>", methods=["PUT"])
def update_safra(id: str):
    ensure_safras_schema()
    payload = request.get_json(silent=True) or {}
    nome = payload.get("nome")
    is_default = payload.get("is_default")
    ativa = payload.get("ativa")
    ano_inicio = payload.get("ano_inicio")
    ano_fim = payload.get("ano_fim")
    set_parts = []
    values = []
    for col, val in [("nome", nome), ("is_default", is_default), ("ativa", ativa), ("ano_inicio", ano_inicio), ("ano_fim", ano_fim)]:
        if val is not None:
            set_parts.append(f"{col} = %s")
            values.append(val)
    if not set_parts:
        return jsonify({"error": "nenhum campo para atualizar"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                if is_default is True:
                    cur.execute("UPDATE public.safras SET is_default = false WHERE id <> %s", [id])
                cur.execute(
                    f"UPDATE public.safras SET {', '.join(set_parts)}, updated_at = now() WHERE id = %s",
                    values + [id]
                )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/safras/<id>", methods=["DELETE"])
def delete_safra(id: str):
    ensure_safras_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.safras WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

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

@app.route("/cultivares_catalog", methods=["GET"])
def get_cultivares_catalog():
    ensure_cultivares_catalog_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT cultivar, cultura, nome_cientifico, created_at, updated_at FROM public.cultivares_catalog ORDER BY cultivar"
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/cultivares_catalog/bulk", methods=["POST"])
def import_cultivares_catalog():
    ensure_cultivares_catalog_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True) or {}
    limpar = bool(payload.get("limparAntes")) or bool(payload.get("limpar_antes"))
    items = payload.get("items") or []
    user_id = payload.get("user_id")
    arquivo_nome = payload.get("arquivo_nome")
    pool = get_pool()
    conn = pool.getconn()
    deleted = 0
    imported = 0
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar:
                    cur.execute("SELECT COUNT(*) FROM public.cultivares_catalog")
                    deleted = cur.fetchone()[0] or 0
                    cur.execute("DELETE FROM public.cultivares_catalog")
                values = []
                seen = set()
                for it in (items or []):
                    cultivar = (it.get("cultivar") or "").strip().upper()
                    cultura = (it.get("cultura") or "").strip().upper() or None
                    nome_cientifico = it.get("nome_cientifico")
                    if not cultivar:
                        continue
                    key = f"{cultivar}|{cultura or ''}"
                    if key in seen:
                        continue
                    seen.add(key)
                    values.append([cultivar, cultura, nome_cientifico])
                if values:
                    execute_values(
                        cur,
                        """
                        INSERT INTO public.cultivares_catalog (cultivar, cultura, nome_cientifico)
                        VALUES %s
                        ON CONFLICT (cultivar, cultura) DO UPDATE SET
                          nome_cientifico = EXCLUDED.nome_cientifico,
                          updated_at = now()
                        """,
                        values,
                    )
                    imported = len(values)
                cur.execute(
                    """
                    INSERT INTO public.import_history (id, user_id, tabela_nome, registros_importados, registros_deletados, arquivo_nome, limpar_antes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    [f"ih{int(time.time()*1000)}", user_id, "cultivares_catalog", imported, deleted, arquivo_nome, limpar]
                )
        return jsonify({"ok": True, "imported": imported, "deleted": deleted})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/cultivares_catalog/by_key", methods=["PUT"])
def update_cultivares_by_key():
    ensure_cultivares_catalog_schema()
    payload = request.get_json(silent=True) or {}
    cultivar = (payload.get("cultivar") or "").strip().upper()
    cultura = (payload.get("cultura") or "").strip().upper() or None
    set_cultura = payload.get("set_cultura")
    set_nome_cientifico = payload.get("set_nome_cientifico")
    if not cultivar:
        return jsonify({"error": "cultivar obrigatório"}), 400
    set_parts = []
    values = []
    if set_cultura is not None:
        values.append((str(set_cultura) or "").upper())
        set_parts.append("cultura = %s")
    if set_nome_cientifico is not None:
        values.append(set_nome_cientifico)
        set_parts.append("nome_cientifico = %s")
    if not set_parts:
        return jsonify({"error": "nenhum campo para atualizar"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE public.cultivares_catalog SET {', '.join(set_parts)}, updated_at = now() WHERE cultivar = %s AND {( 'cultura IS NULL' if cultura is None else 'cultura = %s' )}",
                    values + ([cultivar] if cultura is None else [cultivar, cultura])
                )
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/tratamentos_sementes", methods=["GET"])
def list_tratamentos_sementes():
    ensure_tratamentos_sementes_schema()
    cultura = request.args.get("cultura")
    ativo = request.args.get("ativo")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            base = "SELECT id, nome, cultura, ativo, created_at, updated_at FROM public.tratamentos_sementes"
            where = []
            params = []
            if cultura:
                where.append("cultura = %s")
                params.append(cultura.upper())
            if ativo is not None:
                val = str(ativo).strip().lower() in ("1","true","yes","on")
                where.append("ativo = %s")
                params.append(val)
            sql = base + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY nome"
            cur.execute(sql, params)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/tratamentos_sementes", methods=["POST"])
def create_tratamento_semente():
    ensure_tratamentos_sementes_schema()
    payload = request.get_json(silent=True) or {}
    id_val = str(uuid.uuid4())
    nome = (payload.get("nome") or "").strip()
    cultura = payload.get("cultura")
    ativo = bool(payload.get("ativo", True))
    if not nome:
        return jsonify({"error": "nome obrigatório"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO public.tratamentos_sementes (id, nome, cultura, ativo) VALUES (%s, %s, %s, %s)",
                    [id_val, nome, cultura, ativo]
                )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/tratamentos_sementes/<id>", methods=["PUT"])
def update_tratamento_semente(id: str):
    ensure_tratamentos_sementes_schema()
    payload = request.get_json(silent=True) or {}
    nome = payload.get("nome")
    cultura = payload.get("cultura")
    ativo = payload.get("ativo")
    set_parts = []
    values = []
    for col, val in [("nome", nome), ("cultura", (str(cultura).upper() if cultura is not None else None)), ("ativo", ativo)]:
        if val is not None:
            set_parts.append(f"{col} = %s")
            values.append(val)
    if not set_parts:
        return jsonify({"error": "nenhum campo para atualizar"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE public.tratamentos_sementes SET {', '.join(set_parts)}, updated_at = now() WHERE id = %s",
                    values + [id]
                )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/tratamentos_sementes/<id>", methods=["DELETE"])
def delete_tratamento_semente(id: str):
    ensure_tratamentos_sementes_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.tratamentos_sementes WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/cultivares_tratamentos", methods=["GET"])
def list_cultivares_tratamentos():
    ensure_cultivares_tratamentos_schema()
    ensure_tratamentos_sementes_schema()
    cultivar = request.args.get("cultivar")
    if not cultivar:
        return jsonify({"items": [], "count": 0})
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ts.id, ts.nome, ts.cultura, ts.ativo
                FROM public.cultivares_tratamentos ct
                JOIN public.tratamentos_sementes ts ON ts.id = ct.tratamento_id
                WHERE ct.cultivar = %s AND ts.ativo = true
                ORDER BY ts.nome
                """,
                [cultivar]
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/cultivares_tratamentos/bulk", methods=["POST"])
def save_cultivares_tratamentos_bulk():
    ensure_cultivares_tratamentos_schema()
    payload = request.get_json(silent=True) or {}
    tratamento_id = (payload.get("tratamento_id") or "").strip()
    cultivares = payload.get("cultivares") or []
    if not tratamento_id:
        return jsonify({"error": "tratamento_id obrigatório"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.cultivares_tratamentos WHERE tratamento_id = %s", [tratamento_id])
                values = []
                seen = set()
                for c in cultivares:
                    val = (str(c) or "").strip().upper()
                    if not val or val in seen:
                        continue
                    seen.add(val)
                    values.append([val, tratamento_id])
                if values:
                    execute_values(
                        cur,
                        "INSERT INTO public.cultivares_tratamentos (cultivar, tratamento_id) VALUES %s ON CONFLICT DO NOTHING",
                        values
                    )
        return jsonify({"ok": True, "count": len(values)})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/cultivares_tratamentos/set_for_cultivar", methods=["POST"])
def set_tratamentos_for_cultivar():
    ensure_cultivares_tratamentos_schema()
    payload = request.get_json(silent=True) or {}
    cultivar = (payload.get("cultivar") or "").strip().upper()
    tratamento_ids = payload.get("tratamento_ids") or []
    if not cultivar:
        return jsonify({"error": "cultivar obrigatório"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.cultivares_tratamentos WHERE cultivar = %s", [cultivar])
                values = []
                seen = set()
                for tid in tratamento_ids:
                    val = (str(tid) or "").strip()
                    if not val or val in seen:
                        continue
                    seen.add(val)
                    values.append([cultivar, val])
                if values:
                    execute_values(
                        cur,
                        "INSERT INTO public.cultivares_tratamentos (cultivar, tratamento_id) VALUES %s ON CONFLICT DO NOTHING",
                        values
                    )
        return jsonify({"ok": True, "count": len(values)})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/fertilizantes")
def get_fertilizantes():
    ensure_fertilizantes_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cod_item, item, marca, principio_ativo, saldo, created_at, updated_at
                FROM public.fertilizantes_catalog
                ORDER BY item NULLS LAST, cod_item
                """
            )
            rows = cur.fetchall()
            cols = [desc[0] for desc in cur.description]
            data = [dict(zip(cols, row)) for row in rows]
            return jsonify({"items": data, "count": len(data)})
    finally:
        pool.putconn(conn)

@app.route("/fertilizantes", methods=["POST"])
def upsert_fertilizante():
    ensure_fertilizantes_schema()
    payload = request.get_json(silent=True) or {}
    cod_item = payload.get("cod_item")
    if not cod_item:
        return jsonify({"error": "cod_item obrigatório"}), 400
    item = payload.get("item")
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
                    INSERT INTO public.fertilizantes_catalog (cod_item, item, marca, principio_ativo, saldo)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (cod_item) DO UPDATE SET
                      item = EXCLUDED.item,
                      marca = EXCLUDED.marca,
                      principio_ativo = EXCLUDED.principio_ativo,
                      saldo = EXCLUDED.saldo,
                      updated_at = now()
                    """,
                    [cod_item, item, marca, principio_ativo, saldo],
                )
                affected = cur.rowcount
        return jsonify({"ok": True, "cod_item": cod_item, "affected": affected})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/fertilizantes/bulk", methods=["POST"])
def upsert_fertilizantes_bulk():
    ensure_fertilizantes_schema()
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
                    cur.execute("DELETE FROM public.fertilizantes_catalog")
                execute_values(
                    cur,
                    """
                    INSERT INTO public.fertilizantes_catalog (cod_item, item, marca, principio_ativo, saldo)
                    VALUES %s
                    ON CONFLICT (cod_item) DO UPDATE SET
                      item = EXCLUDED.item,
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

@app.route("/fertilizantes/sync", methods=["GET", "POST", "OPTIONS"])
def sync_fertilizantes():
    if request.method == "OPTIONS":
        return ("", 204)
    ensure_system_config_schema()
    ensure_fertilizantes_schema()
    payload = request.get_json(silent=True) or {}
    limpar = bool(payload.get("limparAntes"))
    cfg = get_config_map([
        "api_fertilizantes_cliente_id",
        "api_fertilizantes_secret",
        "api_fertilizantes_url",
        "api_fertilizantes_exp",
    ])
    missing = [k for k in ["api_fertilizantes_cliente_id","api_fertilizantes_secret","api_fertilizantes_url","api_fertilizantes_exp"] if k not in cfg or not cfg[k]]
    if missing:
        return jsonify({"error": f"Config ausente: {', '.join(missing)}"}), 400
    try:
        url_cfg = (cfg["api_fertilizantes_url"] or "").strip().strip("`")
        token = _make_jwt(cfg["api_fertilizantes_cliente_id"], int(cfg["api_fertilizantes_exp"]), cfg["api_fertilizantes_secret"], None)
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
        cod_item = pick(d, ["cod_item", "COD_ITEM", "CODITEM", "COD ITEM", "COD. ITEM", "COD"])
        item_val = pick(d, ["item", "ITEM"]) or None
        marca_val = pick(d, ["marca", "MARCA"]) or None
        princ_val = pick(d, ["principio_ativo", "PRINCIPIO_ATIVO", "PRINCIPIO ATIVO"]) or None
        saldo_val = pick(d, ["saldo", "SALDO"]) or None

        if not cod_item:
            ignored += 1
            continue
        normalized.append([cod_item, item_val, marca_val, princ_val, saldo_val])

    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar:
                    cur.execute("DELETE FROM public.fertilizantes_catalog")
                if normalized:
                    execute_values(
                        cur,
                        """
                        INSERT INTO public.fertilizantes_catalog (cod_item, item, marca, principio_ativo, saldo)
                        VALUES %s
                        ON CONFLICT (cod_item) DO UPDATE SET
                          item = EXCLUDED.item,
                          marca = EXCLUDED.marca,
                          principio_ativo = EXCLUDED.principio_ativo,
                          saldo = EXCLUDED.saldo,
                          updated_at = now()
                        """,
                        normalized,
                    )
        return jsonify({"ok": True, "imported": len(normalized), "ignored": ignored})
    finally:
        pool.putconn(conn)

@app.route("/fertilizantes/sync/test", methods=["GET"])
def sync_fertilizantes_test():
    ensure_system_config_schema()
    cfg = get_config_map(["api_fertilizantes_url", "api_fertilizantes_cliente_id", "api_fertilizantes_secret", "api_fertilizantes_exp"])
    url = (cfg.get("api_fertilizantes_url") or "").strip()
    client_id = cfg.get("api_fertilizantes_cliente_id") or ""
    secret = cfg.get("api_fertilizantes_secret") or ""
    exp = cfg.get("api_fertilizantes_exp") or ""
    if not url:
        return jsonify({"error": "Config api_fertilizantes_url ausente"}), 400
    if not client_id or not secret or not exp:
        return jsonify({"error": "Config JWT ausente (cliente_id/secret/exp)"}), 400
    try:
        token = _make_jwt(client_id, int(str(exp)), secret, None)
        req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
        with urlopen(req, timeout=15) as resp:
            return jsonify({"status": resp.status, "ok": True})
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "HTTPError", "status": e.code, "details": body or str(e)}), 502
    except URLError as e:
        details = str(getattr(e, 'reason', e))
        return jsonify({"error": "URLError", "details": details}), 502

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

@app.route("/versions", methods=["GET", "POST"])
def app_versions():
    ensure_app_versions_schema()
    pool = get_pool()
    conn = pool.getconn()
    if request.method == "GET":
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id, version, build, environment, notes, created_at FROM public.app_versions ORDER BY created_at DESC")
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                items = [dict(zip(cols, r)) for r in rows]
                return jsonify({"items": items, "count": len(items)})
        finally:
            pool.putconn(conn)
    else:
        payload = request.get_json(silent=True) or {}
        version = (payload.get("version") or "").strip()
        build = (payload.get("build") or "").strip() or None
        environment = (payload.get("environment") or "prod").strip() or "prod"
        notes = payload.get("notes")
        if not version:
            pool.putconn(conn)
            return jsonify({"error": "version obrigatório"}), 400
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO public.app_versions (id, version, build, environment, notes)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (version, environment) DO NOTHING
                        """,
                        [str(uuid.uuid4()), version, build, environment, notes],
                    )
            return jsonify({"ok": True, "version": version, "build": build, "environment": environment})
        except Exception as e:
            return jsonify({"error": str(e)}), 400
        finally:
            pool.putconn(conn)
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")

def _make_jwt(client_id: str, exp_ts: int, secret: str, audience: str | None = None) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"client_id": client_id, "exp": int(exp_ts)}
    if audience is not None and str(audience).strip():
        payload["aud"] = str(audience).strip()
    h = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    to_sign_str = h + "." + p
    sig = hmac.new(secret.encode("utf-8"), to_sign_str.encode("utf-8"), hashlib.sha256).digest()
    s = _b64url(sig)
    return to_sign_str + "." + s

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
    cfg = get_config_map(["api_defensivos_url", "api_defensivos_client_id", "api_defensivos_secret", "api_defensivos_exp", "api_defensivos_aud"])
    url = (cfg.get("api_defensivos_url") or "").strip()
    client_id = cfg.get("api_defensivos_client_id") or ""
    secret = cfg.get("api_defensivos_secret") or ""
    exp = cfg.get("api_defensivos_exp") or ""
    aud = cfg.get("api_defensivos_aud") or None
    if not url:
        return jsonify({"error": "Config api_defensivos_url ausente"}), 400
    if not client_id or not secret or not exp:
        return jsonify({"error": "Config JWT ausente (client_id/secret/exp)"}), 400
    try:
        token = _make_jwt(client_id, int(str(exp)), secret, aud)
        req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
        with urlopen(req, timeout=15) as resp:
            return jsonify({"status": resp.status, "ok": True})
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "HTTPError", "status": e.code, "details": body or str(e)}), 502
    except URLError as e:
        details = str(getattr(e, 'reason', e))
        return jsonify({"error": "URLError", "details": details}), 502

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

@app.route("/talhoes", methods=["GET"])
def list_talhoes():
    ensure_talhoes_schema()
    fazenda_id = request.args.get("fazenda_id")
    ids = request.args.get("ids")
    safra_id = request.args.get("safra_id")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            if ids:
                id_list = [s for s in str(ids).split(",") if s]
                cur.execute(
                    """
                    SELECT 
                        t.id,
                        t.fazenda_id,
                        t.nome,
                        t.area,
                        t.arrendado,
                        t.safras_todas,
                        t.kml_name,
                        t.kml_uploaded_at,
                        t.geojson,
                        t.centroid_lat,
                        t.centroid_lng,
                        t.bbox_min_lat,
                        t.bbox_min_lng,
                        t.bbox_max_lat,
                        t.bbox_max_lng,
                        t.created_at,
                        t.updated_at,
                        COALESCE(ARRAY_REMOVE(ARRAY_AGG(ts.safra_id), NULL), ARRAY[]::TEXT[]) AS allowed_safras,
                        EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = t.id) AS tem_programacao,
                        CASE WHEN %s IS NULL THEN FALSE ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = t.id AND pt.safra_id = %s) END AS tem_programacao_safra
                    FROM public.talhoes t
                    LEFT JOIN public.talhao_safras ts ON ts.talhao_id = t.id
                    WHERE t.fazenda_id = ANY(%s)
                      AND (%s IS NULL OR t.safras_todas OR EXISTS (SELECT 1 FROM public.talhao_safras ts2 WHERE ts2.talhao_id = t.id AND ts2.safra_id = %s))
                    GROUP BY t.id, t.fazenda_id, t.nome, t.area, t.arrendado, t.safras_todas, t.created_at, t.updated_at
                    ORDER BY t.nome
                    """,
                    (safra_id, safra_id, id_list, safra_id, safra_id)
                )
            elif fazenda_id:
                cur.execute(
                    """
                    SELECT 
                        t.id,
                        t.fazenda_id,
                        t.nome,
                        t.area,
                        t.arrendado,
                        t.safras_todas,
                        t.kml_name,
                        t.kml_uploaded_at,
                        t.geojson,
                        t.centroid_lat,
                        t.centroid_lng,
                        t.bbox_min_lat,
                        t.bbox_min_lng,
                        t.bbox_max_lat,
                        t.bbox_max_lng,
                        t.created_at,
                        t.updated_at,
                        COALESCE(ARRAY_REMOVE(ARRAY_AGG(ts.safra_id), NULL), ARRAY[]::TEXT[]) AS allowed_safras,
                        EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = t.id) AS tem_programacao,
                        CASE WHEN %s IS NULL THEN FALSE ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = t.id AND pt.safra_id = %s) END AS tem_programacao_safra
                    FROM public.talhoes t
                    LEFT JOIN public.talhao_safras ts ON ts.talhao_id = t.id
                    WHERE t.fazenda_id = %s
                      AND (%s IS NULL OR t.safras_todas OR EXISTS (SELECT 1 FROM public.talhao_safras ts2 WHERE ts2.talhao_id = t.id AND ts2.safra_id = %s))
                    GROUP BY t.id, t.fazenda_id, t.nome, t.area, t.arrendado, t.safras_todas, t.created_at, t.updated_at
                    ORDER BY t.nome
                    """,
                    [safra_id, safra_id, fazenda_id, safra_id, safra_id]
                )
            else:
                # por padrão evitar retornar todos; retornar vazio
                return jsonify({"items": [], "count": 0})
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/talhoes", methods=["POST"])
def create_talhao():
    ensure_talhoes_schema()
    payload = request.get_json(silent=True) or {}
    id_val = str(uuid.uuid4())
    fazenda_id = payload.get("fazenda_id")
    nome = payload.get("nome")
    area = payload.get("area")
    arrendado = bool(payload.get("arrendado", False))
    safras_todas = bool(payload.get("safras_todas", True))
    safras = payload.get("safras") or []
    if not fazenda_id or not nome or area is None:
        return jsonify({"error": "campos obrigatórios ausentes"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.talhoes (id, fazenda_id, nome, area, arrendado, safras_todas)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    [id_val, fazenda_id, nome, area, arrendado, safras_todas]
                )
                if not safras_todas and isinstance(safras, list):
                    for s in safras:
                        sid = str(uuid.uuid4())
                        cur.execute(
                            """
                            INSERT INTO public.talhao_safras (id, talhao_id, safra_id)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (talhao_id, safra_id) DO NOTHING
                            """,
                            [sid, id_val, str(s)]
                        )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/talhoes/<id>", methods=["PUT"])
def update_talhao(id: str):
    ensure_talhoes_schema()
    payload = request.get_json(silent=True) or {}
    nome = payload.get("nome")
    area = payload.get("area")
    arrendado = payload.get("arrendado")
    safras_todas = payload.get("safras_todas")
    safras = payload.get("safras")
    geojson = payload.get("geojson")
    centroid_lat = payload.get("centroid_lat")
    centroid_lng = payload.get("centroid_lng")
    bbox_min_lat = payload.get("bbox_min_lat")
    bbox_min_lng = payload.get("bbox_min_lng")
    bbox_max_lat = payload.get("bbox_max_lat")
    bbox_max_lng = payload.get("bbox_max_lng")
    kml_name = payload.get("kml_name")
    kml_text = payload.get("kml_text")
    set_parts = []
    values = []
    for col, val in [("nome", nome), ("area", area), ("arrendado", arrendado)]:
        if val is not None:
            set_parts.append(f"{col} = %s")
            values.append(val)
    if safras_todas is not None:
        set_parts.append("safras_todas = %s")
        values.append(bool(safras_todas))
    for col, val in [
        ("geojson", (json.dumps(geojson) if isinstance(geojson, (dict, list)) else geojson)),
        ("centroid_lat", centroid_lat),
        ("centroid_lng", centroid_lng),
        ("bbox_min_lat", bbox_min_lat),
        ("bbox_min_lng", bbox_min_lng),
        ("bbox_max_lat", bbox_max_lat),
        ("bbox_max_lng", bbox_max_lng),
        ("kml_name", kml_name),
        ("kml_text", kml_text),
    ]:
        if val is not None:
            set_parts.append(f"{col} = %s")
            values.append(val)
    if not set_parts:
        return jsonify({"error": "nenhum campo para atualizar"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE public.talhoes SET {', '.join(set_parts)}, updated_at = now() WHERE id = %s",
                    values + [id]
                )
                if safras_todas is not None:
                    if bool(safras_todas):
                        cur.execute("DELETE FROM public.talhao_safras WHERE talhao_id = %s", [id])
                    elif isinstance(safras, list):
                        cur.execute("DELETE FROM public.talhao_safras WHERE talhao_id = %s", [id])
                        for s in safras:
                            sid = str(uuid.uuid4())
                            cur.execute(
                                """
                                INSERT INTO public.talhao_safras (id, talhao_id, safra_id)
                                VALUES (%s, %s, %s)
                                ON CONFLICT (talhao_id, safra_id) DO NOTHING
                                """,
                                [sid, id, str(s)]
                            )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/talhoes/<id>", methods=["DELETE"])
def delete_talhao(id: str):
    ensure_talhoes_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                # Verifica se o talhão está vinculado a alguma programação de sementes/adubação
                cur.execute(
                    "SELECT COUNT(*) FROM public.programacao_talhoes WHERE talhao_id = %s",
                    [id]
                )
                used_count = cur.fetchone()[0] or 0
                if used_count > 0:
                    return jsonify({
                        "error": "Talhão não pode ser excluído: existe programação vinculada (sementes/adubação)."
                    }), 400
                cur.execute("DELETE FROM public.talhoes WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

# Utilitário simples para converter KML em GeoJSON minimalista
def _parse_kml_to_geojson(kml_text: str) -> dict:
    try:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(kml_text)
    except Exception as e:
        raise ValueError(f"XML inválido: {e}")
    ns = "{http://www.opengis.net/kml/2.2}"
    geoms = []
    def parse_coords(text):
        coords = []
        for part in (text or "").strip().split():
            bits = part.split(",")
            if len(bits) >= 2:
                lon = float(bits[0])
                lat = float(bits[1])
                coords.append([lon, lat])
        return coords
    for pm in root.iter(f"{ns}Placemark"):
        # Polygon
        for poly in pm.iter(f"{ns}Polygon"):
            ring = poly.find(f".{ns}outerBoundaryIs/{ns}LinearRing/{ns}coordinates")
            if ring is not None and ring.text:
                coords = parse_coords(ring.text)
                if coords:
                    geoms.append({"type": "Polygon", "coordinates": [coords]})
        # LineString
        for ls in pm.iter(f"{ns}LineString"):
            c = ls.find(f".{ns}coordinates")
            if c is not None and c.text:
                coords = parse_coords(c.text)
                if coords:
                    geoms.append({"type": "LineString", "coordinates": coords})
        # Point
        for pt in pm.iter(f"{ns}Point"):
            c = pt.find(f".{ns}coordinates")
            if c is not None and c.text:
                coords = parse_coords(c.text)
                if coords:
                    geoms.append({"type": "Point", "coordinates": coords[0]})
    if not geoms:
        # fallback: procurar coordinates soltos
        for c in root.iter(f"{ns}coordinates"):
            coords = parse_coords(c.text or "")
            if coords:
                geoms.append({"type": "LineString", "coordinates": coords})
                break
    if not geoms:
        raise ValueError("Nenhuma geometria encontrada no KML")
    # Bounding box e centroide simplistas
    all_points = []
    def collect_points(geom):
        t = geom["type"]
        if t == "Point":
            all_points.append(geom["coordinates"])
        elif t == "LineString":
            all_points.extend(geom["coordinates"])
        elif t == "Polygon":
            for ring in geom["coordinates"]:
                all_points.extend(ring)
    for g in geoms:
        collect_points(g)
    lons = [p[0] for p in all_points]
    lats = [p[1] for p in all_points]
    min_lng = min(lons); max_lng = max(lons)
    min_lat = min(lats); max_lat = max(lats)
    centroid_lng = sum(lons)/len(lons)
    centroid_lat = sum(lats)/len(lats)
    geojson = {
        "type": "GeometryCollection",
        "geometries": geoms,
        "bbox": [min_lng, min_lat, max_lng, max_lat],
    }
    return {
        "geojson": geojson,
        "centroid": [centroid_lng, centroid_lat],
        "bbox": {
            "min_lng": min_lng,
            "min_lat": min_lat,
            "max_lng": max_lng,
            "max_lat": max_lat,
        },
    }

@app.route("/talhoes/<id>/kml", methods=["POST"])
def upload_talhao_kml(id: str):
    ensure_talhoes_schema()
    if "file" not in request.files:
        return jsonify({"error": "arquivo obrigatório"}), 400
    f = request.files["file"]
    filename = f.filename or ""
    if not filename.lower().endswith(".kml"):
        return jsonify({"error": "formato inválido: envie um .kml"}), 400
    try:
        content = f.read().decode("utf-8", errors="ignore")
        parsed = _parse_kml_to_geojson(content)
    except Exception as e:
        return jsonify({"error": f"Falha ao ler KML: {e}"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE public.talhoes
                    SET kml_name = %s,
                        kml_uploaded_at = now(),
                        kml_text = %s,
                        geojson = %s,
                        centroid_lat = %s,
                        centroid_lng = %s,
                        bbox_min_lat = %s,
                        bbox_min_lng = %s,
                        bbox_max_lat = %s,
                        bbox_max_lng = %s,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    [
                        filename,
                        content,
                        json.dumps(parsed["geojson"]),
                        parsed["centroid"][1],
                        parsed["centroid"][0],
                        parsed["bbox"]["min_lat"],
                        parsed["bbox"]["min_lng"],
                        parsed["bbox"]["max_lat"],
                        parsed["bbox"]["max_lng"],
                        id,
                    ],
                )
                cur.execute("SELECT kml_text IS NOT NULL, kml_name FROM public.talhoes WHERE id = %s", [id])
                row = cur.fetchone() or (False, None)
                return jsonify({"ok": True, "id": id, "filename": filename, "has_kml": bool(row[0]), "kml_name": row[1]})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/talhoes/<id>/geometry", methods=["GET"])
def get_talhao_geometry(id: str):
    ensure_talhoes_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT geojson, centroid_lat, centroid_lng, bbox_min_lat, bbox_min_lng, bbox_max_lat, bbox_max_lng, kml_name, kml_uploaded_at FROM public.talhoes WHERE id = %s",
                [id],
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "talhão não encontrado"}), 404
            keys = ["geojson", "centroid_lat", "centroid_lng", "bbox_min_lat", "bbox_min_lng", "bbox_max_lat", "bbox_max_lng", "kml_name", "kml_uploaded_at"]
            item = dict(zip(keys, row))
            try:
                item["geojson"] = json.loads(item["geojson"]) if item["geojson"] else None
            except Exception:
                pass
            return jsonify(item)
    finally:
        pool.putconn(conn)

@app.route("/talhoes/<id>/kml", methods=["GET"])
def download_talhao_kml(id: str):
    ensure_talhoes_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT kml_text, kml_name FROM public.talhoes WHERE id = %s", [id])
            row = cur.fetchone()
            if not row or not row[0]:
                return jsonify({"error": "KML não encontrado"}), 404
            kml_text = row[0]
            name = (row[1] or "area.kml").strip() or "area.kml"
            from flask import Response
            resp = Response(kml_text, mimetype="application/vnd.google-earth.kml+xml")
            resp.headers["Content-Disposition"] = f"attachment; filename={name}"
            return resp
    finally:
        pool.putconn(conn)

@app.route("/aplicacoes_defensivos", methods=["GET"])
def list_aplicacoes_defensivos():
    ensure_aplicacoes_defensivos_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            auth = request.headers.get("Authorization") or ""
            role = None
            cm_token = None
            if auth.lower().startswith("bearer "):
                try:
                    payload = verify_jwt(auth.split(" ", 1)[1])
                    role = (payload.get("role") or "consultor").lower()
                    cm_token = payload.get("numerocm_consultor")
                except Exception:
                    role = None
            cur.execute("SELECT id, user_id, produtor_numerocm, area, created_at, updated_at FROM public.aplicacoes_defensivos ORDER BY created_at DESC")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            apps = [dict(zip(cols, r)) for r in rows]
            out = []
            for a in apps:
                cur.execute("SELECT id, aplicacao_id, user_id, classe, defensivo, dose, unidade, alvo, produto_salvo, deve_faturar, porcentagem_salva, area_hectares, safra_id, numerocm_consultor, created_at, updated_at FROM public.programacao_defensivos WHERE aplicacao_id = %s ORDER BY created_at", [a["id"]])
                dcols = [d[0] for d in cur.description]
                drows = cur.fetchall()
                defensivos = [dict(zip(dcols, r)) for r in drows]
                if role == "consultor" and cm_token:
                    defensivos = [d for d in defensivos if (d.get("numerocm_consultor") or "") == cm_token]
                    if not defensivos:
                        continue
                a2 = dict(a)
                a2["defensivos"] = defensivos
                out.append(a2)
            return jsonify({"items": out, "count": len(out)})
    finally:
        pool.putconn(conn)

@app.route("/aplicacoes_defensivos", methods=["POST"])
def create_aplicacao_defensivos():
    ensure_aplicacoes_defensivos_schema()
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    produtor_numerocm = payload.get("produtor_numerocm")
    area = payload.get("area")
    defensivos = payload.get("defensivos") or []
    id_val = str(uuid.uuid4())
    auth = request.headers.get("Authorization") or ""
    cm_token = None
    if auth.lower().startswith("bearer "):
        try:
            payload_jwt = verify_jwt(auth.split(" ", 1)[1])
            cm_token = payload_jwt.get("numerocm_consultor")
        except Exception:
            pass
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                # Bloqueio: já existe aplicação de defensivos para produtor/fazenda/safra
                safra_ids = []
                for d in defensivos:
                    s = (d.get("safra_id") or "").strip()
                    if s:
                        safra_ids.append(s)
                safra_ids = list(dict.fromkeys(safra_ids))
                if produtor_numerocm and area and safra_ids:
                    for s in safra_ids:
                        cur.execute(
                            """
                            SELECT 1
                            FROM public.programacao_defensivos pd
                            JOIN public.aplicacoes_defensivos ad ON ad.id = pd.aplicacao_id
                            WHERE ad.produtor_numerocm = %s AND ad.area = %s AND pd.safra_id = %s
                            LIMIT 1
                            """,
                            [produtor_numerocm, area, s]
                        )
                        if cur.fetchone():
                            return jsonify({
                                "error": "defensivos já cadastrados para produtor/fazenda nesta safra",
                                "produtor_numerocm": produtor_numerocm,
                                "area": area,
                                "safra_id": s,
                            }), 409
                cur.execute(
                    """
                    INSERT INTO public.aplicacoes_defensivos (id, user_id, produtor_numerocm, area)
                    VALUES (%s, %s, %s, %s)
                    """,
                    [id_val, user_id, produtor_numerocm, area]
                )
                for d in defensivos:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_defensivos (id, aplicacao_id, user_id, classe, defensivo, dose, unidade, alvo, produto_salvo, deve_faturar, porcentagem_salva, area_hectares, safra_id, numerocm_consultor)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [str(uuid.uuid4()), id_val, user_id, d.get("classe"), d.get("defensivo"), d.get("dose"), d.get("unidade"), d.get("alvo"), d.get("produto_salvo"), d.get("deve_faturar"), d.get("porcentagem_salva"), d.get("area_hectares"), d.get("safra_id"), cm_token]
                    )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/aplicacoes_defensivos/<id>", methods=["PUT"])
def update_aplicacao_defensivos(id: str):
    ensure_aplicacoes_defensivos_schema()
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    produtor_numerocm = payload.get("produtor_numerocm")
    area = payload.get("area")
    defensivos = payload.get("defensivos") or []
    auth = request.headers.get("Authorization") or ""
    cm_token = None
    if auth.lower().startswith("bearer "):
        try:
            payload_jwt = verify_jwt(auth.split(" ", 1)[1])
            cm_token = payload_jwt.get("numerocm_consultor")
        except Exception:
            pass
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                # Bloqueio: duplicidade produtor/fazenda/safra em outra aplicação
                safra_ids = []
                for d in defensivos:
                    s = (d.get("safra_id") or "").strip()
                    if s:
                        safra_ids.append(s)
                safra_ids = list(dict.fromkeys(safra_ids))
                if produtor_numerocm and area and safra_ids:
                    for s in safra_ids:
                        cur.execute(
                            """
                            SELECT 1
                            FROM public.programacao_defensivos pd
                            JOIN public.aplicacoes_defensivos ad ON ad.id = pd.aplicacao_id
                            WHERE ad.produtor_numerocm = %s AND ad.area = %s AND pd.safra_id = %s AND pd.aplicacao_id <> %s
                            LIMIT 1
                            """,
                            [produtor_numerocm, area, s, id]
                        )
                        if cur.fetchone():
                            return jsonify({
                                "error": "defensivos já cadastrados para produtor/fazenda nesta safra",
                                "produtor_numerocm": produtor_numerocm,
                                "area": area,
                                "safra_id": s,
                            }), 409
                cur.execute("UPDATE public.aplicacoes_defensivos SET user_id = %s, produtor_numerocm = %s, area = %s, updated_at = now() WHERE id = %s", [user_id, produtor_numerocm, area, id])
                cur.execute("DELETE FROM public.programacao_defensivos WHERE aplicacao_id = %s", [id])
                for d in defensivos:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_defensivos (id, aplicacao_id, user_id, classe, defensivo, dose, unidade, alvo, produto_salvo, deve_faturar, porcentagem_salva, area_hectares, safra_id, numerocm_consultor)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [str(uuid.uuid4()), id, user_id, d.get("classe"), d.get("defensivo"), d.get("dose"), d.get("unidade"), d.get("alvo"), d.get("produto_salvo"), d.get("deve_faturar"), d.get("porcentagem_salva"), d.get("area_hectares"), d.get("safra_id"), cm_token]
                    )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/aplicacoes_defensivos/<id>", methods=["DELETE"])
def delete_aplicacao_defensivos(id: str):
    ensure_aplicacoes_defensivos_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.aplicacoes_defensivos WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def _b64url_decode(s: str) -> bytes:
    pad = 4 - (len(s) % 4)
    if pad and pad != 4:
        s = s + ("=" * pad)
    return base64.urlsafe_b64decode(s.encode("ascii"))

def get_auth_secret() -> str:
    secret = os.environ.get("AUTH_SECRET") or os.environ.get("DEFENSIVOS_SECRET")
    if not secret:
        try:
            cfg = get_config_map()
            secret = cfg.get("auth_secret") or cfg.get("defensivos_secret") or "dev-secret"
        except Exception:
            secret = "dev-secret"
    return secret

def create_jwt(payload: dict, exp_seconds: int = 7200) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = dict(payload or {})
    payload["exp"] = int(time.time()) + int(exp_seconds)
    h = _b64url(_json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p = _b64url(_json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing = f"{h}.{p}".encode("ascii")
    sig = hmac.new(get_auth_secret().encode("utf-8"), signing, hashlib.sha256).digest()
    return f"{h}.{p}.{_b64url(sig)}"

def verify_jwt(token: str) -> dict:
    try:
        parts = (token or "").split(".")
        if len(parts) != 3:
            raise ValueError("formato inválido")
        h, p, s = parts
        signing = f"{h}.{p}".encode("ascii")
        expected = hmac.new(get_auth_secret().encode("utf-8"), signing, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64url_decode(s)):
            raise ValueError("assinatura inválida")
        payload = _json.loads(_b64url_decode(p))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("token expirado")
        return payload
    except Exception as e:
        raise ValueError(str(e))

def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    iterations = 100_000
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return f"pbkdf2_sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"

def _verify_password(password: str, digest: str) -> bool:
    try:
        algo, iter_str, salt_b64, hash_b64 = digest.split('$')
        if algo != 'pbkdf2_sha256':
            return False
        iterations = int(iter_str)
        salt = base64.b64decode(salt_b64)
        dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
        return base64.b64encode(dk).decode() == hash_b64
    except Exception:
        return False

@app.route("/auth/login", methods=["POST"])
def auth_login():
    ensure_consultores_schema()
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, numerocm_consultor, consultor, email, role, ativo, password_digest FROM public.consultores WHERE email = %s", [email])
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "email não autorizado"}), 403
            cols = [d[0] for d in cur.description]
            item = dict(zip(cols, row))
            if not bool(item.get("ativo", True)):
                return jsonify({"error": "usuário inativo"}), 403
            digest = item.get("password_digest")
            if digest:
                if not password:
                    return jsonify({"error": "senha obrigatória"}), 400
                if not _verify_password(password, digest):
                    return jsonify({"error": "senha inválida"}), 403
            token = create_jwt({
                "user_id": item["id"],
                "email": item["email"],
                "numerocm_consultor": item["numerocm_consultor"],
                "nome": item["consultor"],
                "role": item.get("role", "consultor"),
            })
            return jsonify({"token": token, "user": item})
    finally:
        pool.putconn(conn)

@app.route("/auth/me", methods=["GET"])
def auth_me():
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1]
    else:
        return jsonify({"error": "sem token"}), 401
    try:
        payload = verify_jwt(token)
        return jsonify({"user": payload})
    except Exception as e:
        return jsonify({"error": str(e)}), 401

@app.route("/user_roles/me", methods=["GET"])
def user_roles_me():
    auth = request.headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        return jsonify({"error": "sem token"}), 401
    try:
        payload = verify_jwt(auth.split(" ", 1)[1])
        return jsonify({"role": payload.get("role", "consultor")})
    except Exception as e:
        return jsonify({"error": str(e)}), 401

@app.route("/users", methods=["GET"])
def list_users():
    ensure_consultores_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, numerocm_consultor, consultor, email, role, ativo, created_at, updated_at FROM public.consultores ORDER BY consultor")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/users/<id>", methods=["PUT"])
def update_user(id: str):
    ensure_consultores_schema()
    payload = request.get_json(silent=True) or {}
    role = payload.get("role")
    ativo = payload.get("ativo")
    nome = payload.get("nome")
    numerocm_consultor = payload.get("numerocm_consultor")
    if role is None and ativo is None:
        if nome is None and numerocm_consultor is None:
            return jsonify({"error": "nenhum campo"}), 400
    set_parts = []
    values = []
    if role is not None:
        set_parts.append("role = %s")
        values.append(role)
    if ativo is not None:
        set_parts.append("ativo = %s")
        values.append(bool(ativo))
    if nome is not None:
        set_parts.append("consultor = %s")
        values.append(nome)
    if numerocm_consultor is not None:
        set_parts.append("numerocm_consultor = %s")
        values.append(numerocm_consultor)
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE public.consultores SET {', '.join(set_parts)}, updated_at = now() WHERE id = %s", values + [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/users/<id>/password", methods=["POST"])
def set_user_password(id: str):
    ensure_consultores_schema()
    auth = request.headers.get("Authorization") or ""
    requester_role = None
    requester_id = None
    if auth.lower().startswith("bearer "):
        try:
            payload = verify_jwt(auth.split(" ", 1)[1])
            requester_role = (payload.get("role") or "consultor").lower()
            requester_id = payload.get("user_id")
        except Exception:
            pass
    pool = get_pool()
    conn = pool.getconn()
    # Verificar digest atual para permitir bootstrap sem token
    current_digest = None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_digest FROM public.consultores WHERE id = %s", [id])
            row = cur.fetchone()
            current_digest = row[0] if row else None
    finally:
        pool.putconn(conn)
    bootstrap = (request.args.get("bootstrap") or "").strip() == "1"
    if not bootstrap:
        if current_digest:
            if requester_role != "admin" and requester_id != id:
                return jsonify({"error": "não autorizado"}), 401
        else:
            if requester_role != "admin" and requester_id != id:
                return jsonify({"error": "não autorizado"}), 401
    payload = request.get_json(silent=True) or {}
    password = payload.get("password") or ""
    if len(password) < 6:
        return jsonify({"error": "senha muito curta"}), 400
    digest = _hash_password(password)
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE public.consultores SET password_digest = %s, updated_at = now() WHERE id = %s", [digest, id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/user_produtores", methods=["GET"])
def list_user_produtores():
    ensure_consultores_schema()
    user_id = request.args.get("user_id")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            if user_id:
                cur.execute("SELECT id, user_id, produtor_numerocm, created_at FROM public.user_produtores WHERE user_id = %s", [user_id])
            else:
                cur.execute("SELECT id, user_id, produtor_numerocm, created_at FROM public.user_produtores")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            return jsonify({"items": [dict(zip(cols, r)) for r in rows]})
    finally:
        pool.putconn(conn)

@app.route("/user_produtores", methods=["POST"])
def add_user_produtor():
    ensure_consultores_schema()
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    produtor_numerocm = payload.get("produtor_numerocm")
    if not user_id or not produtor_numerocm:
        return jsonify({"error": "dados ausentes"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO public.user_produtores (id, user_id, produtor_numerocm) VALUES (%s,%s,%s)", [str(uuid.uuid4()), user_id, produtor_numerocm])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/user_produtores/<id>", methods=["DELETE"])
def remove_user_produtor(id: str):
    ensure_consultores_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.user_produtores WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/user_fazendas", methods=["GET"])
def list_user_fazendas():
    ensure_consultores_schema()
    user_id = request.args.get("user_id")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            if user_id:
                cur.execute("SELECT id, user_id, fazenda_id, created_at FROM public.user_fazendas WHERE user_id = %s", [user_id])
            else:
                cur.execute("SELECT id, user_id, fazenda_id, created_at FROM public.user_fazendas")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            return jsonify({"items": [dict(zip(cols, r)) for r in rows]})
    finally:
        pool.putconn(conn)

@app.route("/user_fazendas", methods=["POST"])
def add_user_fazenda():
    ensure_consultores_schema()
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    fazenda_id = payload.get("fazenda_id")
    if not user_id or not fazenda_id:
        return jsonify({"error": "dados ausentes"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO public.user_fazendas (id, user_id, fazenda_id) VALUES (%s,%s,%s)", [str(uuid.uuid4()), user_id, fazenda_id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/user_fazendas/<id>", methods=["DELETE"])
def remove_user_fazenda(id: str):
    ensure_consultores_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.user_fazendas WHERE id = %s", [id])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/gestor_consultores", methods=["GET"])
def list_gestor_consultores():
    ensure_gestor_consultores_schema()
    user_id = request.args.get("user_id")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            if user_id:
                cur.execute("SELECT id, user_id, numerocm_consultor, created_at FROM public.gestor_consultores WHERE user_id = %s ORDER BY created_at DESC", [user_id])
            else:
                cur.execute("SELECT id, user_id, numerocm_consultor, created_at FROM public.gestor_consultores ORDER BY created_at DESC")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/gestor_consultores", methods=["POST"])
def add_gestor_consultor():
    ensure_gestor_consultores_schema()
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    numerocm_consultor = payload.get("numerocm_consultor")
    if not user_id or not numerocm_consultor:
        return jsonify({"error": "user_id e numerocm_consultor obrigatórios"}), 400
    id_val = str(uuid.uuid4())
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.gestor_consultores (id, user_id, numerocm_consultor)
                    VALUES (%s, %s, %s)
                    """,
                    [id_val, user_id, numerocm_consultor]
                )
        return jsonify({"ok": True, "id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/gestor_consultores/<id>", methods=["DELETE"])
def remove_gestor_consultor(id: str):
    ensure_gestor_consultores_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM public.gestor_consultores WHERE id = %s", [id])
        return jsonify({"ok": True})
    finally:
        pool.putconn(conn)

# moved to end of file to ensure all routes are registered before running
@app.route("/embalagens", methods=["GET"])
def list_embalagens():
    ensure_embalagens_schema()
    scope = (request.args.get("scope") or "").strip().lower()
    cultura = (request.args.get("cultura") or "").strip()
    only_active = True if (request.args.get("ativo") or "true").strip().lower() in ("true", "1") else False
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            where = []
            vals = []
            if only_active:
                where.append("ativo = true")
            if scope in ("cultivar", "fertilizante", "defensivo"):
                col = {
                    "cultivar": "scope_cultivar",
                    "fertilizante": "scope_fertilizante",
                    "defensivo": "scope_defensivo",
                }[scope]
                where.append(f"{col} = true")
            if cultura:
                where.append("(cultura IS NULL OR cultura = %s)")
                vals.append(cultura)
            sql = "SELECT id, nome, ativo, scope_cultivar, scope_fertilizante, scope_defensivo, cultura, created_at, updated_at FROM public.embalagens"
            if where:
                sql += " WHERE " + " AND ".join(where)
            sql += " ORDER BY nome"
            cur.execute(sql, vals)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/embalagens/bulk", methods=["POST"])
def upsert_embalagens_bulk():
    ensure_embalagens_schema()
    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        return jsonify({"error": "items vazio"}), 400
    pool = get_pool()
    conn = pool.getconn()
    inserted = 0
    updated = 0
    try:
        with conn:
            with conn.cursor() as cur:
                for it in items:
                    idv = (it.get("id") or str(uuid.uuid4())).strip()
                    nome = (it.get("nome") or "").strip()
                    ativo = bool(it.get("ativo", True))
                    sc_cult = bool(it.get("scope_cultivar", False)) or ("CULTIVAR" in (it.get("scopes") or []))
                    sc_fert = bool(it.get("scope_fertilizante", False)) or ("FERTILIZANTE" in (it.get("scopes") or []))
                    sc_def = bool(it.get("scope_defensivo", False)) or ("DEFENSIVO" in (it.get("scopes") or []))
                    cultura = it.get("cultura")
                    if not nome:
                        continue
                    cur.execute(
                        """
                        INSERT INTO public.embalagens (id, nome, ativo, scope_cultivar, scope_fertilizante, scope_defensivo, cultura)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                          nome = EXCLUDED.nome,
                          ativo = EXCLUDED.ativo,
                          scope_cultivar = EXCLUDED.scope_cultivar,
                          scope_fertilizante = EXCLUDED.scope_fertilizante,
                          scope_defensivo = EXCLUDED.scope_defensivo,
                          cultura = EXCLUDED.cultura,
                          updated_at = now()
                        """,
                        [idv, nome, ativo, sc_cult, sc_fert, sc_def, cultura],
                    )
                    inserted += 1
        return jsonify({"ok": True, "processed": inserted, "updated": updated})
    finally:
        pool.putconn(conn)

if __name__ == "__main__":
    ensure_app_versions_schema()
    app.run(host="0.0.0.0", port=5000)
