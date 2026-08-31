import uuid
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.schemas.equipment import EquipmentResponse
from app.schemas.equipment_category import CategoryResponse
from app.schemas.floor import FloorWithBuilding

class SlotBase(BaseModel):
    category_id: uuid.UUID
    position_x: float
    position_y: float
    room_name: Optional[str] = None
    slot_code: Optional[str] = None

class SlotCreate(SlotBase):
    pass

class SlotResponse(SlotBase):
    id: uuid.UUID
    floor_id: uuid.UUID
    equipment_id: Optional[uuid.UUID] = None
    room_name: Optional[str] = None
    slot_code: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SlotWithEquipment(SlotResponse):
    equipment: Optional[EquipmentResponse] = None
    category: Optional[CategoryResponse] = None
    floor: Optional[FloorWithBuilding] = None

    class Config:
        from_attributes = True
