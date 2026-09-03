from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from .config import settings

if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_async_engine(settings.DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
else:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)


AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
