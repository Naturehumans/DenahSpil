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
from app.schemas.inventory import AssetInventoryResponse, InventoryHistoryLogResponse, AssetRestoreRequest, BrandActionRequest
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
    ac_type = data.get("ac_type")

    # Fetch category
    from app.models.equipment_category import EquipmentCategory
    from app.utils.asset_id_generator import get_next_asset_ids
    cat_res = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == category_id))
    cat = cat_res.scalars().first()
    
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    cat_name = cat.name

    # Generate sequential structured IDs
    new_asset_ids = await get_next_asset_ids(cat_name, brand, model_number, db, category_id, quantity)

    for i in range(quantity):
        base_asset_id = new_asset_ids[i]
        
        parts_to_create = []
        if ac_type == 'in':
            parts_to_create.append(('in', f"{base_asset_id}-IN"))
        elif ac_type == 'out':
            parts_to_create.append(('out', f"{base_asset_id}-OUT"))
        elif ac_type == 'in_out':
            parts_to_create.append(('in', f"{base_asset_id}-IN"))
            parts_to_create.append(('out', f"{base_asset_id}-OUT"))
        else:
            parts_to_create.append((None, base_asset_id))
            
        for p_type, asset_id in parts_to_create:
            asset_inv = AssetInventory(
                category_id=category_id,
                asset_id=asset_id,
                status='available',
                brand=brand,
                model_number=model_number,
                ac_type=p_type
            )
            db.add(asset_inv)
    
            log = InventoryHistoryLog(
                category_id=category_id,
                asset_id=asset_id,
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

@router.post("/assets/delete-brand", status_code=status.HTTP_200_OK)
async def delete_assets_by_brand(
    request: BrandActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all AssetInventory records matching category + brand + model."""
    try:
        cat_uuid = uuid.UUID(request.category_id)
    except ValueError:
        return {"deleted": 0}

    from sqlalchemy import and_
    query = select(AssetInventory).options(selectinload(AssetInventory.category)).where(
        AssetInventory.category_id == cat_uuid
    )
    if request.brand:
        query = query.where(AssetInventory.brand == request.brand)
    if request.model_number:
        query = query.where(AssetInventory.model_number == request.model_number)
    
    result = await db.execute(query)
    assets = result.scalars().all()
    
    deleted_count = 0
    for asset in assets:
        log = InventoryHistoryLog(
            category_id=asset.category_id,
            asset_id=asset.asset_id,
            brand=asset.brand,
            model_number=asset.model_number,
            action_type='remove',
            status='Dibuang',
            location_info=f"Dihapus permanen dari gudang (merk {request.brand or '-'})",
            performed_by=current_user.id
        )
        db.add(log)
        await db.delete(asset)
        deleted_count += 1
    
    await db.commit()
    return {"deleted": deleted_count}

@router.post("/assets/reduce-stock", status_code=status.HTTP_200_OK)
async def delete_one_asset_by_brand(
    request: BrandActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a single AssetInventory record matching category + brand + model."""
    try:
        cat_uuid = uuid.UUID(request.category_id)
    except ValueError:
        return {"deleted": 0}

    from sqlalchemy import and_
    query = select(AssetInventory).options(selectinload(AssetInventory.category)).where(
        AssetInventory.category_id == cat_uuid
    )
    if request.brand:
        query = query.where(AssetInventory.brand == request.brand)
    if request.model_number:
        query = query.where(AssetInventory.model_number == request.model_number)
    
    result = await db.execute(query.limit(2))  # Fetch 2 to detect AC pair
    assets = result.scalars().all()
    if not assets:
        return {"deleted": 0}
    
    # For AC: delete the pair (IN + OUT share a base ID)
    cat_res = await db.execute(select(AssetInventory.category_id).where(AssetInventory.id == assets[0].id))
    from app.models.equipment_category import EquipmentCategory
    cat_r = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == cat_uuid))
    cat = cat_r.scalars().first()
    is_ac = 'AC' in (cat.name if cat else '').upper()
    
    to_delete = []
    if is_ac:
        # Find base ID of first asset and delete all with same base
        base_id = assets[0].asset_id or ''
        if base_id.endswith('-IN'): base_id = base_id[:-3]
        if base_id.endswith('-OUT'): base_id = base_id[:-4]
        
        pair_query = select(AssetInventory).where(
            AssetInventory.category_id == cat_uuid,
            AssetInventory.asset_id.in_([f"{base_id}-IN", f"{base_id}-OUT", base_id])
        )
        pair_res = await db.execute(pair_query)
        to_delete = pair_res.scalars().all()
    else:
        to_delete = [assets[0]]
    
    deleted_count = 0
    for asset in to_delete:
        log = InventoryHistoryLog(
            category_id=asset.category_id,
            asset_id=asset.asset_id,
            brand=asset.brand,
            model_number=asset.model_number,
            action_type='remove',
            status='Dikurangi',
            location_info=f"Stok dikurangi 1 unit (merk {request.brand or '-'})",
            performed_by=current_user.id
        )
        db.add(log)
        await db.delete(asset)
        deleted_count += 1
    
    await db.commit()
    return {"deleted": deleted_count}

@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset_real(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(AssetInventory).where(AssetInventory.id == asset_id).options(selectinload(AssetInventory.category)))
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    log = InventoryHistoryLog(
        category_id=asset.category_id,
        asset_id=asset.asset_id,
        brand=asset.brand,
        model_number=asset.model_number,
        action_type='remove',
        location_info=f"Dihapus permanen dari gudang (Status sebelumnya: {asset.status})",
        performed_by=current_user.id
    )
    db.add(log)
    
    await db.delete(asset)
    await db.commit()
    return None

@router.post("/assets/restore")
async def restore_asset(request: AssetRestoreRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(AssetInventory).where(AssetInventory.asset_id == request.asset_id, AssetInventory.status == 'damaged'))
    asset = result.scalars().first()
    
    if asset:
        asset.status = 'available'
        
        log = InventoryHistoryLog(
            category_id=asset.category_id,
            asset_id=asset.asset_id,
            brand=asset.brand,
            model_number=asset.model_number,
            action_type='repair',
            status='Siap Pakai (Hasil Perbaikan)',
            location_info=f"Diperbaiki dari Gudang Rusak -> Kembali ke Stok Siap Pakai",
            performed_by=current_user.id
        )
        db.add(log)
        await db.commit()
        return {"success": True, "message": "Asset restored"}
    
    raise HTTPException(status_code=404, detail="Damaged asset not found")
