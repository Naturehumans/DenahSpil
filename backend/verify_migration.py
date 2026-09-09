import asyncio
import asyncpg

async def check():
    pg = await asyncpg.connect(host='localhost',port=5432,user='postgres',password='021104',database='postgres')
    
    print("=== Buildings ===")
    rows = await pg.fetch("SELECT id, name, description, total_floors, created_at FROM buildings")
    for r in rows:
        print(f"  id={r['id']} name={r['name']} floors={r['total_floors']}")
    
    print("\n=== Floors (with building linkage) ===")
    rows = await pg.fetch("SELECT id, name, building_id FROM floors")
    for r in rows:
        print(f"  id={r['id']} name={r['name']} building_id={r['building_id']}")
    
    print("\n=== Equipments ===")
    rows = await pg.fetch("SELECT id, name, category_id, floor_id, status FROM equipments")
    for r in rows:
        print(f"  id={r['id']} name={r['name']} cat={r['category_id']} floor={r['floor_id']} status={r['status']}")
    
    print("\n=== Slot Templates (first 5) ===")
    rows = await pg.fetch("SELECT id, floor_id, category_id, slot_code, room_name FROM slot_templates LIMIT 5")
    for r in rows:
        print(f"  id={r['id']} floor={r['floor_id']} cat={r['category_id']} slot={r['slot_code']} room={r['room_name']}")
    
    print("\n=== Inventory History Logs (first 3) ===")
    rows = await pg.fetch("SELECT id, category_id, action_type, building_name, floor_name, performed_by FROM inventory_history_logs LIMIT 3")
    for r in rows:
        print(f"  id={r['id']} cat={r['category_id']} action={r['action_type']} building={r['building_name']} by={r['performed_by']}")
    
    await pg.close()

asyncio.run(check())
