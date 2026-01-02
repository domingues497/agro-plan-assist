import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid

# Add server directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'server'))

try:
    from app import get_pool
except ImportError:
    pass

def get_db_connection():
    try:
        pool = get_pool()
        return pool.getconn()
    except:
        return psycopg2.connect(
            "dbname=postgres user=postgres password=postgres host=localhost port=5432"
        )

def check_legacy_logic():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        print("--- VERIFICANDO LOGICA COM DADOS LEGADOS (NULL) ---")
        
        # 1. Find a talhao that has a programacao with epoca_id NULL
        cur.execute("""
            SELECT pt.talhao_id, pt.safra_id, pt.epoca_id 
            FROM programacao_talhoes pt
            WHERE pt.epoca_id IS NULL
            LIMIT 1
        """)
        row = cur.fetchone()
        
        if not row:
            print("Nenhum registro legado (epoca_id NULL) encontrado para teste.")
            return

        talhao_id = row['talhao_id']
        safra_id = row['safra_id']
        print(f"Usando Talhao: {talhao_id} | Safra: {safra_id} (Registro com epoca_id NULL)")
        
        # 2. Check availability for 'Normal' (UUID)
        # We need a valid Normal UUID.
        cur.execute("SELECT id, nome FROM epocas WHERE nome = 'Normal'")
        epoca_normal = cur.fetchone()
        if not epoca_normal:
            print("Epoca Normal nao encontrada.")
            return
            
        epoca_normal_id = epoca_normal['id']
        print(f"Epoca Normal ID: {epoca_normal_id}")
        
        # Query matching app.py logic
        query = """
            SELECT 
                t.id,
                CASE 
                  WHEN %s IS NULL THEN FALSE 
                  WHEN %s IS NULL THEN FALSE
                  ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = t.id AND pt.safra_id = %s AND pt.epoca_id = %s) 
                END AS tem_programacao_safra
            FROM public.talhoes t
            WHERE t.id = %s
        """
        
        # Test 1: Check against Normal
        print(f"Checando disponibilidade para Epoca Normal ({epoca_normal_id})...")
        cur.execute(query, (safra_id, epoca_normal_id, safra_id, epoca_normal_id, talhao_id))
        result = cur.fetchone()
        print(f"Resultado Normal: {result['tem_programacao_safra']} (Esperado: False, pois NULL != UUID)")
        
        # Test 2: Check against Safrinha
        cur.execute("SELECT id, nome FROM epocas WHERE nome = 'Safrinha'")
        epoca_safrinha = cur.fetchone()
        if epoca_safrinha:
            epoca_safrinha_id = epoca_safrinha['id']
            print(f"Checando disponibilidade para Epoca Safrinha ({epoca_safrinha_id})...")
            cur.execute(query, (safra_id, epoca_safrinha_id, safra_id, epoca_safrinha_id, talhao_id))
            result = cur.fetchone()
            print(f"Resultado Safrinha: {result['tem_programacao_safra']} (Esperado: False)")
            
    except Exception as e:
        print(f"Erro: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_legacy_logic()
