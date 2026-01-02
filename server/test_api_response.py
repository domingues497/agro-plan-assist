
import os
import json
from app import app
from db import get_pool
from psycopg2.extras import RealDictCursor

def test_api():
    # Setup
    client = app.test_client()
    
    # 1. Find a farm/safra/epoch to test (same logic as debug_talhoes)
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print("--- FINDING TEST DATA ---")
            # Find a farm with at least one programacao
            cur.execute("""
                SELECT f.id as fazenda_id, f.nomefazenda, pt.safra_id, s.nome as safra_nome, pt.epoca_id
                FROM fazendas f
                JOIN talhoes t ON t.fazenda_id = f.id
                JOIN programacao_talhoes pt ON pt.talhao_id = t.id
                JOIN safras s ON s.id = pt.safra_id
                WHERE pt.epoca_id IS NOT NULL
                LIMIT 1
            """)
            row = cur.fetchone()
            if not row:
                print("No data found to test.")
                return

            fazenda_id = str(row['fazenda_id'])
            safra_id = str(row['safra_id'])
            epoca_id = str(row['epoca_id'])
            
            print(f"Testing with Fazenda: {fazenda_id}")
            print(f"Safra: {safra_id}")
            print(f"Epoca (Programmed): {epoca_id}")

            # Find another epoch (Available)
            cur.execute("SELECT id FROM epocas WHERE id != %s LIMIT 1", (epoca_id,))
            other_row = cur.fetchone()
            other_epoca_id = str(other_row['id']) if other_row else None
            print(f"Epoca (Available): {other_epoca_id}")

            # 2. Call API for PROGRAMMED epoch
            print(f"\n--- CALLING API (Programmed Epoch) ---")
            resp = client.get(f'/talhoes?fazenda_id={fazenda_id}&safra_id={safra_id}&epoca_id={epoca_id}')
            if resp.status_code != 200:
                print(f"Error: {resp.status_code}")
                print(resp.data)
                return
                
            data = json.loads(resp.data)
            items = data.get('items', [])
            print(f"Items returned: {len(items)}")
            
            # Check tem_programacao_safra
            programmed_count = 0
            for item in items:
                if item.get('tem_programacao_safra'):
                    programmed_count += 1
            
            print(f"Items with tem_programacao_safra=True: {programmed_count}")

            # 3. Call API for AVAILABLE epoch
            if other_epoca_id:
                print(f"\n--- CALLING API (Available Epoch) ---")
                resp = client.get(f'/talhoes?fazenda_id={fazenda_id}&safra_id={safra_id}&epoca_id={other_epoca_id}')
                data = json.loads(resp.data)
                items = data.get('items', [])
                print(f"Items returned: {len(items)}")
                
                programmed_count = 0
                for item in items:
                    if item.get('tem_programacao_safra'):
                        programmed_count += 1
                
                print(f"Items with tem_programacao_safra=True: {programmed_count}")

    finally:
        pool.putconn(conn)

if __name__ == "__main__":
    test_api()
