import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class AssetInventory(Base):
    __tablename__ = "asset_inventory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(UUID(as_uuid=True), ForeignKey("equipment_categories.id"), nullable=False, index=True)
    asset_id = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="available")
    brand = Column(String(100), nullable=True)
    model_number = Column(String(100), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    category = relationship("EquipmentCategory")
