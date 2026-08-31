import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.equipment import Equipment
from app.models.floor import Floor
from app.models.equipment_category import EquipmentCategory
from app.models.user import User
from app.schemas.equipment import EquipmentCreate, EquipmentUpdate, EquipmentPositionUpdate, EquipmentResponse, EquipmentWithCategory
from app.api.deps import get_current_user
from app.services.equipment_service import compute_expiry_date, compute_status, get_expiring_equipments, get_equipment_stats
from app.utils.sanitizer import sanitize_text

router = APIRouter()

@router.get("/equipments/all", response_model=List[EquipmentWithCategory])
async def list_all_equipments(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Equipment)
        .options(selectinload(Equipment.category), selectinload(Equipment.floor).selectinload(Floor.building))
    )
    return result.scalars().all()

@router.get("/floors/{floor_id}/equipments", response_model=List[EquipmentWithCategory])
async def list_equipments_by_floor(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Equipment)
        .where(Equipment.floor_id == floor_id)
        .options(selectinload(Equipment.category), selectinload(Equipment.floor))
    )
    return result.scalars().all()

@router.get("/equipments/expiring", response_model=List[EquipmentWithCategory])
async def list_expiring_equipments(days: int = 30, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    equipments = await get_expiring_equipments(db, days)
    # Note: we should preload category too if needed, but get_expiring_equipments currently doesn't. 
    # Let's keep it simple here.
    return equipments

@router.get("/equipments/stats")
async def equipment_stats(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await get_equipment_stats(db)

@router.get("/equipments/{equipment_id}", response_model=EquipmentWithCategory)
async def get_equipment(equipment_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Equipment)
        .where(Equipment.id == equipment_id)
        .options(selectinload(Equipment.category), selectinload(Equipment.floor))
    )
    equipment = result.scalars().first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment

@router.post("/floors/{floor_id}/equipments", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    floor_id: uuid.UUID,
    equipment_in: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # check floor
    f_res = await db.execute(select(Floor).where(Floor.id == floor_id))
    if not f_res.scalars().first():
        raise HTTPException(status_code=404, detail="Floor not found")
        
    # check category
    c_res = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == equipment_in.category_id))
    if not c_res.scalars().first():
        raise HTTPException(status_code=404, detail="Category not found")
        
    expiry_date = compute_expiry_date(equipment_in.installation_date, equipment_in.lifespan_months) if equipment_in.installation_date else None
    computed_status = compute_status(expiry_date) if expiry_date else 'active'
    
    db_equipment = Equipment(
        floor_id=floor_id,
        category_id=equipment_in.category_id,
        placed_by=current_user.id,
        name=sanitize_text(equipment_in.name),
        brand=sanitize_text(equipment_in.brand) if equipment_in.brand else None,
        model_number=sanitize_text(equipment_in.model_number) if equipment_in.model_number else None,
        installation_date=equipment_in.installation_date,
        lifespan_months=equipment_in.lifespan_months,
        expiry_date=expiry_date,
        position_x=equipment_in.position_x,
        position_y=equipment_in.position_y,
        status=equipment_in.status if equipment_in.status != 'active' else computed_status, # allow override or use computed
        notes=sanitize_text(equipment_in.notes) if equipment_in.notes else None
    )
    db.add(db_equipment)
    await db.commit()
    await db.refresh(db_equipment)
    return db_equipment

@router.put("/equipments/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: uuid.UUID,
    equipment_in: EquipmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
    equipment = result.scalars().first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
        
    if equipment_in.name is not None:
        equipment.name = sanitize_text(equipment_in.name)
    if equipment_in.brand is not None:
        equipment.brand = sanitize_text(equipment_in.brand)
    if equipment_in.model_number is not None:
        equipment.model_number = sanitize_text(equipment_in.model_number)
    if equipment_in.category_id is not None:
        equipment.category_id = equipment_in.category_id
    if equipment_in.installation_date is not None:
        equipment.installation_date = equipment_in.installation_date
    if equipment_in.lifespan_months is not None:
        equipment.lifespan_months = equipment_in.lifespan_months
    
    # recompute expiry if either changed
    if equipment_in.installation_date is not None or equipment_in.lifespan_months is not None:
        equipment.expiry_date = compute_expiry_date(equipment.installation_date, equipment.lifespan_months) if equipment.installation_date else None
        
    if equipment_in.status is not None:
        equipment.status = equipment_in.status
    else:
        equipment.status = compute_status(equipment.expiry_date) if equipment.expiry_date else 'active'
        
    if equipment_in.notes is not None:
        equipment.notes = sanitize_text(equipment_in.notes)
        
    await db.commit()
    await db.refresh(equipment)
    return equipment

@router.patch("/equipments/{equipment_id}/position", response_model=EquipmentResponse)
async def update_equipment_position(
    equipment_id: uuid.UUID,
    pos_in: EquipmentPositionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
    equipment = result.scalars().first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
        
    equipment.position_x = pos_in.position_x
    equipment.position_y = pos_in.position_y
    
    await db.commit()
    await db.refresh(equipment)
    return equipment

from app.models.asset_inventory import AssetInventory
from app.models.inventory_history_log import InventoryHistoryLog

@router.delete("/equipments/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(equipment_id: uuid.UUID, destination: str = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.slot_template import SlotTemplate
    
    # Clear slot reference first if any slot is pointing to this equipment
    slot_res = await db.execute(select(SlotTemplate).where(SlotTemplate.equipment_id == equipment_id))
    slot_obj = slot_res.scalars().first()
    if slot_obj:
        slot_obj.equipment_id = None
        await db.flush()

    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id).options(selectinload(Equipment.category)))
    equipment = result.scalars().first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
        
    # Process inventory and history tracking for legacy equipment
    if equipment.category and equipment.category.has_id:
        if destination in ['good', 'damaged']:
            asset_inv = AssetInventory(
                category_id=equipment.category_id,
                asset_id=equipment.name,
                status='available' if destination == 'good' else 'damaged',
            )
            db.add(asset_inv)
            log = InventoryHistoryLog(
                category_id=equipment.category_id,
                asset_id=equipment.name,
                action_type='repair' if destination == 'good' else 'damage',
                location_info="Ditarik dari denah (Barang lawas)",
                performed_by=current_user.id
            )
            db.add(log)
        elif destination == 'discard':
            log = InventoryHistoryLog(
                category_id=equipment.category_id,
                asset_id=equipment.name,
                action_type='remove',
                location_info="Dibuang dari denah (Barang lawas)",
                performed_by=current_user.id
            )
            db.add(log)
    else:
        log = InventoryHistoryLog(
            category_id=equipment.category_id,
            action_type='remove',
            location_info="Barang habis pakai dibuang dari denah (Barang lawas)",
            performed_by=current_user.id
        )
        db.add(log)
        
    await db.delete(equipment)
    await db.commit()
    return None
