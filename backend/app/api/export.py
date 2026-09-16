import uuid
from typing import Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.equipment import Equipment
from app.models.floor import Floor
from app.models.user import User
from app.models.inventory_history_log import InventoryHistoryLog
from app.api.deps import get_current_user
from app.services.export_service import (
    generate_csv,
    generate_pdf,
    generate_history_csv,
    generate_history_pdf,
    generate_history_xlsx,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
#  Export Riwayat (History Log) — CSV / PDF / XLSX dengan filter
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/export/history")
async def export_history(
    format: str = Query("csv", regex="^(csv|pdf|xlsx)$"),
    building: Optional[str] = Query(None),
    floor: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    condition: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_start: Optional[date] = Query(None),
    date_end: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export riwayat log ke CSV, PDF, atau XLSX.
    Filter yang tersedia: building, floor, category_id, condition, search, date_start, date_end.
    Export mengikuti hasil filter yang aktif.
    """
    # ── Query dasar ─────────────────────────────────────────────────────────
    query = (
        select(InventoryHistoryLog)
        .options(selectinload(InventoryHistoryLog.category))
        .order_by(InventoryHistoryLog.created_at.desc())
    )

    # ── Filter tanggal (created_at) ─────────────────────────────────────────
    if date_start:
        dt_start = datetime.combine(date_start, datetime.min.time())
        query = query.where(InventoryHistoryLog.created_at >= dt_start)
    if date_end:
        dt_end = datetime.combine(date_end, datetime.max.time().replace(microsecond=0))
        query = query.where(InventoryHistoryLog.created_at <= dt_end)

    # ── Filter lainnya (dilakukan di DB untuk efisiensi) ───────────────────
    if building and building != "all":
        query = query.where(InventoryHistoryLog.building_name == building)
    if floor and floor != "all":
        query = query.where(InventoryHistoryLog.floor_name == floor)
    if category_id and category_id != "all":
        try:
            cat_uuid = uuid.UUID(category_id)
            query = query.where(InventoryHistoryLog.category_id == cat_uuid)
        except ValueError:
            pass

    result = await db.execute(query)
    logs = result.scalars().all()

    # ── Filter kondisi & search (lebih fleksibel di Python) ─────────────────
    if condition and condition != "all":
        cond_lower = condition.lower()
        logs = [
            log for log in logs
            if cond_lower in (log.status or log.action_type or "").lower()
        ]
    if search and search.strip():
        q = search.strip().lower()
        logs = [
            log for log in logs
            if any(
                q in (getattr(log, field) or "").lower()
                for field in [
                    "building_name", "floor_name", "room_name",
                    "slot_code", "asset_id", "brand", "model_number",
                    "status", "action_type",
                ]
            ) or q in (log.category.name if log.category else "").lower()
        ]

    # ── Generate & return file ───────────────────────────────────────────────
    now_str = datetime.now().strftime("%Y%m%d_%H%M")
    title = "Riwayat Data Barang — Spil Denah"

    if format == "csv":
        content = generate_history_csv(logs)
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=history_{now_str}.csv"},
        )
    elif format == "xlsx":
        content = generate_history_xlsx(logs, title=title)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=history_{now_str}.xlsx"},
        )
    else:  # pdf
        content = generate_history_pdf(logs, title=title)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=history_{now_str}.pdf"},
        )


# ─────────────────────────────────────────────────────────────────────────────
#  Legacy Equipment Export (dipertahankan)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/export/equipments")
async def export_all_equipments(
    format: str = Query("csv", regex="^(csv|pdf)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
            headers={"Content-Disposition": "attachment; filename=equipments_export.csv"},
        )
    else:
        pdf_bytes = generate_pdf(equipments, title="All Equipment Report")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=equipments_export.pdf"},
        )


@router.get("/export/floor/{floor_id}")
async def export_floor_equipments(
    floor_id: uuid.UUID,
    format: str = Query("csv", regex="^(csv|pdf)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
            headers={"Content-Disposition": f"attachment; filename=floor_{floor.name}_export.csv"},
        )
    else:
        pdf_bytes = generate_pdf(equipments, title=f"Equipment Report - {floor.name}")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=floor_{floor.name}_export.pdf"},
        )
