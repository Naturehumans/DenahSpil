import asyncio
import sqlite3
import uuid
from datetime import datetime, date
import asyncpg
import traceback

SQLITE_DB_PATH = "spildenah.db"
PG_HOST = "localhost"
PG_PORT = 5432
PG_USER = "postgres"
PG_PASS = "021104"
PG_DB   = "postgres"

log_lines = []

def log(msg):
    log_lines.append(str(msg))

def fmt_uuid(val):
    if not val:
        return None
    s = str(val)
    if len(s) == 32 and '-' not in s:
        s = f"{s[:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:]}"
    try:
        return str(uuid.UUID(s))
    except Exception:
        return None

def as_uuid(uid_str):
    s = fmt_uuid(uid_str)
    return uuid.UUID(s) if s else None

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

def remap(raw, remap_dict):
    uid = fmt_uuid(raw)
    if not uid:
        return None
    if uid in remap_dict:
        return remap_dict[uid]
    return uuid.UUID(uid)

async def migrate():
    log("=" * 60)
    log("SQLite -> PostgreSQL Safe Migration")
    log("=" * 60)

    s_conn = sqlite3.connect(SQLITE_DB_PATH)
    s_conn.row_factory = sqlite3.Row
    cur = s_conn.cursor()
    log(f"Opened SQLite: {SQLITE_DB_PATH}")

    pg = await asyncpg.connect(host=PG_HOST, port=PG_PORT,
                               user=PG_USER, password=PG_PASS, database=PG_DB)
    log("Connected to PostgreSQL")

    # Build remap tables
    user_remap = {}
    cur.execute("SELECT id, email FROM users")
    for r in cur.fetchall():
        sq = fmt_uuid(r["id"])
        row = await pg.fetchrow("SELECT id FROM users WHERE email=$1", r["email"])
        if row:
            user_remap[sq] = row["id"]
            log(f"  user remap: {sq} -> {row['id']}")

    building_remap = {}
    cur.execute("SELECT id, name FROM buildings")
    for r in cur.fetchall():
        sq = fmt_uuid(r["id"])
        row = await pg.fetchrow("SELECT id FROM buildings WHERE name=$1", r["name"])
        if row:
            building_remap[sq] = row["id"]
            log(f"  building remap: {sq} -> {row['id']}")

    cat_remap = {}
    cur.execute("SELECT id, name FROM equipment_categories")
    for r in cur.fetchall():
        sq = fmt_uuid(r["id"])
        row = await pg.fetchrow("SELECT id FROM equipment_categories WHERE name=$1", r["name"])
        if row:
            cat_remap[sq] = row["id"]
            log(f"  cat remap: {sq} -> {row['id']}")

    floor_remap = {}
    cur.execute("SELECT id FROM floors")
    for r in cur.fetchall():
        sq = fmt_uuid(r["id"])
        row = await pg.fetchrow("SELECT id FROM floors WHERE id=$1", uuid.UUID(sq))
        if row:
            floor_remap[sq] = row["id"]

    # Clean duplicate buildings
    dup = await pg.fetchval("SELECT COUNT(*) FROM buildings WHERE name='Gedung Utama'")
    if dup > 1:
        log(f"Found {dup} duplicate buildings, cleaning...")
        ref = await pg.fetch("SELECT DISTINCT building_id FROM floors WHERE building_id IS NOT NULL")
        ref_ids = {r["building_id"] for r in ref}
        all_b = await pg.fetch("SELECT id FROM buildings WHERE name='Gedung Utama'")
        for b in all_b:
            if b["id"] not in ref_ids:
                await pg.execute("DELETE FROM buildings WHERE id=$1", b["id"])
                log(f"  Deleted duplicate building: {b['id']}")

    # 1. Users
    cur.execute("SELECT * FROM users")
    rows = cur.fetchall()
    n = 0
    for r in rows:
        d = dict(r)
        uid = remap(d.get("id"), user_remap)
        if not uid: continue
        res = await pg.execute(
            "INSERT INTO users (id,username,email,hashed_password,is_active,reset_token,reset_token_expires,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
            uid, d.get("username"), d.get("email"), d.get("hashed_password"),
            bool(d.get("is_active",1)), d.get("reset_token"),
            parse_dt(d.get("reset_token_expires")), parse_dt(d.get("created_at")), parse_dt(d.get("updated_at"))
        )
        if res == "INSERT 0 1": n += 1
    log(f"users: {len(rows)} in SQLite, {n} inserted")

    # 2. Buildings
    cur.execute("SELECT * FROM buildings")
    rows = cur.fetchall()
    n = 0
    for r in rows:
        d = dict(r)
        uid = remap(d.get("id"), building_remap)
        if not uid: continue
        res = await pg.execute(
            "INSERT INTO buildings (id,name,description,total_floors,created_at) "
            "VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
            uid, d.get("name"), d.get("description"), int(d.get("total_floors",1)), parse_dt(d.get("created_at"))
        )
        if res == "INSERT 0 1": n += 1
    log(f"buildings: {len(rows)} in SQLite, {n} inserted")

    # 3. Equipment Categories
    cur.execute("SELECT * FROM equipment_categories")
    rows = cur.fetchall()
    n = 0
    for r in rows:
        d = dict(r)
        uid = remap(d.get("id"), cat_remap)
        if not uid: continue
        res = await pg.execute(
            "INSERT INTO equipment_categories (id,name,icon_url,color,initial_stock,has_id,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
            uid, d.get("name"), d.get("icon_url"), d.get("color"),
            int(d.get("initial_stock",0)), bool(d.get("has_id",0)), parse_dt(d.get("created_at"))
        )
        if res == "INSERT 0 1": n += 1
    log(f"equipment_categories: {len(rows)} in SQLite, {n} inserted")

    # 4. Floors
    cur.execute("SELECT * FROM floors")
    rows = cur.fetchall()
    n = 0
    for r in rows:
        d = dict(r)
        sq = fmt_uuid(d.get("id"))
        if not sq: continue
        bid = remap(d.get("building_id"), building_remap)
        res = await pg.execute(
            "INSERT INTO floors (id,building_id,floor_number,name,floor_plan_image_url,canvas_width,canvas_height,sort_order,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
            uuid.UUID(sq), bid, int(d.get("floor_number",1)), d.get("name"), d.get("floor_plan_image_url"),
            int(d.get("canvas_width") or 800), int(d.get("canvas_height") or 600), int(d.get("sort_order",0)),
            parse_dt(d.get("created_at")), parse_dt(d.get("updated_at"))
        )
        if res == "INSERT 0 1": n += 1
    log(f"floors: {len(rows)} in SQLite, {n} inserted")

    # 5. Equipments
    cur.execute("SELECT * FROM equipments")
    rows = cur.fetchall()
    n = 0
    for r in rows:
        d = dict(r)
        sq = fmt_uuid(d.get("id"))
        if not sq: continue
        fid    = remap(d.get("floor_id"), floor_remap)
        cid    = remap(d.get("category_id"), cat_remap)
        placed = remap(d.get("placed_by"), user_remap)
        res = await pg.execute(
            "INSERT INTO equipments (id,floor_id,category_id,placed_by,name,brand,model_number,"
            "installation_date,lifespan_months,expiry_date,position_x,position_y,status,notes,placed_at,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT DO NOTHING",
            uuid.UUID(sq), fid, cid, placed,
            d.get("name"), d.get("brand"), d.get("model_number"),
            parse_date(d.get("installation_date")),
            int(d.get("lifespan_months")) if d.get("lifespan_months") is not None else None,
            parse_date(d.get("expiry_date")),
            float(d.get("position_x",0)), float(d.get("position_y",0)),
            d.get("status","active"), d.get("notes"),
            parse_dt(d.get("placed_at")), parse_dt(d.get("created_at")), parse_dt(d.get("updated_at"))
        )
        if res == "INSERT 0 1": n += 1
    log(f"equipments: {len(rows)} in SQLite, {n} inserted")

    # 6. Slot Templates
    cur.execute("SELECT * FROM slot_templates")
    rows = cur.fetchall()
    n = 0
    for r in rows:
        d = dict(r)
        sq = fmt_uuid(d.get("id"))
        if not sq: continue
        fid = remap(d.get("floor_id"), floor_remap)
        cid = remap(d.get("category_id"), cat_remap)
        eid_s = fmt_uuid(d.get("equipment_id"))
        eid = uuid.UUID(eid_s) if eid_s else None
        res = await pg.execute(
            "INSERT INTO slot_templates (id,floor_id,category_id,equipment_id,position_x,position_y,room_name,slot_code,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
            uuid.UUID(sq), fid, cid, eid,
            float(d.get("position_x",0)), float(d.get("position_y",0)),
            d.get("room_name"), d.get("slot_code"),
            parse_dt(d.get("created_at")), parse_dt(d.get("updated_at"))
        )
        if res == "INSERT 0 1": n += 1
    log(f"slot_templates: {len(rows)} in SQLite, {n} inserted")

    # 7. Asset Inventory
    cur.execute("SELECT * FROM asset_inventory")
    rows = cur.fetchall()
    n = 0
    for r in rows:
        d = dict(r)
        sq = fmt_uuid(d.get("id"))
        if not sq: continue
        cid = remap(d.get("category_id"), cat_remap)
        res = await pg.execute(
            "INSERT INTO asset_inventory (id,category_id,asset_id,status,brand,model_number,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
            uuid.UUID(sq), cid, d.get("asset_id"), d.get("status","available"),
            d.get("brand"), d.get("model_number"),
            parse_dt(d.get("created_at")), parse_dt(d.get("updated_at"))
        )
        if res == "INSERT 0 1": n += 1
    log(f"asset_inventory: {len(rows)} in SQLite, {n} inserted")

    # 8. Inventory History Logs
    cur.execute("SELECT * FROM inventory_history_logs")
    rows = cur.fetchall()
    n = 0
    for r in rows:
        d = dict(r)
        sq = fmt_uuid(d.get("id"))
        if not sq: continue
        cid = remap(d.get("category_id"), cat_remap)
        pb  = remap(d.get("performed_by"), user_remap)
        res = await pg.execute(
            "INSERT INTO inventory_history_logs (id,category_id,asset_id,slot_code,action_type,location_info,"
            "building_name,floor_name,room_name,brand,model_number,status,performed_by,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING",
            uuid.UUID(sq), cid, d.get("asset_id"), d.get("slot_code"),
            d.get("action_type","deploy"), d.get("location_info"),
            d.get("building_name"), d.get("floor_name"), d.get("room_name"),
            d.get("brand"), d.get("model_number"), d.get("status"),
            pb, parse_dt(d.get("created_at"))
        )
        if res == "INSERT 0 1": n += 1
    log(f"inventory_history_logs: {len(rows)} in SQLite, {n} inserted")

    # Verification
    log("")
    log("=" * 60)
    log("FINAL VERIFICATION - PostgreSQL row counts:")
    log("=" * 60)
    for t in ["users","buildings","equipment_categories","floors","equipments","slot_templates","asset_inventory","inventory_history_logs"]:
        c = await pg.fetchval(f"SELECT COUNT(*) FROM {t}")
        log(f"  {t:<35} {c} rows")

    await pg.close()
    s_conn.close()
    log("")
    log("SUCCESS! Migration complete. PostgreSQL is now the sole database.")

try:
    asyncio.run(migrate())
except Exception as e:
    log(f"FATAL ERROR: {e}")
    log(traceback.format_exc())

# Write log to file
with open("migration_log.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(log_lines))

# Print summary
for line in log_lines:
    print(line)
