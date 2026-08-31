import uuid
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CategoryBase(BaseModel):
    name: str
    icon_url: Optional[str] = None
    color: str = "#6366f1"
    initial_stock: int = 0
    minimum_stock: int = 0
    has_id: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(CategoryBase):
    name: Optional[str] = None
    color: Optional[str] = None
    icon_url: Optional[str] = None
    initial_stock: Optional[int] = None
    minimum_stock: Optional[int] = None
    has_id: Optional[bool] = None

class CategoryResponse(CategoryBase):
    id: uuid.UUID
    created_at: datetime
    available_stock: Optional[int] = 0

    class Config:
        from_attributes = True
