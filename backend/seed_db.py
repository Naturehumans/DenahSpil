import json
import asyncio
import sys
import os
import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection
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

# Map nama key di seed_data.json ke nama tabel di database
TABLE_MAP = {
    "User": User.__tablename__,
    "Building": Building.__tablename__,
    "Floor": Floor.__tablename__,
    "EquipmentCategory": EquipmentCategory.__tablename__,
    "Equipment": Equipment.__tablename__,
    "SlotTemplate": SlotTemplate.__tablename__,
    "AssetInventory": AssetInventory.__tablename__,
    "InventoryHistoryLog": InventoryHistoryLog.__tablename__,
    "RoomPolygon": RoomPolygon.__tablename__,
}

# Urutan hapus: child dulu, baru parent (reverse dependency)
DELETE_ORDER_TABLES = [
    InventoryHistoryLog.__tablename__,
    AssetInventory.__tablename__,
    SlotTemplate.__tablename__,
    Equipment.__tablename__,
    EquipmentCategory.__tablename__,
    RoomPolygon.__tablename__,
    Floor.__tablename__,
    Building.__tablename__,
    User.__tablename__,
]

# Kelompok tipe PostgreSQL yang perlu konversi khusus
NUMERIC_TYPES = {"integer", "bigint", "smallint", "int4", "int8", "int2"}
FLOAT_TYPES = {"real", "double precision", "numeric", "decimal", "float4", "float8"}
BOOL_TYPES = {"boolean", "bool"}
DATE_TYPES = {"date"}
DATETIME_TYPES = {"timestamp", "timestamptz", "timestamp without time zone",
                  "timestamp with time zone"}
JSON_TYPES = {"json", "jsonb"}


async def get_column_types(conn: AsyncConnection, table_name: str) -> dict:
    """
    Ambil nama + tipe kolom yang benar-benar ada di database.
    Return: {column_name: data_type_string}
    """
    result = await conn.execute(
        text("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = :table_name
        """),
        {"table_name": table_name}
    )
    return {row[0]: row[1].lower() for row in result.fetchall()}


def coerce_value(value, pg_type: str):
    """Konversi nilai dari JSON (biasanya string/list/dict) ke tipe Python yang sesuai dengan PostgreSQL."""
    if pg_type in JSON_TYPES:
        # asyncpg butuh string JSON, bukan list/dict Python
        if isinstance(value, (list, dict)):
            return json.dumps(value)
        return value  # sudah string JSON
    if value is None:
        return None

    if pg_type in BOOL_TYPES:
        if isinstance(value, bool):
            return value
        return str(value).lower() in ("true", "1", "yes")

    if pg_type in NUMERIC_TYPES:
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return value

    if pg_type in FLOAT_TYPES:
        try:
            return float(value)
        except (ValueError, TypeError):
            return value

    if pg_type in DATE_TYPES:
        if isinstance(value, (datetime.date, datetime.datetime)):
            return value
        try:
            return datetime.date.fromisoformat(str(value)[:10])
        except (ValueError, TypeError):
            return value

    if pg_type in DATETIME_TYPES or "timestamp" in pg_type:
        if isinstance(value, datetime.datetime):
            return value
        try:
            return datetime.datetime.fromisoformat(str(value))
        except (ValueError, TypeError):
            return value

    # Tipe lain (varchar, uuid, text, json, dll.) — kembalikan apa adanya
    return value


async def clear_all_tables(conn: AsyncConnection):
    """Hapus semua data dari semua tabel tanpa drop tabel."""
    print("Menghapus data lama...")
    for table_name in DELETE_ORDER_TABLES:
        await conn.execute(text(f'DELETE FROM "{table_name}"'))
        print(f"  ✓ Tabel '{table_name}' dibersihkan.")
    print("Semua data lama berhasil dihapus.\n")


async def seed():
    print("Loading seed_data.json...")
    seed_file = os.path.join(os.path.dirname(__file__), "seed_data.json")
    if not os.path.exists(seed_file):
        print(f"ERROR: File seed_data.json tidak ditemukan di {seed_file}")
        return

    with open(seed_file, "r") as f:
        data = json.load(f)

    async with engine.begin() as conn:
        # Pastikan semua tabel sudah ada (create_all idempotent)
        await conn.run_sync(Base.metadata.create_all)

        # Hapus semua data lama
        await clear_all_tables(conn)

        print("Seeding data...")
        for key, records in data.items():
            if key not in TABLE_MAP:
                print(f"  ⚠ Key tidak dikenal, dilewati: {key}")
                continue

            table_name = TABLE_MAP[key]
            print(f"  → Menyimpan {len(records)} record ke '{table_name}'...")

            # Ambil kolom & tipe aktual dari DB
            col_types = await get_column_types(conn, table_name)
            if not col_types:
                print(f"  ⚠ Tabel '{table_name}' tidak ditemukan di DB, dilewati.")
                continue

            for record_dict in records:
                # Filter hanya kolom yang ada di DB + konversi tipe sesuai skema DB
                filtered = {}
                for k, v in record_dict.items():
                    if k in col_types:
                        filtered[k] = coerce_value(v, col_types[k])

                if not filtered:
                    continue

                # Buat INSERT statement
                cols = list(filtered.keys())
                col_str = ", ".join(f'"{c}"' for c in cols)
                param_str = ", ".join(f":{c}" for c in cols)
                stmt = text(f'INSERT INTO "{table_name}" ({col_str}) VALUES ({param_str})')
                await conn.execute(stmt, filtered)

        print("\n✅ Seeding selesai! Database berhasil diperbarui.")


if __name__ == "__main__":
    asyncio.run(seed())
