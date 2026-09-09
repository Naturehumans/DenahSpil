import asyncio
import asyncpg

async def cleanup():
    pg = await asyncpg.connect(host='localhost',port=5432,user='postgres',password='021104',database='postgres')
    
    # Delete the unreferenced duplicate building (PG-seeded one with no floors)
    await pg.execute("DELETE FROM buildings WHERE id = '463e4546-1c4b-4cfc-87e1-c68222fe13eb'")
    
    count = await pg.fetchval("SELECT COUNT(*) FROM buildings")
    print(f"Buildings after cleanup: {count}")
    rows = await pg.fetch("SELECT id, name FROM buildings")
    for r in rows:
        print(f"  {r['id']} - {r['name']}")
    
    await pg.close()
    print("Done.")

asyncio.run(cleanup())
