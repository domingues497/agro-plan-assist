
import os
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, jsonify
import json

def get_db_connection():
    dbname = os.environ.get("AGROPLAN_DB_NAME", "agroplan_assist")
    user = os.environ.get("AGROPLAN_DB_USER", "agroplan_user")
    password = os.environ.get("AGROPLAN_DB_PASS", "agroplan_pass")
    host = os.environ.get("AGROPLAN_DB_HOST", "localhost")
    port = int(os.environ.get("AGROPLAN_DB_PORT", "5432"))
    return psycopg2.connect(dbname=dbname, user=user, password=password, host=host, port=port)

def debug_availability():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 1. Get a farm/safra/epoch where count(programacao) matches count(talhoes)
        print("--- BUSCANDO FAZENDA COMPLETAMENTE PROGRAMADA ---")
        cur.execute("""
            SELECT f.id as fazenda_id, f.nomefazenda, pt.safra_id, s.nome as safra_nome, pt.epoca_id
            FROM fazendas f
            JOIN talhoes t ON t.fazenda_id = f.id
            JOIN programacao_talhoes pt ON pt.talhao_id = t.id
            JOIN safras s ON s.id = pt.safra_id
            WHERE pt.epoca_id IS NOT NULL
            GROUP BY f.id, f.nomefazenda, pt.safra_id, s.nome, pt.epoca_id
            HAVING COUNT(DISTINCT pt.talhao_id) = (SELECT COUNT(*) FROM talhoes t2 WHERE t2.fazenda_id = f.id)
            LIMIT 1
        """)
        row = cur.fetchone()
        
        if not row:
            print("Nenhuma fazenda completamente programada encontrada.")
            # Fallback to partially programmed
            print("--- BUSCANDO FAZENDA PARCIALMENTE PROGRAMADA ---")
            cur.execute("""
                SELECT f.id as fazenda_id, f.nomefazenda, pt.safra_id, s.nome as safra_nome, pt.epoca_id
                FROM fazendas f
                JOIN talhoes t ON t.fazenda_id = f.id
                JOIN programacao_talhoes pt ON pt.talhao_id = t.id
                JOIN safras s ON s.id = pt.safra_id
                WHERE pt.epoca_id IS NOT NULL
                GROUP BY f.id, f.nomefazenda, pt.safra_id, s.nome, pt.epoca_id
                LIMIT 1
            """)
            row = cur.fetchone()

        if not row:
            print("Nenhuma programacao encontrada.")
            return

        fazenda_id = row['fazenda_id']
        safra_id = row['safra_id']
        epoca_id = row['epoca_id']
        print(f"Fazenda: {row['nomefazenda']} ({fazenda_id})")
        print(f"Safra: {row['safra_nome']} ({safra_id})")
        print(f"Epoca ID: {epoca_id}")
        
        # Check availability for THIS epoch
        print(f"\n--- CHECANDO DISPONIBILIDADE (Epoca Selecionada) ---")
        check_availability(cur, fazenda_id, safra_id, epoca_id)

        # Check availability for ANOTHER epoch (find one)
        print(f"\n--- CHECANDO DISPONIBILIDADE (Outra Epoca) ---")
        cur.execute("SELECT id FROM epocas WHERE id != %s LIMIT 1", (epoca_id,))
        other_epoca = cur.fetchone()
        if other_epoca:
             check_availability(cur, fazenda_id, safra_id, other_epoca['id'])

    finally:
        conn.close()

def check_availability(cur, fazenda_id, safra_id, epoca_id):
    query = """
        SELECT 
            t.id,
            t.nome,
            CASE 
                WHEN %s IS NULL THEN FALSE 
                WHEN %s IS NULL THEN FALSE
                ELSE EXISTS (SELECT 1 FROM public.programacao_talhoes pt WHERE pt.talhao_id = t.id AND pt.safra_id = %s AND pt.epoca_id = %s) 
            END AS tem_programacao_safra
        FROM public.talhoes t
        WHERE t.fazenda_id = %s
    """
    params = [safra_id, epoca_id, safra_id, epoca_id, fazenda_id]
    
    # Print effective query for debugging (approximation)
    # print(f"Query params: {params}")
    
    cur.execute(query, params)
    results = cur.fetchall()
    
    available_count = 0
    unavailable_count = 0
    
    for row in results:
        status = "INDISPONIVEL" if row['tem_programacao_safra'] else "DISPONIVEL"
        print(f"Talhao {row['nome']} ({row['id']}): {status}")
        if row['tem_programacao_safra']:
            unavailable_count += 1
        else:
            available_count += 1
            
    print(f"Total: {len(results)} | Disponiveis: {available_count} | Indisponiveis: {unavailable_count}")

if __name__ == "__main__":
    debug_availability()
