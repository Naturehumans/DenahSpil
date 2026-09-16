import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres.vqgiufadlfcoxbrofofx:SpilWeCare.@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
engine = create_async_engine(DATABASE_URL)

async def main():
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE users SET role = 'user' WHERE username = 'user'"))
        print("Updated role for user 'user' to 'user'.")

asyncio.run(main())
