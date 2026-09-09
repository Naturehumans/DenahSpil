import asyncio
import uuid
from sqlalchemy import text
from app.database import engine, AsyncSessionLocal
from app.models.asset_inventory import AssetInventory
from app.models.equipment_category import EquipmentCategory

async def fix_sync():
    async with AsyncSessionLocal() as db:
        # 1. Set initial_stock to 0 for all categories
        await db.execute(text("UPDATE equipment_categories SET initial_stock = 0"))
        
        # 2. Get APAR category
        res = await db.execute(text("SELECT id FROM equipment_categories WHERE name = 'APAR'"))
        apar_id = res.scalar()
        
        if apar_id:
            # Get existing APAR count in inventory
            res2 = await db.execute(text(f"SELECT COUNT(*) FROM asset_inventory WHERE category_id = '{apar_id}' AND status = 'available'"))
            current_apar_count = res2.scalar()
            
            apars_to_add = 13 - current_apar_count
            
            if apars_to_add > 0:
                new_assets = []
                for i in range(apars_to_add):
                    idx = i + 5 # AST-APR-005, etc
                    new_assets.append(AssetInventory(
                        category_id=apar_id,
                        asset_id=f'AST-APR-{idx:03d}',
                        brand='Servvo',
                        model_number='P 300 (3 kg ABC Powder)',
                        status='available'
                    ))
                    
                db.add_all(new_assets)
                
            print(f"Set initial_stock to 0 and added {apars_to_add} APARs to inventory.")
        
        await db.commit()

asyncio.run(fix_sync())
