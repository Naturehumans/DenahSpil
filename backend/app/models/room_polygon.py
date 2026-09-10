import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class RoomPolygon(Base):
    __tablename__ = "room_polygons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    floor_id = Column(UUID(as_uuid=True), ForeignKey("floors.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    coordinates = Column(JSON, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    floor = relationship("Floor", back_populates="room_polygons")
