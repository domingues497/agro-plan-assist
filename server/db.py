import os
from psycopg2.pool import SimpleConnectionPool
import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

_pool = None
_sa_engine = None
_SessionLocal = None
_ensured = set()
Base = declarative_base()

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

def get_database_url() -> str:
    dbname = os.environ.get("AGROPLAN_DB_NAME", "agroplan_assist")
    user = os.environ.get("AGROPLAN_DB_USER", "agroplan_user")
    password = os.environ.get("AGROPLAN_DB_PASS", "agroplan_pass")
    host = os.environ.get("AGROPLAN_DB_HOST", "localhost")
    port = os.environ.get("AGROPLAN_DB_PORT", "5432")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}"

def get_sa_engine():
    global _sa_engine, _SessionLocal
    if _sa_engine is None:
        url = get_database_url()
        _sa_engine = create_engine(url, pool_pre_ping=True, future=True)
        _SessionLocal = sessionmaker(bind=_sa_engine, autoflush=False, autocommit=False, expire_on_commit=False, future=True)
    return _sa_engine

def get_sa_session():
    get_sa_engine()
    return _SessionLocal()

def ensure_defensivos_schema():
    if 'defensivos_catalog' in _ensured:
        return
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
                _ensured.add('defensivos_catalog')
    finally:
        pool.putconn(conn)

def ensure_aplicacoes_defensivos_schema():
    if 'aplicacoes_defensivos' in _ensured:
        return
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.aplicacoes_defensivos (
                      id TEXT PRIMARY KEY,
                      user_id TEXT,
                      produtor_numerocm TEXT,
                      area TEXT NOT NULL,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );

                    CREATE TABLE IF NOT EXISTS public.programacao_defensivos (
                      id TEXT PRIMARY KEY,
                      aplicacao_id TEXT REFERENCES public.aplicacoes_defensivos(id) ON DELETE CASCADE,
                      user_id TEXT,
                      classe TEXT,
                      defensivo TEXT NOT NULL,
                      dose NUMERIC,
                      unidade TEXT,
                      alvo TEXT,
                      produto_salvo BOOLEAN,
                      deve_faturar BOOLEAN,
                      porcentagem_salva NUMERIC,
                      area_hectares NUMERIC,
                      safra_id TEXT,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
                _ensured.add('aplicacoes_defensivos')
                # Garantir coluna numerocm_consultor para segregação por consultor
                try:
                    cur.execute("ALTER TABLE public.programacao_defensivos ADD COLUMN IF NOT EXISTS numerocm_consultor TEXT")
                except Exception:
                    pass
    finally:
        pool.putconn(conn)

def ensure_fertilizantes_schema():
    if 'fertilizantes_catalog' in _ensured:
        return
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.fertilizantes_catalog (
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
                cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fertilizantes_catalog'")
                cols = {r[0] for r in cur.fetchall()}
                if "grupo" not in cols:
                    cur.execute("ALTER TABLE public.fertilizantes_catalog ADD COLUMN grupo TEXT")
                if "marca" not in cols:
                    cur.execute("ALTER TABLE public.fertilizantes_catalog ADD COLUMN marca TEXT")
                if "principio_ativo" not in cols:
                    cur.execute("ALTER TABLE public.fertilizantes_catalog ADD COLUMN principio_ativo TEXT")
                if "saldo" not in cols:
                    cur.execute("ALTER TABLE public.fertilizantes_catalog ADD COLUMN saldo NUMERIC")
                _ensured.add('fertilizantes_catalog')
    finally:
        pool.putconn(conn)

def ensure_system_config_schema():
    if 'system_config' in _ensured:
        return
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
                _ensured.add('system_config')
    finally:
        pool.putconn(conn)

def ensure_gestor_consultores_schema():
    if 'gestor_consultores' in _ensured:
        return
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.gestor_consultores (
                      id TEXT PRIMARY KEY,
                      user_id TEXT NOT NULL,
                      numerocm_consultor TEXT NOT NULL,
                      created_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
                _ensured.add('gestor_consultores')
                _ensured.add('consultores')
    finally:
        pool.putconn(conn)

def ensure_consultores_schema():
    if 'consultores' in _ensured:
        return
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.consultores (
                      id TEXT PRIMARY KEY,
                      numerocm_consultor TEXT NOT NULL,
                      consultor TEXT NOT NULL,
                      email TEXT NOT NULL UNIQUE,
                      role TEXT NOT NULL DEFAULT 'consultor',
                      ativo BOOLEAN NOT NULL DEFAULT true,
                      pode_editar_programacao BOOLEAN NOT NULL DEFAULT false,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
                # Garantir colunas novas em bases existentes
                try:
                    cur.execute("ALTER TABLE public.consultores ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'consultor'")
                except Exception:
                    pass
                try:
                    cur.execute("ALTER TABLE public.consultores ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true")
                except Exception:
                    pass
                try:
                    cur.execute("ALTER TABLE public.consultores ADD COLUMN IF NOT EXISTS password_digest TEXT")
                except Exception:
                    pass
                try:
                    cur.execute("ALTER TABLE public.consultores ADD COLUMN IF NOT EXISTS pode_editar_programacao BOOLEAN NOT NULL DEFAULT false")
                except Exception:
                    pass
                try:
                    cur.execute("UPDATE public.consultores SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL")
                except Exception:
                    pass
                # Tabelas de associação
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.user_produtores (
                      id TEXT PRIMARY KEY,
                      user_id TEXT NOT NULL,
                      produtor_numerocm TEXT NOT NULL,
                      created_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.user_fazendas (
                      id TEXT PRIMARY KEY,
                      user_id TEXT NOT NULL,
                      fazenda_id TEXT NOT NULL,
                      created_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_calendario_aplicacoes_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.calendario_aplicacoes (
                      id TEXT PRIMARY KEY,
                      cod_aplic TEXT NOT NULL UNIQUE,
                      descr_aplicacao TEXT NOT NULL,
                      cod_aplic_ger TEXT,
                      cod_classe TEXT NOT NULL,
                      descricao_classe TEXT NOT NULL,
                      trat_sementes TEXT,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_epocas_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.epocas (
                      id TEXT PRIMARY KEY,
                      nome TEXT NOT NULL UNIQUE,
                      descricao TEXT,
                      ativa BOOLEAN NOT NULL DEFAULT true,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_justificativas_adubacao_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.justificativas_adubacao (
                      id TEXT PRIMARY KEY,
                      descricao TEXT NOT NULL UNIQUE,
                      ativo BOOLEAN NOT NULL DEFAULT true,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_produtores_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.produtores (
                      id TEXT PRIMARY KEY,
                      numerocm TEXT NOT NULL UNIQUE,
                      nome TEXT NOT NULL,
                      numerocm_consultor TEXT NOT NULL,
                      consultor TEXT,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_import_history_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.import_history (
                      id TEXT PRIMARY KEY,
                      user_id TEXT,
                      tabela_nome TEXT NOT NULL,
                      registros_importados INT NOT NULL,
                      registros_deletados INT NOT NULL,
                      arquivo_nome TEXT,
                      limpar_antes BOOLEAN DEFAULT false,
                      created_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_fazendas_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.fazendas (
                      id TEXT PRIMARY KEY,
                      numerocm TEXT NOT NULL,
                      idfazenda TEXT NOT NULL,
                      nomefazenda TEXT NOT NULL,
                      numerocm_consultor TEXT NOT NULL,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now(),
                      CONSTRAINT fazendas_unique UNIQUE (numerocm, idfazenda)
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_talhoes_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.talhoes (
                      id TEXT PRIMARY KEY,
                      fazenda_id TEXT NOT NULL,
                      nome TEXT NOT NULL,
                      area NUMERIC NOT NULL,
                      arrendado BOOLEAN NOT NULL DEFAULT false,
                      safras_todas BOOLEAN NOT NULL DEFAULT true,
                      kml_name TEXT,
                      kml_uploaded_at TIMESTAMPTZ,
                      kml_text TEXT,
                      geojson TEXT,
                      centroid_lat NUMERIC,
                      centroid_lng NUMERIC,
                      bbox_min_lat NUMERIC,
                      bbox_min_lng NUMERIC,
                      bbox_max_lat NUMERIC,
                      bbox_max_lng NUMERIC,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
                cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'talhoes'")
                cols = {r[0] for r in cur.fetchall()}
                if "safras_todas" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN safras_todas BOOLEAN")
                    cur.execute("UPDATE public.talhoes SET safras_todas = true WHERE safras_todas IS NULL")
                    cur.execute("ALTER TABLE public.talhoes ALTER COLUMN safras_todas SET DEFAULT true")
                    cur.execute("ALTER TABLE public.talhoes ALTER COLUMN safras_todas SET NOT NULL")
                if "kml_name" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN kml_name TEXT")
                if "kml_uploaded_at" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN kml_uploaded_at TIMESTAMPTZ")
                if "kml_text" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN kml_text TEXT")
                if "geojson" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN geojson TEXT")
                if "centroid_lat" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN centroid_lat NUMERIC")
                if "centroid_lng" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN centroid_lng NUMERIC")
                if "bbox_min_lat" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN bbox_min_lat NUMERIC")
                if "bbox_min_lng" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN bbox_min_lng NUMERIC")
                if "bbox_max_lat" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN bbox_max_lat NUMERIC")
                if "bbox_max_lng" not in cols:
                    cur.execute("ALTER TABLE public.talhoes ADD COLUMN bbox_max_lng NUMERIC")
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.talhao_safras (
                      id TEXT PRIMARY KEY,
                      talhao_id TEXT NOT NULL REFERENCES public.talhoes(id) ON DELETE CASCADE,
                      safra_id TEXT NOT NULL,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      CONSTRAINT talhao_safras_unique UNIQUE (talhao_id, safra_id)
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_cultivares_catalog_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.cultivares_catalog (
                      cultivar TEXT NOT NULL,
                      cultura TEXT,
                      nome_cientifico TEXT,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now(),
                      CONSTRAINT cultivares_catalog_unique UNIQUE (cultivar, cultura)
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_tratamentos_sementes_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.tratamentos_sementes (
                      id TEXT PRIMARY KEY,
                      nome TEXT NOT NULL,
                      cultura TEXT,
                      ativo BOOLEAN NOT NULL DEFAULT true,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now(),
                      CONSTRAINT tratamentos_sementes_unique UNIQUE (nome)
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_cultivares_tratamentos_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.cultivares_tratamentos (
                      cultivar TEXT NOT NULL,
                      tratamento_id TEXT NOT NULL,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now(),
                      CONSTRAINT cultivares_tratamentos_unique UNIQUE (cultivar, tratamento_id)
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_app_versions_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.app_versions (
                      id TEXT PRIMARY KEY,
                      version TEXT NOT NULL,
                      build TEXT,
                      environment TEXT,
                      notes TEXT,
                      created_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
                try:
                    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS app_versions_unique_version_env ON public.app_versions (version, environment)")
                except Exception:
                    pass
    finally:
        pool.putconn(conn)

def ensure_embalagens_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.embalagens (
                      id TEXT PRIMARY KEY,
                      nome TEXT NOT NULL,
                      ativo BOOLEAN NOT NULL DEFAULT true,
                      scope_cultivar BOOLEAN NOT NULL DEFAULT false,
                      scope_fertilizante BOOLEAN NOT NULL DEFAULT false,
                      scope_defensivo BOOLEAN NOT NULL DEFAULT false,
                      cultura TEXT,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
                try:
                    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS embalagens_nome_idx ON public.embalagens (nome)")
                except Exception:
                    pass
    finally:
        pool.putconn(conn)

def ensure_safras_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.safras (
                      id TEXT PRIMARY KEY,
                      nome TEXT NOT NULL,
                      is_default BOOLEAN NOT NULL DEFAULT false,
                      ativa BOOLEAN NOT NULL DEFAULT true,
                      ano_inicio INT,
                      ano_fim INT,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
    finally:
        pool.putconn(conn)

def ensure_programacao_schema():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.programacoes (
                      id TEXT PRIMARY KEY,
                      user_id TEXT,
                      produtor_numerocm TEXT NOT NULL,
                      fazenda_idfazenda TEXT NOT NULL,
                      area TEXT NOT NULL,
                      area_hectares NUMERIC,
                      safra_id TEXT,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );

                    CREATE TABLE IF NOT EXISTS public.programacao_cultivares (
                      id TEXT PRIMARY KEY,
                      programacao_id TEXT REFERENCES public.programacoes(id) ON DELETE CASCADE,
                      user_id TEXT,
                      produtor_numerocm TEXT,
                      area TEXT,
                      area_hectares NUMERIC,
                      numerocm_consultor TEXT,
                      cultivar TEXT,
                      quantidade NUMERIC,
                      unidade TEXT,
                      percentual_cobertura NUMERIC,
                      tipo_embalagem TEXT,
                      tipo_tratamento TEXT,
                      tratamento_id TEXT,
                      data_plantio TIMESTAMPTZ,
                      populacao_recomendada NUMERIC,
                      semente_propria BOOLEAN,
                      referencia_rnc_mapa TEXT,
                      sementes_por_saca NUMERIC,
                      safra TEXT,
                      epoca_id TEXT,
                      porcentagem_salva NUMERIC,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );

                    CREATE TABLE IF NOT EXISTS public.programacao_cultivares_tratamentos (
                      id TEXT PRIMARY KEY,
                      programacao_cultivar_id TEXT REFERENCES public.programacao_cultivares(id) ON DELETE CASCADE,
                      tratamento_id TEXT,
                      created_at TIMESTAMPTZ DEFAULT now()
                    );

                    CREATE TABLE IF NOT EXISTS public.programacao_cultivares_defensivos (
                      id TEXT PRIMARY KEY,
                      programacao_cultivar_id TEXT REFERENCES public.programacao_cultivares(id) ON DELETE CASCADE,
                      classe TEXT,
                      aplicacao TEXT,
                      defensivo TEXT,
                      dose NUMERIC,
                      cobertura NUMERIC,
                      total NUMERIC,
                      produto_salvo BOOLEAN,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );

                    CREATE TABLE IF NOT EXISTS public.programacao_adubacao (
                      id TEXT PRIMARY KEY,
                      programacao_id TEXT REFERENCES public.programacoes(id) ON DELETE CASCADE,
                      user_id TEXT,
                      produtor_numerocm TEXT,
                      area TEXT,
                      numerocm_consultor TEXT,
                      formulacao TEXT,
                      dose NUMERIC,
                      percentual_cobertura NUMERIC,
                      data_aplicacao TIMESTAMPTZ,
                      embalagem TEXT,
                      justificativa_nao_adubacao_id TEXT,
                      fertilizante_salvo BOOLEAN,
                      deve_faturar BOOLEAN,
                      porcentagem_salva NUMERIC,
                      total NUMERIC,
                      safra_id TEXT,
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
                    );

                    CREATE TABLE IF NOT EXISTS public.programacao_talhoes (
                      id TEXT PRIMARY KEY,
                      programacao_id TEXT REFERENCES public.programacoes(id) ON DELETE CASCADE,
                      talhao_id TEXT,
                      safra_id TEXT,
                      fazenda_idfazenda TEXT,
                      created_at TIMESTAMPTZ DEFAULT now()
                    );

                    -- Garantir coluna e índice único para evitar duas programações por talhão na mesma safra
                    ALTER TABLE public.programacao_talhoes ADD COLUMN IF NOT EXISTS safra_id TEXT;
                    ALTER TABLE public.programacao_talhoes ADD COLUMN IF NOT EXISTS fazenda_idfazenda TEXT;
                    CREATE UNIQUE INDEX IF NOT EXISTS programacao_talhoes_unique_talhao_safra
                      ON public.programacao_talhoes (talhao_id, safra_id)
                      WHERE safra_id IS NOT NULL;
                    CREATE UNIQUE INDEX IF NOT EXISTS programacao_talhoes_unique_fazenda_talhao_safra
                      ON public.programacao_talhoes (fazenda_idfazenda, talhao_id, safra_id)
                      WHERE safra_id IS NOT NULL AND fazenda_idfazenda IS NOT NULL;
                    """
                )
                # Garantir colunas em bases existentes
                try:
                    cur.execute("ALTER TABLE public.programacao_cultivares ADD COLUMN IF NOT EXISTS numerocm_consultor TEXT")
                except Exception:
                    pass
                try:
                    cur.execute("ALTER TABLE public.programacao_adubacao ADD COLUMN IF NOT EXISTS numerocm_consultor TEXT")
                except Exception:
                    pass
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
            out = {k: (str(v) if v is not None else "") for k, v in rows}
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
