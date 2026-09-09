import asyncio
import asyncpg

async def t():
    conn = await asyncpg.connect(host='localhost',port=5432,user='postgres',password='021104',database='postgres')
    r = await conn.fetchval('SELECT COUNT(*) FROM equipments')
    print('equipments count:', r)
    r2 = await conn.fetchval('SELECT COUNT(*) FROM slot_templates')
    print('slot_templates count:', r2)
    await conn.close()

asyncio.run(t())
print("Done")
