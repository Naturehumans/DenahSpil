import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.equipment import Equipment
from app.models.floor import Floor
from app.models.user import User
from app.api.deps import get_current_user
from app.services.export_service import generate_csv, generate_pdf

router = APIRouter()

@router.get("/export/equipments")
async def export_all_equipments(
    format: str = Query("csv", regex="^(csv|pdf)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Equipment)
        .options(selectinload(Equipment.category), selectinload(Equipment.floor))
    )
    equipments = result.scalars().all()
    
    if format == "csv":
        csv_bytes = generate_csv(equipments)
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=equipments_export.csv"}
        )
    else:
        pdf_bytes = generate_pdf(equipments, title="All Equipment Report")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=equipments_export.pdf"}
        )

@router.get("/export/floor/{floor_id}")
async def export_floor_equipments(
    floor_id: uuid.UUID,
    format: str = Query("csv", regex="^(csv|pdf)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    f_res = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = f_res.scalars().first()
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
        
    result = await db.execute(
        select(Equipment)
        .where(Equipment.floor_id == floor_id)
        .options(selectinload(Equipment.category), selectinload(Equipment.floor))
    )
    equipments = result.scalars().all()
    
    if format == "csv":
        csv_bytes = generate_csv(equipments)
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=floor_{floor.name}_export.csv"}
        )
    else:
        pdf_bytes = generate_pdf(equipments, title=f"Equipment Report - {floor.name}")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=floor_{floor.name}_export.pdf"}
        )
