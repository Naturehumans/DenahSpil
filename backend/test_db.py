import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres.vqgiufadlfcoxbrofofx:SpilWeCare.@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
engine = create_async_engine(DATABASE_URL)

async def main():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, username, email, role FROM users"))
        for row in result:
            print(row)

asyncio.run(main())
