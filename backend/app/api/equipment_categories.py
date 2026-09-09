import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.equipment_category import EquipmentCategory
from app.models.user import User
from app.schemas.equipment_category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.api.deps import get_current_user
from app.utils.sanitizer import sanitize_text

router = APIRouter()

@router.get("", response_model=List[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.asset_inventory import AssetInventory
    from sqlalchemy import func
    
    stmt = select(EquipmentCategory).order_by(EquipmentCategory.name)
    result = await db.execute(stmt)
    categories = result.scalars().all()
    
    if categories:
        count_stmt = select(
            AssetInventory.category_id, 
            func.count(AssetInventory.id)
        ).where(AssetInventory.status == 'available').group_by(AssetInventory.category_id)
        
        c_res = await db.execute(count_stmt)
        counts = dict(c_res.fetchall())
        
        for cat in categories:
            asset_count = counts.get(cat.id, 0)
            setattr(cat, "available_stock", cat.initial_stock + asset_count)
        
    return categories

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(category_in: CategoryCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if name exists
    sanitized_name = sanitize_text(category_in.name)
    existing = await db.execute(select(EquipmentCategory).where(EquipmentCategory.name == sanitized_name))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Category with this name already exists")
        
    db_category = EquipmentCategory(
        name=sanitized_name,
        icon_url=category_in.icon_url,
        color=category_in.color,
        initial_stock=category_in.initial_stock,
        has_id=category_in.has_id
    )
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category

@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: uuid.UUID, category_in: CategoryUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == category_id))
    category = result.scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    if category_in.name is not None:
        sanitized_name = sanitize_text(category_in.name)
        existing = await db.execute(select(EquipmentCategory).where(EquipmentCategory.name == sanitized_name).where(EquipmentCategory.id != category_id))
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Category with this name already exists")
        category.name = sanitized_name
        
    if category_in.icon_url is not None:
        category.icon_url = category_in.icon_url
    if category_in.color is not None:
        category.color = category_in.color
    if hasattr(category_in, 'initial_stock') and category_in.initial_stock is not None:
        category.initial_stock = category_in.initial_stock
    if hasattr(category_in, 'has_id') and category_in.has_id is not None:
        category.has_id = category_in.has_id
        
    await db.commit()
    await db.refresh(category)
    return category

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(EquipmentCategory).where(EquipmentCategory.id == category_id))
    category = result.scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Check if any equipment uses this category (optional, could also be handled by cascade or restricted by DB)
    await db.delete(category)
    await db.commit()
    return None
