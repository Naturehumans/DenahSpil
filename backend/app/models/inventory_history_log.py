import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class InventoryHistoryLog(Base):
    __tablename__ = "inventory_history_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(UUID(as_uuid=True), ForeignKey("equipment_categories.id"), nullable=False, index=True)
    asset_id = Column(String(100), nullable=True)
    slot_code = Column(String(100), nullable=True)
    action_type = Column(String(50), nullable=False)
    location_info = Column(String(255), nullable=True)
    building_name = Column(String(100), nullable=True)
    floor_name = Column(String(100), nullable=True)
    room_name = Column(String(100), nullable=True)
    brand = Column(String(100), nullable=True)
    model_number = Column(String(100), nullable=True)
    status = Column(String(50), nullable=True)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    category = relationship("EquipmentCategory")
