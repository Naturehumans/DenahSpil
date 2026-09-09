import sqlite3
import asyncio
import asyncpg
import uuid

def fmt_uuid(val):
    s = str(val)
    if len(s) == 32 and '-' not in s:
        s = f"{s[:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:]}"
    return s

async def check():
    conn = sqlite3.connect('spildenah.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    print("=== SQLite ===")
    for table in ['users', 'buildings', 'equipment_categories', 'floors', 'equipments', 'slot_templates']:
        cur.execute(f"SELECT * FROM {table}")
        rows = cur.fetchall()
        print(f"\n[{table}]")
        for r in rows:
            d = dict(r)
            print(f"  id={fmt_uuid(d['id'])}", end="")
            if 'name' in d: print(f" name={d['name']}", end="")
            if 'category_id' in d: print(f" category_id={fmt_uuid(d['category_id']) if d['category_id'] else None}", end="")
            if 'floor_id' in d: print(f" floor_id={fmt_uuid(d['floor_id']) if d['floor_id'] else None}", end="")
            print()
    conn.close()
    
    pg = await asyncpg.connect(host='localhost', port=5432, user='postgres', password='021104', database='postgres')
    print("\n=== PostgreSQL ===")
    for table in ['users', 'buildings', 'equipment_categories', 'floors', 'equipments', 'slot_templates']:
        rows = await pg.fetch(f"SELECT * FROM {table}")
        print(f"\n[{table}]")
        for r in rows:
            print(f"  id={r['id']}", end="")
            if 'name' in r.keys(): print(f" name={r['name']}", end="")
            if 'category_id' in r.keys(): print(f" category_id={r['category_id']}", end="")
            if 'floor_id' in r.keys(): print(f" floor_id={r['floor_id']}", end="")
            print()
    await pg.close()

asyncio.run(check())
