
import os
import sys
from server.db import get_pool
from server.app import app

def check_talhoes():
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            # Get a fazenda_id that has talhoes
            cur.execute("SELECT fazenda_id FROM talhoes LIMIT 1")
            row = cur.fetchone()
            if not row:
                print("No talhoes found in DB")
                return
            fazenda_id = row[0]
            print(f"Fazenda ID: {fazenda_id}")

            # Get talhoes for this fazenda directly from DB
            cur.execute("SELECT id, area FROM talhoes WHERE fazenda_id = %s LIMIT 1", [fazenda_id])
            t_row = cur.fetchone()
            if not t_row:
                print("No talhoes found for this fazenda")
            else:
                print(f"DB Talhao: id={t_row[0]}, area={t_row[1]}, type={type(t_row[1])}")

            # Now verify what the API would return
            # We can simulate the query used in list_talhoes
            ids_param = str(fazenda_id)
            id_list = [s for s in ids_param.split(",") if s]
            
            # This is the query from app.py
            query = """
                    SELECT 
                        t.id,
                        t.fazenda_id,
                        t.nome,
                        t.area
                    FROM public.talhoes t
                    LEFT JOIN public.talhao_safras ts ON ts.talhao_id = t.id
                    WHERE t.fazenda_id = ANY(%s)
                    GROUP BY t.id
            """
            cur.execute(query, [id_list])
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            items = [dict(zip(cols, r)) for r in rows]
            
            import json
            # Simulate jsonify (standard json.dumps)
            # We need to handle Decimal serialization manually to see how it behaves if we were using standard json
            # But Flask jsonify handles some things? actually no, standard json fails on Decimal.
            # Let's see what the value is.
            if items:
                print(f"API Item Area: {items[0]['area']} (Type: {type(items[0]['area'])})")
                
    finally:
        pool.putconn(conn)

if __name__ == "__main__":
    check_talhoes()
