import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Floor(Base):
    __tablename__ = "floors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_id = Column(UUID(as_uuid=True), ForeignKey("buildings.id"), nullable=False, index=True)
    floor_number = Column(Integer, nullable=False)
    name = Column(String(50), nullable=False)
    floor_plan_image_url = Column(String(500), nullable=True)
    canvas_width = Column(Integer, nullable=True)
    canvas_height = Column(Integer, nullable=True)
    sort_order = Column(Integer, nullable=True, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    building = relationship("Building", back_populates="floors")
    equipments = relationship("Equipment", back_populates="floor", cascade="all, delete-orphan")
    slots = relationship("SlotTemplate", back_populates="floor", cascade="all, delete-orphan")
    room_polygons = relationship("RoomPolygon", back_populates="floor", cascade="all, delete-orphan")
