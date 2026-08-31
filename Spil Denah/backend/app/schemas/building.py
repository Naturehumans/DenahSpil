import uuid
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BuildingBase(BaseModel):
    name: str
    description: Optional[str] = None
    total_floors: int = 1

class BuildingCreate(BuildingBase):
    pass

class BuildingUpdate(BuildingBase):
    name: Optional[str] = None
    total_floors: Optional[int] = None

class BuildingResponse(BuildingBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
