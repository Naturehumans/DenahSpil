import uuid
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.equipment_category import CategoryResponse

class AssetRestoreRequest(BaseModel):
    asset_id: str
    category_id: Optional[uuid.UUID] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None

class AssetInventoryBase(BaseModel):
    category_id: uuid.UUID
    asset_id: str
    component_name: Optional[str] = None
    status: str

class AssetInventoryResponse(AssetInventoryBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True

class InventoryHistoryLogBase(BaseModel):
    category_id: uuid.UUID
    asset_id: Optional[str] = None
    slot_code: Optional[str] = None
    action_type: str
    location_info: Optional[str] = None
    building_name: Optional[str] = None
    floor_name: Optional[str] = None
    room_name: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    status: Optional[str] = None
    performed_by: Optional[uuid.UUID] = None

class InventoryHistoryLogResponse(InventoryHistoryLogBase):
    id: uuid.UUID
    created_at: datetime
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True
