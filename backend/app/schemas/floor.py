import uuid
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class FloorBase(BaseModel):
    name: str
    floor_number: Optional[int] = None

class FloorCreate(FloorBase):
    pass

class FloorUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None

class FloorReorder(BaseModel):
    sort_order: int

class FloorResponse(FloorBase):
    id: uuid.UUID
    building_id: uuid.UUID
    floor_number: int
    floor_plan_image_url: Optional[str] = None
    canvas_width: int
    canvas_height: int
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

from app.schemas.building import BuildingResponse

class FloorWithBuilding(FloorResponse):
    building: Optional[BuildingResponse] = None

    class Config:
        from_attributes = True
