import re
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.equipment import Equipment
from app.models.asset_inventory import AssetInventory
from app.models.inventory_history_log import InventoryHistoryLog

def generate_asset_id_prefix(category_name: str, brand: str, model_number: str) -> str:
    # KODE_KATEGORI
    cat_upper = (category_name or '').upper()
    if 'AC' in cat_upper:
        cat_code = 'AC'
    elif 'LAMPU' in cat_upper:
        cat_code = 'LMP'
    elif 'KIPAS' in cat_upper:
        cat_code = 'KPS'
    elif 'APAR' in cat_upper or 'FIRE' in cat_upper:
        cat_code = 'APAR'
    elif 'PROYEKTOR' in cat_upper:
        cat_code = 'PRJ'
    elif 'MEJA' in cat_upper:
        cat_code = 'MJA'
    elif 'KURSI' in cat_upper:
        cat_code = 'KRS'
    else:
        clean = re.sub(r'[^A-Z]', '', cat_upper)
        cat_code = clean[:3] if clean else 'AST'

    # KODE_MERK_TIPE
    brand_upper = (brand or '').upper()
    model_upper = (model_number or '').upper()

    if 'INVERTER' in model_upper:
        model_part = 'INV'
    elif 'STANDARD' in model_upper:
        model_part = 'STD'
    elif 'LED' in model_upper:
        model_part = 'LED'
    else:
        model_words = re.findall(r'[A-Z0-9]+', model_upper)
        model_part = "".join([w[0] for w in model_words])[:3]

    if 'LG' in brand_upper:
        brand_code = 'LG'
    elif 'DAIKIN' in brand_upper:
        brand_code = 'DK'
    elif 'PANASONIC' in brand_upper:
        brand_code = 'PNS'
    elif 'PHILIPS' in brand_upper:
        brand_code = 'PHI'
    else:
        clean_b = re.sub(r'[^A-Z]', '', brand_upper)
        brand_code = clean_b[:3] if clean_b else 'UNK'

    if model_part:
        type_code = f"{brand_code}{model_part}"
    else:
        type_code = brand_code

    return f"{cat_code}-{type_code}"

async def get_next_asset_ids(
    category_name: str,
    brand: str, 
    model_number: str, 
    db: AsyncSession, 
    category_id: uuid.UUID, 
    count: int = 1
) -> list[str]:
    prefix = generate_asset_id_prefix(category_name, brand, model_number)
    all_names = []
    
    # Check Equipment table
    eqs_res = await db.execute(select(Equipment.name).where(Equipment.category_id == category_id))
    all_names.extend([n for n in eqs_res.scalars().all() if n and n.startswith(prefix)])

    # Check AssetInventory table
    assets_res = await db.execute(select(AssetInventory.asset_id).where(AssetInventory.category_id == category_id))
    all_names.extend([n for n in assets_res.scalars().all() if n and n.startswith(prefix)])

    # Check InventoryHistoryLog table
    hist_res = await db.execute(
        select(InventoryHistoryLog.asset_id)
        .where(InventoryHistoryLog.category_id == category_id)
        .where(InventoryHistoryLog.asset_id.isnot(None))
    )
    all_names.extend([n for n in hist_res.scalars().all() if n and n.startswith(prefix)])

    max_num = 0
    for n in all_names:
        match = re.search(rf'{prefix}-(\d+)', n.strip())
        if match:
            num = int(match.group(1))
            if num > max_num:
                max_num = num

    return [f"{prefix}-{(max_num + i + 1):03d}" for i in range(count)]
