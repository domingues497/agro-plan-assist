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

def ensure_aplicacoes_defensivos_schema():
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
    finally:
        pool.putconn(conn)

def ensure_fertilizantes_schema():
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

def ensure_consultores_schema():
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
                      created_at TIMESTAMPTZ DEFAULT now(),
                      updated_at TIMESTAMPTZ DEFAULT now()
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
                      created_at TIMESTAMPTZ DEFAULT now()
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
