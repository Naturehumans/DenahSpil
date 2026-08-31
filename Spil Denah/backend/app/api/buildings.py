import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.building import Building
from app.models.user import User
from app.schemas.building import BuildingCreate, BuildingUpdate, BuildingResponse
from app.api.deps import get_current_user
from app.utils.sanitizer import sanitize_text

router = APIRouter()

@router.get("", response_model=List[BuildingResponse])
async def list_buildings(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Building))
    return result.scalars().all()

@router.get("/{building_id}", response_model=BuildingResponse)
async def get_building(building_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Building).where(Building.id == building_id))
    building = result.scalars().first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    return building

@router.post("", response_model=BuildingResponse, status_code=status.HTTP_201_CREATED)
async def create_building(building_in: BuildingCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_building = Building(
        name=sanitize_text(building_in.name),
        description=sanitize_text(building_in.description) if building_in.description else None,
        total_floors=building_in.total_floors
    )
    db.add(db_building)
    await db.commit()
    await db.refresh(db_building)
    return db_building

@router.put("/{building_id}", response_model=BuildingResponse)
async def update_building(building_id: uuid.UUID, building_in: BuildingUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Building).where(Building.id == building_id))
    building = result.scalars().first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
        
    if building_in.name is not None:
        building.name = sanitize_text(building_in.name)
    if building_in.total_floors is not None:
        building.total_floors = building_in.total_floors
        
    await db.commit()
    await db.refresh(building)
    return building

@router.delete("/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_building(
    building_id: uuid.UUID, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Building).where(Building.id == building_id))
    building = result.scalars().first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
        
    await db.delete(building)
    await db.commit()
    return None
