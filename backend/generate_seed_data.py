import json
import datetime
import sys
import os
import asyncio
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.building import Building
from app.models.floor import Floor
from app.models.equipment_category import EquipmentCategory
from app.models.equipment import Equipment
from app.models.slot_template import SlotTemplate
from app.models.asset_inventory import AssetInventory
from app.models.inventory_history_log import InventoryHistoryLog
from app.models.room_polygon import RoomPolygon

models = [
    User,
    Building,
    Floor,
    EquipmentCategory,
    Equipment,
    SlotTemplate,
    AssetInventory,
    InventoryHistoryLog,
    RoomPolygon
]

async def main():
    data = {}
    async with AsyncSessionLocal() as db:
        for model in models:
            stmt = select(model)
            result = await db.execute(stmt)
            records = result.scalars().all()
            table_name = model.__name__
            data[table_name] = []
            
            for record in records:
                record_dict = {}
                for column in model.__table__.columns:
                    val = getattr(record, column.name)
                    if val is not None:
                        if hasattr(val, "isoformat"):
                            val = val.isoformat()
                        elif hasattr(val, "hex"):
                            val = str(val)
                    record_dict[column.name] = val
                data[table_name].append(record_dict)

    with open("seed_data.json", "w") as f:
        json.dump(data, f, indent=4)

    print("Data exported to seed_data.json")

if __name__ == "__main__":
    asyncio.run(main())
