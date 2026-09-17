import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text
import uuid

async def test():
    engine = create_async_engine('postgresql+asyncpg://postgres:021104@localhost:5432/postgres')
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession)
    
    async with AsyncSessionLocal() as db:
        # Find floor and category
        res_f = await db.execute(text("SELECT id FROM floors LIMIT 1;"))
        floor_id = res_f.scalar()
        
        res_c = await db.execute(text("SELECT id FROM equipment_categories WHERE name='Lampu' LIMIT 1;"))
        cat_id = res_c.scalar()
        
        print('Floor:', floor_id, 'Cat:', cat_id)
        
        # Call the logic directly to see what fails
        try:
            # Generate slot_code
            count_res = await db.execute(text("SELECT count(id) FROM slot_templates WHERE floor_id = :fid AND room_name = :rm"), {'fid': floor_id, 'rm': 'Niken'})
            s_count = (count_res.scalar() or 0) + 1
            slot_code = f"GUL4N{s_count:03d}"
            print('Generated slot_code:', slot_code)
            
            await db.execute(text("INSERT INTO slot_templates (id, floor_id, category_id, position_x, position_y, room_name, slot_code) VALUES (:id, :fid, :cid, :px, :py, :rn, :sc)"), {
                'id': uuid.uuid4(),
                'fid': floor_id,
                'cid': cat_id,
                'px': 100.0,
                'py': 100.0,
                'rn': 'Niken',
                'sc': slot_code
            })
            await db.commit()
            print('Success!')
        except Exception as e:
            print('Error:', e)
            
asyncio.run(test())
