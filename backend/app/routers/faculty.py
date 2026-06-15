from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireAdmin, RequireRep
from ..database import get_db
from ..models import College, Department, Faculty
from ..models.history import MasterDataReview
from ..schemas.master import (
    CollegeBrief,
    DeptBrief,
    DuplicateCheckResponse,
    FacultyCreate,
    FacultyResponse,
    FacultyUpdate,
    PaginatedResponse,
)
from ..utils.fuzzy import check_faculty_duplicates, search_faculty
from ..utils.pagination import Pagination

router = APIRouter(prefix="/faculty", tags=["Faculty"])


def _load(db: Session):
    return db.query(Faculty).options(
        joinedload(Faculty.college),
        joinedload(Faculty.department),
    )


def _to_response(f: Faculty) -> FacultyResponse:
    data = FacultyResponse.model_validate(f)
    if f.college:
        data.college    = CollegeBrief.model_validate(f.college)
    if f.department:
        data.department = DeptBrief.model_validate(f.department)
    return data


def _get_or_404(db: Session, faculty_id: int) -> Faculty:
    f = _load(db).filter(Faculty.faculty_id == faculty_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faculty member not found")
    return f


@router.get("", response_model=PaginatedResponse[FacultyResponse])
def list_faculty(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    search:       Optional[str]  = Query(None),
    college_id:   Optional[int]  = Query(None),
    dept_id:      Optional[int]  = Query(None),
    dq_flag:      Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(True),
):
    q = _load(db)
    if is_active is not None:
        q = q.filter(Faculty.is_active == is_active)
    if search:
        q = q.filter(Faculty.faculty_name.ilike(f"%{search}%"))
    if college_id:
        q = q.filter(Faculty.college_id == college_id)
    if dept_id:
        q = q.filter(Faculty.dept_id == dept_id)
    if dq_flag:
        q = q.filter(Faculty.data_quality_flag == dq_flag)

    total = q.count()
    items = (
        q.order_by(Faculty.faculty_name)
        .offset(pagination.offset)
        .limit(pagination.page_size)
        .all()
    )
    return PaginatedResponse.build(
        items     = [_to_response(f) for f in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.get("/search", response_model=List[FacultyResponse])
def fuzzy_search_faculty(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    q:            str          = Query(..., min_length=2),
    college_id:   Optional[int] = Query(None),
    limit:        int          = Query(20, ge=1, le=50),
):
    results = search_faculty(db, q, college_id=college_id, limit=limit)
    return [_to_response(f) for f in results]


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate(
    payload:      FacultyCreate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    return check_faculty_duplicates(
        db,
        faculty_name = payload.faculty_name,
        college_id   = payload.college_id,
    )


@router.post("", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
def create_faculty(
    payload:      FacultyCreate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    if not db.query(College).filter(College.college_id == payload.college_id,
                                     College.is_active == True).first():
        raise HTTPException(status_code=404, detail="College not found")
    if not db.query(Department).filter(Department.dept_id == payload.dept_id,
                                        Department.college_id == payload.college_id,
                                        Department.is_active == True).first():
        raise HTTPException(status_code=404, detail="Department not found in this college")

    dq_flag = "VERIFIED" if current_user.role == "admin" else "PENDING_REVIEW"

    faculty = Faculty(
        **payload.model_dump(),
        data_quality_flag = dq_flag,
        created_by        = current_user.user_id,
        updated_by        = current_user.user_id,
    )
    db.add(faculty)
    db.commit()
    db.refresh(faculty)
    return _to_response(faculty)


@router.get("/{faculty_id}", response_model=FacultyResponse)
def get_faculty(
    faculty_id:   int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    return _to_response(_get_or_404(db, faculty_id))


@router.put("/{faculty_id}", response_model=FacultyResponse)
def update_faculty(
    faculty_id:   int,
    payload:      FacultyUpdate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    f = _get_or_404(db, faculty_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(f, field, value)
    f.updated_by = current_user.user_id
    db.commit()
    db.refresh(f)
    return _to_response(f)


@router.delete("/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_faculty(
    faculty_id:   int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    f = _get_or_404(db, faculty_id)
    f.is_active  = False
    f.updated_by = current_user.user_id
    db.commit()


@router.patch("/{faculty_id}/approve", response_model=FacultyResponse)
def approve_faculty(
    faculty_id:   int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    f = _get_or_404(db, faculty_id)
    if f.data_quality_flag == "VERIFIED":
        raise HTTPException(status_code=400, detail="Faculty is already VERIFIED")

    f.data_quality_flag = "VERIFIED"
    f.updated_by        = current_user.user_id
    db.add(MasterDataReview(
        entity_type  = "faculty",
        entity_id    = faculty_id,
        action_taken = "approved",
        reviewed_by  = current_user.user_id,
    ))
    db.commit()
    db.refresh(f)
    return _to_response(f)


@router.patch("/{faculty_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_faculty(
    faculty_id:   int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
    notes:        Optional[str] = Query(None),
):
    f = _get_or_404(db, faculty_id)
    f.is_active  = False
    f.updated_by = current_user.user_id
    db.add(MasterDataReview(
        entity_type  = "faculty",
        entity_id    = faculty_id,
        action_taken = "rejected",
        reviewed_by  = current_user.user_id,
        notes        = notes,
    ))
    db.commit()
