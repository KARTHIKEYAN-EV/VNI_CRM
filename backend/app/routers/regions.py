from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth.dependencies import CurrentUser, RequireAdmin
from ..database import get_db
from ..models import Region
from ..schemas.master import (
    PaginatedResponse,
    RegionCreate,
    RegionResponse,
    RegionUpdate,
)
from ..utils.pagination import Pagination

router = APIRouter(prefix="/regions", tags=["Regions"])


@router.get("", response_model=PaginatedResponse[RegionResponse])
def list_regions(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    search:       Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(True),
):
    q = db.query(Region)
    if is_active is not None:
        q = q.filter(Region.is_active == is_active)
    if search:
        q = q.filter(Region.region_name.ilike(f"%{search}%"))

    total = q.count()
    items = q.order_by(Region.region_name).offset(pagination.offset).limit(pagination.page_size).all()
    return PaginatedResponse.build(
        items     = [RegionResponse.model_validate(r) for r in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.get("/all", response_model=List[RegionResponse])
def list_all_regions(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    """Unpaginated — used for dropdowns."""
    regions = db.query(Region).filter(Region.is_active == True).order_by(Region.region_name).all()
    return [RegionResponse.model_validate(r) for r in regions]


@router.post("", response_model=RegionResponse, status_code=status.HTTP_201_CREATED)
def create_region(
    payload:      RegionCreate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    region = Region(
        **payload.model_dump(),
        created_by = current_user.user_id,
        updated_by = current_user.user_id,
    )
    db.add(region)
    db.commit()
    db.refresh(region)
    return RegionResponse.model_validate(region)


@router.get("/{region_id}", response_model=RegionResponse)
def get_region(
    region_id:    int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    region = db.query(Region).filter(Region.region_id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    return RegionResponse.model_validate(region)


@router.put("/{region_id}", response_model=RegionResponse)
def update_region(
    region_id:    int,
    payload:      RegionUpdate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    region = db.query(Region).filter(Region.region_id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(region, field, value)
    region.updated_by = current_user.user_id
    db.commit()
    db.refresh(region)
    return RegionResponse.model_validate(region)


@router.delete("/{region_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_region(
    region_id:    int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    region = db.query(Region).filter(Region.region_id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    region.is_active  = False
    region.updated_by = current_user.user_id
    db.commit()
