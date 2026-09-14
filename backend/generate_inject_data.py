import asyncio
import os
import json
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.models.user import User
from app.models.building import Building
from app.models.floor import Floor
from app.models.equipment_category import EquipmentCategory
from app.models.equipment import Equipment
from app.models.slot_template import SlotTemplate
from app.models.asset_inventory import AssetInventory
from app.models.inventory_history_log import InventoryHistoryLog
from app.models.room_polygon import RoomPolygon

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

def format_val(val):
    if val is None:
        return "None"
    if isinstance(val, str):
        # Escape quotes
        val = val.replace("'", "\\'")
        return f"'{val}'"
    if isinstance(val, bool):
        return "True" if val else "False"
    if isinstance(val, (int, float)):
        return str(val)
    if hasattr(val, "isoformat"):  # datetime or date
        return f"datetime.datetime.fromisoformat('{val.isoformat()}')"
    import uuid
    if isinstance(val, uuid.UUID):
        return f"uuid.UUID('{str(val)}')"
    if isinstance(val, (list, dict)):
        return json.dumps(val)
    return f"'{str(val)}'"

async def generate():
    async with AsyncSessionLocal() as db:
        out = []
        out.append("import asyncio")
        out.append("import datetime")
        out.append("import uuid")
        out.append("import os")
        out.append("import json")
        out.append("from dotenv import load_dotenv")
        out.append("from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker")
        out.append("from sqlalchemy import select, text")
        out.append("")
        out.append("from app.models.user import User")
        out.append("from app.models.building import Building")
        out.append("from app.models.floor import Floor")
        out.append("from app.models.equipment_category import EquipmentCategory")
        out.append("from app.models.equipment import Equipment")
        out.append("from app.models.slot_template import SlotTemplate")
        out.append("from app.models.asset_inventory import AssetInventory")
        out.append("from app.models.inventory_history_log import InventoryHistoryLog")
        out.append("from app.models.room_polygon import RoomPolygon")
        out.append("from app.utils.security import hash_password")
        out.append("")
        out.append("load_dotenv()")
        out.append("DATABASE_URL = os.getenv('DATABASE_URL')")
        out.append("if DATABASE_URL and DATABASE_URL.startswith('postgresql://'):")
        out.append("    DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')")
        out.append("")
        out.append("engine = create_async_engine(DATABASE_URL)")
        out.append("AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)")
        out.append("")
        out.append("async def inject_data():")
        out.append("    print('Starting Data Injection...')")
        out.append("    async with AsyncSessionLocal() as db:")
        out.append("        # --- CLEAR EXISTING DATA ---")
        out.append("        await db.execute(text('TRUNCATE TABLE users, buildings, floors, equipment_categories, equipments, slot_templates, asset_inventory, inventory_history_logs, room_polygons RESTART IDENTITY CASCADE;'))")
        out.append("        await db.commit()")
        
        models = [
            (User, "User", ["id", "username", "email", "hashed_password", "is_active", "created_at"]),
            (Building, "Building", ["id", "name", "description", "total_floors", "created_at"]),
            (EquipmentCategory, "EquipmentCategory", ["id", "name", "icon_url", "color", "initial_stock", "has_id", "created_at"]),
            (Floor, "Floor", ["id", "building_id", "name", "floor_number", "floor_plan_image_url", "canvas_width", "canvas_height", "sort_order", "created_at"]),
            (RoomPolygon, "RoomPolygon", ["id", "floor_id", "name", "coordinates"]),
            (Equipment, "Equipment", ["id", "floor_id", "category_id", "placed_by", "name", "brand", "model_number", "installation_date", "lifespan_months", "expiry_date", "position_x", "position_y", "status", "notes", "placed_at", "created_at", "updated_at"]),
            (SlotTemplate, "SlotTemplate", ["id", "floor_id", "category_id", "equipment_id", "position_x", "position_y", "is_active", "building_name", "floor_name", "slot_code", "room_name"]),
            (AssetInventory, "AssetInventory", ["id", "asset_id", "category_id", "brand", "model_number", "purchase_date", "warranty_months", "expired_date", "status", "is_active"]),
            (InventoryHistoryLog, "InventoryHistoryLog", ["id", "category_id", "asset_id", "slot_code", "action_type", "building_name", "floor_name", "room_name", "brand", "model_number", "condition", "location_info", "notes"])
        ]

        for model_cls, model_name, columns in models:
            res = await db.execute(select(model_cls))
            records = res.scalars().all()
            for r in records:
                kwargs = []
                for col in columns:
                    val = getattr(r, col, None)
                    kwargs.append(f"{col}={format_val(val)}")
                out.append(f"        db.add({model_name}({', '.join(kwargs)}))")
            out.append("        await db.commit()")

        out.append("    print('Data Injection Complete!')")
        out.append("")
        out.append("if __name__ == '__main__':")
        out.append("    asyncio.run(inject_data())")

        with open("inject_data.py", "w") as f:
            f.write("\n".join(out))

asyncio.run(generate())
