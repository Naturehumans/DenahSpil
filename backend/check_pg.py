import asyncio
import asyncpg

async def check_pg():
    try:
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            user='postgres',
            password='021104',
            database='postgres'
        )
        print("[OK] Connected to PostgreSQL!")
        
        # List tables
        rows = await conn.fetch("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        if rows:
            print(f"\nExisting tables in PostgreSQL ({len(rows)}):")
            for r in rows:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {r['table_name']}")
                print(f"  {r['table_name']}: {count} rows")
        else:
            print("\nNo tables exist yet in PostgreSQL public schema.")
        
        await conn.close()
    except Exception as e:
        print(f"[ERROR] {e}")

asyncio.run(check_pg())
