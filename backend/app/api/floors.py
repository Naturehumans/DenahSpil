import uuid
import os
import aiofiles
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.floor import Floor
from app.models.building import Building
from app.models.user import User
from app.schemas.floor import FloorCreate, FloorUpdate, FloorResponse, FloorReorder
from app.api.deps import get_current_user
from app.utils.sanitizer import sanitize_text
from app.services.image_service import optimize_image

router = APIRouter()

UPLOAD_DIR = "uploads/floor-plans"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/buildings/{building_id}/floors", response_model=List[FloorResponse])
async def list_floors(building_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Floor).where(Floor.building_id == building_id).order_by(Floor.sort_order)
    )
    return result.scalars().all()

@router.get("/floors/{floor_id}", response_model=FloorResponse)
async def get_floor(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalars().first()
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    return floor

@router.post("/buildings/{building_id}/floors", response_model=FloorResponse, status_code=status.HTTP_201_CREATED)
async def create_floor(
    building_id: uuid.UUID,
    name: str = Form(...),
    image: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify building exists
    b_result = await db.execute(select(Building).where(Building.id == building_id))
    if not b_result.scalars().first():
        raise HTTPException(status_code=404, detail="Building not found")

    # Determine floor number and sort order
    f_result = await db.execute(select(Floor).where(Floor.building_id == building_id).order_by(Floor.floor_number.desc()))
    last_floor = f_result.scalars().first()
    next_num = last_floor.floor_number + 1 if last_floor else 1
    
    db_floor = Floor(
        building_id=building_id,
        name=sanitize_text(name),
        floor_number=next_num,
        sort_order=next_num
    )

    if image:
        content = await image.read()
        opt_bytes, width, height = optimize_image(content)
        ext = "webp"
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        async with aiofiles.open(filepath, 'wb') as out_file:
            await out_file.write(opt_bytes)
            
        db_floor.floor_plan_image_url = f"/api/uploads/{filename}"
        db_floor.canvas_width = width
        db_floor.canvas_height = height

    db.add(db_floor)
    await db.commit()
    await db.refresh(db_floor)
    return db_floor

@router.put("/floors/{floor_id}", response_model=FloorResponse)
async def update_floor(floor_id: uuid.UUID, floor_in: FloorUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalars().first()
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
        
    if floor_in.name is not None:
        floor.name = sanitize_text(floor_in.name)
    if floor_in.sort_order is not None:
        floor.sort_order = floor_in.sort_order
        
    await db.commit()
    await db.refresh(floor)
    return floor

@router.delete("/floors/{floor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_floor(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalars().first()
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
        
    await db.delete(floor)
    await db.commit()
    return None

@router.post("/floors/{floor_id}/upload-image", response_model=FloorResponse)
async def upload_floor_image(
    floor_id: uuid.UUID,
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalars().first()
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
        
    content = await image.read()
    opt_bytes, width, height = optimize_image(content)
    
    filename = f"{uuid.uuid4()}.webp"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    async with aiofiles.open(filepath, 'wb') as out_file:
        await out_file.write(opt_bytes)
        
    floor.floor_plan_image_url = f"/api/uploads/{filename}"
    floor.canvas_width = width
    floor.canvas_height = height
    
    await db.commit()
    await db.refresh(floor)
    return floor
