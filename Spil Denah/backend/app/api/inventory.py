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

from pydantic import BaseModel
class AddStockRequest(BaseModel):
    category_id: uuid.UUID
    brand: str
    model_number: str
    quantity: int

def abbreviate(name: str) -> str:
    if not name: return "UNK"
    parts = name.split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return name[:2].upper()

@router.post("/add-stock")
async def add_stock_to_inventory(req: AddStockRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.equipment_category import EquipmentCategory
    from app.models.equipment import Equipment
    
    res = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == req.category_id))
    cat = res.scalars().first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    # Increment category stock
    cat.initial_stock += req.quantity
    
    # 2. Find max ID
    eq_res = await db.execute(select(Equipment.name).where(Equipment.category_id == cat.id))
    hist_res = await db.execute(select(InventoryHistoryLog.asset_id).where(InventoryHistoryLog.category_id == cat.id).where(InventoryHistoryLog.asset_id.isnot(None)))
    asset_res = await db.execute(select(AssetInventory.asset_id).where(AssetInventory.category_id == cat.id))
    
    all_names = list(eq_res.scalars().all()) + list(hist_res.scalars().all()) + list(asset_res.scalars().all())
    
    max_num = 0
    for n in all_names:
        # Find the last number in the string
        import re
        match = re.search(r'(\d+)$', n)
        if match:
            num = int(match.group(1))
            if num > max_num:
                max_num = num
                
    added_assets = []
    
    # Create 1 single summary transaction log for the batch stock addition
    summary_log = InventoryHistoryLog(
        category_id=cat.id,
        asset_id=f"{cat.name} (Restock {req.quantity} pcs)",
        action_type="add_stock",
        quantity=req.quantity,
        brand=req.brand,
        model_number=req.model_number,
        location_info="Stok Masuk Gudang (Siap Pakai)",
        status="Siap Pakai",
        performed_by=current_user.id
    )
    db.add(summary_log)
    
    for i in range(req.quantity):
        max_num += 1
        new_id = f"{cat.name} - {max_num}"
        
        # Insert into AssetInventory
        asset = AssetInventory(
            category_id=cat.id,
            asset_id=new_id,
            brand=req.brand,
            model_number=req.model_number,
            status="available"
        )
        db.add(asset)
        added_assets.append(new_id)
        
    await db.commit()
    
    return {"message": f"Added {req.quantity} items successfully", "assets": added_assets}

@router.get("/inventory-logs", response_model=List[InventoryHistoryLogResponse])
async def get_inventory_logs(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
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

class RestoreAssetRequest(BaseModel):
    asset_id: str
    category_id: Optional[uuid.UUID] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None

@router.post("/assets/restore")
async def restore_damaged_asset(req: RestoreAssetRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.equipment_category import EquipmentCategory
    
    # 1. Search for existing AssetInventory entry by asset_id or status='damaged'
    res = await db.execute(
        select(AssetInventory)
        .where(AssetInventory.asset_id == req.asset_id)
    )
    asset = res.scalars().first()
    
    cat_id = req.category_id

    if asset:
        asset.status = "available"
        if not cat_id:
            cat_id = asset.category_id
    else:
        # Check if asset_id is a UUID
        try:
            val_uuid = uuid.UUID(req.asset_id)
            res_id = await db.execute(select(AssetInventory).where(AssetInventory.id == val_uuid))
            asset = res_id.scalars().first()
            if asset:
                asset.status = "available"
                if not cat_id:
                    cat_id = asset.category_id
        except ValueError:
            pass

    if not asset and cat_id:
        asset = AssetInventory(
            category_id=cat_id,
            asset_id=req.asset_id,
            brand=req.brand or "Tanpa Merk",
            model_number=req.model_number or "Standard",
            status="available"
        )
        db.add(asset)

    # 2. Increment category initial_stock
    if cat_id:
        cat_res = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == cat_id))
        cat = cat_res.scalars().first()
        if cat:
            cat.initial_stock += 1

    # 3. Add History Log for backend
    log = InventoryHistoryLog(
        category_id=cat_id,
        asset_id=req.asset_id,
        action_type="repair",
        brand=req.brand,
        model_number=req.model_number,
        location_info="Diperbaiki dari Gudang Rusak -> Kembali ke Stok Siap Pakai",
        status="Siap Pakai (Hasil Perbaikan)",
        performed_by=current_user.id
    )
    db.add(log)

    await db.commit()
    return {"message": f"Asset {req.asset_id} restored to available stock successfully"}
