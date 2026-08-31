import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base, AsyncSessionLocal
from app.middleware.error_handler import error_handler_middleware
from app.api import health, auth, buildings, floors, equipment_categories, equipments, export, slot_templates, inventory

# Create uploads directory if it doesn't exist
os.makedirs("uploads/floor-plans", exist_ok=True)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spildenah")

async def seed_data():
    from app.models.user import User
    from app.models.building import Building
    from app.models.equipment_category import EquipmentCategory
    from app.utils.security import hash_password
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as db:
        # Seed Admin User
        result = await db.execute(select(User).where(User.username == "admin"))
        if not result.scalars().first():
            admin = User(username="admin", email="admin@spildenah.com", hashed_password=hash_password("admin123"))
            db.add(admin)
            logger.info("Seeded default admin user")
            
        # Seed Default Building
        result = await db.execute(select(Building).where(Building.name == "Gedung Utama"))
        if not result.scalars().first():
            building = Building(name="Gedung Utama", description="Gedung Utama Spil", total_floors=1)
            db.add(building)
            logger.info("Seeded default building")
            
        # Seed Equipment Categories
        categories = [
            {"name": "Lampu", "color": "#fbbf24", "icon_url": None},
            {"name": "AC", "color": "#3b82f6", "icon_url": None},
            {"name": "Kipas Angin", "color": "#22c55e", "icon_url": None},
            {"name": "Proyektor", "color": "#a855f7", "icon_url": None},
        ]
        
        for cat in categories:
            result = await db.execute(select(EquipmentCategory).where(EquipmentCategory.name == cat["name"]))
            if not result.scalars().first():
                db_cat = EquipmentCategory(**cat)
                db.add(db_cat)
                logger.info(f"Seeded category {cat['name']}")
                
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Run seeder and create tables
    logger.info("Starting up Spil Denah Backend...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        from sqlalchemy import text
        for col in ['building_name', 'floor_name', 'room_name', 'brand', 'model_number', 'status']:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(f"ALTER TABLE inventory_history_logs ADD COLUMN {col} VARCHAR(100)"))
            except Exception:
                pass

        try:
            async with engine.begin() as conn:
                await conn.execute(text("ALTER TABLE slot_templates ADD COLUMN room_name VARCHAR(100)"))
        except Exception:
            pass
        await seed_data()
    except Exception as e:
        logger.error(f"Error seeding data: {e}")
    yield
    # Shutdown
    logger.info("Shutting down Spil Denah Backend...")


app = FastAPI(
    title="Spil Denah API",
    description="Interactive Building Floor Plan Monitoring System",
    version="1.0.0",
    lifespan=lifespan
)

# Global error handler
app.middleware("http")(error_handler_middleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static Files for uploaded floor plans
app.mount("/api/uploads", StaticFiles(directory="uploads/floor-plans"), name="uploads")

# Include Routers
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(buildings.router, prefix="/api/buildings", tags=["Buildings"])
app.include_router(floors.router, prefix="/api", tags=["Floors"])
app.include_router(equipment_categories.router, prefix="/api/equipment-categories", tags=["Categories"])
app.include_router(equipments.router, prefix="/api", tags=["Equipments"])
app.include_router(export.router, prefix="/api", tags=["Export"])
app.include_router(slot_templates.router, prefix="/api", tags=["Slot Templates"])
app.include_router(inventory.router, prefix="/api", tags=["Inventory"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Spil Denah API"}
