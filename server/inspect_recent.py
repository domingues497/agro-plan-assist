
import os
import json
from app import app
from db import get_pool
from psycopg2.extras import RealDictCursor

def inspect_recent():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("--- RECENT PROGRAMACAO_TALHOES ---")
            cur.execute("""
                SELECT 
                    p.created_at,
                    f.nomefazenda,
                    s.nome as safra_nome,
                    e.nome as epoca_nome,
                    pt.epoca_id,
                    t.nome as talhao_nome
                FROM programacao_talhoes pt
                JOIN programacoes p ON p.id = pt.programacao_id
                JOIN fazendas f ON f.id = pt.fazenda_idfazenda
                JOIN safras s ON s.id = pt.safra_id
                LEFT JOIN epocas e ON e.id = pt.epoca_id
                JOIN talhoes t ON t.id = pt.talhao_id
                ORDER BY p.created_at DESC
                LIMIT 20
            """)
            rows = cur.fetchall()
            for r in rows:
                print(f"{r['created_at']} | {r['nomefazenda']} | {r['safra_nome']} | {r['epoca_nome']} ({r['epoca_id']}) | {r['talhao_nome']}")

    finally:
        pool.putconn(conn)

if __name__ == "__main__":
    inspect_recent()
