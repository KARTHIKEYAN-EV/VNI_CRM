from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireAdmin, RequireRep
from ..database import get_db
from ..models import College, Region
from ..models.history import MasterDataReview
from ..schemas.master import (
    CollegeBrief,
    CollegeCreate,
    CollegeResponse,
    CollegeUpdate,
    DuplicateCheckResponse,
    PaginatedResponse,
    RegionBrief,
)
from ..utils.fuzzy import check_college_duplicates, search_colleges
from ..utils.pagination import Pagination

router = APIRouter(prefix="/colleges", tags=["Colleges"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load(db: Session) -> "Query":
    return db.query(College).options(joinedload(College.region))


def _to_response(college: College) -> CollegeResponse:
    data = CollegeResponse.model_validate(college)
    if college.region:
        data.region = RegionBrief.model_validate(college.region)
    return data


def _get_or_404(db: Session, college_id: int) -> College:
    college = _load(db).filter(College.college_id == college_id).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
    return college


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=PaginatedResponse[CollegeResponse])
def list_colleges(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    search:       Optional[str]  = Query(None, description="Filter by name (ILIKE)"),
    region_id:    Optional[int]  = Query(None),
    college_type: Optional[str]  = Query(None),
    dq_flag:      Optional[str]  = Query(None, description="VERIFIED or PENDING_REVIEW"),
    is_active:    Optional[bool] = Query(True),
):
    q = _load(db)
    if is_active is not None:
        q = q.filter(College.is_active == is_active)
    if search:
        q = q.filter(College.college_name.ilike(f"%{search}%"))
    if region_id:
        q = q.filter(College.region_id == region_id)
    if college_type:
        q = q.filter(College.college_type == college_type)
    if dq_flag:
        q = q.filter(College.data_quality_flag == dq_flag)

    total = q.count()
    items = (
        q.order_by(College.college_name)
        .offset(pagination.offset)
        .limit(pagination.page_size)
        .all()
    )
    return PaginatedResponse.build(
        items     = [_to_response(c) for c in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.get("/all", response_model=List[CollegeBrief])
def list_all_colleges(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    region_id:    Optional[int] = Query(None),
):
    """Unpaginated brief list — used for dropdowns."""
    q = db.query(College).filter(College.is_active == True)
    if region_id:
        q = q.filter(College.region_id == region_id)
    colleges = q.order_by(College.college_name).all()
    return [CollegeBrief.model_validate(c) for c in colleges]


@router.get("/search", response_model=List[CollegeResponse])
def fuzzy_search_colleges(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    q:            str = Query(..., min_length=2, description="Search term"),
    limit:        int = Query(20, ge=1, le=50),
):
    """Trigram-based fuzzy search for typeahead."""
    results = search_colleges(db, q, limit)
    return [_to_response(c) for c in results]


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate(
    payload:      CollegeCreate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    """
    Call before creating a new college to surface potential duplicates.
    Returns warnings only — never blocks creation (Constitution §10.2).
    """
    return check_college_duplicates(
        db,
        college_name = payload.college_name,
        city         = payload.address_city,
    )


@router.post("", response_model=CollegeResponse, status_code=status.HTTP_201_CREATED)
def create_college(
    payload:      CollegeCreate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    if not db.query(Region).filter(Region.region_id == payload.region_id,
                                    Region.is_active == True).first():
        raise HTTPException(status_code=404, detail="Region not found")

    # Admins create VERIFIED records; field roles → PENDING_REVIEW (Constitution §10.1)
    dq_flag = "VERIFIED" if current_user.role == "admin" else "PENDING_REVIEW"

    college = College(
        **payload.model_dump(),
        data_quality_flag = dq_flag,
        created_by        = current_user.user_id,
        updated_by        = current_user.user_id,
    )
    db.add(college)
    db.commit()
    db.refresh(college)
    return _to_response(college)


@router.get("/{college_id}", response_model=CollegeResponse)
def get_college(
    college_id:   int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    return _to_response(_get_or_404(db, college_id))


@router.put("/{college_id}", response_model=CollegeResponse)
def update_college(
    college_id:   int,
    payload:      CollegeUpdate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    college = _get_or_404(db, college_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(college, field, value)
    college.updated_by = current_user.user_id
    db.commit()
    db.refresh(college)
    return _to_response(college)


@router.delete("/{college_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_college(
    college_id:   int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    college = _get_or_404(db, college_id)
    college.is_active  = False
    college.updated_by = current_user.user_id
    db.commit()


@router.patch("/{college_id}/approve", response_model=CollegeResponse)
def approve_college(
    college_id:   int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    """Approve a PENDING_REVIEW college → sets flag to VERIFIED and logs to H_MASTER_DATA_REVIEW."""
    college = _get_or_404(db, college_id)
    if college.data_quality_flag == "VERIFIED":
        raise HTTPException(status_code=400, detail="College is already VERIFIED")

    college.data_quality_flag = "VERIFIED"
    college.updated_by        = current_user.user_id

    db.add(MasterDataReview(
        entity_type = "college",
        entity_id   = college_id,
        action_taken = "approved",
        reviewed_by  = current_user.user_id,
    ))
    db.commit()
    db.refresh(college)
    return _to_response(college)


@router.patch("/{college_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_college(
    college_id:   int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
    notes:        Optional[str] = Query(None),
):
    """Reject a PENDING_REVIEW college — deactivates it and logs the decision."""
    college = _get_or_404(db, college_id)
    college.is_active  = False
    college.updated_by = current_user.user_id

    db.add(MasterDataReview(
        entity_type  = "college",
        entity_id    = college_id,
        action_taken = "rejected",
        reviewed_by  = current_user.user_id,
        notes        = notes,
    ))
    db.commit()
