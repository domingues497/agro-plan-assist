
import os
import psycopg2
from dotenv import load_dotenv
import json

load_dotenv()

def get_db_connection():
    url = os.getenv("DATABASE_URL")
    print(f"Connecting to: {url}")
    return psycopg2.connect(url)

def test():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        print("--- Programacao Talhoes (Limit 20) ---")
        cur.execute("SELECT talhao_id, safra_id, epoca_id FROM public.programacao_talhoes ORDER BY created_at DESC LIMIT 20")
        rows = cur.fetchall()
        for r in rows:
            print(r)
            
        print("\n--- Talhoes (Limit 5) ---")
        cur.execute("SELECT id, nome, fazenda_id FROM public.talhoes LIMIT 5")
        rows = cur.fetchall()
        for r in rows:
            print(r)

        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
