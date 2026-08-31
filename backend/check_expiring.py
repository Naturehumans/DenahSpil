import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.services.equipment_service import get_expiring_equipments

DATABASE_URL = "postgresql+asyncpg://spildenah:spildenah_secret_2024@db:5432/spildenah_db"

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def check():
    async with AsyncSessionLocal() as db:
        eqs = await get_expiring_equipments(db, 30)
        print(f"Found {len(eqs)} expiring equipments:")
        for eq in eqs:
            print(f"- {eq.name} | expiry: {eq.expiry_date} | status: {eq.status}")

if __name__ == "__main__":
    asyncio.run(check())
