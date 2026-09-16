from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid

from app.database import get_db
from app.models.room_polygon import RoomPolygon
from app.models.floor import Floor
from app.schemas.room_polygon import RoomPolygonCreate, RoomPolygonResponse, RoomPolygonUpdate

router = APIRouter(tags=["Room Polygons"])

@router.get("/floors/{floor_id}/room-polygons", response_model=List[RoomPolygonResponse])
async def get_room_polygons_by_floor(floor_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RoomPolygon).where(RoomPolygon.floor_id == floor_id))
    return result.scalars().all()

@router.post("/floors/{floor_id}/room-polygons", response_model=RoomPolygonResponse, status_code=status.HTTP_201_CREATED)
async def create_room_polygon(
    floor_id: uuid.UUID,
    polygon_in: RoomPolygonCreate,
    db: AsyncSession = Depends(get_db)
):
    # Check if floor exists
    floor_res = await db.execute(select(Floor).where(Floor.id == floor_id))
    if not floor_res.scalars().first():
        raise HTTPException(status_code=404, detail="Floor not found")
        
    coordinates_list = [{"x": p.x, "y": p.y} for p in polygon_in.coordinates]
        
    new_polygon = RoomPolygon(
        floor_id=floor_id,
        name=polygon_in.name,
        coordinates=coordinates_list
    )
    db.add(new_polygon)
    await db.commit()
    await db.refresh(new_polygon)
    return new_polygon

@router.delete("/room-polygons/{polygon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room_polygon(
    polygon_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(RoomPolygon).where(RoomPolygon.id == polygon_id))
    polygon = result.scalars().first()
    if not polygon:
        raise HTTPException(status_code=404, detail="Room polygon not found")
        
    await db.delete(polygon)
    await db.commit()
    return None
