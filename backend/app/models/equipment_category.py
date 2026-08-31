import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class EquipmentCategory(Base):
    __tablename__ = "equipment_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False, unique=True)
    icon_url = Column(String(500), nullable=True)
    color = Column(String(7), nullable=True)
    initial_stock = Column(Integer, nullable=False, default=0)
    has_id = Column(Boolean, server_default='false', nullable=False, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    equipments = relationship("Equipment", back_populates="category")
