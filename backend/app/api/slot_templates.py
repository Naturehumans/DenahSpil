import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.slot_template import SlotTemplate
from app.models.equipment import Equipment
from app.models.equipment_category import EquipmentCategory
from app.models.floor import Floor
from app.models.building import Building
from app.models.user import User
from app.models.asset_inventory import AssetInventory
from app.models.inventory_history_log import InventoryHistoryLog
from app.schemas.slot_template import SlotCreate, SlotResponse, SlotWithEquipment
from app.api.deps import get_current_user

router = APIRouter()

def abbreviate(name: str) -> str:
    if not name:
        return ""
    words = name.split()
    if len(words) == 1:
        w = words[0]
        if len(w) <= 2:
            return w.upper()
        return w[0].upper()
    return "".join(word[0].upper() for word in words)

@router.get("/slots", response_model=List[SlotWithEquipment])
async def list_all_slots(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(SlotTemplate)
        .options(
            selectinload(SlotTemplate.equipment).selectinload(Equipment.category),
            selectinload(SlotTemplate.category),
            selectinload(SlotTemplate.floor).selectinload(Floor.building)
        )
    )
    return result.scalars().all()

@router.get("/floors/{floor_id}/slots", response_model=List[SlotWithEquipment])
async def list_slots_by_floor(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(SlotTemplate)
        .where(SlotTemplate.floor_id == floor_id)
        .options(
            selectinload(SlotTemplate.equipment).selectinload(Equipment.category),
            selectinload(SlotTemplate.category),
            selectinload(SlotTemplate.floor).selectinload(Floor.building)
        )
    )
    return result.scalars().all()

@router.post("/floors/{floor_id}/slots", response_model=SlotResponse, status_code=status.HTTP_201_CREATED)
async def create_slot(
    floor_id: uuid.UUID,
    slot_in: SlotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify floor
    f_res = await db.execute(select(Floor).where(Floor.id == floor_id).options(selectinload(Floor.building)))
    flr = f_res.scalars().first()
    if not flr:
        raise HTTPException(status_code=404, detail="Floor not found")
        
    # Verify category
    c_res = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == slot_in.category_id))
    cat = c_res.scalars().first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # Generate slot_code (ID Tempat / ID Lokasi e.g. GUL11)
    b_abbr = abbreviate(flr.building.name) if flr.building else "GU"
    c_abbr = abbreviate(cat.name)
    flr_num = flr.floor_number
    
    count_res = await db.execute(
        select(func.count(SlotTemplate.id))
        .where(SlotTemplate.floor_id == floor_id)
        .where(SlotTemplate.category_id == slot_in.category_id)
    )
    s_count = (count_res.scalar() or 0) + 1
    generated_slot_code = f"{b_abbr}{c_abbr}{flr_num}{s_count}"

    db_slot = SlotTemplate(
        floor_id=floor_id,
        category_id=slot_in.category_id,
        position_x=slot_in.position_x,
        position_y=slot_in.position_y,
        room_name=slot_in.room_name,
        slot_code=slot_in.slot_code or generated_slot_code
    )
    db.add(db_slot)
    await db.commit()
    await db.refresh(db_slot)
    return db_slot

@router.patch("/slots/{slot_id}/position", response_model=SlotResponse)
async def update_slot_position(
    slot_id: uuid.UUID,
    position_x: float,
    position_y: float,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(SlotTemplate).where(SlotTemplate.id == slot_id))
    slot = result.scalars().first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
        
    slot.position_x = position_x
    slot.position_y = position_y
    
    await db.commit()
    await db.refresh(slot)
    return slot

@router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_slot(slot_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(SlotTemplate).where(SlotTemplate.id == slot_id))
    slot = result.scalars().first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    if slot.equipment_id is not None:
        raise HTTPException(status_code=400, detail="Cannot delete a slot that is filled with equipment. Unassign the equipment first.")
        
    await db.delete(slot)
    await db.commit()
    return None

@router.post("/slots/{slot_id}/assign", response_model=SlotWithEquipment)
async def assign_equipment_to_slot(
    slot_id: uuid.UUID,
    brand: str = None,
    model_number: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch slot
    result = await db.execute(
        select(SlotTemplate)
        .where(SlotTemplate.id == slot_id)
        .options(selectinload(SlotTemplate.floor).selectinload(Floor.building), selectinload(SlotTemplate.category))
    )
    slot = result.scalars().first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
        
    if slot.equipment_id is not None:
        raise HTTPException(status_code=400, detail="Slot is already filled")

    # Check available stock
    cat = slot.category
    
    avail_assets_res = await db.execute(
        select(func.count(AssetInventory.id))
        .where(AssetInventory.category_id == cat.id)
        .where(AssetInventory.status == 'available')
    )
    avail_assets_count = avail_assets_res.scalar() or 0

    # Allow assignment if brand stock / asset inventory exists, even if cat.initial_stock is 0
    if cat.initial_stock <= 0 and avail_assets_count <= 0 and not brand:
        raise HTTPException(status_code=400, detail="Stock is empty for this category")
        
    # Decrement stock manually if > 0
    if cat.initial_stock > 0:
        cat.initial_stock -= 1

    # Generate auto-name (ID Barang) strictly incrementing
    bldg_abbr = abbreviate(slot.floor.building.name) if (slot.floor and slot.floor.building) else "GU"
    cat_abbr = abbreviate(cat.name)
    floor_num = slot.floor.floor_number if slot.floor else 1
    
    cat_clean = cat.name.replace(" ", "")

    # 1. First check if an available AssetInventory asset exists for this category/brand/model
    asset_query = select(AssetInventory).where(
        AssetInventory.category_id == cat.id,
        AssetInventory.status == 'available'
    )
    if brand:
        asset_query = asset_query.where(AssetInventory.brand == brand)
    if model_number and model_number != 'Standard':
        asset_query = asset_query.where(AssetInventory.model_number == model_number)

    asset_res = await db.execute(asset_query.order_by(AssetInventory.created_at.asc()))
    avail_asset = asset_res.scalars().first()

    if avail_asset:
        auto_name = avail_asset.asset_id
        avail_asset.status = 'in_use'
    else:
        # 2. If no AssetInventory item exists, generate auto_name strictly incrementing MAX ID number ever recorded
        import re
        all_names = []

        # Check Equipment table
        eqs_res = await db.execute(select(Equipment.name).where(Equipment.category_id == cat.id))
        all_names.extend([n for n in eqs_res.scalars().all() if n])

        # Check AssetInventory table
        assets_res = await db.execute(select(AssetInventory.asset_id).where(AssetInventory.category_id == cat.id))
        all_names.extend([n for n in assets_res.scalars().all() if n])

        # Check InventoryHistoryLog table (includes all deleted, discarded, deployed items)
        hist_res = await db.execute(
            select(InventoryHistoryLog.asset_id)
            .where(InventoryHistoryLog.category_id == cat.id)
            .where(InventoryHistoryLog.asset_id.isnot(None))
        )
        all_names.extend([n for n in hist_res.scalars().all() if n])

        max_num = 0
        for n in all_names:
            match = re.search(r'(\d+)$', n.strip())
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num

        candidate = max_num + 1
        auto_name = f"{cat.name} - {candidate}"

    if not slot.slot_code:
        slot_count_res = await db.execute(
            select(func.count(SlotTemplate.id))
            .where(SlotTemplate.floor_id == slot.floor_id)
            .where(SlotTemplate.category_id == cat.id)
        )
        s_cnt = slot_count_res.scalar() or 1
        slot.slot_code = f"{bldg_abbr}{cat_abbr}{floor_num}{s_cnt}"

    # Create equipment
    new_equipment = Equipment(
        floor_id=slot.floor_id,
        category_id=cat.id,
        placed_by=current_user.id,
        name=auto_name,
        brand=brand,
        model_number=model_number,
        position_x=slot.position_x,
        position_y=slot.position_y,
        status='active'
    )
    db.add(new_equipment)
    await db.flush() # get id
    
    # Assign to slot
    slot.equipment_id = new_equipment.id
    
    # Log history
    room_txt = f" - Ruang: {slot.room_name}" if slot.room_name else ""
    b_name = slot.floor.building.name if (slot.floor and slot.floor.building) else "Gedung Utama"
    f_name = slot.floor.name if slot.floor else "Lantai 1"

    log = InventoryHistoryLog(
        category_id=cat.id,
        asset_id=auto_name,
        slot_code=slot.slot_code,
        action_type="deploy",
        building_name=b_name,
        floor_name=f_name,
        room_name=slot.room_name,
        brand=brand,
        model_number=model_number,
        status="Dipasang",
        location_info=f"Penempatan di {b_name} - {f_name}{room_txt}",
        performed_by=current_user.id
    )
    db.add(log)
    
    await db.commit()
    
    # Reload slot with relationships
    final_res = await db.execute(
        select(SlotTemplate)
        .where(SlotTemplate.id == slot_id)
        .options(
            selectinload(SlotTemplate.equipment).selectinload(Equipment.category),
            selectinload(SlotTemplate.category),
            selectinload(SlotTemplate.floor).selectinload(Floor.building)
        )
    )
    return final_res.scalars().first()

@router.post("/slots/{slot_id}/move-to/{target_slot_id}", response_model=SlotWithEquipment)
async def move_equipment_between_slots(
    slot_id: uuid.UUID,
    target_slot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    source_res = await db.execute(
        select(SlotTemplate)
        .where(SlotTemplate.id == slot_id)
        .options(
            selectinload(SlotTemplate.equipment).selectinload(Equipment.category),
            selectinload(SlotTemplate.category),
            selectinload(SlotTemplate.floor).selectinload(Floor.building)
        )
    )
    source_slot = source_res.scalars().first()
    
    target_res = await db.execute(
        select(SlotTemplate)
        .where(SlotTemplate.id == target_slot_id)
        .options(
            selectinload(SlotTemplate.equipment).selectinload(Equipment.category),
            selectinload(SlotTemplate.category),
            selectinload(SlotTemplate.floor).selectinload(Floor.building)
        )
    )
    target_slot = target_res.scalars().first()
    
    if not source_slot or not target_slot:
        raise HTTPException(status_code=404, detail="Slot not found")
        
    if not source_slot.equipment_id:
        raise HTTPException(status_code=400, detail="Source slot is empty")
        
    if target_slot.equipment_id is not None:
        raise HTTPException(status_code=400, detail="Target slot is already filled")
        
    if str(source_slot.category_id) != str(target_slot.category_id):
        raise HTTPException(status_code=400, detail="Category mismatch between slots")
        
    # Move equipment — must clear source FIRST to avoid unique constraint on equipment_id
    eq = source_slot.equipment
    if not eq and source_slot.equipment_id:
        eq_res = await db.execute(select(Equipment).where(Equipment.id == source_slot.equipment_id))
        eq = eq_res.scalars().first()
        
    if not eq:
        raise HTTPException(status_code=400, detail="Equipment object not found")

    eq.position_x = target_slot.position_x
    eq.position_y = target_slot.position_y
    eq.floor_id = target_slot.floor_id
    
    # Step 1: Clear source slot
    source_slot.equipment_id = None
    await db.flush()
    
    # Step 2: Assign to target slot
    target_slot.equipment_id = eq.id

    # Step 3: Record History Log for drag & drop move
    bldg_name = target_slot.floor.building.name if (target_slot.floor and target_slot.floor.building) else "Gedung Utama"
    flr_name = target_slot.floor.name if target_slot.floor else "-"
    source_rm = f"Ruang {source_slot.room_name}" if source_slot.room_name else (source_slot.slot_code or "Slot Lama")
    target_rm = f"Ruang {target_slot.room_name}" if target_slot.room_name else (target_slot.slot_code or "Slot Baru")

    move_log = InventoryHistoryLog(
        category_id=target_slot.category_id,
        asset_id=eq.name or (target_slot.category.name if target_slot.category else "Aset"),
        slot_code=target_slot.slot_code or source_slot.slot_code,
        action_type="move",
        building_name=bldg_name,
        floor_name=flr_name,
        room_name=target_slot.room_name or "",
        brand=eq.brand,
        model_number=eq.model_number,
        status="Dipasang (Dipindahkan)",
        location_info=f"Dipindahkan dari {source_rm} ke {target_rm} ({bldg_name} - {flr_name})",
        performed_by=current_user.id
    )
    db.add(move_log)
    
    await db.commit()
    
    # reload target
    final_res = await db.execute(
        select(SlotTemplate)
        .where(SlotTemplate.id == target_slot_id)
        .options(
            selectinload(SlotTemplate.equipment).selectinload(Equipment.category),
            selectinload(SlotTemplate.category),
            selectinload(SlotTemplate.floor).selectinload(Floor.building)
        )
    )
    return final_res.scalars().first()

@router.delete("/slots/{slot_id}/unassign", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_equipment_from_slot(
    slot_id: uuid.UUID,
    destination: str = None, # 'good', 'damaged', 'discard'
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(SlotTemplate).where(SlotTemplate.id == slot_id).options(
            selectinload(SlotTemplate.equipment).selectinload(Equipment.category),
            selectinload(SlotTemplate.floor).selectinload(Floor.building),
            selectinload(SlotTemplate.category)
        )
    )
    slot = result.scalars().first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
        
    if not slot.equipment_id:
        return None # already empty
        
    eq = slot.equipment
    cat = slot.category or (eq.category if eq else None)
    
    if not cat:
        cat_id = slot.category_id or (eq.category_id if eq else None)
        if cat_id:
            c_res = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == cat_id))
            cat = c_res.scalars().first()

    bldg_name = slot.floor.building.name if slot.floor and slot.floor.building else "Gedung Utama"
    flr_name = slot.floor.name if slot.floor else "-"
    rm_name = slot.room_name or ""
    
    # Determine status & action_type
    if destination == 'good':
        status_text = 'Inventori Baru'
        action_type = 'restock'
        if cat and not cat.has_id:
            cat.initial_stock += 1
    elif destination == 'damaged':
        status_text = 'Inventori Rusak'
        action_type = 'damage'
    else:
        status_text = 'Dibuang'
        action_type = 'remove'

    # Save to AssetInventory if permanent ID asset
    if cat and cat.has_id:
        if destination in ['good', 'damaged']:
            asset_inv = AssetInventory(
                category_id=cat.id,
                asset_id=eq.name if eq else f"{cat.name} - Asset",
                status='available' if destination == 'good' else 'damaged',
                brand=eq.brand if eq else None,
                model_number=eq.model_number if eq else None,
            )
            db.add(asset_inv)

    # Save to InventoryHistoryLog for /history view ONLY if category exists
    if cat:
        rm_suffix = f" - Ruang: {rm_name}" if rm_name else ""
        log = InventoryHistoryLog(
            category_id=cat.id,
            asset_id=eq.name if eq else cat.name,
            slot_code=slot.slot_code,
            action_type=action_type,
            building_name=bldg_name,
            floor_name=flr_name,
            room_name=rm_name,
            brand=eq.brand if eq else None,
            model_number=eq.model_number if eq else None,
            status=status_text,
            location_info=f"Dilepas dari {bldg_name} - {flr_name}{rm_suffix}",
            performed_by=current_user.id
        )
        db.add(log)
    
    slot.equipment_id = None
    await db.flush()
    if eq:
        await db.delete(eq)
    
    await db.commit()
    return None
