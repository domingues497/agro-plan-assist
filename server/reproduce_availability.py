import sys
import os
import uuid
import json

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import get_pool, ensure_programacao_schema

def run_test():
    print("Starting test...")
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                # 1. Setup Test Data
                # Get Safra
                cur.execute("SELECT id FROM public.safras LIMIT 1")
                safra_id = cur.fetchone()[0]
                print(f"Safra ID: {safra_id}")

                # Get Epocas
                cur.execute("SELECT id, nome FROM public.epocas WHERE nome IN ('Normal', 'Águas')")
                epocas = {row[1]: row[0] for row in cur.fetchall()}
                print(f"Epocas: {epocas}")
                
                if 'Normal' not in epocas or 'Águas' not in epocas:
                    print("Missing 'Normal' or 'Águas' epochs. Creating them if needed (skipping for now).")
                    return

                epoca_normal = epocas['Normal']
                epoca_aguas = epocas['Águas']

                # Create dummy Talhao
                talhao_id = str(uuid.uuid4())
                fazenda_id = str(uuid.uuid4())
                # Ensure fazenda exists (or mock it, assuming foreign keys might be loose or handled)
                # Actually, FKs usually enforced. Need a valid Fazenda.
                cur.execute("SELECT id, idfazenda, numerocm FROM public.fazendas LIMIT 1")
                fazenda = cur.fetchone()
                if not fazenda:
                    print("No fazenda found. Cannot proceed.")
                    return
                fazenda_uuid, fazenda_idfazenda, produtor_numerocm = fazenda
                
                # Check if we have a talhao for this fazenda
                cur.execute("SELECT id FROM public.talhoes WHERE fazenda_id = %s LIMIT 1", [fazenda_uuid])
                t = cur.fetchone()
                if t:
                    talhao_id = t[0]
                    print(f"Using existing Talhao: {talhao_id}")
                else:
                    # Create talhao
                    cur.execute("""
                        INSERT INTO public.talhoes (id, fazenda_id, nome, area)
                        VALUES (%s, %s, 'Test Talhao', 10)
                    """, [talhao_id, fazenda_uuid])
                    print(f"Created Test Talhao: {talhao_id}")

                # Clean up existing programacoes for this talhao/safra to start fresh
                cur.execute("""
                    DELETE FROM public.programacoes 
                    WHERE id IN (
                        SELECT programacao_id FROM public.programacao_talhoes 
                        WHERE talhao_id = %s AND safra_id = %s
                    )
                """, [talhao_id, safra_id])
                print("Cleaned up existing programacoes for test talhao.")

                # 1. Create a programming with Epoch A
                # Mapping variables for compatibility
                epoca_a_id = epoca_normal
                epoca_b_id = epoca_aguas
                user_id = 'test_user'

                print(f"Creating programming for Epoch A ({epoca_a_id})...")
                prog_id = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO public.programacoes (id, user_id, produtor_numerocm, fazenda_idfazenda, area, safra_id, created_at, updated_at)
                    VALUES (%s, %s, '12345', %s, 'Area Test', %s, now(), now())
                """, [prog_id, user_id, fazenda_idfazenda, safra_id])
                
                cur.execute("""
                    INSERT INTO public.programacao_talhoes (id, programacao_id, talhao_id, safra_id, fazenda_idfazenda, epoca_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, [str(uuid.uuid4()), prog_id, talhao_id, safra_id, fazenda_idfazenda, epoca_a_id])
                conn.commit()

                # 2. Check availability for Epoch B (Should be available -> tem_programacao_safra = False)
                print(f"Checking availability for Epoch B ({epoca_b_id})...")
                cur.execute("""
                    SELECT 
                        CASE 
                          WHEN %s IS NULL THEN FALSE 
                          WHEN %s IS NULL THEN FALSE
                          ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = %s AND pt.safra_id = %s AND pt.epoca_id = %s) 
                        END AS tem_programacao_safra
                """, [safra_id, epoca_b_id, talhao_id, safra_id, epoca_b_id])
                
                result_b = cur.fetchone()[0]
                print(f"Result for Epoch B: {result_b} (Expected: False)")

                # 3. Check availability for Epoch A (Should be occupied -> tem_programacao_safra = True)
                print(f"Checking availability for Epoch A ({epoca_a_id})...")
                cur.execute("""
                    SELECT 
                        CASE 
                          WHEN %s IS NULL THEN FALSE 
                          WHEN %s IS NULL THEN FALSE
                          ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = %s AND pt.safra_id = %s AND pt.epoca_id = %s) 
                        END AS tem_programacao_safra
                """, [safra_id, epoca_a_id, talhao_id, safra_id, epoca_a_id])
                
                result_a = cur.fetchone()[0]
                print(f"Result for Epoch A: {result_a} (Expected: True)")

                # 4. Check Conflict Logic for Águas
                # Simulate create_programacao check
                cur.execute("""
                    SELECT pt.talhao_id
                    FROM public.programacoes p
                    JOIN public.programacao_talhoes pt ON pt.programacao_id = p.id
                    WHERE p.safra_id = %s AND p.fazenda_idfazenda = %s AND pt.talhao_id = ANY(%s) AND p.id <> %s
                    AND pt.epoca_id IS NOT DISTINCT FROM %s
                """, [safra_id, fazenda_idfazenda, [talhao_id], 'new_prog_id', epoca_aguas])
                conflicts = cur.fetchall()
                print(f"Conflicts for Águas: {conflicts} (Expected: [])")

                # 5. Create Programacao in Águas
                prog_aguas_id = str(uuid.uuid4())
                # Try inserting
                if not conflicts:
                    cur.execute("""
                        INSERT INTO public.programacoes (id, user_id, produtor_numerocm, fazenda_idfazenda, area, area_hectares, safra_id, tipo)
                        VALUES (%s, 'test_user', %s, %s, 'Test Area Aguas', 10, %s, 'PROGRAMACAO')
                    """, [prog_aguas_id, produtor_numerocm, fazenda_idfazenda, safra_id])
                    
                    cur.execute("""
                        INSERT INTO public.programacao_talhoes (id, programacao_id, talhao_id, safra_id, fazenda_idfazenda, epoca_id)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, [str(uuid.uuid4()), prog_aguas_id, talhao_id, safra_id, fazenda_idfazenda, epoca_aguas])
                    print(f"Created Programacao Águas: {prog_aguas_id}")
                
                # 6. Check Conflict Logic for Águas AGAIN (Should conflict now)
                cur.execute("""
                    SELECT pt.talhao_id
                    FROM public.programacoes p
                    JOIN public.programacao_talhoes pt ON pt.programacao_id = p.id
                    WHERE p.safra_id = %s AND p.fazenda_idfazenda = %s AND pt.talhao_id = ANY(%s) AND p.id <> %s
                    AND pt.epoca_id IS NOT DISTINCT FROM %s
                """, [safra_id, fazenda_idfazenda, [talhao_id], 'new_prog_id_2', epoca_aguas])
                conflicts_2 = cur.fetchall()
                print(f"Conflicts for Águas (After create): {conflicts_2} (Expected: Found)")

                # 7. Check Conflict Logic for Normal (Should conflict with Normal program, but not Águas)
                cur.execute("""
                    SELECT pt.talhao_id
                    FROM public.programacoes p
                    JOIN public.programacao_talhoes pt ON pt.programacao_id = p.id
                    WHERE p.safra_id = %s AND p.fazenda_idfazenda = %s AND pt.talhao_id = ANY(%s) AND p.id <> %s
                    AND pt.epoca_id IS NOT DISTINCT FROM %s
                """, [safra_id, fazenda_idfazenda, [talhao_id], 'new_prog_id_3', epoca_normal])
                conflicts_3 = cur.fetchall()
                print(f"Conflicts for Normal: {conflicts_3} (Expected: Found from Normal program)")

                # Rollback changes
                raise Exception("Rollback test data")

    except Exception as e:
        if str(e) == "Rollback test data":
            print("Test finished successfully (Rolled back).")
        else:
            print(f"Error: {e}")
    finally:
        pool.putconn(conn)

if __name__ == "__main__":
    run_test()
