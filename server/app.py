import os
from flask import Flask, jsonify, request
from werkzeug.utils import secure_filename
from alembic.config import Config as _AlembicConfig
from alembic import command as _alembic_command
from flask_cors import CORS
from db import get_pool, ensure_defensivos_schema, ensure_system_config_schema, get_config_map, upsert_config_items, ensure_fertilizantes_schema, ensure_safras_schema, ensure_programacao_schema, ensure_consultores_schema, ensure_import_history_schema, ensure_calendario_aplicacoes_schema, ensure_epocas_schema, ensure_justificativas_adubacao_schema, ensure_produtores_schema, ensure_fazendas_schema, ensure_talhoes_schema, ensure_cultivares_catalog_schema, ensure_tratamentos_sementes_schema, ensure_cultivares_tratamentos_schema, ensure_aplicacoes_defensivos_schema, ensure_gestor_consultores_schema, ensure_app_versions_schema, ensure_embalagens_schema, ensure_access_logs_schema
from sqlalchemy import text, select, delete, or_, update
from sqlalchemy.dialects.postgresql import insert as _pg_insert
from sa import get_engine, get_session
from models import AppVersion, SystemConfig, ImportHistory, DefensivoCatalog, FertilizanteCatalog, CultivarCatalog, TratamentoSemente, CultivarTratamento, Epoca, JustificativaAdubacao, Embalagem, UserFazenda, GestorConsultor, Consultor, CalendarioAplicacao, AccessLog
from psycopg2.extras import execute_values
import uuid
import time
import json
from typing import Optional, Dict, Any
import hmac
import hashlib
import base64
from urllib.request import Request, urlopen
from urllib.parse import urlsplit, urlencode
from urllib.error import URLError, HTTPError
import threading
import json as _json

app = Flask(__name__)
# 1GB limit para garantir
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  
print(f"DEBUG: MAX_CONTENT_LENGTH set to {app.config['MAX_CONTENT_LENGTH']}")

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
    ensure_access_logs_schema()
except Exception:
    pass

# Executar migrações Alembic (baseline/head)
try:
    from db import get_database_url as _get_url
    cfg = _AlembicConfig()
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "migrations"))
    cfg.set_main_option("sqlalchemy.url", _get_url())
    _alembic_command.upgrade(cfg, "head")
except Exception:
    pass

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/db/health")
def db_health():
    engine = get_engine()
    with engine.connect() as conn:
        val = conn.execute(text("SELECT 1")).scalar()
        ok = bool(val == 1)
        return jsonify({"status": "ok" if ok else "error"})

@app.route("/talhoes/import", methods=["POST"])
def import_talhoes():
    ensure_talhoes_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        try:
            raw = (request.data or b"").decode("utf-8")
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {}
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
                    [str(uuid.uuid4()), user_id, "talhoes", imported, deleted, arquivo_nome, limpar_antes]
                )
        return jsonify({"ok": True, "imported": imported, "deleted": deleted})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)
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
                cm_val = numerocm_consultor or cm_token
                if (not cm_val) and user_id:
                    try:
                        cur.execute("SELECT numerocm_consultor FROM public.consultores WHERE id = %s", [user_id])
                        r = cur.fetchone()
                        if r and r[0]:
                            cm_val = r[0]
                    except Exception:
                        pass
                
                conds = []
                if cm_val:
                    conds.append("f.numerocm_consultor = %s")
                    params.append(cm_val)
                    # Também permitir se o produtor dono da fazenda é do consultor
                    conds.append("f.numerocm IN (SELECT p.numerocm FROM public.produtores p WHERE p.numerocm_consultor = %s)")
                    params.append(cm_val)
                
                if allowed_numerocm:
                    conds.append("f.numerocm = ANY(%s)")
                    params.append(allowed_numerocm)
                    
                if allowed_fazendas:
                    conds.append("f.id = ANY(%s)")
                    params.append(allowed_fazendas)
                    
                if conds:
                    where.append("(" + " OR ".join(conds) + ")")
                else:
                    where.append("1=0")
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
    limpar = False
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
                    [str(uuid.uuid4()), user_id, "fazendas", imported, 0, arquivo_nome, False]
                )
        return jsonify({"ok": True, "imported": imported, "deleted": 0})
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
    session = get_session()
    q = select(JustificativaAdubacao)
    if only_ativas:
        q = q.where(JustificativaAdubacao.ativo == True)
    items = session.execute(q.order_by(JustificativaAdubacao.descricao)).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "descricao": it.descricao,
                "ativo": bool(it.ativo),
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/justificativas_adubacao", methods=["POST"])
def create_justificativa():
    ensure_justificativas_adubacao_schema()
    payload = request.get_json(silent=True) or {}
    id_val = str(uuid.uuid4())
    descricao = payload.get("descricao")
    ativo = bool(payload.get("ativo", True))
    session = get_session()
    session.add(JustificativaAdubacao(id=id_val, descricao=descricao, ativo=ativo))
    session.commit()
    return jsonify({"id": id_val})

@app.route("/justificativas_adubacao/<id>", methods=["PUT"])
def update_justificativa(id: str):
    ensure_justificativas_adubacao_schema()
    payload = request.get_json(silent=True) or {}
    session = get_session()
    row = session.get(JustificativaAdubacao, id)
    if not row:
        return jsonify({"error": "não encontrado"}), 404
    if "descricao" in payload:
        row.descricao = payload.get("descricao")
    if "ativo" in payload:
        row.ativo = payload.get("ativo")
    session.commit()
    return jsonify({"ok": True, "id": id})

@app.route("/justificativas_adubacao/<id>", methods=["DELETE"])
def delete_justificativa(id: str):
    ensure_justificativas_adubacao_schema()
    session = get_session()
    session.execute(delete(JustificativaAdubacao).where(JustificativaAdubacao.id == id))
    session.commit()
    return jsonify({"ok": True})

@app.route("/produtores", methods=["GET"])
def list_produtores():
    ensure_produtores_schema()
    numerocm_consultor = request.args.get("numerocm_consultor")
    auth = request.headers.get("Authorization") or ""
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            base = "SELECT id, numerocm, nome, numerocm_consultor, consultor, assistencia, compra_insumos, entrega_producao, paga_assistencia, observacao_flags, created_at, updated_at FROM public.produtores"
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
                try:
                    cur.execute("SELECT DISTINCT f.numerocm FROM public.fazendas f JOIN public.user_fazendas uf ON uf.fazenda_id = f.id WHERE uf.user_id = %s", [user_id])
                    from_fazendas = [r[0] for r in cur.fetchall()]
                    if from_fazendas:
                        allowed_numerocm = list({*(allowed_numerocm or []), *from_fazendas})
                except Exception:
                    pass
                if role == "gestor":
                    cur.execute("SELECT numerocm_consultor FROM public.gestor_consultores WHERE user_id = %s", [user_id])
                    allowed_consultores = [r[0] for r in cur.fetchall()]
            if role == "consultor":
                cm_val = numerocm_consultor or cm_token
                if (not cm_val) and user_id:
                    try:
                        cur.execute("SELECT numerocm_consultor FROM public.consultores WHERE id = %s", [user_id])
                        r = cur.fetchone()
                        if r and r[0]:
                            cm_val = r[0]
                    except Exception:
                        pass
                
                conds = []
                if cm_val:
                    conds.append("(numerocm_consultor = %s OR numerocm IN (SELECT numerocm FROM public.fazendas WHERE numerocm_consultor = %s))")
                    params.append(cm_val)
                    params.append(cm_val)
                
                if allowed_numerocm:
                    conds.append("numerocm = ANY(%s)")
                    params.append(allowed_numerocm)
                
                if conds:
                    where.append("(" + " OR ".join(conds) + ")")
                else:
                    where.append("1=0")
            elif role == "gestor":
                subconds = []
                if allowed_numerocm:
                    subconds.append("numerocm = ANY(%s)")
                    params.append(allowed_numerocm)
                if allowed_consultores:
                    subconds.append("numerocm_consultor = ANY(%s)")
                    params.append(allowed_consultores)
                cm_val = numerocm_consultor or cm_token
                if (not cm_val) and user_id:
                    try:
                        cur.execute("SELECT numerocm_consultor FROM public.consultores WHERE id = %s", [user_id])
                        r = cur.fetchone()
                        if r and r[0]:
                            cm_val = r[0]
                    except Exception:
                        pass
                if cm_val:
                    subconds.append("numerocm_consultor = %s")
                    params.append(cm_val)
                if subconds:
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
    limpar = False
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
                    [str(uuid.uuid4()), user_id, "produtores", imported, 0, arquivo_nome, False]
                )
        return jsonify({"ok": True, "imported": imported, "deleted": 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/produtores/<id>", methods=["PUT"])
def update_produtor(id: str):
    ensure_produtores_schema()
    payload = request.get_json(silent=True) or {}
    
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM public.produtores WHERE id = %s", [id])
                if not cur.fetchone():
                    return jsonify({"error": "não encontrado"}), 404

                set_clauses = []
                values = []

                if "compra_insumos" in payload:
                    set_clauses.append("compra_insumos = %s")
                    values.append(bool(payload.get("compra_insumos")))

                if "entrega_producao" in payload:
                    set_clauses.append("entrega_producao = %s")
                    values.append(bool(payload.get("entrega_producao")))

                if "entrega_producao_destino" in payload:
                    set_clauses.append("entrega_producao_destino = %s")
                    values.append(payload.get("entrega_producao_destino"))
                    
                if "paga_assistencia" in payload:
                    set_clauses.append("paga_assistencia = %s")
                    values.append(bool(payload.get("paga_assistencia")))

                if "assistencia" in payload:
                    set_clauses.append("assistencia = %s")
                    values.append(payload.get("assistencia"))
                    
                if "observacao_flags" in payload:
                    set_clauses.append("observacao_flags = %s")
                    values.append(payload.get("observacao_flags"))

                if not set_clauses:
                    return jsonify({"ok": True, "msg": "Nada a atualizar"})
                
                set_clauses.append("updated_at = now()")
                
                query = f"UPDATE public.produtores SET {', '.join(set_clauses)} WHERE id = %s"
                values.append(id)
                
                cur.execute(query, values)
                
        return jsonify({"ok": True, "id": id})
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
    session = get_session()
    q = select(Epoca)
    if only_ativas:
        q = q.where(Epoca.ativa == True)
    items = session.execute(q.order_by(Epoca.nome)).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "nome": it.nome,
                "descricao": it.descricao,
                "ativa": bool(it.ativa),
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/epocas", methods=["POST"])
def create_epoca():
    ensure_epocas_schema()
    payload = request.get_json(silent=True) or {}
    id_val = str(uuid.uuid4())
    nome = payload.get("nome")
    descricao = payload.get("descricao")
    ativa = bool(payload.get("ativa", True))
    session = get_session()
    session.add(Epoca(id=id_val, nome=nome, descricao=descricao, ativa=ativa))
    session.commit()
    return jsonify({"id": id_val})

@app.route("/epocas/<id>", methods=["PUT"])
def update_epoca(id: str):
    ensure_epocas_schema()
    payload = request.get_json(silent=True) or {}
    session = get_session()
    row = session.get(Epoca, id)
    if not row:
        return jsonify({"error": "não encontrado"}), 404
    if "nome" in payload:
        row.nome = payload.get("nome")
    if "descricao" in payload:
        row.descricao = payload.get("descricao")
    if "ativa" in payload:
        row.ativa = payload.get("ativa")
    session.commit()
    return jsonify({"ok": True, "id": id})

@app.route("/epocas/<id>", methods=["DELETE"])
def delete_epoca(id: str):
    ensure_epocas_schema()
    session = get_session()
    session.execute(delete(Epoca).where(Epoca.id == id))
    session.commit()
    return jsonify({"ok": True})

@app.route("/calendario_aplicacoes", methods=["GET"])
def list_calendario_aplicacoes():
    ensure_calendario_aplicacoes_schema()
    session = get_session()
    items = session.execute(select(CalendarioAplicacao).order_by(CalendarioAplicacao.descricao_classe.asc())).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "cod_aplic": it.cod_aplic,
                "descr_aplicacao": it.descr_aplicacao,
                "cod_aplic_ger": it.cod_aplic_ger,
                "cod_classe": it.cod_classe,
                "descricao_classe": it.descricao_classe,
                "trat_sementes": it.trat_sementes,
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/calendario_aplicacoes/<id>", methods=["PUT"])
def update_calendario_aplicacao(id: str):
    ensure_calendario_aplicacoes_schema()
    payload = request.get_json(silent=True) or {}
    session = get_session()
    try:
        row = session.get(CalendarioAplicacao, id)
        if not row:
            return jsonify({"error": "não encontrado"}), 404
        if "descr_aplicacao" in payload:
            row.descr_aplicacao = payload.get("descr_aplicacao")
        if "cod_classe" in payload:
            row.cod_classe = payload.get("cod_classe")
        if "descricao_classe" in payload:
            row.descricao_classe = payload.get("descricao_classe")
        if "trat_sementes" in payload:
            row.trat_sementes = payload.get("trat_sementes")
        if "cod_aplic_ger" in payload:
            row.cod_aplic_ger = payload.get("cod_aplic_ger")
        session.commit()
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/calendario_aplicacoes/<id>", methods=["DELETE"])
def delete_calendario_aplicacao(id: str):
    ensure_calendario_aplicacoes_schema()
    session = get_session()
    try:
        session.execute(delete(CalendarioAplicacao).where(CalendarioAplicacao.id == id))
        session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/calendario_aplicacoes/import", methods=["POST"])
def import_calendario_aplicacoes():
    ensure_calendario_aplicacoes_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True) or {}
    limpar_antes = False
    items = payload.get("items") or []
    user_id = payload.get("user_id")
    arquivo_nome = payload.get("arquivo_nome")
    session = get_session()
    deleted_count = 0
    imported_count = 0
    try:
        
        to_upsert = []
        for it in items:
            to_upsert.append({
                "id": str(uuid.uuid4()),
                "cod_aplic": str(it.get("cod_aplic") or "").strip(),
                "descr_aplicacao": it.get("descr_aplicacao"),
                "cod_aplic_ger": it.get("cod_aplic_ger"),
                "cod_classe": it.get("cod_classe"),
                "descricao_classe": it.get("descricao_classe"),
                "trat_sementes": it.get("trat_sementes"),
            })
        if to_upsert:
            stmt = _pg_insert(CalendarioAplicacao.__table__).values(to_upsert)
            session.execute(
                stmt.on_conflict_do_update(
                    index_elements=[CalendarioAplicacao.cod_aplic],
                    set_={
                        "descr_aplicacao": stmt.excluded.descr_aplicacao,
                        "cod_aplic_ger": stmt.excluded.cod_aplic_ger,
                        "cod_classe": stmt.excluded.cod_classe,
                        "descricao_classe": stmt.excluded.descricao_classe,
                        "trat_sementes": stmt.excluded.trat_sementes,
                        "updated_at": text("now()"),
                    },
                )
            )
            imported_count = len(to_upsert)
        session.add(ImportHistory(id=str(uuid.uuid4()), user_id=user_id, tabela_nome="calendario_aplicacoes", registros_importados=imported_count, registros_deletados=0, arquivo_nome=arquivo_nome, limpar_antes=False))
        session.commit()
        return jsonify({"imported": imported_count, "deleted": 0})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/version")
def version():
    try:
        session = get_session()
        env = (request.args.get("env") or "").strip()
        q = select(AppVersion)
        if env:
            q = q.where(AppVersion.environment == env)
        row = session.execute(q.order_by(AppVersion.created_at.desc())).scalars().first()
        if row:
            return jsonify({
                "app": "agro-plan-assist-api",
                "version": row.version,
                "build": row.build,
                "environment": row.environment,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            })
    except Exception:
        pass
    return jsonify({"app": "agro-plan-assist-api", "version": "0.1.0"})

@app.route("/import_history", methods=["GET"])
def list_import_history():
    ensure_import_history_schema()
    session = get_session()
    items = session.execute(
        select(ImportHistory).order_by(ImportHistory.created_at.desc()).limit(100)
    ).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "user_id": it.user_id,
                "tabela_nome": it.tabela_nome,
                "registros_importados": it.registros_importados,
                "registros_deletados": it.registros_deletados,
                "arquivo_nome": it.arquivo_nome,
                "limpar_antes": bool(it.limpar_antes),
                "created_at": it.created_at.isoformat() if it.created_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/consultores", methods=["GET"])
def list_consultores():
    ensure_consultores_schema()
    session = get_session()
    items = session.execute(select(Consultor).order_by(Consultor.consultor.asc())).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "numerocm_consultor": it.numerocm_consultor,
                "consultor": it.consultor,
                "email": it.email,
                "pode_editar_programacao": bool(it.pode_editar_programacao),
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/consultores", methods=["POST"])
def create_consultor():
    ensure_consultores_schema()
    payload = request.get_json(silent=True) or {}
    id_val = str(uuid.uuid4())
    numerocm_consultor = payload.get("numerocm_consultor")
    consultor = payload.get("consultor")
    email = (payload.get("email") or "").lower()
    session = get_session()
    try:
        session.add(Consultor(id=id_val, numerocm_consultor=numerocm_consultor, consultor=consultor, email=email))
        session.commit()
        return jsonify({"id": id_val})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/consultores/<id>", methods=["PUT"])
def update_consultor(id: str):
    ensure_consultores_schema()
    payload = request.get_json(silent=True) or {}
    session = get_session()
    try:
        row = session.get(Consultor, id)
        if not row:
            return jsonify({"ok": True})
        if "consultor" in payload:
            row.consultor = payload.get("consultor")
        if "email" in payload:
            v = payload.get("email")
            row.email = (v or "").lower() if v is not None else row.email
        if "numerocm_consultor" in payload:
            row.numerocm_consultor = payload.get("numerocm_consultor")
        if "pode_editar_programacao" in payload:
            row.pode_editar_programacao = bool(payload.get("pode_editar_programacao"))
        session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/consultores/<id>", methods=["DELETE"])
def delete_consultor(id: str):
    ensure_consultores_schema()
    session = get_session()
    try:
        session.execute(delete(Consultor).where(Consultor.id == id))
        session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/consultores/by_email", methods=["GET"])
def get_consultor_by_email():
    ensure_consultores_schema()
    email = (request.args.get("email") or "").lower()
    session = get_session()
    row = session.execute(select(Consultor).where(Consultor.email == email)).scalars().first()
    if not row:
        return jsonify({"item": None}), 404
    return jsonify({
        "item": {
            "id": row.id,
            "numerocm_consultor": row.numerocm_consultor,
            "consultor": row.consultor,
            "email": row.email,
        }
    })

@app.route("/consultores/import", methods=["POST"])
def import_consultores():
    ensure_consultores_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True) or {}
    limpar_antes = False
    items = payload.get("items") or []
    user_id = payload.get("user_id")
    arquivo_nome = payload.get("arquivo_nome")
    session = get_session()
    deleted_count = 0
    imported_count = 0
    try:
        
        to_upsert = []
        for it in items:
            to_upsert.append({
                "id": str(uuid.uuid4()),
                "numerocm_consultor": it.get("numerocm_consultor"),
                "consultor": it.get("consultor"),
                "email": (it.get("email") or "").lower(),
            })
        if to_upsert:
            stmt = _pg_insert(Consultor.__table__).values(to_upsert)
            session.execute(
                stmt.on_conflict_do_update(
                    index_elements=[Consultor.email],
                    set_={
                        "numerocm_consultor": stmt.excluded.numerocm_consultor,
                        "consultor": stmt.excluded.consultor,
                        "updated_at": text("now()"),
                    },
                )
            )
            imported_count = len(to_upsert)
        session.add(ImportHistory(id=str(uuid.uuid4()), user_id=user_id, tabela_nome="consultores", registros_importados=imported_count, registros_deletados=0, arquivo_nome=arquivo_nome, limpar_antes=False))
        session.commit()
        return jsonify({"imported": imported_count, "deleted": 0})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/programacoes", methods=["GET"])
def list_programacoes():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            base = (
                "SELECT p.id, p.user_id, p.produtor_numerocm, p.fazenda_idfazenda, p.area, p.area_hectares, p.safra_id, p.tipo, p.revisada, p.created_at, p.updated_at, "
                "(SELECT s.ano_inicio || '/' || s.ano_fim FROM public.safras s WHERE s.id = p.safra_id LIMIT 1) as safra_nome, "
                "(SELECT pt.epoca_id FROM public.programacao_talhoes pt WHERE pt.programacao_id = p.id LIMIT 1) as epoca_id, "
                "(SELECT f.id FROM public.fazendas f WHERE f.idfazenda = p.fazenda_idfazenda AND f.numerocm = p.produtor_numerocm LIMIT 1) as fazenda_uuid "
                "FROM public.programacoes p"
            )
            auth = request.headers.get("Authorization") or ""
            role = None
            user_id = None
            cm_token = None
            cm_arg = (request.args.get("numerocm_consultor") or "").strip()
            safra_id = request.args.get("safra_id")
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
            if cm_arg:
                where.append("(EXISTS (SELECT 1 FROM public.programacao_cultivares pc WHERE pc.programacao_id = p.id AND pc.numerocm_consultor = %s) OR EXISTS (SELECT 1 FROM public.programacao_adubacao pa WHERE pa.programacao_id = p.id AND pa.numerocm_consultor = %s) OR EXISTS (SELECT 1 FROM public.fazendas f WHERE f.numerocm_consultor = %s AND f.idfazenda = p.fazenda_idfazenda AND f.numerocm = p.produtor_numerocm))")
                params.append(cm_arg)
                params.append(cm_arg)
                params.append(cm_arg)
            elif user_id and role in ("gestor", "consultor"):
                cur.execute("SELECT produtor_numerocm FROM public.user_produtores WHERE user_id = %s", [user_id])
                allowed_numerocm = [r[0] for r in cur.fetchall()]
                cur.execute("SELECT fazenda_id FROM public.user_fazendas WHERE user_id = %s", [user_id])
                allowed_fazendas = [r[0] for r in cur.fetchall()]

                subconds = []
                # 1. Permissões via vínculo explícito (user_produtores / user_fazendas)
                if allowed_numerocm:
                    subconds.append("p.produtor_numerocm = ANY(%s)")
                    params.append(allowed_numerocm)
                if allowed_fazendas:
                    subconds.append("EXISTS (SELECT 1 FROM public.fazendas f2 WHERE f2.id = ANY(%s) AND f2.idfazenda = p.fazenda_idfazenda AND f2.numerocm = p.produtor_numerocm)")
                    params.append(allowed_fazendas)
                
                # 2. Permissões via Token de Consultor (legacy/metadata)
                if role == "consultor" and cm_token:
                    # Ajuste: Removida a permissão por "consultor do produtor" para evitar vazamento entre fazendas de consultores diferentes
                    # E reforçada a verificação de fazenda para incluir produtor_numerocm
                    subconds.append("(EXISTS (SELECT 1 FROM public.programacao_cultivares pc WHERE pc.programacao_id = p.id AND pc.numerocm_consultor = %s) OR EXISTS (SELECT 1 FROM public.programacao_adubacao pa WHERE pa.programacao_id = p.id AND pa.numerocm_consultor = %s) OR EXISTS (SELECT 1 FROM public.fazendas f WHERE f.numerocm_consultor = %s AND f.idfazenda = p.fazenda_idfazenda AND f.numerocm = p.produtor_numerocm))")
                    params.append(cm_token)
                    params.append(cm_token)
                    params.append(cm_token)


                if subconds:
                    where.append("(" + " OR ".join(subconds) + ")")
                else:
                    where.append("FALSE")
            if safra_id:
                where.append("p.safra_id = %s")
                params.append(safra_id)
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
    tipo = (payload.get("tipo") or "PROGRAMACAO").strip().upper()
    auth = request.headers.get("Authorization") or ""
    cm_token = None
    if auth.lower().startswith("bearer "):
        try:
            payload_jwt = verify_jwt(auth.split(" ", 1)[1])
            cm_token = payload_jwt.get("numerocm_consultor")
            # Garantir que o user_id seja o do usuário autenticado
            if payload_jwt.get("user_id"):
                user_id = payload_jwt.get("user_id")
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
                        AND pt.epoca_id IS NOT DISTINCT FROM %s
                        """,
                        [safra_id, fazenda_idfazenda, talhao_ids, epoca_id],
                    )
                    rows_conf = cur.fetchall()
                    if rows_conf:
                        return jsonify({
                            "error": "talhao já possui programação nesta safra e época",
                            "talhoes": [r[0] for r in rows_conf],
                            "talhoes_nomes": [r[1] for r in rows_conf if r[1] is not None]
                        }), 400
                cur.execute(
                    """
                    INSERT INTO public.programacoes (id, user_id, produtor_numerocm, fazenda_idfazenda, area, area_hectares, safra_id, tipo)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    [prog_id, user_id, produtor_numerocm, fazenda_idfazenda, area, area_hectares, safra_id, tipo]
                )
                for item in cultivares:
                    cult_id = item.get("id") or str(uuid.uuid4())
                    cultura_val = item.get("cultura")
                    if not cultura_val and item.get("cultivar"):
                        try:
                            cur.execute("SELECT cultura FROM public.cultivares_catalog WHERE cultivar = %s", [item.get("cultivar")])
                            r_cat = cur.fetchone()
                            if r_cat: cultura_val = r_cat[0]
                        except Exception:
                            pass
                    tr_ids = item.get("tratamento_ids") or ([item.get("tratamento_id")] if item.get("tratamento_id") else [])
                    first_tr = None if str(item.get("tipo_tratamento")).upper() == "NÃO" else (tr_ids[0] if tr_ids else None)
                    cur.execute(
                        """
                        INSERT INTO public.programacao_cultivares (
                          id, programacao_id, user_id, produtor_numerocm, area, area_hectares, numerocm_consultor, cultivar, quantidade, unidade,
                          percentual_cobertura, tipo_embalagem, tipo_tratamento, tratamento_id, data_plantio, populacao_recomendada,
                          semente_propria, referencia_rnc_mapa, sementes_por_saca, safra, epoca_id, porcentagem_salva, cultura
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [cult_id, prog_id, user_id, produtor_numerocm, area, area_hectares, cm_cons, item.get("cultivar"), 0, "kg",
                         item.get("percentual_cobertura"), item.get("tipo_embalagem"), item.get("tipo_tratamento"), first_tr,
                         item.get("data_plantio"), item.get("populacao_recomendada") or 0, bool(item.get("semente_propria")),
                         item.get("referencia_rnc_mapa"), item.get("sementes_por_saca") or 0, safra_id, epoca_id, 0, cultura_val]
                    )
                    for tid in (tr_ids or []):
                        if not tid: continue
                        cur.execute(
                            """
                            INSERT INTO public.programacao_cultivares_tratamentos (id, programacao_cultivar_id, tratamento_id)
                            VALUES (%s, %s, %s)
                            """,
                            [str(uuid.uuid4()), cult_id, tid]
                        )
                    if str(item.get("tipo_tratamento")).upper() == "NA FAZENDA":
                        for d in (item.get("defensivos_fazenda") or []):
                            cod_val = None
                            try:
                                cur.execute(
                                    "SELECT cod_item FROM public.defensivos_catalog WHERE item = %s AND (%s IS NULL OR grupo = %s) ORDER BY cod_item LIMIT 1",
                                    [d.get("defensivo"), d.get("classe"), d.get("classe")]
                                )
                                r = cur.fetchone()
                                if r:
                                    cod_val = r[0]
                            except Exception:
                                cod_val = None
                            cur.execute(
                                """
                                INSERT INTO public.programacao_cultivares_defensivos
                                (id, programacao_cultivar_id, classe, aplicacao, defensivo, cod_item, dose, cobertura, total, produto_salvo)
                                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                                """,
                                [str(uuid.uuid4()), cult_id, d.get("classe"), d.get("aplicacao"), d.get("defensivo"), cod_val,
                                 d.get("dose"), d.get("cobertura"), d.get("total"), bool(d.get("produto_salvo"))]
                            )
                for a in adubacao:
                    cod_val = None
                    try:
                        cur.execute(
                            "SELECT cod_item FROM public.fertilizantes_catalog WHERE item = %s ORDER BY cod_item LIMIT 1",
                            [a.get("formulacao")]
                        )
                        r = cur.fetchone()
                        if r:
                            cod_val = r[0]
                    except Exception:
                        cod_val = None
                    cur.execute(
                        """
                        INSERT INTO public.programacao_adubacao (
                          id, programacao_id, user_id, produtor_numerocm, area, numerocm_consultor, formulacao, cod_item, dose, percentual_cobertura,
                          data_aplicacao, embalagem, justificativa_nao_adubacao_id, fertilizante_salvo,
                          porcentagem_salva, total, safra_id
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [str(uuid.uuid4()), prog_id, user_id, produtor_numerocm, area, cm_cons, a.get("formulacao"), cod_val, a.get("dose"), a.get("percentual_cobertura"),
                         a.get("data_aplicacao"), a.get("embalagem"), a.get("justificativa_nao_adubacao_id"), bool(a.get("fertilizante_salvo")),
                         float(a.get("porcentagem_salva") or 0), None, safra_id]
                    )
                for tid in talhao_ids:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_talhoes (id, programacao_id, talhao_id, safra_id, fazenda_idfazenda, epoca_id)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        [str(uuid.uuid4()), prog_id, tid, safra_id, fazenda_idfazenda, epoca_id]
                    )
        return jsonify({"id": prog_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacoes/<id>", methods=["DELETE"])
def delete_programacao(id: str):
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
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pt.talhao_id, t.nome, t.area
                FROM public.programacao_talhoes pt
                LEFT JOIN public.talhoes t ON t.id = pt.talhao_id
                WHERE pt.programacao_id = %s
            """, [id])
            rows = cur.fetchall()
            talhoes = [{"id": r[0], "nome": (r[1] or r[0]), "area": float(r[2] or 0)} for r in rows]
            talhoes_map = {r[0]: (r[1] or r[0]) for r in rows}

            cur.execute("SELECT * FROM public.programacao_cultivares WHERE programacao_id = %s", [id])
            cols = [d[0] for d in cur.description]
            cults = [dict(zip(cols, r)) for r in cur.fetchall()]
            
            # Se cultura estiver vazio, tentar buscar do catalogo
            for c in cults:
                if not c.get("cultura") and c.get("cultivar"):
                    try:
                        cur.execute("SELECT cultura FROM public.cultivares_catalog WHERE cultivar = %s", [c.get("cultivar")])
                        r_cat = cur.fetchone()
                        if r_cat:
                            c["cultura"] = r_cat[0]
                    except Exception:
                        pass

            cur.execute("SELECT programacao_cultivar_id, tratamento_id FROM public.programacao_cultivares_tratamentos WHERE programacao_cultivar_id IN (SELECT id FROM public.programacao_cultivares WHERE programacao_id = %s)", [id])
            trat_rows = cur.fetchall()
            tratamentos = {}
            for pcid, tid in trat_rows:
                tratamentos.setdefault(pcid, []).append(tid)
            cur.execute("SELECT * FROM public.programacao_cultivares_defensivos WHERE programacao_cultivar_id IN (SELECT id FROM public.programacao_cultivares WHERE programacao_id = %s)", [id])
            def_cols = [d[0] for d in cur.description]
            def_rows = cur.fetchall()
            defensivos = [dict(zip(def_cols, r)) for r in def_rows] if def_rows else []
            cur.execute("""
                SELECT pa.*, j.descricao as justificativa_descricao
                FROM public.programacao_adubacao pa
                LEFT JOIN public.justificativas_adubacao j ON j.id = pa.justificativa_nao_adubacao_id
                WHERE pa.programacao_id = %s
            """, [id])
            ad_cols = [d[0] for d in cur.description]
            ad_rows = cur.fetchall()
            adubacao = [dict(zip(ad_cols, r)) for r in ad_rows] if ad_rows else []
            return jsonify({"talhoes": talhoes, "talhoes_nomes": talhoes_map, "cultivares": cults, "tratamentos": tratamentos, "defensivos": defensivos, "adubacao": adubacao})
    finally:
        pool.putconn(conn)

@app.route("/programacoes/<id>", methods=["PUT"])
def update_programacao(id: str):
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    produtor_numerocm = payload.get("produtor_numerocm")
    fazenda_idfazenda = payload.get("fazenda_idfazenda")
    area = payload.get("area")
    area_hectares = payload.get("area_hectares")
    safra_id = payload.get("safra_id")
    revisada = payload.get("revisada")
    tipo = (payload.get("tipo") or None)
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
                        AND pt.epoca_id IS NOT DISTINCT FROM %s
                        """,
                        [safra_id, fazenda_idfazenda, talhao_ids, id, epoca_id],
                    )
                    rows_conf = cur.fetchall()
                    if rows_conf:
                        return jsonify({
                            "error": "talhao já possui programação nesta safra e época",
                            "talhoes": [r[0] for r in rows_conf],
                            "talhoes_nomes": [r[1] for r in rows_conf if r[1] is not None]
                        }), 400

                # Check if it's a partial update (e.g. only revisada flag)
                is_partial = False
                # If main required fields are missing, assume it is a partial update for revisada
                # We ignore lists checks because if produtor_numerocm is missing, we can't do a full update anyway.
                if not produtor_numerocm and not fazenda_idfazenda and not area and revisada is not None:
                    is_partial = True

                if is_partial:
                    cur.execute(
                        "UPDATE public.programacoes SET revisada = %s, updated_at = now() WHERE id = %s",
                        [bool(revisada), id]
                    )
                else:
                    # Check for required fields for full update
                    if not produtor_numerocm or not fazenda_idfazenda or not area:
                        # If required fields are missing in a non-partial update, fetch them from DB
                        # or simply fail. Here we try to fetch existing values to be safe, or just return error.
                        # However, since we might be converting a partial request that failed detection?
                        # Let's assume if it reached here with missing fields, it is invalid unless we merge.
                        
                        # Better approach: If missing required fields, fetch current state
                        cur.execute("SELECT user_id, produtor_numerocm, fazenda_idfazenda, area, area_hectares, safra_id, tipo, revisada FROM public.programacoes WHERE id = %s", [id])
                        current = cur.fetchone()
                        if current:
                            user_id = user_id or current[0]
                            produtor_numerocm = produtor_numerocm or current[1]
                            fazenda_idfazenda = fazenda_idfazenda or current[2]
                            area = area or current[3]
                            area_hectares = area_hectares or current[4]
                            safra_id = safra_id or current[5]
                            if tipo is None: tipo = current[6]
                            if revisada is None: revisada = current[7]
                            
                            if epoca_id is None:
                                try:
                                    cur.execute("SELECT epoca_id FROM public.programacao_talhoes WHERE programacao_id = %s LIMIT 1", [id])
                                    r_ep = cur.fetchone()
                                    if r_ep:
                                        epoca_id = r_ep[0]
                                except Exception:
                                    pass

                    cm_cons = cm_token
                    if not cm_cons:
                        try:
                            cur.execute("SELECT numerocm_consultor FROM public.fazendas WHERE idfazenda = %s AND numerocm = %s", [fazenda_idfazenda, produtor_numerocm])
                            r = cur.fetchone()
                            cm_cons = r[0] if r else None
                        except Exception:
                            cm_cons = None

                    cur.execute(
                        """
                        UPDATE public.programacoes
                        SET user_id = %s, produtor_numerocm = %s, fazenda_idfazenda = %s, area = %s, area_hectares = %s, safra_id = %s, tipo = %s, revisada = %s, updated_at = now()
                        WHERE id = %s
                        """,
                        [user_id, produtor_numerocm, fazenda_idfazenda, area, area_hectares, safra_id, (str(tipo).strip().upper() if tipo is not None else None), bool(revisada) if revisada is not None else False, id]
                    )
                    cur.execute("DELETE FROM public.programacao_cultivares WHERE programacao_id = %s", [id])
                    cur.execute("DELETE FROM public.programacao_talhoes WHERE programacao_id = %s", [id])
                    cur.execute("DELETE FROM public.programacao_adubacao WHERE programacao_id = %s", [id])
                    
                    for item in cultivares:
                        cult_id = item.get("id") or str(uuid.uuid4())
                        tr_ids = item.get("tratamento_ids") or ([item.get("tratamento_id")] if item.get("tratamento_id") else [])
                        first_tr = None if str(item.get("tipo_tratamento") or "").upper() == "NÃO" else (tr_ids[0] if tr_ids else None)
                        cur.execute(
                            """
                            INSERT INTO public.programacao_cultivares (
                              id, programacao_id, user_id, produtor_numerocm, area, area_hectares, numerocm_consultor, cultivar, quantidade, unidade,
                              percentual_cobertura, tipo_embalagem, tipo_tratamento, tratamento_id, data_plantio, populacao_recomendada,
                              semente_propria, referencia_rnc_mapa, sementes_por_saca, safra, epoca_id, porcentagem_salva
                            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                            """,
                            [cult_id, id, user_id, produtor_numerocm, area, area_hectares, cm_cons, item.get("cultivar"), 0, "kg",
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
                                [str(uuid.uuid4()), cult_id, tid]
                            )
                        if str(item.get("tipo_tratamento") or "").upper() == "NA FAZENDA":
                            for d in (item.get("defensivos_fazenda") or []):
                                cod_val = None
                                try:
                                    cur.execute(
                                        "SELECT cod_item FROM public.defensivos_catalog WHERE item = %s AND (%s IS NULL OR grupo = %s) ORDER BY cod_item LIMIT 1",
                                        [d.get("defensivo"), d.get("classe"), d.get("classe")]
                                    )
                                    r = cur.fetchone()
                                    if r:
                                        cod_val = r[0]
                                except Exception:
                                    cod_val = None
                                cur.execute(
                                    """
                                    INSERT INTO public.programacao_cultivares_defensivos
                                    (id, programacao_cultivar_id, classe, aplicacao, defensivo, cod_item, dose, cobertura, total, produto_salvo)
                                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                                    """,
                                    [str(uuid.uuid4()), cult_id, d.get("classe"), d.get("aplicacao"), d.get("defensivo"), cod_val,
                                     d.get("dose"), d.get("cobertura"), d.get("total"), bool(d.get("produto_salvo"))]
                                )
                    for a in adubacao:
                        cod_val = None
                        try:
                            cur.execute(
                                "SELECT cod_item FROM public.fertilizantes_catalog WHERE item = %s ORDER BY cod_item LIMIT 1",
                                [a.get("formulacao")]
                            )
                            r = cur.fetchone()
                            if r:
                                cod_val = r[0]
                        except Exception:
                            cod_val = None
                        cur.execute(
                            """
                            INSERT INTO public.programacao_adubacao (
                              id, programacao_id, user_id, produtor_numerocm, area, numerocm_consultor, formulacao, cod_item, dose, percentual_cobertura,
                              data_aplicacao, embalagem, justificativa_nao_adubacao_id, fertilizante_salvo,
                              porcentagem_salva, total, safra_id
                            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                            """,
                            [str(uuid.uuid4()), id, user_id, produtor_numerocm, area, cm_cons, a.get("formulacao"), cod_val, a.get("dose"), a.get("percentual_cobertura"),
                             a.get("data_aplicacao"), a.get("embalagem"), a.get("justificativa_nao_adubacao_id"), bool(a.get("fertilizante_salvo")),
                             float(a.get("porcentagem_salva") or 0), None, safra_id]
                        )
                for tid in talhao_ids:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_talhoes (id, programacao_id, talhao_id, safra_id, fazenda_idfazenda, epoca_id)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        [str(uuid.uuid4()), id, tid, safra_id, fazenda_idfazenda, epoca_id]
                    )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacao_talhoes", methods=["GET"])
def list_programacao_talhoes():
    safra_id = request.args.get("safra_id")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            if safra_id:
                cur.execute("SELECT * FROM public.programacao_talhoes WHERE safra_id = %s ORDER BY created_at DESC", [safra_id])
            else:
                cur.execute("SELECT * FROM public.programacao_talhoes ORDER BY created_at DESC")
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/programacao_talhoes", methods=["POST"])
def create_programacao_talhoes():
    payload = request.get_json(silent=True) or {}
    id_val = payload.get("id") or str(uuid.uuid4())
    programacao_id = payload.get("programacao_id")
    talhao_id = payload.get("talhao_id")
    safra_id = payload.get("safra_id")
    epoca_id = payload.get("epoca_id")
    fazenda_idfazenda = payload.get("fazenda_idfazenda")

    if not programacao_id or not talhao_id or not safra_id:
        return jsonify({"error": "campos obrigatórios ausentes"}), 400

    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM public.programacao_talhoes WHERE programacao_id = %s AND talhao_id = %s AND safra_id = %s",
                    [programacao_id, talhao_id, safra_id]
                )
                if cur.fetchone():
                    return jsonify({"error": "talhao já vinculado nesta safra"}), 400

                if not epoca_id:
                    try:
                        cur.execute("SELECT epoca_id FROM public.programacao_talhoes WHERE programacao_id = %s LIMIT 1", [programacao_id])
                        r_ep = cur.fetchone()
                        if r_ep:
                            epoca_id = r_ep[0]
                    except Exception:
                        pass

                cur.execute(
                    """
                    INSERT INTO public.programacao_talhoes (id, programacao_id, talhao_id, safra_id, fazenda_idfazenda, epoca_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    [id_val, programacao_id, talhao_id, safra_id, fazenda_idfazenda, epoca_id]
                )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacao_cultivares", methods=["GET"])
def list_programacao_cultivares():
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
            if role == "consultor" and cm_token:
                cur.execute("SELECT pc.*, (SELECT s.ano_inicio || '/' || s.ano_fim FROM public.safras s WHERE s.id = pc.safra LIMIT 1) as safra_nome FROM public.programacao_cultivares pc WHERE pc.numerocm_consultor = %s ORDER BY pc.created_at DESC", [cm_token])
            elif role == "consultor":
                cur.execute("SELECT pc.*, (SELECT s.ano_inicio || '/' || s.ano_fim FROM public.safras s WHERE s.id = pc.safra LIMIT 1) as safra_nome FROM public.programacao_cultivares pc WHERE 1=0")
            else:
                cur.execute("SELECT pc.*, (SELECT s.ano_inicio || '/' || s.ano_fim FROM public.safras s WHERE s.id = pc.safra LIMIT 1) as safra_nome FROM public.programacao_cultivares pc ORDER BY pc.created_at DESC")
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
    payload = request.get_json(silent=True) or {}
    id_val = payload.get("id") or str(uuid.uuid4())
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
                            [str(uuid.uuid4()), id_val, tid]
                        )
                for d in defensivos_fazenda:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_cultivares_defensivos
                        (id, programacao_cultivar_id, classe, aplicacao, defensivo, dose, cobertura, total, produto_salvo)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [str(uuid.uuid4()), id_val, d.get("classe"), d.get("aplicacao"), d.get("defensivo"),
                         d.get("dose"), d.get("cobertura"), d.get("total"), bool(d.get("produto_salvo"))]
                    )
        return jsonify({"id": id_val})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacao_cultivares/<id>", methods=["PUT"])
def update_programacao_cultivar(id: str):
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
                            [str(uuid.uuid4()), id, tid]
                        )
                cur.execute("DELETE FROM public.programacao_cultivares_defensivos WHERE programacao_cultivar_id = %s", [id])
                for d in defensivos_fazenda:
                    cur.execute(
                        """
                        INSERT INTO public.programacao_cultivares_defensivos
                        (id, programacao_cultivar_id, classe, aplicacao, defensivo, dose, cobertura, total, produto_salvo)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [str(uuid.uuid4()), id, d.get("classe"), d.get("aplicacao"), d.get("defensivo"),
                         d.get("dose"), d.get("cobertura"), d.get("total"), bool(d.get("produto_salvo"))]
                    )
        return jsonify({"ok": True, "id": id})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        pool.putconn(conn)

@app.route("/programacao_cultivares/<id>", methods=["DELETE"])
def delete_programacao_cultivar(id: str):
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
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            auth = request.headers.get("Authorization") or ""
            role = None
            cm_token = None
            safra_id = request.args.get("safra_id")
            if auth.lower().startswith("bearer "):
                try:
                    payload = verify_jwt(auth.split(" ", 1)[1])
                    role = (payload.get("role") or "consultor").lower()
                    cm_token = payload.get("numerocm_consultor")
                except Exception:
                    role = None
            
            where = []
            params = []
            
            if role == "consultor" and cm_token:
                where.append("numerocm_consultor = %s")
                params.append(cm_token)
            elif role == "consultor":
                where.append("1=0")
            
            if safra_id:
                where.append("safra_id = %s")
                params.append(safra_id)
                
            sql = "SELECT pa.*, (SELECT s.ano_inicio || '/' || s.ano_fim FROM public.safras s WHERE s.id = pa.safra_id LIMIT 1) as safra_nome FROM public.programacao_adubacao pa"
            if where:
                sql += " WHERE " + " AND ".join(where)
            sql += " ORDER BY pa.created_at DESC"
            
            cur.execute(sql, params)
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/programacao_adubacao", methods=["POST"])
def create_programacao_adub():
    payload = request.get_json(silent=True) or {}
    id_val = payload.get("id") or str(uuid.uuid4())
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
                cod_val = None
                try:
                    cur.execute(
                        "SELECT cod_item FROM public.fertilizantes_catalog WHERE item = %s ORDER BY cod_item LIMIT 1",
                        [formulacao]
                    )
                    r = cur.fetchone()
                    if r:
                        cod_val = r[0]
                except Exception:
                    cod_val = None
                cur.execute(
                    """
                    INSERT INTO public.programacao_adubacao (
                      id, programacao_id, user_id, produtor_numerocm, area, numerocm_consultor, formulacao, cod_item, dose, percentual_cobertura,
                      data_aplicacao, embalagem, justificativa_nao_adubacao_id, fertilizante_salvo, deve_faturar,
                      porcentagem_salva, total, safra_id
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    [id_val, programacao_id, user_id, produtor_numerocm, area, cm_token, formulacao, cod_val, dose, percentual_cobertura,
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
                try:
                    if fields.get("formulacao") is not None:
                        cur.execute(
                            "SELECT cod_item FROM public.fertilizantes_catalog WHERE item = %s ORDER BY cod_item LIMIT 1",
                            [fields.get("formulacao")]
                        )
                        r = cur.fetchone()
                        set_parts.append("cod_item = %s")
                        values.append(r[0] if r else None)
                except Exception:
                    pass
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
    id_val = (payload.get("id") or "").strip() or str(uuid.uuid4())
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
    session = get_session()
    items = session.execute(select(DefensivoCatalog).order_by(DefensivoCatalog.item.nulls_last(), DefensivoCatalog.cod_item)).scalars().all()
    return jsonify({
        "items": [
            {
                "cod_item": it.cod_item,
                "item": it.item,
                "grupo": it.grupo,
                "marca": it.marca,
                "principio_ativo": it.principio_ativo,
                "saldo": float(it.saldo) if it.saldo is not None else None,
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/cultivares_catalog", methods=["GET"])
def get_cultivares_catalog():
    ensure_cultivares_catalog_schema()
    session = get_session()
    items = session.execute(select(CultivarCatalog).order_by(CultivarCatalog.cultivar)).scalars().all()
    out = jsonify({
        "items": [
            {
                "cultivar": it.cultivar,
                "cultura": it.cultura,
                "nome_cientifico": it.nome_cientifico,
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })
    session.close()
    return out

@app.route("/cultivares_catalog/bulk", methods=["POST"])
def import_cultivares_catalog():
    ensure_cultivares_catalog_schema()
    ensure_import_history_schema()
    payload = request.get_json(silent=True) or {}
    limpar = False
    items = payload.get("items") or []
    user_id = payload.get("user_id")
    arquivo_nome = payload.get("arquivo_nome")
    deleted = 0
    imported = 0
    session = get_session()
    
    to_insert = []
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
        to_insert.append({"cultivar": cultivar, "cultura": cultura, "nome_cientifico": nome_cientifico})
    if to_insert:
        stmt = _pg_insert(CultivarCatalog.__table__).values(to_insert)
        upsert_stmt = stmt.on_conflict_do_update(
            index_elements=[CultivarCatalog.cultivar, CultivarCatalog.cultura],
            set_={"nome_cientifico": stmt.excluded.nome_cientifico, "updated_at": text("now()")},
        )
        session.execute(upsert_stmt)
        imported = len(to_insert)
    session.add(ImportHistory(id=str(uuid.uuid4()), user_id=user_id, tabela_nome="cultivares_catalog", registros_importados=imported, registros_deletados=0, arquivo_nome=arquivo_nome, limpar_antes=False))
    session.commit()
    return jsonify({"ok": True, "imported": imported, "deleted": 0})

@app.route("/cultivares_catalog/by_key", methods=["PUT"])
def update_cultivares_by_key():
    ensure_cultivares_catalog_schema()
    payload = request.get_json(silent=True) or {}
    # Não forçar upper aqui para permitir encontrar registros legados com case misto
    cultivar = (payload.get("cultivar") or "").strip()
    cultura_raw = (payload.get("cultura") or "").strip()
    cultura = cultura_raw or None
    
    set_cultura = payload.get("set_cultura")
    set_nome_cientifico = payload.get("set_nome_cientifico")
    if not cultivar:
        return jsonify({"error": "cultivar obrigatório"}), 400
    session = get_session()
    try:
        # Check if exists first
        q = select(CultivarCatalog.cultivar).where(CultivarCatalog.cultivar == cultivar)
        if cultura is None:
            q = q.where(CultivarCatalog.cultura.is_(None))
        else:
            q = q.where(CultivarCatalog.cultura == cultura)
        
        exists = session.execute(q).first()
        if not exists:
            return jsonify({"error": "não encontrado"}), 404

        values = {}
        if set_cultura is not None:
            val = (str(set_cultura) or "").strip().upper()
            values["cultura"] = val or None
        if set_nome_cientifico is not None:
            values["nome_cientifico"] = set_nome_cientifico

        if values:
            values["updated_at"] = text("now()")
            stmt = update(CultivarCatalog).where(CultivarCatalog.cultivar == cultivar)
            if cultura is None:
                stmt = stmt.where(CultivarCatalog.cultura.is_(None))
            else:
                stmt = stmt.where(CultivarCatalog.cultura == cultura)
            
            stmt = stmt.values(**values)
            session.execute(stmt)
            session.commit()

        return jsonify({"ok": True})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/tratamentos_sementes", methods=["GET"])
def list_tratamentos_sementes():
    ensure_tratamentos_sementes_schema()
    cultura = request.args.get("cultura")
    ativo = request.args.get("ativo")
    session = get_session()
    q = select(TratamentoSemente)
    if cultura:
        q = q.where(TratamentoSemente.cultura == (str(cultura).upper()))
    if ativo is not None:
        val = str(ativo).strip().lower() in ("1","true","yes","on")
        q = q.where(TratamentoSemente.ativo == val)
    items = session.execute(q.order_by(TratamentoSemente.nome)).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "nome": it.nome,
                "cultura": it.cultura,
                "ativo": bool(it.ativo),
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/tratamentos_sementes", methods=["POST"])
def create_tratamento_semente():
    ensure_tratamentos_sementes_schema()
    payload = request.get_json(silent=True) or {}
    id_val = str(uuid.uuid4())
    nome = (payload.get("nome") or "").strip()
    cultura_raw = payload.get("cultura")
    cultura = (str(cultura_raw).upper() if cultura_raw is not None else None)
    ativo_raw = payload.get("ativo")
    ativo = True if ativo_raw is None else (str(ativo_raw).strip().lower() in ("1","true","yes","on"))
    if not nome:
        return jsonify({"error": "nome obrigatório"}), 400
    session = get_session()
    session.add(TratamentoSemente(id=id_val, nome=nome, cultura=cultura, ativo=ativo))
    session.commit()
    return jsonify({"id": id_val})

@app.route("/tratamentos_sementes/<id>", methods=["PUT"])
def update_tratamento_semente(id: str):
    ensure_tratamentos_sementes_schema()
    payload = request.get_json(silent=True) or {}
    session = get_session()
    row = session.get(TratamentoSemente, id)
    if not row:
        return jsonify({"error": "não encontrado"}), 404
    if "nome" in payload:
        row.nome = payload.get("nome")
    if "cultura" in payload:
        v = payload.get("cultura")
        row.cultura = (str(v).upper() if v is not None else None)
    if "ativo" in payload:
        v = payload.get("ativo")
        row.ativo = (str(v).strip().lower() in ("1","true","yes","on")) if v is not None else row.ativo
    session.commit()
    return jsonify({"ok": True, "id": id})

@app.route("/tratamentos_sementes/<id>", methods=["DELETE"])
def delete_tratamento_semente(id: str):
    ensure_tratamentos_sementes_schema()
    session = get_session()
    session.execute(delete(TratamentoSemente).where(TratamentoSemente.id == id))
    session.commit()
    return jsonify({"ok": True})

@app.route("/cultivares_tratamentos", methods=["GET"])
def list_cultivares_tratamentos():
    ensure_cultivares_tratamentos_schema()
    ensure_tratamentos_sementes_schema()
    cultivar = request.args.get("cultivar")
    if not cultivar:
        return jsonify({"items": [], "count": 0})
    session = get_session()
    
    # Tenta descobrir a cultura do cultivar
    cultura_row = session.execute(
        select(CultivarCatalog.cultura).where(CultivarCatalog.cultivar == cultivar)
    ).first()
    cultura_val = cultura_row[0] if cultura_row else None

    q = select(TratamentoSemente).where(TratamentoSemente.ativo == True)
    
    # Condição 1: Vínculo explícito
    cond_explicit = TratamentoSemente.id.in_(
        select(CultivarTratamento.tratamento_id).where(CultivarTratamento.cultivar == cultivar)
    )

    if cultura_val:
        # Condição 2: Tratamento da mesma cultura
        # (tratamento não mais por cultivar, mas pela cultura)
        cond_culture = (TratamentoSemente.cultura == cultura_val)
        q = q.where(or_(cond_explicit, cond_culture))
    else:
        q = q.where(cond_explicit)

    q = q.order_by(TratamentoSemente.nome)

    items = session.execute(q).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "nome": it.nome,
                "cultura": it.cultura,
                "ativo": bool(it.ativo),
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/cultivares_tratamentos/bulk", methods=["POST"])
def save_cultivares_tratamentos_bulk():
    ensure_cultivares_tratamentos_schema()
    payload = request.get_json(silent=True) or {}
    tratamento_id = (payload.get("tratamento_id") or "").strip()
    cultivares = payload.get("cultivares") or []
    if not tratamento_id:
        return jsonify({"error": "tratamento_id obrigatório"}), 400
    session = get_session()
    try:
        session.execute(delete(CultivarTratamento).where(CultivarTratamento.tratamento_id == tratamento_id))
        to_insert = []
        seen = set()
        for c in cultivares:
            val = (str(c) or "").strip().upper()
            if not val or val in seen:
                continue
            seen.add(val)
            to_insert.append({"cultivar": val, "tratamento_id": tratamento_id})
        if to_insert:
            stmt = _pg_insert(CultivarTratamento.__table__).values(to_insert)
            session.execute(
                stmt.on_conflict_do_nothing(index_elements=[CultivarTratamento.cultivar, CultivarTratamento.tratamento_id])
            )
        session.commit()
        return jsonify({"ok": True, "count": len(to_insert)})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/cultivares_tratamentos/set_for_cultivar", methods=["POST"])
def set_tratamentos_for_cultivar():
    ensure_cultivares_tratamentos_schema()
    payload = request.get_json(silent=True) or {}
    cultivar = (payload.get("cultivar") or "").strip().upper()
    tratamento_ids = payload.get("tratamento_ids") or []
    if not cultivar:
        return jsonify({"error": "cultivar obrigatório"}), 400
    session = get_session()
    session.execute(delete(CultivarTratamento).where(CultivarTratamento.cultivar == cultivar))
    to_insert = []
    seen = set()
    for tid in tratamento_ids:
        val = (str(tid) or "").strip()
        if not val or val in seen:
            continue
        seen.add(val)
        to_insert.append({"cultivar": cultivar, "tratamento_id": val})
    if to_insert:
        stmt = _pg_insert(CultivarTratamento.__table__).values(to_insert)
        session.execute(stmt.on_conflict_do_nothing(index_elements=[CultivarTratamento.cultivar, CultivarTratamento.tratamento_id]))
    session.commit()
    return jsonify({"ok": True, "count": len(to_insert)})

@app.route("/fertilizantes")
def get_fertilizantes():
    ensure_fertilizantes_schema()
    session = get_session()
    items = session.execute(select(FertilizanteCatalog).order_by(FertilizanteCatalog.item.nulls_last(), FertilizanteCatalog.cod_item)).scalars().all()
    out = jsonify({
        "items": [
            {
                "cod_item": it.cod_item,
                "item": it.item,
                "grupo": it.grupo,
                "marca": it.marca,
                "principio_ativo": it.principio_ativo,
                "saldo": float(it.saldo) if it.saldo is not None else None,
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })
    session.close()
    return out

@app.route("/debug/fertilizante_row/<cod_item>", methods=["GET"])
def debug_fertilizante_row(cod_item: str):
    ensure_fertilizantes_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT cod_item, item, grupo, marca, principio_ativo, saldo FROM public.fertilizantes_catalog WHERE cod_item = %s", [cod_item])
            r = cur.fetchone()
            if not r:
                return jsonify({"error": "not found"}), 404
            return jsonify({
                "cod_item": r[0],
                "item": r[1],
                "grupo": r[2],
                "marca": r[3],
                "principio_ativo": r[4],
                "saldo": float(r[5]) if r[5] is not None else None,
            })
    finally:
        pool.putconn(conn)

@app.route("/fertilizantes", methods=["POST"])
def upsert_fertilizante():
    ensure_fertilizantes_schema()
    payload = request.get_json(silent=True) or {}
    cod_item = payload.get("cod_item")
    if not cod_item:
        return jsonify({"error": "cod_item obrigatório"}), 400
    session = get_session()
    row = session.get(FertilizanteCatalog, cod_item)
    if row:
        for k in ["item", "grupo", "marca", "principio_ativo", "saldo"]:
            if k in payload:
                setattr(row, k, payload.get(k))
    else:
        row = FertilizanteCatalog(
            cod_item=cod_item,
            item=payload.get("item"),
            grupo=payload.get("grupo"),
            marca=payload.get("marca"),
            principio_ativo=payload.get("principio_ativo"),
            saldo=payload.get("saldo"),
        )
        session.add(row)
    gv_raw = payload.get("grupo")
    gval = (str(gv_raw) if gv_raw is not None else "").strip()
    if gval:
        session.execute(text("UPDATE public.fertilizantes_catalog SET grupo = :grupo, updated_at = now() WHERE cod_item = :cod"), {"grupo": gval, "cod": str(cod_item)})
    session.commit()
    return jsonify({"ok": True, "cod_item": cod_item})

@app.route("/fertilizantes/update_grupo", methods=["POST"])
def update_fertilizante_grupo():
    ensure_fertilizantes_schema()
    payload = request.get_json(silent=True) or {}
    cod_item = str(payload.get("cod_item") or "").strip()
    grupo = str(payload.get("grupo") or "").strip()
    if not cod_item or not grupo:
        return jsonify({"error": "cod_item e grupo obrigatórios"}), 400
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE public.fertilizantes_catalog SET grupo = %s, updated_at = now() WHERE cod_item = %s", [grupo, cod_item])
            conn.commit()
        return jsonify({"ok": True, "cod_item": cod_item, "grupo": grupo})
    finally:
        pool.putconn(conn)

@app.route("/fertilizantes/bulk", methods=["POST"])
def upsert_fertilizantes_bulk():
    def _pick(obj, keys):
        for k in keys:
            if k in obj and obj[k] not in (None, ""):
                return obj[k]
        def norm(s: str) -> str:
            s2 = (s or "").strip().lower().replace(" ", "_")
            return "".join(ch for ch in s2 if (ch.isalnum() or ch == "_"))
        norm_map = {norm(str(k)): v for k, v in obj.items()}
        for k in keys:
            nk = norm(k)
            if nk in norm_map and norm_map[nk] not in (None, ""):
                return norm_map[nk]
        return None
    ensure_fertilizantes_schema()
    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    limpar = bool(payload.get("limparAntes"))
    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"error": "items vazio"}), 400
    session = get_session()
    session.execute(text("SET LOCAL lock_timeout = '3s'"))
    to_insert = []
    for d in items:
        cod_item = _pick(d, ["cod_item", "CODITEM", "COD_ITEM", "COD ITEM", "COD. ITEM", "COD"])
        if not cod_item:
            continue
        to_insert.append({
            "cod_item": str(cod_item),
            "item": (str(_pick(d, ["item", "ITEM"])) if _pick(d, ["item", "ITEM"]) is not None else None),
            "grupo": (str(_pick(d, ["grupo", "GRUPO"])) if _pick(d, ["grupo", "GRUPO"]) is not None else None),
            "marca": (str(_pick(d, ["marca", "MARCA"])) if _pick(d, ["marca", "MARCA"]) is not None else None),
            "principio_ativo": (str(_pick(d, ["principio_ativo", "PRINCIPIO_ATIVO", "PRINCIPIO ATIVO"])) if _pick(d, ["principio_ativo", "PRINCIPIO_ATIVO", "PRINCIPIO ATIVO"]) is not None else None),
            "saldo": (_pick(d, ["saldo", "SALDO"]) if _pick(d, ["saldo", "SALDO"]) is not None else None),
        })
    if not to_insert:
        return jsonify({"error": "items sem cod_item válido"}), 400
    stmt = _pg_insert(FertilizanteCatalog.__table__).values(to_insert)
    upsert_stmt = stmt.on_conflict_do_update(
        index_elements=[FertilizanteCatalog.cod_item],
        set_={
            "item": stmt.excluded.item,
            "grupo": stmt.excluded.grupo,
            "marca": stmt.excluded.marca,
            "principio_ativo": stmt.excluded.principio_ativo,
            "saldo": stmt.excluded.saldo,
            "updated_at": text("now()"),
        },
    )
    session.execute(upsert_stmt)
    session.commit()
    return jsonify({"ok": True, "imported": len(to_insert)})

@app.route("/fertilizantes/sync", methods=["GET", "POST", "OPTIONS"])
def sync_fertilizantes():
    if request.method == "OPTIONS":
        return ("", 204)
    ensure_system_config_schema()
    ensure_fertilizantes_schema()
    stage = "start"
    payload = request.get_json(silent=True) or {}
    limpar = bool(payload.get("limparAntes"))
    cfg = get_config_map([
        "api_fertilizantes_cliente_id",
        "api_fertilizantes_secret",
        "api_fertilizantes_url",
        "api_fertilizantes_exp",
    ])
    stage = "config"
    url = str(cfg.get("api_fertilizantes_url") or "").strip().strip("`")
    if not url:
        return jsonify({"error": "Config api_fertilizantes_url ausente"}), 400
    headers = {"Accept": "application/json"}
    # Só envia Authorization se todas as chaves de JWT estiverem presentes
    if cfg.get("api_fertilizantes_cliente_id") and cfg.get("api_fertilizantes_secret") and cfg.get("api_fertilizantes_exp"):
        try:
            client_id = str(cfg.get("api_fertilizantes_cliente_id") or "").strip()
            secret = str(cfg.get("api_fertilizantes_secret") or "").strip()
            exp = str(cfg.get("api_fertilizantes_exp") or "").strip()
            token = _make_jwt(client_id, int(exp), secret, None)
            headers["Authorization"] = f"Bearer {token}"
        except Exception:
            pass
    req = Request(url, headers=headers)
    stage = "http"
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

    stage = "normalize"
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
        grupo_val = pick(d, ["grupo", "GRUPO"]) or None
        princ_val = pick(d, ["principio_ativo", "PRINCIPIO_ATIVO", "PRINCIPIO ATIVO"]) or None
        saldo_val = pick(d, ["saldo", "SALDO"]) or None

        if not cod_item:
            ignored += 1
            continue
        normalized.append([cod_item, item_val, grupo_val, marca_val, princ_val, saldo_val])

    stage = "db"
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
                        INSERT INTO public.fertilizantes_catalog (cod_item, item, grupo, marca, principio_ativo, saldo)
                        VALUES %s
                        ON CONFLICT (cod_item) DO UPDATE SET
                          item = EXCLUDED.item,
                          grupo = EXCLUDED.grupo,
                          marca = EXCLUDED.marca,
                          principio_ativo = EXCLUDED.principio_ativo,
                          saldo = EXCLUDED.saldo,
                          updated_at = now()
                        """,
                        [
                            [
                                (str(r[0]) if r[0] is not None else None),
                                (str(r[1]) if r[1] is not None else None),
                                (str(r[2]) if r[2] is not None else None),
                                (str(r[3]) if r[3] is not None else None),
                                (str(r[4]) if r[4] is not None else None),
                                (float(r[5]) if r[5] is not None else None),
                            ]
                            for r in normalized
                        ],
                    )
        return jsonify({"ok": True, "imported": len(normalized), "ignored": ignored})
    except Exception as e:
        import traceback
        return jsonify({
            "error": "DBError",
            "details": str(e),
            "trace": traceback.format_exc(),
            "stage": "fertilizantes_sync_db"
        }), 500
    finally:
        pool.putconn(conn)


@app.route("/fertilizantes/sync/test", methods=["GET"])
def sync_fertilizantes_test():
    ensure_system_config_schema()
    cfg = get_config_map(["api_fertilizantes_url", "api_fertilizantes_cliente_id", "api_fertilizantes_secret", "api_fertilizantes_exp"])
    url = str(cfg.get("api_fertilizantes_url") or "").strip()
    client_id = str(cfg.get("api_fertilizantes_cliente_id") or "").strip()
    secret = str(cfg.get("api_fertilizantes_secret") or "").strip()
    exp = str(cfg.get("api_fertilizantes_exp") or "").strip()
    if not url:
        return jsonify({"error": "Config api_fertilizantes_url ausente"}), 400
    if not client_id or not secret or not exp:
        return jsonify({"error": "Config JWT ausente (cliente_id/secret/exp)"}), 400
    try:
        token = _make_jwt(client_id, int(exp), secret, None)
        req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
        with urlopen(req, timeout=15) as resp:
            raw = resp.read()
            sample = None
            try:
                data = json.loads(raw.decode("utf-8"))
                items = data.get("items") if isinstance(data, dict) else data
                if isinstance(items, list) and items:
                    if isinstance(items[0], dict):
                        sample = list(items[0].keys())[:20]
            except Exception:
                sample = None
            return jsonify({"status": resp.status, "ok": True, "sample_keys": sample})
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "HTTPError", "status": e.code, "details": body or str(e)}), 502
    except URLError as e:
        details = str(getattr(e, 'reason', e))
        return jsonify({"error": "URLError", "details": details}), 502

@app.route("/debug/fertilizantes_columns", methods=["GET"])
def debug_fertilizantes_columns():
    ensure_fertilizantes_schema()
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='fertilizantes_catalog' ORDER BY ordinal_position")
            cols = [r[0] for r in cur.fetchall()]
            return jsonify({"columns": cols})
    finally:
        pool.putconn(conn)

@app.route("/debug/pg_stat_activity", methods=["GET"])
def debug_pg_stat_activity():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT pid, usename, state, query_start, LEFT(query, 400) AS query
                FROM pg_stat_activity
                WHERE datname = current_database()
                ORDER BY query_start DESC
                """
            )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            return jsonify({"items": items, "count": len(items)})
    finally:
        pool.putconn(conn)

@app.route("/debug/fert_sync_version", methods=["GET"])
def debug_fert_sync_version():
    # Marker to verify deployed code path
    return jsonify({
        "sync_impl": "psycopg_execute_values",
        "pick_strategy": "exact_keys_only",
        "has_dberror_literal": False
    })

@app.route("/defensivos/<cod_item>", methods=["PUT"])
def update_defensivo(cod_item: str):
    ensure_defensivos_schema()
    payload = request.get_json(silent=True) or {}
    session = get_session()
    row = session.get(DefensivoCatalog, cod_item)
    if not row:
        return jsonify({"error": "não encontrado"}), 404
    for k in ["item", "grupo", "marca", "principio_ativo", "saldo"]:
        if k in payload:
            setattr(row, k, payload.get(k))
    session.commit()
    return jsonify({"ok": True, "cod_item": cod_item})

@app.route("/config", methods=["GET"])
def list_config():
    ensure_system_config_schema()
    session = get_session()
    items = (
        session.execute(select(SystemConfig).order_by(SystemConfig.config_key)).scalars().all()
    )
    return jsonify({
        "items": [
            {
                "config_key": it.config_key,
                "config_value": it.config_value,
                "description": it.description,
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/config/bulk", methods=["POST"])
def upsert_config_bulk():
    ensure_system_config_schema()
    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except Exception:
            items = []
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list) or not items:
        return jsonify({"error": "items vazio"}), 400
    if any(not it.get("config_key") for it in items):
        return jsonify({"error": "config_key obrigatório"}), 400
    session = get_session()
    try:
        for it in items:
            key = str(it.get("config_key")).strip()
            val = it.get("config_value")
            desc = it.get("description")
            row = session.get(SystemConfig, key)
            if row:
                row.config_value = val
                row.description = desc
            else:
                row = SystemConfig(config_key=key, config_value=val, description=desc)
                session.add(row)
        session.commit()
        return jsonify({"ok": True, "imported": len(items)})
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/versions", methods=["GET", "POST"])
def app_versions():
    ensure_app_versions_schema()
    if request.method == "GET":
        session = get_session()
        items = session.execute(select(AppVersion).order_by(AppVersion.created_at.desc())).scalars().all()
        out = jsonify({
            "items": [
                {
                    "id": it.id,
                    "version": it.version,
                    "build": it.build,
                    "environment": it.environment,
                    "notes": it.notes,
                    "created_at": it.created_at.isoformat() if it.created_at else None,
                } for it in items
            ],
            "count": len(items),
        })
        session.close()
        return out
    else:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            try:
                raw = (request.data or b"").decode("utf-8")
                payload = json.loads(raw) if raw else {}
            except Exception:
                payload = {}
        version = (payload.get("version") or "").strip()
        build = (payload.get("build") or "").strip() or None
        environment = (payload.get("environment") or "prod").strip() or "prod"
        notes = payload.get("notes")
        if not version:
            return jsonify({"error": "version obrigatório"}), 400
        session = get_session()
        try:
            exists = session.execute(
                select(AppVersion).where(AppVersion.version == version, AppVersion.environment == environment)
            ).scalars().first()
            if exists:
                return jsonify({"ok": True, "version": version, "build": exists.build, "environment": environment})
            row = AppVersion(id=str(uuid.uuid4()), version=version, build=build, environment=environment, notes=notes)
            session.add(row)
            session.commit()
            return jsonify({"ok": True, "version": version, "build": build, "environment": environment})
        except Exception as e:
            session.rollback()
            return jsonify({"error": str(e)}), 400
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")

def _make_jwt(client_id: str, exp_ts: int, secret: str, audience: Optional[str] = None) -> str:
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

    session = get_session()
    if limpar:
        session.execute(delete(DefensivoCatalog))
    to_insert = []
    for r in normalized:
        to_insert.append({
            "cod_item": r[0],
            "item": r[1],
            "grupo": r[2],
            "marca": r[3],
            "principio_ativo": r[4],
            "saldo": r[5],
        })
    if to_insert:
        stmt = _pg_insert(DefensivoCatalog.__table__).values(to_insert)
        upsert_stmt = stmt.on_conflict_do_update(
            index_elements=[DefensivoCatalog.cod_item],
            set_={
                "item": stmt.excluded.item,
                "grupo": stmt.excluded.grupo,
                "marca": stmt.excluded.marca,
                "principio_ativo": stmt.excluded.principio_ativo,
                "saldo": stmt.excluded.saldo,
                "updated_at": text("now()"),
            },
        )
        session.execute(upsert_stmt)
    session.commit()
    return jsonify({"ok": True, "imported": len(to_insert), "ignored": ignored})

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

def run_sync_produtores(limpar: bool = False):
    ensure_system_config_schema()
    ensure_produtores_schema()
    cfg = get_config_map([
        "api_produtores_client_id",
        "api_produtores_secret",
        "api_produtores_url",
        "api_produtores_exp",
    ])
    url = str(cfg.get("api_produtores_url") or "").strip().strip("`")
    if not url:
        return {"error": "Config api_produtores_url ausente", "status": 400}
    
    headers = {"Accept": "application/json"}
    if cfg.get("api_produtores_client_id") and cfg.get("api_produtores_secret") and cfg.get("api_produtores_exp"):
        try:
            token = _make_jwt(str(cfg.get("api_produtores_client_id")), int(cfg.get("api_produtores_exp")), str(cfg.get("api_produtores_secret")), None)
            headers["Authorization"] = f"Bearer {token}"
        except Exception:
            pass
            
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read()
            data = json.loads(raw.decode("utf-8"))
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return {
            "error": "HTTPError",
            "status": e.code,
            "details": body or str(e),
            "url": url
        }
    except URLError as e:
        return {
            "error": "URLError",
            "details": getattr(e, 'reason', str(e)),
            "url": url,
            "status": 502
        }
    except Exception as e:
        return {"error": f"Erro ao ler resposta da API externa: {e}", "status": 500}

    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return {"error": "Resposta da API externa inválida", "url": url, "preview": data, "status": 500}

    def pick(obj, keys):
        for k in keys:
            if k in obj and obj[k] not in (None, ""):
                return obj[k]
        return None

    pool = get_pool()
    conn = pool.getconn()
    imported = 0
    ignored = 0
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT LOWER(TRIM(consultor)) AS nome, numerocm_consultor FROM public.consultores")
                rows = cur.fetchall()
                consultores_map = {r[0]: r[1] for r in rows if r and r[0]}
                cur.execute("SELECT MIN(numerocm_consultor) FROM public.consultores")
                default_cm_row = cur.fetchone()
                default_cm = default_cm_row[0] if default_cm_row and default_cm_row[0] else None
                if limpar:
                    cur.execute("DELETE FROM public.produtores")
                values = []
                seen = set()
                for d in items:
                    numerocm = str(pick(d, ["numerocm", "NUMEROCM", "NUMERO_CM", "NUMERO_CM_PRODUTOR"])) if pick(d, ["numerocm", "NUMEROCM", "NUMERO_CM", "NUMERO_CM_PRODUTOR"]) is not None else None
                    nome = str(pick(d, ["nome", "NOME", "NOME_PRODUTOR"])) if pick(d, ["nome", "NOME", "NOME_PRODUTOR"]) is not None else None
                    cm_cons = str(pick(d, ["numerocmconsultor", "numerocm_consultor", "NUMEROCM_CONSULTOR", "CONSULTOR_CM", "NUMEROCMCONSULTOR", "CONSULTORCM", "CM_CONSULTOR", "CONSULTOR_NUMEROCM"])) if pick(d, ["numerocmconsultor", "numerocm_consultor", "NUMEROCM_CONSULTOR", "CONSULTOR_CM", "NUMEROCMCONSULTOR", "CONSULTORCM", "CM_CONSULTOR", "CONSULTOR_NUMEROCM"]) is not None else None
                    consultor = pick(d, ["consultor", "CONSULTOR"]) or None
                    tipocooperado = pick(d, ["tipocooperado", "TIPOCOOPERADO", "TIPO_COOPERADO"]) or None
                    assistencia = pick(d, ["assistencia", "ASSISTENCIA", "TIPO_ASSISTENCIA"]) or None
                    if (not cm_cons) and consultor:
                        key_nome = str(consultor).strip().lower()
                        cm_lookup = consultores_map.get(key_nome)
                        if cm_lookup:
                            cm_cons = str(cm_lookup)
                    if (not cm_cons) and consultor and not cm_cons:
                        key_nome = str(consultor).strip().lower()
                        cm_lookup = consultores_map.get(key_nome)
                        if cm_lookup:
                            cm_cons = str(cm_lookup)
                    if (not cm_cons) and default_cm:
                        cm_cons = str(default_cm)
                    if not numerocm or not nome or not cm_cons:
                        ignored += 1
                        continue
                    key = numerocm
                    if key in seen:
                        continue
                    seen.add(key)
                    values.append([str(uuid.uuid4()), numerocm, nome, cm_cons, consultor, tipocooperado, assistencia])
                if values:
                    execute_values(
                        cur,
                        """
                        INSERT INTO public.produtores (id, numerocm, nome, numerocm_consultor, consultor, tipocooperado, assistencia)
                        VALUES %s
                        ON CONFLICT (numerocm) DO UPDATE SET
                          nome = EXCLUDED.nome,
                          numerocm_consultor = EXCLUDED.numerocm_consultor,
                          consultor = EXCLUDED.consultor,
                          tipocooperado = EXCLUDED.tipocooperado,
                          assistencia = EXCLUDED.assistencia,
                          updated_at = now()
                        """,
                        values,
                    )
                    imported = len(values)
        return {"ok": True, "imported": imported, "ignored": ignored}
    finally:
        pool.putconn(conn)

def run_sync_fazendas(limpar: bool = False):
    ensure_system_config_schema()
    ensure_fazendas_schema()
    cfg = get_config_map([
        "api_fazendas_client_id",
        "api_fazendas_secret",
        "api_fazendas_url",
        "api_fazendas_exp",
    ])
    url = str(cfg.get("api_fazendas_url") or "").strip().strip("`")
    if not url:
        return {"error": "Config api_fazendas_url ausente", "status": 400}
    
    headers = {"Accept": "application/json"}
    if cfg.get("api_fazendas_client_id") and cfg.get("api_fazendas_secret") and cfg.get("api_fazendas_exp"):
        try:
            token = _make_jwt(str(cfg.get("api_fazendas_client_id")), int(cfg.get("api_fazendas_exp")), str(cfg.get("api_fazendas_secret")), None)
            headers["Authorization"] = f"Bearer {token}"
        except Exception:
            pass
            
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read()
            data = json.loads(raw.decode("utf-8"))
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return {
            "error": "HTTPError",
            "status": e.code,
            "details": body or str(e),
            "url": url
        }
    except URLError as e:
        return {
            "error": "URLError",
            "details": getattr(e, 'reason', str(e)),
            "url": url,
            "status": 502
        }
    except Exception as e:
        return {"error": f"Erro ao ler resposta da API externa: {e}", "status": 500}

    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return {"error": "Resposta da API externa inválida", "url": url, "preview": data, "status": 500}

    def pick(obj, keys):
        for k in keys:
            if k in obj and obj[k] not in (None, ""):
                return obj[k]
        return None

    pool = get_pool()
    conn = pool.getconn()
    imported = 0
    ignored = 0
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT numerocm, numerocm_consultor FROM public.produtores")
                produtor_cm_map = {row[0]: row[1] for row in cur.fetchall()}

                if limpar:
                    cur.execute("DELETE FROM public.fazendas")
                values = []
                seen = set()
                for d in items:
                    numerocm_val = pick(d, ["numerocm", "NUMEROCM", "NUMERO_CM", "NUMERO_CM_PRODUTOR"])
                    numerocm = str(numerocm_val).strip() if numerocm_val is not None else None
                    
                    idfazenda_val = pick(d, ["idfazenda", "IDFAZENDA", "ID_FAZENDA", "COD_FAZENDA", "CODIGO_FAZENDA"])
                    idfazenda = str(idfazenda_val).strip() if idfazenda_val is not None else None
                    
                    nomefazenda_val = pick(d, ["nomefazenda", "NOMEFAZENDA", "NOME_FAZENDA", "NOME", "DESCRICAO", "NOME_PROPRIEDADE"])
                    nomefazenda = str(nomefazenda_val).strip() if nomefazenda_val is not None else None
                    
                    cm_cons_val = pick(d, ["numerocm_consultor", "NUMEROCM_CONSULTOR", "CONSULTOR_CM", "NUMEROCMCONSULTOR", "CONSULTORCM", "CM_CONSULTOR", "CONSULTOR_NUMEROCM"])
                    cm_cons = str(cm_cons_val).strip() if cm_cons_val is not None else None
                    
                    if not cm_cons and numerocm and numerocm in produtor_cm_map:
                        cm_cons = produtor_cm_map[numerocm]

                    if not numerocm or not idfazenda or not nomefazenda or not cm_cons:
                        ignored += 1
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
        return {"ok": True, "imported": imported, "ignored": ignored}
    finally:
        pool.putconn(conn)

def run_sync_consultores(limpar: bool = False):
    ensure_system_config_schema()
    ensure_consultores_schema()
    cfg = get_config_map([
        "api_consultores_client_id",
        "api_consultores_secret",
        "api_consultores_url",
        "api_consultores_exp",
    ])
    url = str(cfg.get("api_consultores_url") or "").strip().strip("`")
    if not url:
        return {"error": "Config api_consultores_url ausente", "status": 400}
    
    headers = {"Accept": "application/json"}
    if cfg.get("api_consultores_client_id") and cfg.get("api_consultores_secret") and cfg.get("api_consultores_exp"):
        try:
            token = _make_jwt(str(cfg.get("api_consultores_client_id")), int(cfg.get("api_consultores_exp")), str(cfg.get("api_consultores_secret")), None)
            headers["Authorization"] = f"Bearer {token}"
        except Exception:
            pass
            
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read()
            data = json.loads(raw.decode("utf-8"))
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return {
            "error": "HTTPError",
            "status": e.code,
            "details": body or str(e),
            "url": url
        }
    except URLError as e:
        return {
            "error": "URLError",
            "details": getattr(e, 'reason', str(e)),
            "url": url,
            "status": 502
        }
    except Exception as e:
        return {"error": f"Erro ao ler resposta da API externa: {e}", "status": 500}

    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return {"error": "Resposta da API externa inválida", "url": url, "preview": data, "status": 500}

    def pick(obj, keys):
        for k in keys:
            if k in obj and obj[k] not in (None, ""):
                return obj[k]
        return None

    pool = get_pool()
    conn = pool.getconn()
    imported = 0
    ignored = 0
    try:
        with conn:
            with conn.cursor() as cur:
                if limpar:
                    cur.execute("DELETE FROM public.consultores")
                values = []
                seen = set()
                for d in items:
                    cm_cons_val = pick(d, ["numerocm_consultor", "NUMEROCM_CONSULTOR", "CONSULTOR_CM", "NUMEROCMCONSULTOR", "CONSULTORCM", "CM_CONSULTOR", "CONSULTOR_NUMEROCM", "codigo", "id", "CODIGO"])
                    numerocm_consultor = str(cm_cons_val).strip() if cm_cons_val is not None else None
                    
                    nome_val = pick(d, ["consultor", "CONSULTOR", "nome", "NOME", "nome_consultor", "NOME_CONSULTOR"])
                    consultor = str(nome_val).strip() if nome_val is not None else None
                    
                    email_val = pick(d, ["email", "EMAIL", "e-mail", "E-MAIL", "mail"])
                    email = str(email_val).strip().lower() if email_val is not None else None
                    
                    if not numerocm_consultor or not consultor or not email:
                        ignored += 1
                        continue
                        
                    # Use email as key because it's unique in DB
                    key = email
                    if key in seen:
                        continue
                    seen.add(key)
                    # id, numerocm_consultor, consultor, email, role, ativo, pode_editar_programacao
                    values.append([str(uuid.uuid4()), numerocm_consultor, consultor, email, 'consultor', True, False])
                
                if values:
                    execute_values(
                        cur,
                        """
                        INSERT INTO public.consultores (id, numerocm_consultor, consultor, email, role, ativo, pode_editar_programacao)
                        VALUES %s
                        ON CONFLICT (email) DO UPDATE SET
                          numerocm_consultor = EXCLUDED.numerocm_consultor,
                          consultor = EXCLUDED.consultor,
                          updated_at = now()
                        """,
                        values,
                    )
                    imported = len(values)
        return {"ok": True, "imported": imported, "ignored": ignored}
    finally:
        pool.putconn(conn)

def _start_sync_scheduler():
    def loop():
        last_run_def = 0
        last_run_prod = 0
        last_run_faz = 0
        last_run_cons = 0
        while True:
            try:
                ensure_system_config_schema()
                cfg = get_config_map([
                    "defensivos_sync_enabled", "defensivos_sync_interval_minutes",
                    "produtores_sync_enabled", "produtores_sync_interval_minutes",
                    "fazendas_sync_enabled", "fazendas_sync_interval_minutes",
                    "consultores_sync_enabled", "consultores_sync_interval_minutes"
                ])
                now_ts = time.time()
                
                # Defensivos
                en_def = str(cfg.get("defensivos_sync_enabled", "")).strip().lower() in ("1", "true", "yes", "on")
                int_def = int(str(cfg.get("defensivos_sync_interval_minutes", "30") or "30"))
                if int_def < 1: int_def = 30
                if en_def and now_ts - last_run_def >= int_def * 60:
                    try:
                        res = run_sync_defensivos(False)
                        print(f"[defensivos-sync] imported={res.get('imported')} ignored={res.get('ignored')}")
                    except Exception as e:
                        print(f"[defensivos-sync] erro: {e}")
                    last_run_def = now_ts

                # Produtores
                en_prod = str(cfg.get("produtores_sync_enabled", "")).strip().lower() in ("1", "true", "yes", "on")
                int_prod = int(str(cfg.get("produtores_sync_interval_minutes", "30") or "30"))
                if int_prod < 1: int_prod = 30
                if en_prod and now_ts - last_run_prod >= int_prod * 60:
                    try:
                        res = run_sync_produtores(False)
                        print(f"[produtores-sync] imported={res.get('imported')} ignored={res.get('ignored')}")
                    except Exception as e:
                        print(f"[produtores-sync] erro: {e}")
                    last_run_prod = now_ts

                # Fazendas
                en_faz = str(cfg.get("fazendas_sync_enabled", "")).strip().lower() in ("1", "true", "yes", "on")
                int_faz = int(str(cfg.get("fazendas_sync_interval_minutes", "30") or "30"))
                if int_faz < 1: int_faz = 30
                if en_faz and now_ts - last_run_faz >= int_faz * 60:
                    try:
                        res = run_sync_fazendas(False)
                        print(f"[fazendas-sync] imported={res.get('imported')} ignored={res.get('ignored')}")
                    except Exception as e:
                        print(f"[fazendas-sync] erro: {e}")
                    last_run_faz = now_ts

                # Consultores
                en_cons = str(cfg.get("consultores_sync_enabled", "")).strip().lower() in ("1", "true", "yes", "on")
                int_cons = int(str(cfg.get("consultores_sync_interval_minutes", "30") or "30"))
                if int_cons < 1: int_cons = 30
                if en_cons and now_ts - last_run_cons >= int_cons * 60:
                    try:
                        res = run_sync_consultores(False)
                        print(f"[consultores-sync] imported={res.get('imported')} ignored={res.get('ignored')}")
                    except Exception as e:
                        print(f"[consultores-sync] erro: {e}")
                    last_run_cons = now_ts

            except Exception as e:
                print(f"[scheduler] erro loop: {e}")
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
    session = get_session()
    row = session.get(DefensivoCatalog, cod_item)
    if row:
        for k in ["item", "grupo", "marca", "principio_ativo", "saldo"]:
            if k in payload:
                setattr(row, k, payload.get(k))
    else:
        row = DefensivoCatalog(
            cod_item=cod_item,
            item=payload.get("item"),
            grupo=payload.get("grupo"),
            marca=payload.get("marca"),
            principio_ativo=payload.get("principio_ativo"),
            saldo=payload.get("saldo"),
        )
        session.add(row)
    session.commit()
    return jsonify({"ok": True, "cod_item": cod_item})

@app.route("/defensivos/bulk", methods=["POST"])
def upsert_defensivos_bulk():
    ensure_defensivos_schema()
    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    limpar = False
    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"error": "items vazio"}), 400
    session = get_session()
    to_insert = []
    for d in items:
        if not d.get("cod_item"):
            continue
        to_insert.append({
            "cod_item": d.get("cod_item"),
            "item": d.get("item"),
            "grupo": d.get("grupo"),
            "marca": d.get("marca"),
            "principio_ativo": d.get("principio_ativo"),
            "saldo": d.get("saldo"),
        })
    if not to_insert:
        return jsonify({"error": "items sem cod_item válido"}), 400
    stmt = _pg_insert(DefensivoCatalog.__table__).values(to_insert)
    upsert_stmt = stmt.on_conflict_do_update(
        index_elements=[DefensivoCatalog.cod_item],
        set_={
            "item": stmt.excluded.item,
            "grupo": stmt.excluded.grupo,
            "marca": stmt.excluded.marca,
            "principio_ativo": stmt.excluded.principio_ativo,
            "saldo": stmt.excluded.saldo,
            "updated_at": text("now()"),
        },
    )
    session.execute(upsert_stmt)
    session.commit()
    return jsonify({"ok": True, "imported": len(to_insert)})

@app.route("/talhoes", methods=["GET"])
def list_talhoes():
    # Endpoint para listar talhões com filtros de safra e época
    ensure_talhoes_schema()
    fazenda_id = request.args.get("fazenda_id")
    ids = request.args.get("ids")
    safra_id = request.args.get("safra_id")
    epoca_id = request.args.get("epoca_id")
    
    print(f"DEBUG list_talhoes: fazenda_id={fazenda_id} safra_id={safra_id} epoca_id={epoca_id}")
    
    auth = request.headers.get("Authorization") or ""
    role = None
    cm_token = None
    user_id = None
    if auth.lower().startswith("bearer "):
        try:
            payload = verify_jwt(auth.split(" ", 1)[1])
            role = (payload.get("role") or "consultor").lower()
            cm_token = payload.get("numerocm_consultor")
            user_id = payload.get("user_id")
        except Exception:
            role = None
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            allowed_numerocm = []
            if user_id and role == "consultor":
                cur.execute("SELECT produtor_numerocm FROM public.user_produtores WHERE user_id = %s", [user_id])
                allowed_numerocm = [r[0] for r in cur.fetchall()]

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
                                (
                                    SELECT json_build_object('id', pt.programacao_id, 'epoca_id', pt.epoca_id, 'epoca_nome', e.nome)
                                    FROM public.programacao_talhoes pt
                                    LEFT JOIN public.epocas e ON e.id = pt.epoca_id
                                    WHERE pt.talhao_id = t.id AND pt.safra_id = %s AND pt.epoca_id = %s
                                    LIMIT 1
                                ) AS conflito_programacao
                            FROM public.talhoes t
                    LEFT JOIN public.talhao_safras ts ON ts.talhao_id = t.id
                    WHERE t.id = ANY(%s)
                      AND (%s IS NULL OR EXISTS (SELECT 1 FROM public.fazendas f WHERE f.id = t.fazenda_id AND (f.numerocm_consultor = %s OR f.numerocm = ANY(%s))))
                      AND (%s IS NULL OR t.safras_todas OR EXISTS (SELECT 1 FROM public.talhao_safras ts2 WHERE ts2.talhao_id = t.id AND ts2.safra_id = %s))
                    GROUP BY t.id, t.fazenda_id, t.nome, t.area, t.arrendado, t.safras_todas, t.created_at, t.updated_at
                    ORDER BY t.nome
                    """,
                    (safra_id, epoca_id, id_list, (cm_token if role == "consultor" else None), (cm_token if role == "consultor" else None), allowed_numerocm, safra_id, safra_id)
                )
            elif fazenda_id:
                print(f"DEBUG: list_talhoes fazenda_id={fazenda_id} safra_id={safra_id} epoca_id={epoca_id}")
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
                        (
                            SELECT json_build_object('id', pt.programacao_id, 'epoca_id', pt.epoca_id, 'epoca_nome', e.nome)
                            FROM public.programacao_talhoes pt
                            LEFT JOIN public.epocas e ON e.id = pt.epoca_id
                            WHERE pt.talhao_id = t.id AND pt.safra_id = %s AND pt.epoca_id = %s
                            LIMIT 1
                        ) AS conflito_programacao
                    FROM public.talhoes t
                    LEFT JOIN public.talhao_safras ts ON ts.talhao_id = t.id
                    WHERE t.fazenda_id = %s
                      AND (%s IS NULL OR EXISTS (SELECT 1 FROM public.fazendas f WHERE f.id = t.fazenda_id AND (f.numerocm_consultor = %s OR f.numerocm = ANY(%s))))
                      AND (%s IS NULL OR t.safras_todas OR EXISTS (SELECT 1 FROM public.talhao_safras ts2 WHERE ts2.talhao_id = t.id AND ts2.safra_id = %s))
                    GROUP BY t.id, t.fazenda_id, t.nome, t.area, t.arrendado, t.safras_todas, t.created_at, t.updated_at
                    ORDER BY t.nome
                    """,
                    [safra_id, epoca_id, fazenda_id, (cm_token if role == "consultor" else None), (cm_token if role == "consultor" else None), allowed_numerocm, safra_id, safra_id]
                )
                # Debug output results
                # rows_debug = cur.fetchall()
                # for r in rows_debug:
                #    print(f"DEBUG: Talhao {r[2]} tem_prog_safra={r[19]}")
                # conn.commit() # needed? no select
                # But I need to return rows. 
                # Re-execute is wasteful. I'll just use the fetchall below.
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
    # RBAC: Consultor só pode cadastrar talhão em fazendas dos seus cooperados
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
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                if role == "consultor" and cm_token:
                    cur.execute("SELECT 1 FROM public.fazendas WHERE id = %s AND numerocm_consultor = %s", [fazenda_id, cm_token])
                    if not cur.fetchone():
                        return jsonify({"error": "não autorizado para esta fazenda"}), 401
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
            user_id = None
            if auth.lower().startswith("bearer "):
                try:
                    payload = verify_jwt(auth.split(" ", 1)[1])
                    role = (payload.get("role") or "consultor").lower()
                    cm_token = payload.get("numerocm_consultor")
                    user_id = payload.get("user_id")
                except Exception:
                    role = None

            allowed_numerocm = set()
            if role == "consultor":
                if user_id:
                    try:
                        cur.execute("SELECT produtor_numerocm FROM public.user_produtores WHERE user_id = %s", [user_id])
                        allowed_numerocm.update(str(r[0] or "") for r in cur.fetchall())
                        cur.execute("SELECT DISTINCT f.numerocm FROM public.fazendas f JOIN public.user_fazendas uf ON uf.fazenda_id = f.id WHERE uf.user_id = %s", [user_id])
                        allowed_numerocm.update(str(r[0] or "") for r in cur.fetchall())
                    except Exception:
                        pass
                if cm_token:
                    try:
                        cur.execute("SELECT numerocm FROM public.produtores WHERE numerocm_consultor = %s", [cm_token])
                        allowed_numerocm.update(str(r[0] or "") for r in cur.fetchall())
                    except Exception:
                        pass

            cur.execute("SELECT a.id, a.user_id, a.produtor_numerocm, a.area, a.safra_id, a.tipo, a.created_at, a.updated_at, (SELECT s.ano_inicio || '/' || s.ano_fim FROM public.safras s WHERE s.id = a.safra_id LIMIT 1) as safra_nome FROM public.aplicacoes_defensivos a ORDER BY a.created_at DESC")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            apps = [dict(zip(cols, r)) for r in rows]
            out = []
            for a in apps:
                cur.execute("SELECT talhao_id FROM public.aplicacao_defensivos_talhoes WHERE aplicacao_id = %s", [a["id"]])
                trows = cur.fetchall()
                talhao_ids = [r[0] for r in trows]

                cur.execute("SELECT id, aplicacao_id, user_id, classe, defensivo, dose, unidade, alvo, produto_salvo, deve_faturar, porcentagem_salva, area_hectares, safra_id, numerocm_consultor, created_at, updated_at FROM public.programacao_defensivos WHERE aplicacao_id = %s ORDER BY created_at", [a["id"]])
                dcols = [d[0] for d in cur.description]
                drows = cur.fetchall()
                defensivos = [dict(zip(dcols, r)) for r in drows]
                if role == "consultor":
                    is_my_producer = str(a.get("produtor_numerocm") or "") in allowed_numerocm
                    if not is_my_producer:
                        if cm_token:
                            defensivos = [d for d in defensivos if str(d.get("numerocm_consultor") or "") == str(cm_token)]
                        else:
                            defensivos = []
                        if not defensivos:
                            continue
                a2 = dict(a)
                a2["defensivos"] = defensivos
                a2["talhao_ids"] = talhao_ids
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
    tipo = (payload.get("tipo") or "PROGRAMACAO").strip().upper()
    safra_root = (payload.get("safra_id") or "").strip()
    defensivos = payload.get("defensivos") or []
    talhao_ids = payload.get("talhao_ids") or []
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
                if safra_root:
                    safra_ids.append(safra_root)
                for d in defensivos:
                    s = (d.get("safra_id") or "").strip()
                    if s:
                        safra_ids.append(s)
                safra_ids = list(dict.fromkeys(safra_ids))
                safra_header = safra_ids[0] if safra_ids else None

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
                    INSERT INTO public.aplicacoes_defensivos (id, user_id, produtor_numerocm, area, safra_id, tipo)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    [id_val, user_id, produtor_numerocm, area, safra_header, tipo]
                )
                # Persistir vínculo de talhões selecionados para relatórios
                try:
                    safra_for_talhoes = safra_header
                    for tid in list(dict.fromkeys([str(t) for t in talhao_ids if t])):
                        cur.execute(
                            """
                            INSERT INTO public.aplicacao_defensivos_talhoes (id, aplicacao_id, talhao_id, safra_id)
                            VALUES (%s, %s, %s, %s)
                            """,
                            [str(uuid.uuid4()), id_val, tid, safra_for_talhoes]
                        )
                except Exception:
                    pass
                for d in defensivos:
                    cod_val = None
                    try:
                        cur.execute(
                            "SELECT cod_item FROM public.defensivos_catalog WHERE item = %s AND (%s IS NULL OR grupo = %s) ORDER BY cod_item LIMIT 1",
                            [d.get("defensivo"), d.get("classe"), d.get("classe")]
                        )
                        r = cur.fetchone()
                        if r:
                            cod_val = r[0]
                    except Exception:
                        cod_val = None
                    cur.execute(
                        """
                        INSERT INTO public.programacao_defensivos (id, aplicacao_id, user_id, classe, defensivo, cod_item, dose, unidade, alvo, produto_salvo, deve_faturar, porcentagem_salva, area_hectares, safra_id, numerocm_consultor)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [str(uuid.uuid4()), id_val, user_id, d.get("classe"), d.get("defensivo"), cod_val, d.get("dose"), d.get("unidade"), d.get("alvo"), d.get("produto_salvo"), d.get("deve_faturar"), d.get("porcentagem_salva"), d.get("area_hectares"), d.get("safra_id"), cm_token]
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
    tipo = (payload.get("tipo") or "PROGRAMACAO").strip().upper()
    defensivos = payload.get("defensivos") or []
    talhao_ids = payload.get("talhao_ids") or []
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
                safra_header = safra_ids[0] if safra_ids else None

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
                cur.execute("UPDATE public.aplicacoes_defensivos SET user_id = %s, produtor_numerocm = %s, area = %s, safra_id = %s, tipo = %s, updated_at = now() WHERE id = %s", [user_id, produtor_numerocm, area, safra_header, tipo, id])
                # Atualizar vínculos de talhões
                try:
                    cur.execute("DELETE FROM public.aplicacao_defensivos_talhoes WHERE aplicacao_id = %s", [id])
                    safra_for_talhoes = safra_header
                    for tid in list(dict.fromkeys([str(t) for t in talhao_ids if t])):
                        cur.execute(
                            """
                            INSERT INTO public.aplicacao_defensivos_talhoes (id, aplicacao_id, talhao_id, safra_id)
                            VALUES (%s, %s, %s, %s)
                            """,
                            [str(uuid.uuid4()), id, tid, safra_for_talhoes]
                        )
                except Exception:
                    pass
                cur.execute("DELETE FROM public.programacao_defensivos WHERE aplicacao_id = %s", [id])
                for d in defensivos:
                    cod_val = None
                    try:
                        cur.execute(
                            "SELECT cod_item FROM public.defensivos_catalog WHERE item = %s AND (%s IS NULL OR grupo = %s) ORDER BY cod_item LIMIT 1",
                            [d.get("defensivo"), d.get("classe"), d.get("classe")]
                        )
                        r = cur.fetchone()
                        if r:
                            cod_val = r[0]
                    except Exception:
                        cod_val = None
                    cur.execute(
                        """
                        INSERT INTO public.programacao_defensivos (id, aplicacao_id, user_id, classe, defensivo, cod_item, dose, unidade, alvo, produto_salvo, deve_faturar, porcentagem_salva, area_hectares, safra_id, numerocm_consultor)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [str(uuid.uuid4()), id, user_id, d.get("classe"), d.get("defensivo"), cod_val, d.get("dose"), d.get("unidade"), d.get("alvo"), d.get("produto_salvo"), d.get("deve_faturar"), d.get("porcentagem_salva"), d.get("area_hectares"), d.get("safra_id"), cm_token]
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



def create_jwt(payload: Dict[str, Any], exp_seconds: Optional[int] = None) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = dict(payload or {})
    if exp_seconds is None:
        try:
            cfg = get_config_map()
            exp_seconds = int(cfg.get("auth_token_ttl_seconds") or 43200)
        except Exception:
            exp_seconds = 43200
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
    print("DEBUG: auth_login endpoint hit")
    ensure_consultores_schema()
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""
    pool = get_pool()
    conn = pool.getconn()
    try:
        item = None
        # Use explicit transaction for reading user
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, numerocm_consultor, consultor, email, role, ativo, password_digest FROM public.consultores WHERE email = %s", [email])
                row = cur.fetchone()
                if row:
                    cols = [d[0] for d in cur.description]
                    item = dict(zip(cols, row))

        if not item:
            return jsonify({"error": "email não autorizado"}), 403
        
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
        
        # Log de acesso em transação separada
        try:
            print(f"DEBUG: Attempting to log login for {item['email']}")
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO public.access_logs (id, user_id, email, action, ip_address, user_agent) VALUES (%s, %s, %s, %s, %s, %s)",
                        [str(uuid.uuid4()), item["id"], item["email"], "LOGIN", request.remote_addr, request.headers.get("User-Agent")]
                    )
            print("DEBUG: Log inserted successfully")
        except Exception as e:
            print(f"Erro ao registrar log de acesso: {e}")

        # Remover dados sensíveis do retorno
        if "password_digest" in item:
            del item["password_digest"]

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

@app.route("/auth/refresh", methods=["POST"])
def auth_refresh():
    auth = request.headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        return jsonify({"error": "sem token"}), 401
    token = auth.split(" ", 1)[1]
    try:
        payload = verify_jwt(token)
        new_token = create_jwt({
            "user_id": payload.get("user_id"),
            "email": payload.get("email"),
            "numerocm_consultor": payload.get("numerocm_consultor"),
            "nome": payload.get("nome"),
            "role": payload.get("role", "consultor"),
        })
        return jsonify({"token": new_token})
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

@app.route("/embalagens", methods=["GET"])
def list_embalagens():
    ensure_embalagens_schema()
    scope = (request.args.get("scope") or "").strip().lower()
    cultura = (request.args.get("cultura") or "").strip()
    only_active = True if (request.args.get("ativo") or "true").strip().lower() in ("true", "1") else False
    session = get_session()
    q = select(Embalagem)
    if only_active:
        q = q.where(Embalagem.ativo == True)
    if scope in ("cultivar", "fertilizante", "defensivo"):
        col = {
            "cultivar": Embalagem.scope_cultivar,
            "fertilizante": Embalagem.scope_fertilizante,
            "defensivo": Embalagem.scope_defensivo,
        }[scope]
        q = q.where(col == True)
    if cultura:
        q = q.where((Embalagem.cultura.is_(None)) | (Embalagem.cultura == cultura))
    items = session.execute(q.order_by(Embalagem.nome)).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "nome": it.nome,
                "ativo": bool(it.ativo),
                "scope_cultivar": bool(it.scope_cultivar),
                "scope_fertilizante": bool(it.scope_fertilizante),
                "scope_defensivo": bool(it.scope_defensivo),
                "cultura": it.cultura,
                "created_at": it.created_at.isoformat() if it.created_at else None,
                "updated_at": it.updated_at.isoformat() if it.updated_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/embalagens/bulk", methods=["POST"])
def upsert_embalagens_bulk():
    ensure_embalagens_schema()
    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        return jsonify({"error": "items vazio"}), 400
    session = get_session()
    to_insert = []
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
        to_insert.append({
            "id": idv,
            "nome": nome,
            "ativo": ativo,
            "scope_cultivar": sc_cult,
            "scope_fertilizante": sc_fert,
            "scope_defensivo": sc_def,
            "cultura": cultura,
        })
    if not to_insert:
        return jsonify({"error": "items vazios"}), 400
    stmt = _pg_insert(Embalagem.__table__).values(to_insert)
    upsert_stmt = stmt.on_conflict_do_update(
        index_elements=[Embalagem.id],
        set_={
            "nome": stmt.excluded.nome,
            "ativo": stmt.excluded.ativo,
            "scope_cultivar": stmt.excluded.scope_cultivar,
            "scope_fertilizante": stmt.excluded.scope_fertilizante,
            "scope_defensivo": stmt.excluded.scope_defensivo,
            "cultura": stmt.excluded.cultura,
            "updated_at": text("now()"),
        },
    )
    session.execute(upsert_stmt)
    session.commit()
    return jsonify({"ok": True, "processed": len(to_insert)})

@app.route("/user_fazendas", methods=["GET"])
def list_user_fazendas():
    ensure_consultores_schema()
    user_id = request.args.get("user_id")
    session = get_session()
    q = select(UserFazenda)
    if user_id:
        q = q.where(UserFazenda.user_id == user_id)
    items = session.execute(q).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "user_id": it.user_id,
                "fazenda_id": it.fazenda_id,
                "created_at": it.created_at.isoformat() if it.created_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/user_fazendas", methods=["POST"])
def add_user_fazenda():
    ensure_consultores_schema()
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    fazenda_id = payload.get("fazenda_id")
    if not user_id or not fazenda_id:
        return jsonify({"error": "dados ausentes"}), 400
    session = get_session()
    session.add(UserFazenda(id=str(uuid.uuid4()), user_id=user_id, fazenda_id=fazenda_id))
    session.commit()
    return jsonify({"ok": True})

@app.route("/user_fazendas/<id>", methods=["DELETE"])
def remove_user_fazenda(id: str):
    ensure_consultores_schema()
    session = get_session()
    session.execute(delete(UserFazenda).where(UserFazenda.id == id))
    session.commit()
    return jsonify({"ok": True})

@app.route("/gestor_consultores", methods=["GET"])
def list_gestor_consultores():
    ensure_gestor_consultores_schema()
    user_id = request.args.get("user_id")
    session = get_session()
    q = select(GestorConsultor)
    if user_id:
        q = q.where(GestorConsultor.user_id == user_id)
    items = session.execute(q.order_by(GestorConsultor.created_at.desc())).scalars().all()
    return jsonify({
        "items": [
            {
                "id": it.id,
                "user_id": it.user_id,
                "numerocm_consultor": it.numerocm_consultor,
                "created_at": it.created_at.isoformat() if it.created_at else None,
            } for it in items
        ],
        "count": len(items),
    })

@app.route("/gestor_consultores", methods=["POST"])
def add_gestor_consultor():
    ensure_gestor_consultores_schema()
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")
    numerocm_consultor = payload.get("numerocm_consultor")
    if not user_id or not numerocm_consultor:
        return jsonify({"error": "user_id e numerocm_consultor obrigatórios"}), 400
    id_val = str(uuid.uuid4())
    session = get_session()
    session.add(GestorConsultor(id=id_val, user_id=user_id, numerocm_consultor=numerocm_consultor))
    session.commit()
    return jsonify({"ok": True, "id": id_val})

@app.route("/gestor_consultores/<id>", methods=["DELETE"])
def remove_gestor_consultor(id: str):
    ensure_gestor_consultores_schema()
    session = get_session()
    session.execute(delete(GestorConsultor).where(GestorConsultor.id == id))
    session.commit()
    return jsonify({"ok": True})

@app.route("/produtores/sync", methods=["GET", "POST", "OPTIONS"])
def sync_produtores():
    if request.method == "OPTIONS":
        return ("", 204)
    payload = request.get_json(silent=True) or {}
    limpar = bool(payload.get("limparAntes"))
    res = run_sync_produtores(limpar)
    status = res.get("status", 200)
    if "error" in res:
        return jsonify(res), status
    return jsonify(res)

@app.route("/produtores/sync/test", methods=["GET"])
def sync_produtores_test():
    ensure_system_config_schema()
    cfg = get_config_map(["api_produtores_url", "api_produtores_client_id", "api_produtores_secret", "api_produtores_exp"])
    url = str(cfg.get("api_produtores_url") or "").strip()
    client_id = str(cfg.get("api_produtores_client_id") or "").strip()
    secret = str(cfg.get("api_produtores_secret") or "").strip()
    exp = str(cfg.get("api_produtores_exp") or "").strip()
    if not url:
        return jsonify({"error": "Config api_produtores_url ausente"}), 400
    if not client_id or not secret or not exp:
        return jsonify({"error": "Config JWT ausente (cliente_id/secret/exp)"}), 400
    try:
        token = _make_jwt(client_id, int(exp), secret, None)
        req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
        with urlopen(req, timeout=15) as resp:
            raw = resp.read()
            sample = None
            try:
                data = json.loads(raw.decode("utf-8"))
                items = data.get("items") if isinstance(data, dict) else data
                if isinstance(items, list) and items:
                    if isinstance(items[0], dict):
                        sample = list(items[0].keys())[:20]
            except Exception:
                sample = None
            return jsonify({"status": resp.status, "ok": True, "sample_keys": sample})
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "HTTPError", "status": e.code, "details": body or str(e)}), 502
    except URLError as e:
        details = str(getattr(e, 'reason', e))
        return jsonify({"error": "URLError", "details": details}), 502

@app.route("/fazendas/sync", methods=["GET", "POST", "OPTIONS"])
def sync_fazendas():
    if request.method == "OPTIONS":
        return ("", 204)
    payload = request.get_json(silent=True) or {}
    limpar = bool(payload.get("limparAntes"))
    res = run_sync_fazendas(limpar)
    status = res.get("status", 200)
    if "error" in res:
        return jsonify(res), status
    return jsonify(res)

@app.route("/fazendas/sync/test", methods=["GET"])
def sync_fazendas_test():
    ensure_system_config_schema()
    cfg = get_config_map(["api_fazendas_url", "api_fazendas_client_id", "api_fazendas_secret", "api_fazendas_exp"])
    url = str(cfg.get("api_fazendas_url") or "").strip()
    client_id = str(cfg.get("api_fazendas_client_id") or "").strip()
    secret = str(cfg.get("api_fazendas_secret") or "").strip()
    exp = str(cfg.get("api_fazendas_exp") or "").strip()
    if not url:
        return jsonify({"error": "Config api_fazendas_url ausente"}), 400
    if not client_id or not secret or not exp:
        return jsonify({"error": "Config JWT ausente (cliente_id/secret/exp)"}), 400
    try:
        token = _make_jwt(client_id, int(exp), secret, None)
        req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
        with urlopen(req, timeout=15) as resp:
            raw = resp.read()
            sample = None
            try:
                data = json.loads(raw.decode("utf-8"))
                items = data.get("items") if isinstance(data, dict) else data
                if isinstance(items, list) and items:
                    if isinstance(items[0], dict):
                        sample = list(items[0].keys())[:20]
            except Exception:
                sample = None
            return jsonify({"status": resp.status, "ok": True, "sample_keys": sample})
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "HTTPError", "status": e.code, "details": body or str(e)}), 502
    except URLError as e:
        details = str(getattr(e, 'reason', e))
        return jsonify({"error": "URLError", "details": details}), 502

@app.route("/consultores/sync", methods=["GET", "POST", "OPTIONS"])
def sync_consultores():
    if request.method == "OPTIONS":
        return ("", 204)
    payload = request.get_json(silent=True) or {}
    limpar = bool(payload.get("limparAntes"))
    res = run_sync_consultores(limpar)
    status = res.get("status", 200)
    if "error" in res:
        return jsonify(res), status
    return jsonify(res)

@app.route("/consultores/sync/test", methods=["GET"])
def sync_consultores_test():
    ensure_system_config_schema()
    cfg = get_config_map(["api_consultores_url", "api_consultores_client_id", "api_consultores_secret", "api_consultores_exp"])
    url = str(cfg.get("api_consultores_url") or "").strip()
    client_id = str(cfg.get("api_consultores_client_id") or "").strip()
    secret = str(cfg.get("api_consultores_secret") or "").strip()
    exp = str(cfg.get("api_consultores_exp") or "").strip()
    if not url:
        return jsonify({"error": "Config api_consultores_url ausente"}), 400
    if not client_id or not secret or not exp:
        return jsonify({"error": "Config JWT ausente (cliente_id/secret/exp)"}), 400
    try:
        token = _make_jwt(client_id, int(exp), secret, None)
        req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
        with urlopen(req, timeout=15) as resp:
            raw = resp.read()
            sample = None
            try:
                data = json.loads(raw.decode("utf-8"))
                items = data.get("items") if isinstance(data, dict) else data
                if isinstance(items, list) and items:
                    if isinstance(items[0], dict):
                        sample = list(items[0].keys())[:20]
            except Exception:
                sample = None
            return jsonify({"status": resp.status, "ok": True, "sample_keys": sample})
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "HTTPError", "status": e.code, "details": body or str(e)}), 502
    except URLError as e:
        details = str(getattr(e, 'reason', e))
        return jsonify({"error": "URLError", "details": details}), 502

@app.route("/reports/programacao_safra", methods=["GET"])
def report_programacao_safra():
    safra_id = request.args.get("safra_id")
    produtor_numerocm = request.args.get("produtor_numerocm")
    fazenda_id = request.args.get("fazenda_id")
    epoca_id = request.args.get("epoca_id")
    programacao_id = request.args.get("id")

    if not safra_id:
        return jsonify({"error": "Parâmetro safra_id é obrigatório"}), 400

    session = get_session()
    try:
        # Construção dinâmica dos filtros
        params = {
            "safra_id": safra_id,
            "produtor_numerocm": produtor_numerocm,
            "fazenda_id": fazenda_id,
            "epoca_id": epoca_id,
            "id": programacao_id
        }
        
        where_produtor = "AND p.produtor_numerocm = :produtor_numerocm" if produtor_numerocm and produtor_numerocm != 'all' else ""
        where_fazenda = "AND p.fazenda_idfazenda = :fazenda_id" if fazenda_id else ""
        where_epoca = "AND pt.epoca_id = :epoca_id" if epoca_id else ""
        where_id = "AND p.id = :id" if programacao_id else ""

        # 1. Buscar Programações (Agrupador Principal)
        # Ajuste para trazer Consultor, Época e Tipo conforme solicitado
        q_programacoes = text(f"""
            SELECT DISTINCT
                p.id,
                p.area_hectares,
                p.tipo,
                f.nomefazenda as fazenda,
                pr.nome as produtor,
                s.ano_inicio || '/' || s.ano_fim as safra_nome,
                (
                    SELECT e.nome 
                    FROM programacao_talhoes pt2
                    JOIN epocas e ON pt2.epoca_id = e.id
                    WHERE pt2.programacao_id = p.id
                    LIMIT 1
                ) as epoca,
                (
                    SELECT c.consultor
                    FROM programacao_cultivares pc2
                    JOIN consultores c ON pc2.numerocm_consultor = c.numerocm_consultor
                    WHERE pc2.programacao_id = p.id
                    LIMIT 1
                ) as consultor
            FROM programacoes p
            JOIN fazendas f ON p.fazenda_idfazenda = f.idfazenda AND p.produtor_numerocm = f.numerocm
            JOIN produtores pr ON p.produtor_numerocm = pr.numerocm
            LEFT JOIN safras s ON p.safra_id = s.id
            JOIN programacao_talhoes pt ON p.id = pt.programacao_id
            WHERE p.safra_id = :safra_id
              {where_produtor}
              {where_fazenda}
              {where_epoca}
              {where_id}
            ORDER BY f.nomefazenda, p.id
        """)
        res_progs = session.execute(q_programacoes, params).fetchall()
        
        progs_map = {}
        prog_ids = []
        
        for r in res_progs:
            progs_map[r.id] = {
                "id": r.id,
                "fazenda": r.fazenda,
                "produtor": r.produtor,
                "safra": r.safra_nome,
                "area_total": float(r.area_hectares) if r.area_hectares else 0,
                "tipo": r.tipo,
                "epoca": r.epoca,
                "consultor": r.consultor,
                "talhoes": [],
                "cultivares": [],
                "adubacao": []
            }
            prog_ids.append(r.id)
            
        if not prog_ids:
            return jsonify({"programacoes": []})

        # 2. Buscar Talhões das Programações
        q_talhoes = text(f"""
            SELECT DISTINCT
                pt.programacao_id,
                t.nome,
                t.area,
                t.geojson
            FROM programacao_talhoes pt
            JOIN talhoes t ON pt.talhao_id = t.id
            WHERE pt.programacao_id IN :prog_ids
            ORDER BY t.nome
        """)
        res_talhoes = session.execute(q_talhoes, {"prog_ids": tuple(prog_ids)}).fetchall()
        
        for r in res_talhoes:
            if r.programacao_id in progs_map:
                geojson_data = None
                if r.geojson:
                    try:
                        geojson_data = json.loads(r.geojson)
                    except:
                        pass
                
                progs_map[r.programacao_id]["talhoes"].append({
                    "nome": r.nome,
                    "area": float(r.area) if r.area else 0,
                    "geojson": geojson_data
                })

        # 3. Buscar Cultivares das Programações
        q_cultivares = text(f"""
            SELECT DISTINCT
                pc.programacao_id,
                pc.id,
                COALESCE(cc.cultura, pc.cultura) as cultura,
                pc.cultivar,
                pc.tipo_embalagem,
                pc.populacao_recomendada,
                pc.data_plantio,
                pc.tipo_tratamento,
                pc.percentual_cobertura,
                ts.nome as tratamento_nome,
                (
                    SELECT SUM(t2.area)
                    FROM programacao_talhoes pt2
                    JOIN talhoes t2 ON pt2.talhao_id = t2.id
                    WHERE pt2.programacao_id = pc.programacao_id
                ) as area_total_talhoes
            FROM programacao_cultivares pc
            LEFT JOIN cultivares_catalog cc ON pc.cultivar = cc.cultivar
            LEFT JOIN tratamentos_sementes ts ON pc.tratamento_id = ts.id
            WHERE pc.programacao_id IN :prog_ids
            ORDER BY cultura, pc.cultivar
        """)
        res_cultivares = session.execute(q_cultivares, {"prog_ids": tuple(prog_ids)}).fetchall()
        
        for r in res_cultivares:
            if r.programacao_id in progs_map:
                # Calculo de área plantável conforme solicitado: total_talhoes * percentual / 100
                area_talhoes = float(r.area_total_talhoes) if r.area_total_talhoes else 0
                cobertura = float(r.percentual_cobertura) if r.percentual_cobertura else 100
                area_plantavel = area_talhoes * (cobertura / 100.0)

                tratamento_display = r.tratamento_nome if r.tipo_tratamento != 'NÃO' else 'Sem Tratamento'

                progs_map[r.programacao_id]["cultivares"].append({
                    "id": r.id,
                    "cultura": r.cultura,
                    "cultivar": r.cultivar,
                    "tipo_embalagem": r.tipo_embalagem,
                    "area_plantavel": area_plantavel,
                    "populacao": float(r.populacao_recomendada) if r.populacao_recomendada else 0,
                    "data_plantio": r.data_plantio.isoformat() if r.data_plantio else None,
                    "tratamento": r.tipo_tratamento,
                    "tratamento_display": tratamento_display,
                    "cobertura": cobertura
                })

        # 4. Buscar Adubação das Programações
        q_adubacao = text(f"""
            SELECT DISTINCT
                pa.programacao_id,
                pa.id,
                COALESCE(pa.formulacao, ja.descricao) as formulacao,
                pa.dose,
                pa.percentual_cobertura,
                pa.embalagem,
                (pa.dose * p.area_hectares * COALESCE(pa.percentual_cobertura, 100) / 100.0) as total,
                pa.data_aplicacao
            FROM programacao_adubacao pa
            JOIN programacoes p ON pa.programacao_id = p.id
            LEFT JOIN justificativas_adubacao ja ON pa.justificativa_nao_adubacao_id = ja.id
            WHERE pa.programacao_id IN :prog_ids
            ORDER BY pa.data_aplicacao NULLS LAST
        """)
        res_adubacao = session.execute(q_adubacao, {"prog_ids": tuple(prog_ids)}).fetchall()
        
        for r in res_adubacao:
            if r.programacao_id in progs_map:
                progs_map[r.programacao_id]["adubacao"].append({
                    "id": r.id,
                    "formulacao": r.formulacao,
                    "dose": float(r.dose) if r.dose else 0,
                    "cobertura": float(r.percentual_cobertura) if r.percentual_cobertura else 0,
                    "total": float(r.total) if r.total else 0,
                    "embalagem": r.embalagem,
                    "data_aplicacao": r.data_aplicacao.isoformat() if r.data_aplicacao else None
                })

        return jsonify({
            "programacoes": list(progs_map.values())
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400
    finally:
        session.close()

@app.route("/reports/consolidated", methods=["GET"])
def report_consolidated():
    """
    Retorna totais consolidados:
    - Sementes (kg/unidades) - (somatório de quantidade) -> melhor contar registros ou somar área?
      O código antigo somava 'quantidade'.
    - Área total (ha) - Soma das áreas dos cultivares filtrados.
    - Adubação (kg) - Soma total calculada.
    - Defensivos (doses) - Soma das doses.
    Filtros: safra_id, cultura.
    """
    safra_id = request.args.get("safra_id")
    cultura = request.args.get("cultura")
    
    # Se não tiver safra, o comportamento antigo filtrava no frontend se safraFilter fosse vazio?
    # Vamos suportar sem filtro também.
    
    session = get_session()
    try:
        # 1. Totais de Cultivares (Quantidade, Área)
        # Filtro de safra em programacoes ou programacao_cultivares?
        # A safra está em programacao_talhoes (pt.safra_id) ou programacoes (p.safra_id)?
        # No endpoint anterior usamos pt.safra_id e p.safra_id.
        # Vamos usar p.safra_id para consistência com o filtro principal.
        
        where_safra = "AND p.safra_id = :safra_id" if safra_id else ""
        where_cultura = "AND (UPPER(cc.cultura) = :cultura OR UPPER(pc.cultura) = :cultura)" if cultura else ""
        
        params = {}
        if safra_id: params["safra_id"] = safra_id
        if cultura: params["cultura"] = cultura.upper()

        q_cult = text(f"""
            SELECT
                COUNT(*) as count_cultivares,
                SUM(pc.quantidade) as total_sementes,
                SUM(
                    (SELECT SUM(t.area) 
                     FROM programacao_talhoes pt 
                     JOIN talhoes t ON pt.talhao_id = t.id 
                     WHERE pt.programacao_id = pc.programacao_id) 
                    * COALESCE(pc.percentual_cobertura, 100) / 100.0
                ) as total_area_cultivada
            FROM programacao_cultivares pc
            JOIN programacoes p ON pc.programacao_id = p.id
            LEFT JOIN cultivares_catalog cc ON pc.cultivar = cc.cultivar
            WHERE 1=1
            {where_safra}
            {where_cultura}
        """)
        
        res_cult = session.execute(q_cult, params).fetchone()
        
        # 2. Totais de Adubação
        # Adubação não tem 'cultura' direta, mas está ligada a uma programação que pode ter cultivares de X cultura.
        # Se filtrarmos por cultura, devemos incluir apenas adubações de programações que tenham essa cultura?
        # Ou adubação é geral da programação?
        # Normalmente adubação é por programação. Se a programação tem Soja e Milho, a adubação é para ambos?
        # Simplificação: Se cultura for selecionada, filtrar programações que contenham pelo menos um cultivar dessa cultura.
        
        # Subquery para filtrar programacoes pela cultura
        filter_prog_cultura = ""
        if cultura:
            filter_prog_cultura = """
            AND pa.programacao_id IN (
                SELECT pc2.programacao_id 
                FROM programacao_cultivares pc2 
                LEFT JOIN cultivares_catalog cc2 ON pc2.cultivar = cc2.cultivar
                WHERE (UPPER(cc2.cultura) = :cultura OR UPPER(pc2.cultura) = :cultura)
            )
            """

        q_adub = text(f"""
            SELECT
                COUNT(*) as count_adubacoes,
                SUM(
                    pa.dose * p.area_hectares * COALESCE(pa.percentual_cobertura, 100) / 100.0
                ) as total_adubo_kg
            FROM programacao_adubacao pa
            JOIN programacoes p ON pa.programacao_id = p.id
            WHERE 1=1
            {where_safra}
            {filter_prog_cultura}
        """)
        
        res_adub = session.execute(q_adub, params).fetchone()
        
        # 3. Totais de Defensivos
        # Similar à adubação.
        
        filter_prog_cultura_def = ""
        if cultura:
            filter_prog_cultura_def = """
            AND pd.programacao_id IN (
                SELECT pc2.programacao_id 
                FROM programacao_cultivares pc2 
                LEFT JOIN cultivares_catalog cc2 ON pc2.cultivar = cc2.cultivar
                WHERE (UPPER(cc2.cultura) = :cultura OR UPPER(pc2.cultura) = :cultura)
            )
            """

        q_def = text(f"""
            SELECT
                COUNT(*) as count_defensivos,
                SUM(pd.dose) as total_dose_simples -- Apenas soma das doses cadastradas, não multiplicado por área (conforme lógica anterior do frontend?)
                -- O frontend anterior fazia: sum + parseNumber(def.dose).
                -- Se quisermos volume total, seria dose * area * cob. Mas vamos manter a lógica simples se for o que o usuário via, 
                -- OU melhorar para volume total real? O usuário pediu "dados não estão batendo".
                -- O frontend calculava "volumeDefensivo" somando apenas as doses. Isso é estranho (ml/ha + L/ha misturado?).
                -- Vamos retornar a soma simples por enquanto para manter compatibilidade, mas o ideal seria Volume Total (L/Kg).
                -- Vou retornar count por enquanto.
            FROM programacao_defensivos pd
            JOIN programacoes p ON pd.programacao_id = p.id
            WHERE 1=1
            {where_safra}
            {filter_prog_cultura_def}
        """)
        
        res_def = session.execute(q_def, params).fetchone()

        return jsonify({
            "cultivares_count": res_cult.count_cultivares or 0,
            "sementes_total": float(res_cult.total_sementes or 0),
            "area_total_ha": float(res_cult.total_area_cultivada or 0),
            "adubacoes_count": res_adub.count_adubacoes or 0,
            "adubo_total_kg": float(res_adub.total_adubo_kg or 0),
            "defensivos_count": res_def.count_defensivos or 0,
            # "defensivos_total": ... (deixar 0 se não for calcular volume real)
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400
    finally:
        session.close()

@app.route("/reports/consultor_produtor_summary", methods=["GET"])
def report_consultor_produtor_summary():
    """
    Retorna resumo agrupado por Consultor e Produtor:
    - Consultor
    - Produtor
    - Soma da Área (ha) - Área total das programações (glebas) desse produtor na safra.
    - Soma da Área Programada (ha) - Soma das áreas dos cultivares (considerando cobertura).
    Filtros: safra_id, cultura.
    """
    safra_id = request.args.get("safra_id")
    cultura = request.args.get("cultura")
    
    if not safra_id:
        return jsonify({"error": "Safra é obrigatória"}), 400

    session = get_session()
    try:
        where_cultura = ""
        params = {"safra_id": safra_id}
        
        if cultura:
            where_cultura = "AND (UPPER(cc.cultura) = :cultura OR UPPER(pc.cultura) = :cultura)"
            params["cultura"] = cultura.upper()

        # Query complexa:
        # Agrupar por Consultor, Produtor.
        # Precisamos identificar o Consultor. Ele está em programacao_cultivares (numerocm_consultor).
        # Um produtor pode ter vários consultores em programações diferentes? Sim.
        # Então o agrupamento é (Consultor, Produtor).
        
        q = text(f"""
            SELECT
                c.consultor as nome_consultor,
                pr.nome as nome_produtor,
                -- Área Total (Glebas das programações envolvidas)
                -- Precisamos contar a área da programação apenas uma vez por grupo.
                -- Como estamos joinando com cultivares, a programação se repete.
                -- COUNT(DISTINCT p.id) ajuda, mas a soma da área precisa ser feita com cuidado.
                -- Vamos somar a área dos cultivares (Programada) e tentar estimar a Área Física.
                -- Área Programada = SUM(Area Talhoes * Cobertura Cultivar)
                
                SUM(
                    (SELECT SUM(t.area) 
                     FROM programacao_talhoes pt 
                     JOIN talhoes t ON pt.talhao_id = t.id 
                     WHERE pt.programacao_id = p.id) 
                    * COALESCE(pc.percentual_cobertura, 100) / 100.0
                ) as area_programada,
                
                -- Área Física (Soma das áreas das programações únicas neste grupo)
                -- Isso é difícil fazer numa query única com Group By simples se houver multiplos cultivares por programação.
                -- Vamos fazer uma agregação array e somar no python ou usar subquery.
                -- Subquery na select list para somar areas unicas de programacoes desse consultor/produtor?
                -- Melhor: Retornar dados detalhados e agrupar no Python ou usar CTE.
                -- CTE é melhor.
                
                COUNT(DISTINCT p.id) as num_programacoes
                
            FROM programacao_cultivares pc
            JOIN programacoes p ON pc.programacao_id = p.id
            JOIN produtores pr ON p.produtor_numerocm = pr.numerocm
            LEFT JOIN consultores c ON pc.numerocm_consultor = c.numerocm_consultor
            LEFT JOIN cultivares_catalog cc ON pc.cultivar = cc.cultivar
            WHERE p.safra_id = :safra_id
            {where_cultura}
            GROUP BY c.consultor, pr.nome
            ORDER BY c.consultor, pr.nome
        """)
        
        # Para Área Física (Soma da área dos talhões das programações), se filtrar por cultura,
        # queremos a área total da programação que TEM aquela cultura? Ou só a área ocupada pela cultura?
        # O usuário pediu: "Soma da Area (há) e a soma da Area Programada (há)".
        # Geralmente:
        # Área (ha) = Área física da gleba/talhão.
        # Área Programada (ha) = Área cultivada (pode ser menor que a física se cobertura < 100%).
        
        # Se eu tenho um talhão de 100ha.
        # Planto Soja em 100% -> Área 100, Prog 100.
        # Planto Milho em 50% -> Área 100, Prog 50.
        # Se filtro Soja: Área 100, Prog 100.
        # Se filtro Milho: Área 100, Prog 50.
        
        # O problema do GROUP BY acima é que p.area_hectares vai ser somado múltiplas vezes se tiver multiplos cultivares.
        # Vamos buscar os dados brutos e agrupar no Python para garantir precisão nas somas.
        
        q_raw = text(f"""
            SELECT DISTINCT
                p.id as prog_id,
                p.area_hectares as area_prog_fisica, -- Área cadastrada na programação (soma dos talhões)
                c.consultor,
                pr.nome as produtor,
                pc.id as cult_id,
                (
                 (SELECT SUM(t.area) 
                  FROM programacao_talhoes pt 
                  JOIN talhoes t ON pt.talhao_id = t.id 
                  WHERE pt.programacao_id = p.id) 
                 * COALESCE(pc.percentual_cobertura, 100) / 100.0
                ) as area_cultivar_calculada
            FROM programacao_cultivares pc
            JOIN programacoes p ON pc.programacao_id = p.id
            JOIN produtores pr ON p.produtor_numerocm = pr.numerocm
            LEFT JOIN consultores c ON pc.numerocm_consultor = c.numerocm_consultor
            LEFT JOIN cultivares_catalog cc ON pc.cultivar = cc.cultivar
            WHERE p.safra_id = :safra_id
            {where_cultura}
        """)
        
        rows = session.execute(q_raw, params).fetchall()
        
        # Agrupamento Python
        # Chave: (consultor, produtor)
        # Valor: { programacoes_ids: Set, area_programada_soma: float }
        
        summary = {}
        
        for r in rows:
            cons = r.consultor or "Sem Consultor"
            prod = r.produtor
            key = (cons, prod)
            
            if key not in summary:
                summary[key] = {
                    "consultor": cons,
                    "produtor": prod,
                    "progs_fisicas": {}, # map id -> area
                    "area_programada": 0.0
                }
            
            # Adicionar área física apenas uma vez por programação
            if r.prog_id not in summary[key]["progs_fisicas"]:
                summary[key]["progs_fisicas"][r.prog_id] = float(r.area_prog_fisica or 0)
            
            # Somar área programada (cultivar)
            summary[key]["area_programada"] += float(r.area_cultivar_calculada or 0)
            
        # Formatar resultado
        result = []
        for k, v in summary.items():
            area_fisica_total = sum(v["progs_fisicas"].values())
            result.append({
                "consultor": v["consultor"],
                "produtor": v["produtor"],
                "area_fisica": area_fisica_total,
                "area_programada": v["area_programada"]
            })
            
        # Ordenar
        result.sort(key=lambda x: (x["consultor"], x["produtor"]))
        
        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400
    finally:
        session.close()

import socket

class NominatimGeocoder:
    _instance = None
    _lock = threading.Lock()
    _last_request_time = 0
    _cache = {}
    _consecutive_failures = 0
    _circuit_open_until = 0
    
    @classmethod
    def get_instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    def get_address(self, lat, lon):
        if lat is None or lon is None:
            return None
            
        r_lat = round(float(lat), 5)
        r_lon = round(float(lon), 5)
        key = (r_lat, r_lon)
        
        with self._lock:
            if key in self._cache:
                return self._cache[key]
            
            if self._consecutive_failures > 5:
                if time.time() < self._circuit_open_until:
                    return self._get_fallback(lat, lon, "Circuit Open")
                else:
                    self._consecutive_failures = 0
        
        max_retries = 3
        base_delay = 1.0
        
        for attempt in range(max_retries):
            with self._lock:
                now = time.time()
                elapsed = now - self._last_request_time
                wait_time = base_delay - elapsed
                if wait_time > 0:
                    time.sleep(wait_time)
                self._last_request_time = time.time()
                
            try:
                # Switching to ArcGIS Public API as Nominatim is blocking requests
                # ArcGIS REST API: reverseGeocode
                url = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode"
                params = {
                    "f": "json",
                    "location": f"{r_lon},{r_lat}", # ArcGIS uses lon,lat
                    "distance": 1000,
                    "outSR": ""
                }
                query_string = urlencode(params)
                full_url = f"{url}?{query_string}"
                
                req = Request(full_url)
                req.add_header("User-Agent", "AgroPlanAssist/1.0 (agroplanassist@example.com)")
                
                with urlopen(req, timeout=10) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        
                        # ArcGIS Error handling inside 200 OK
                        if "error" in data:
                            print(f"ArcGIS Error: {data['error']}")
                            raise Exception(f"ArcGIS API Error: {data['error'].get('message')}")

                        addr = data.get("address", {})
                        
                        result = {
                            "lat": float(data.get("location", {}).get("y", lat)),
                            "lon": float(data.get("location", {}).get("x", lon)),
                            "endereco_formatado": addr.get("Match_addr") or addr.get("LongLabel"),
                            "logradouro": addr.get("Address") or addr.get("Street"), # ArcGIS usually returns 'Address' or 'Street'
                            "numero": addr.get("AddNum"),
                            "bairro": addr.get("Neighborhood") or addr.get("District"),
                            "cidade": addr.get("City") or addr.get("MetroArea") or addr.get("Subregion"),
                            "estado": addr.get("Region") or addr.get("Territory"), # 'Region' is state code or name
                            "cep": addr.get("Postal"),
                            "pais": addr.get("CountryCode"),
                            "fonte": "ArcGIS/Esri"
                        }
                        
                        with self._lock:
                            self._cache[key] = result
                            self._consecutive_failures = 0
                        return result
                    
            except (URLError, HTTPError, socket.timeout) as e:
                is_timeout = isinstance(e, socket.timeout) or (hasattr(e, 'reason') and isinstance(e.reason, socket.timeout))
                is_503 = hasattr(e, 'code') and e.code == 503
                
                if (is_timeout or is_503) and attempt < max_retries - 1:
                    sleep_time = (attempt + 1) * 2
                    print(f"ArcGIS retry {attempt+1}/{max_retries} after error: {e}. Sleeping {sleep_time}s")
                    time.sleep(sleep_time)
                    continue
                
                print(f"ArcGIS error: {e}")
                if not (is_timeout or is_503):
                    break
            except Exception as e:
                print(f"ArcGIS unexpected error: {e}")
                break
        
        with self._lock:
            self._consecutive_failures += 1
            if self._consecutive_failures > 5:
                print("ArcGIS circuit breaker opened for 60s due to excessive failures")
                self._circuit_open_until = time.time() + 60
            
        return self._get_fallback(lat, lon, "ArcGIS (Error)")

    def _get_fallback(self, lat, lon, source_msg):
        return {
            "lat": lat,
            "lon": lon,
            "endereco_formatado": None,
            "logradouro": None,
            "numero": None,
            "bairro": None,
            "cidade": None,
            "estado": None,
            "cep": None,
            "pais": None,
            "fonte": source_msg
        }

@app.route("/reports/mapa_fazendas", methods=["GET"])
def report_mapa_fazendas():
    produtor_numerocm = request.args.get("produtor_numerocm")
    fazenda_idfazenda = request.args.get("fazenda_id")
    
    session = get_session()
    try:
        where_produtor = "AND f.numerocm = :produtor_numerocm" if produtor_numerocm and produtor_numerocm != 'all' else ""
        where_fazenda = "AND f.idfazenda = :fazenda_id" if fazenda_idfazenda else ""
        
        q = text(f"""
            SELECT 
                f.id as fazenda_uuid,
                f.nomefazenda,
                f.numerocm,
                p.nome as produtor_nome,
                t.id as talhao_id,
                t.nome as talhao_nome,
                t.area as talhao_area,
                t.geojson as talhao_geojson,
                t.centroid_lat,
                t.centroid_lng
            FROM fazendas f
            JOIN produtores p ON f.numerocm = p.numerocm
            JOIN talhoes t ON t.fazenda_id = f.id
            WHERE 1=1
            {where_produtor}
            {where_fazenda}
            ORDER BY p.nome, f.nomefazenda, t.nome
        """)
        
        params = {
            "produtor_numerocm": produtor_numerocm,
            "fazenda_id": fazenda_idfazenda
        }
        
        rows = session.execute(q, params).fetchall()
        
        geocoder = NominatimGeocoder.get_instance()
        
        grouped = {}
        for row in rows:
            f_key = row.fazenda_uuid
            if f_key not in grouped:
                grouped[f_key] = {
                    "fazenda": row.nomefazenda,
                    "produtor": row.produtor_nome,
                    "talhoes": []
                }
            
            geojson = row.talhao_geojson
            if isinstance(geojson, str):
                try:
                    geojson = json.loads(geojson)
                except:
                    geojson = None
            
            talhao_data = {
                "id": row.talhao_id,
                "nome": row.talhao_nome,
                "area": float(row.talhao_area) if row.talhao_area else 0,
                "geojson": geojson,
                "localizacao": None
            }
            
            if row.centroid_lat and row.centroid_lng:
                talhao_data["localizacao"] = geocoder.get_address(row.centroid_lat, row.centroid_lng)
            
            grouped[f_key]["talhoes"].append(talhao_data)
            
        return jsonify(list(grouped.values()))
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400
    finally:
        session.close()

@app.route("/upload/public", methods=["POST"])
def upload_public_file():
    if "file" not in request.files:
        return jsonify({"error": "arquivo obrigatório"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "arquivo sem nome"}), 400
    
    filename = secure_filename(f.filename)
    upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
        
    f.save(os.path.join(upload_dir, filename))
    return jsonify({"ok": True, "filename": filename, "url": f"/{filename}"})

@app.route("/upload/public", methods=["GET"])
def list_public_files():
    upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
    if not os.path.exists(upload_dir):
        return jsonify({"items": []})
    
    files = []
    for name in os.listdir(upload_dir):
        path = os.path.join(upload_dir, name)
        if os.path.isfile(path):
            files.append({
                "name": name,
                "size": os.path.getsize(path),
                "modified": os.path.getmtime(path),
                "url": f"/{name}"
            })
    files.sort(key=lambda x: x["modified"], reverse=True)
    return jsonify({"items": files})

@app.route("/upload/public/<filename>", methods=["DELETE"])
def delete_public_file(filename: str):
    upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
    path = os.path.join(upload_dir, secure_filename(filename))
    if os.path.exists(path):
        os.remove(path)
        return jsonify({"ok": True})
    return jsonify({"error": "arquivo não encontrado"}), 404

if __name__ == "__main__":
    ensure_app_versions_schema()
    app.run(host="0.0.0.0", port=5000, debug=True)
