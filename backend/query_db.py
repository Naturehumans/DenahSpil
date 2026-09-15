import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:021104@localhost:5432/postgres')
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT asset_id, status, ac_type FROM asset_inventory WHERE asset_id LIKE '%GREINV%'"))
        print("Asset Inventory containing GREINV:")
        for r in res.fetchall():
            print(r)

asyncio.run(main())
