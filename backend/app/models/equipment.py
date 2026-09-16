import uuid
from datetime import date
from sqlalchemy import Column, String, Integer, Float, Date, Text, DateTime, ForeignKey
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Equipment(Base):
    __tablename__ = "equipments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    floor_id = Column(UUID(as_uuid=True), ForeignKey("floors.id"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("equipment_categories.id"), nullable=False, index=True)
    placed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)
    brand = Column(String(100), nullable=True)
    model_number = Column(String(100), nullable=True)
    
    ac_in_asset_id = Column(String(100), nullable=True)
    ac_out_asset_id = Column(String(100), nullable=True)
    
    installation_date = Column(Date, nullable=True, default=date.today)
    lifespan_months = Column(Integer, nullable=True, default=0)
    expiry_date = Column(Date, nullable=True, index=True)
    
    position_x = Column(Float, nullable=False)
    position_y = Column(Float, nullable=False)
    
    status = Column(String(20), default='active', index=True)
    notes = Column(Text, nullable=True)
    
    placed_at = Column(DateTime(timezone=True), default=func.now())
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    floor = relationship("Floor", back_populates="equipments")
    category = relationship("EquipmentCategory", back_populates="equipments")
    placer = relationship("User")
