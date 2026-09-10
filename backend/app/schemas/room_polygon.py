from pydantic import BaseModel
import uuid
from typing import List, Dict, Any
from datetime import datetime

class Point(BaseModel):
    x: float
    y: float

class RoomPolygonBase(BaseModel):
    name: str
    coordinates: List[Point]

class RoomPolygonCreate(RoomPolygonBase):
    pass

class RoomPolygonUpdate(BaseModel):
    name: str = None
    coordinates: List[Point] = None

class RoomPolygonResponse(RoomPolygonBase):
    id: uuid.UUID
    floor_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
