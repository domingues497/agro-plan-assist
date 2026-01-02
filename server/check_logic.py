
import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool

def get_pool():
    dbname = os.environ.get("AGROPLAN_DB_NAME", "agroplan_assist")
    user = os.environ.get("AGROPLAN_DB_USER", "agroplan_user")
    password = os.environ.get("AGROPLAN_DB_PASS", "agroplan_pass")
    host = os.environ.get("AGROPLAN_DB_HOST", "localhost")
    port = int(os.environ.get("AGROPLAN_DB_PORT", "5432"))
    return SimpleConnectionPool(1, 10, dbname=dbname, user=user, password=password, host=host, port=port)

def check_logic():
    pool = get_pool()
    conn = pool.getconn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Case 1: Plot with NULL epoch
        # TalhaoID: dcb0c855-5257-4407-95f7-0db90e021287
        # Safra: 1764593339253
        # Epoca: None
        
        talhao_id = 'dcb0c855-5257-4407-95f7-0db90e021287'
        safra_id = '1764593339253'
        
        # Get Normal Epoch ID
        cur.execute("SELECT id FROM public.epocas WHERE nome = 'Normal'")
        normal_id = cur.fetchone()['id']
        
        print(f"\n--- Checking Plot {talhao_id} (Has NULL epoch) ---")
        
        # Check logic for Normal ID
        cur.execute("""
            SELECT 
                CASE 
                  WHEN %s IS NULL THEN FALSE 
                  WHEN %s IS NULL THEN FALSE
                  ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = %s AND pt.safra_id = %s AND pt.epoca_id = %s) 
                END AS tem_programacao_safra
        """, [safra_id, normal_id, talhao_id, safra_id, normal_id])
        res_normal = cur.fetchone()['tem_programacao_safra']
        print(f"Availability for Normal ({normal_id}): {res_normal} (Expected: False because NULL != UUID)")

        # Check logic for NULL (passing None)
        cur.execute("""
            SELECT 
                CASE 
                  WHEN %s IS NULL THEN FALSE 
                  WHEN %s IS NULL THEN FALSE
                  ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = %s AND pt.safra_id = %s AND pt.epoca_id = %s) 
                END AS tem_programacao_safra
        """, [safra_id, None, talhao_id, safra_id, None])
        res_null = cur.fetchone()['tem_programacao_safra']
        print(f"Availability for None: {res_null} (Expected: False because first WHEN clause)")

        # Case 2: Plot with Águas epoch
        # TalhaoID: dcb0c855-5257-4407-95f7-0db90e021287
        # Safra: 1 (Wait, same talhao has Safra 1 too?)
        # Let's verify what records exist for this talhao
        print(f"\n--- Records for Plot {talhao_id} ---")
        cur.execute("SELECT safra_id, epoca_id FROM public.programacao_talhoes WHERE talhao_id = %s", [talhao_id])
        recs = cur.fetchall()
        for r in recs:
            print(f"Safra: {r['safra_id']} | Epoca: {r['epoca_id']}")

        # Safra 1 has Águas (adbf8...)
        safra_1 = '1'
        # Get Águas ID
        cur.execute("SELECT id FROM public.epocas WHERE nome = 'Águas'")
        aguas_id = cur.fetchone()['id']

        print(f"\n--- Checking Plot {talhao_id} Safra 1 (Has Águas) ---")
        
        # Check availability for Águas (Should be True)
        cur.execute("""
            SELECT 
                CASE 
                  WHEN %s IS NULL THEN FALSE 
                  WHEN %s IS NULL THEN FALSE
                  ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = %s AND pt.safra_id = %s AND pt.epoca_id = %s) 
                END AS tem_programacao_safra
        """, [safra_1, aguas_id, talhao_id, safra_1, aguas_id])
        res_aguas = cur.fetchone()['tem_programacao_safra']
        print(f"Availability for Águas: {res_aguas} (Expected: True)")

        # Check availability for Normal (Should be False)
        cur.execute("""
            SELECT 
                CASE 
                  WHEN %s IS NULL THEN FALSE 
                  WHEN %s IS NULL THEN FALSE
                  ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = %s AND pt.safra_id = %s AND pt.epoca_id = %s) 
                END AS tem_programacao_safra
        """, [safra_1, normal_id, talhao_id, safra_1, normal_id])
        res_normal_1 = cur.fetchone()['tem_programacao_safra']
        print(f"Availability for Normal: {res_normal_1} (Expected: False)")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        pool.putconn(conn)

if __name__ == "__main__":
    check_logic()
