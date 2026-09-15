import json
import asyncio
import sys
import os
import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.future import select
from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User
from app.models.building import Building
from app.models.floor import Floor
from app.models.equipment_category import EquipmentCategory
from app.models.equipment import Equipment
from app.models.slot_template import SlotTemplate
from app.models.asset_inventory import AssetInventory
from app.models.inventory_history_log import InventoryHistoryLog
from app.models.room_polygon import RoomPolygon

# Map string table names to SQLAlchemy model classes
MODEL_MAP = {
    "User": User,
    "Building": Building,
    "Floor": Floor,
    "EquipmentCategory": EquipmentCategory,
    "Equipment": Equipment,
    "SlotTemplate": SlotTemplate,
    "AssetInventory": AssetInventory,
    "InventoryHistoryLog": InventoryHistoryLog,
    "RoomPolygon": RoomPolygon
}

async def seed():
    print("Loading seed_data.json...")
    with open(os.path.join(os.path.dirname(__file__), "seed_data.json"), "r") as f:
        data = json.load(f)

    async with AsyncSessionLocal() as db:
        # Check if database is already seeded (e.g. check if Users exist)
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            print("Database already contains data. The seeding process expects an empty database.")
            print("If you want to re-seed, please delete your database file (e.g., denah_app.db) and restart the backend to recreate the tables.")
            return
            
        print("Seeding data...")
        for table_name, records in data.items():
            if table_name not in MODEL_MAP:
                print(f"Skipping unknown table: {table_name}")
                continue
                
            model = MODEL_MAP[table_name]
            print(f"Seeding {len(records)} records into {table_name}...")
            
            for record_dict in records:
                # Convert strings back to datetime where necessary
                for col in model.__table__.columns:
                    val = record_dict.get(col.name)
                    if val is not None:
                        type_str = str(col.type).lower()
                        if "datetime" in type_str or "timestamp" in type_str:
                            try:
                                record_dict[col.name] = datetime.datetime.fromisoformat(val)
                            except (ValueError, TypeError):
                                pass
                        elif "date" in type_str:
                            try:
                                record_dict[col.name] = datetime.date.fromisoformat(val[:10])
                            except (ValueError, TypeError):
                                pass
                        
                instance = model(**record_dict)
                db.add(instance)
                
        await db.commit()
        print("Seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
