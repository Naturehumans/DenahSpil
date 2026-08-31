import uuid
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime
from app.schemas.equipment_category import CategoryResponse
from app.schemas.floor import FloorResponse

class EquipmentBase(BaseModel):
    name: str
    brand: Optional[str] = None
    model_number: Optional[str] = None
    installation_date: Optional[date] = None
    lifespan_months: Optional[int] = 0
    position_x: float
    position_y: float
    status: Literal['active', 'warning', 'expired', 'replaced'] = 'active'
    notes: Optional[str] = None

class EquipmentCreate(EquipmentBase):
    category_id: uuid.UUID

class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    installation_date: Optional[date] = None
    lifespan_months: Optional[int] = None
    status: Optional[Literal['active', 'warning', 'expired', 'replaced']] = None
    notes: Optional[str] = None

class EquipmentPositionUpdate(BaseModel):
    position_x: float
    position_y: float

class EquipmentResponse(EquipmentBase):
    id: uuid.UUID
    floor_id: uuid.UUID
    category_id: uuid.UUID
    placed_by: uuid.UUID
    expiry_date: Optional[date] = None
    placed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EquipmentWithCategory(EquipmentResponse):
    category: Optional[CategoryResponse] = None
    floor: Optional[FloorResponse] = None
    
    class Config:
        from_attributes = True
