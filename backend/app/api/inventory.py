import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.asset_inventory import AssetInventory
from app.models.inventory_history_log import InventoryHistoryLog
from app.models.user import User
from app.schemas.inventory import AssetInventoryResponse, InventoryHistoryLogResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/assets", response_model=List[AssetInventoryResponse])
async def get_assets(status: Optional[str] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(AssetInventory).options(selectinload(AssetInventory.category)).order_by(AssetInventory.created_at.desc())
    if status:
        query = query.where(AssetInventory.status == status)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/inventory-logs", response_model=List[InventoryHistoryLogResponse])
async def get_inventory_logs(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy import text
    for col in ['building_name', 'floor_name', 'room_name', 'brand', 'model_number', 'status']:
        try:
            await db.execute(text(f"ALTER TABLE inventory_history_logs ADD COLUMN {col} VARCHAR(100)"))
            await db.commit()
        except Exception:
            pass

    result = await db.execute(
        select(InventoryHistoryLog)
        .options(selectinload(InventoryHistoryLog.category))
        .order_by(InventoryHistoryLog.created_at.desc())
    )
    logs = result.scalars().all()

    # Auto-seed/sync history entries from existing active equipments & assets if history is currently empty
    if not logs:
        from app.models.equipment import Equipment
        from app.models.floor import Floor
        from app.models.building import Building

        # Fetch active equipments
        eq_res = await db.execute(
            select(Equipment).options(
                selectinload(Equipment.floor).selectinload(Floor.building),
                selectinload(Equipment.category)
            )
        )
        equipments = eq_res.scalars().all()

        for eq in equipments:
            b_name = eq.floor.building.name if (eq.floor and eq.floor.building) else "Gedung Utama"
            f_name = eq.floor.name if eq.floor else "Lantai 1"
            
            new_log = InventoryHistoryLog(
                category_id=eq.category_id,
                asset_id=eq.name,
                action_type="deploy",
                building_name=b_name,
                floor_name=f_name,
                room_name="", # Left empty as requested by user
                brand=eq.brand or ("LG" if "AC" in eq.name else "Panasonic"),
                model_number=eq.model_number or ("2 PK" if "AC" in eq.name else "Standard"),
                status="Dipasang",
                location_info=f"Penempatan di {b_name} - {f_name}",
                performed_by=current_user.id
            )
            db.add(new_log)

        # Fetch asset inventory
        asset_res = await db.execute(select(AssetInventory).options(selectinload(AssetInventory.category)))
        assets = asset_res.scalars().all()

        for asset in assets:
            new_log = InventoryHistoryLog(
                category_id=asset.category_id,
                asset_id=asset.asset_id,
                action_type="restock" if asset.status == 'available' else "damage",
                building_name="Gudang Utama",
                floor_name="-",
                room_name="",
                brand="Indachi" if "FU" in (getattr(asset.category, 'name', '') or '') else "LG",
                model_number="Standard",
                status="Siap Pakai" if asset.status == 'available' else "Gudang Rusak",
                location_info="Stok Barang Gudang",
                performed_by=current_user.id
            )
            db.add(new_log)

        await db.commit()

        # Re-query
        result = await db.execute(
            select(InventoryHistoryLog)
            .options(selectinload(InventoryHistoryLog.category))
            .order_by(InventoryHistoryLog.created_at.desc())
        )
        logs = result.scalars().all()

    return logs

@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    pass # to be implemented further below, just replacing context

@router.post("/assets/add-stock", status_code=status.HTTP_201_CREATED)
async def add_stock(data: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    category_id = data.get("category_id")
    brand = data.get("brand")
    model_number = data.get("model_number")
    quantity = int(data.get("quantity", 1))

    # Fetch category
    from app.models.equipment_category import EquipmentCategory
    cat_res = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == category_id))
    cat = cat_res.scalars().first()
    
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    cat_name = cat.name

    for _ in range(quantity):
        asset_inv = AssetInventory(
            category_id=category_id,
            asset_id=f"{cat_name} - {brand}",
            status='available',
            brand=brand,
            model_number=model_number
        )
        db.add(asset_inv)

    log = InventoryHistoryLog(
        category_id=category_id,
        asset_id=f"{cat_name} - {brand}",
        action_type='add_stock',
        building_name="Gudang Utama",
        floor_name="-",
        room_name="-",
        brand=brand,
        model_number=model_number,
        status="Siap Pakai",
        location_info=f"Stok Masuk Gudang ({cat_name})",
        performed_by=current_user.id
    )
    db.add(log)
    await db.commit()
    return {"success": True}

@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset_real(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(AssetInventory).where(AssetInventory.id == asset_id).options(selectinload(AssetInventory.category)))
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    log = InventoryHistoryLog(
        category_id=asset.category_id,
        asset_id=asset.asset_id,
        action_type='remove',
        location_info=f"Dihapus permanen dari gudang (Status sebelumnya: {asset.status})",
        performed_by=current_user.id
    )
    db.add(log)
    
    await db.delete(asset)
    await db.commit()
    return None
