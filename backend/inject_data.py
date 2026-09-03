import asyncio
import datetime
import uuid
import os
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.models.user import User
from app.models.floor import Floor
from app.models.equipment_category import EquipmentCategory
from app.models.equipment import Equipment
from app.models.inventory import InventoryHistoryLog

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def inject_data():
    async with AsyncSessionLocal() as db:
        # Cek apakah sudah ada equipment, jika ya, jangan duplikasi
        result = await db.execute(select(Equipment).limit(1))
        existing = result.scalars().first()
        if existing:
            print("Mock data already injected. Skipping.")
            return

        # Get a user
        result = await db.execute(select(User).limit(1))
        user = result.scalars().first()
        if not user:
            print("No user found. Please create one via registration first.")
            return

        # Get or create a floor
        result = await db.execute(select(Floor).limit(1))
        floor = result.scalars().first()
        if not floor:
            floor = Floor(name="Lantai 1 Demo", floor_number=1)
            db.add(floor)
            await db.commit()
            await db.refresh(floor)

        # Get or create a category
        result = await db.execute(select(EquipmentCategory).limit(1))
        category = result.scalars().first()
        if not category:
            category = EquipmentCategory(name="APAR", color="#cf2821", icon_url="fire-extinguisher")
            db.add(category)
            await db.commit()
            await db.refresh(category)

        today = datetime.date.today()

        # 1. Expiring in 25 days (Warning - Yellow)
        eq1 = Equipment(
            id=uuid.uuid4(),
            floor_id=floor.id,
            category_id=category.id,
            placed_by=user.id,
            name="APAR Utara 1 (Kuning)",
            brand="Yamato",
            installation_date=today - relativedelta(months=11, days=5),
            lifespan_months=12,
            expiry_date=today + relativedelta(days=25),
            position_x=10.0,
            position_y=20.0,
            status="warning"
        )

        # 2. Expiring in 4 days (Critical - Red)
        eq2 = Equipment(
            id=uuid.uuid4(),
            floor_id=floor.id,
            category_id=category.id,
            placed_by=user.id,
            name="APAR Selatan 2 (Kritis)",
            brand="Servvo",
            installation_date=today - relativedelta(months=11, days=26),
            lifespan_months=12,
            expiry_date=today + relativedelta(days=4),
            position_x=40.0,
            position_y=30.0,
            status="warning"
        )

        # 3. Expired 3 days ago (Expired - Red)
        eq3 = Equipment(
            id=uuid.uuid4(),
            floor_id=floor.id,
            category_id=category.id,
            placed_by=user.id,
            name="APAR Timur 3 (Expired)",
            brand="Gunnebo",
            installation_date=today - relativedelta(months=12, days=3),
            lifespan_months=12,
            expiry_date=today - relativedelta(days=3),
            position_x=60.0,
            position_y=50.0,
            status="expired"
        )

        db.add_all([eq1, eq2, eq3])
        await db.commit()
        
        # Insert History Logs for them
        history_logs = [
            InventoryHistoryLog(
                category_id=category.id,
                action_type="deploy",
                location_info="Posisi Baru",
                building_name="Gedung Utama",
                floor_name=floor.name,
                room_name="Ruang Utara",
                brand="Yamato",
                model_number="YMT-001",
                status="active",
                performed_by=user.id
            ),
            InventoryHistoryLog(
                category_id=category.id,
                action_type="deploy",
                location_info="Posisi Baru",
                building_name="Gedung Utama",
                floor_name=floor.name,
                room_name="Ruang Selatan",
                brand="Servvo",
                model_number="SRV-002",
                status="active",
                performed_by=user.id
            ),
            InventoryHistoryLog(
                category_id=category.id,
                action_type="deploy",
                location_info="Posisi Baru",
                building_name="Gedung Utama",
                floor_name=floor.name,
                room_name="Ruang Timur",
                brand="Gunnebo",
                model_number="GNB-003",
                status="expired",
                performed_by=user.id
            )
        ]
        
        db.add_all(history_logs)
        await db.commit()

        print("Successfully injected 3 mock equipments and history logs for testing!")

if __name__ == "__main__":
    asyncio.run(inject_data())
