from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from sqlalchemy.orm import selectinload
from typing import List

from app.models.equipment import Equipment

def compute_expiry_date(installation_date: date, lifespan_months: int) -> date:
    return installation_date + relativedelta(months=lifespan_months)

def compute_status(expiry_date: date) -> str:
    today = date.today()
    days_remaining = (expiry_date - today).days
    
    if days_remaining < 0:
        return 'expired'
    elif days_remaining <= 30:
        return 'warning'
    else:
        return 'active'

async def get_expiring_equipments(db: AsyncSession, days: int) -> List[Equipment]:
    today = date.today()
    warning_date = today + relativedelta(days=days)
    
    result = await db.execute(
        select(Equipment)
        .options(selectinload(Equipment.category), selectinload(Equipment.floor))
        .where(Equipment.expiry_date <= warning_date)
        .where(Equipment.status != 'replaced')
        .order_by(Equipment.expiry_date.asc())
    )
    return result.scalars().all()

async def get_equipment_stats(db: AsyncSession) -> dict:
    result = await db.execute(
        select(
            func.count(Equipment.id).label("total"),
            func.sum(case((Equipment.status == 'active', 1), else_=0)).label("active"),
            func.sum(case((Equipment.status == 'warning', 1), else_=0)).label("warning"),
            func.sum(case((Equipment.status == 'expired', 1), else_=0)).label("expired")
        )
    )
    stats = result.mappings().first()
    return dict(stats) if stats else {"total": 0, "active": 0, "warning": 0, "expired": 0}
