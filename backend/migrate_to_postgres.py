import asyncio
import sqlite3
import uuid
from datetime import datetime, date
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.database import Base
from app.models import (
    User,
    Building,
    EquipmentCategory,
    Floor,
    Equipment,
    SlotTemplate,
    AssetInventory,
    InventoryHistoryLog,
)

import os
from dotenv import load_dotenv

load_dotenv()
SQLITE_DB_PATH = "spildenah.db"
PG_URL = os.getenv("DATABASE_URL")

if not PG_URL:
    raise ValueError("DATABASE_URL is not set in .env")

# Ensure it uses asyncpg driver
if PG_URL.startswith("postgresql://"):
    PG_URL = PG_URL.replace("postgresql://", "postgresql+asyncpg://")

def parse_uuid(val):
    if not val:
        return None
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except Exception:
        return None

def parse_dt(val):
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        return val
    try:
        return datetime.fromisoformat(str(val))
    except Exception:
        return None

def parse_date(val):
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        return date.fromisoformat(str(val).split("T")[0])
    except Exception:
        return None

async def migrate_data():
    engine = create_async_engine(
        PG_URL, 
        echo=False
    )
    
    print("[*] Creating all tables in PostgreSQL using SQLAlchemy Base.metadata.create_all...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("[+] All tables created successfully in PostgreSQL.")
    
    # Open SQLite
    print(f"[*] Reading data from SQLite: {SQLITE_DB_PATH}...")
    s_conn = sqlite3.connect(SQLITE_DB_PATH)
    s_conn.row_factory = sqlite3.Row
    s_cur = s_conn.cursor()
    
    AsyncSessionMaker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionMaker() as db:
        # 1. Users
        s_cur.execute("SELECT * FROM users")
        u_rows = s_cur.fetchall()
        for r in u_rows:
            d = dict(r)
            user_obj = User(
                id=parse_uuid(d.get("id")),
                username=d.get("username"),
                email=d.get("email"),
                hashed_password=d.get("hashed_password"),
                is_active=bool(d.get("is_active", 1)),
                reset_token=d.get("reset_token"),
                reset_token_expires=parse_dt(d.get("reset_token_expires")),
                created_at=parse_dt(d.get("created_at")),
                updated_at=parse_dt(d.get("updated_at")),
            )
            await db.merge(user_obj)
        print(f"[+] Migrated {len(u_rows)} users.")
        
        # 2. Buildings
        s_cur.execute("SELECT * FROM buildings")
        b_rows = s_cur.fetchall()
        for r in b_rows:
            d = dict(r)
            b_obj = Building(
                id=parse_uuid(d.get("id")),
                name=d.get("name"),
                description=d.get("description"),
                total_floors=int(d.get("total_floors", 1)),
                created_at=parse_dt(d.get("created_at")),
            )
            await db.merge(b_obj)
        print(f"[+] Migrated {len(b_rows)} buildings.")
        
        # 3. Equipment Categories
        s_cur.execute("SELECT * FROM equipment_categories")
        c_rows = s_cur.fetchall()
        for r in c_rows:
            d = dict(r)
            c_obj = EquipmentCategory(
                id=parse_uuid(d.get("id")),
                name=d.get("name"),
                icon_url=d.get("icon_url"),
                color=d.get("color"),
                initial_stock=int(d.get("initial_stock", 0)),
                has_id=bool(d.get("has_id", 0)),
                created_at=parse_dt(d.get("created_at")),
            )
            await db.merge(c_obj)
        print(f"[+] Migrated {len(c_rows)} equipment categories.")
        
        # 4. Floors
        s_cur.execute("SELECT * FROM floors")
        f_rows = s_cur.fetchall()
        for r in f_rows:
            d = dict(r)
            f_obj = Floor(
                id=parse_uuid(d.get("id")),
                building_id=parse_uuid(d.get("building_id")),
                floor_number=int(d.get("floor_number", 1)),
                name=d.get("name"),
                floor_plan_image_url=d.get("floor_plan_image_url"),
                canvas_width=int(d.get("canvas_width") or 800),
                canvas_height=int(d.get("canvas_height") or 600),
                sort_order=int(d.get("sort_order", 0)),
                created_at=parse_dt(d.get("created_at")),
            )
            await db.merge(f_obj)
        print(f"[+] Migrated {len(f_rows)} floors.")
        
        # 5. Equipments
        s_cur.execute("SELECT * FROM equipments")
        eq_rows = s_cur.fetchall()
        for r in eq_rows:
            d = dict(r)
            eq_obj = Equipment(
                id=parse_uuid(d.get("id")),
                floor_id=parse_uuid(d.get("floor_id")),
                category_id=parse_uuid(d.get("category_id")),
                placed_by=parse_uuid(d.get("placed_by")),
                name=d.get("name"),
                brand=d.get("brand"),
                model_number=d.get("model_number"),
                installation_date=parse_date(d.get("installation_date")),
                lifespan_months=int(d.get("lifespan_months", 0)) if d.get("lifespan_months") is not None else None,
                expiry_date=parse_date(d.get("expiry_date")),
                position_x=float(d.get("position_x", 0)),
                position_y=float(d.get("position_y", 0)),
                status=d.get("status", "active"),
                notes=d.get("notes"),
                placed_at=parse_dt(d.get("placed_at")),
                created_at=parse_dt(d.get("created_at")),
                updated_at=parse_dt(d.get("updated_at")),
            )
            await db.merge(eq_obj)
        print(f"[+] Migrated {len(eq_rows)} equipments.")
        
        # 6. Slot Templates
        s_cur.execute("SELECT * FROM slot_templates")
        slot_rows = s_cur.fetchall()
        for r in slot_rows:
            d = dict(r)
            st_obj = SlotTemplate(
                id=parse_uuid(d.get("id")),
                floor_id=parse_uuid(d.get("floor_id")),
                category_id=parse_uuid(d.get("category_id")),
                equipment_id=parse_uuid(d.get("equipment_id")),
                position_x=float(d.get("position_x", 0)),
                position_y=float(d.get("position_y", 0)),
                room_name=d.get("room_name"),
                slot_code=d.get("slot_code"),
                created_at=parse_dt(d.get("created_at")),
                updated_at=parse_dt(d.get("updated_at")),
            )
            await db.merge(st_obj)
        print(f"[+] Migrated {len(slot_rows)} slot templates.")
        
        # 7. Asset Inventory
        s_cur.execute("SELECT * FROM asset_inventory")
        ai_rows = s_cur.fetchall()
        for r in ai_rows:
            d = dict(r)
            ai_obj = AssetInventory(
                id=parse_uuid(d.get("id")),
                category_id=parse_uuid(d.get("category_id")),
                asset_id=d.get("asset_id"),
                status=d.get("status", "available"),
                brand=d.get("brand"),
                model_number=d.get("model_number"),
                created_at=parse_dt(d.get("created_at")),
                updated_at=parse_dt(d.get("updated_at")),
            )
            await db.merge(ai_obj)
        print(f"[+] Migrated {len(ai_rows)} asset inventory records.")
        
        # 8. Inventory History Logs
        s_cur.execute("SELECT * FROM inventory_history_logs")
        ihl_rows = s_cur.fetchall()
        for r in ihl_rows:
            d = dict(r)
            ihl_obj = InventoryHistoryLog(
                id=parse_uuid(d.get("id")),
                category_id=parse_uuid(d.get("category_id")),
                asset_id=d.get("asset_id"),
                slot_code=d.get("slot_code"),
                action_type=d.get("action_type", "deploy"),
                location_info=d.get("location_info"),
                building_name=d.get("building_name"),
                floor_name=d.get("floor_name"),
                room_name=d.get("room_name"),
                brand=d.get("brand"),
                model_number=d.get("model_number"),
                status=d.get("status"),
                performed_by=parse_uuid(d.get("performed_by")),
                created_at=parse_dt(d.get("created_at")),
            )
            await db.merge(ihl_obj)
        print(f"[+] Migrated {len(ihl_rows)} inventory history logs.")
        
        await db.commit()
    
    s_conn.close()
    await engine.dispose()
    print("[SUCCESS] All data successfully transferred from SQLite to PostgreSQL!")

if __name__ == "__main__":
    asyncio.run(migrate_data())
