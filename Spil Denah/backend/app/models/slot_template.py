import uuid
from sqlalchemy import Column, Float, DateTime, ForeignKey, String
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class SlotTemplate(Base):
    __tablename__ = "slot_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    floor_id = Column(UUID(as_uuid=True), ForeignKey("floors.id"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("equipment_categories.id"), nullable=False, index=True)
    equipment_id = Column(UUID(as_uuid=True), ForeignKey("equipments.id"), nullable=True, index=True)
    
    position_x = Column(Float, nullable=False)
    position_y = Column(Float, nullable=False)
    room_name = Column(String(100), nullable=True)
    slot_code = Column(String(100), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    floor = relationship("Floor")
    category = relationship("EquipmentCategory")
    equipment = relationship("Equipment")
