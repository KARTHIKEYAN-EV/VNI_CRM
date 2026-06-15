from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireAdmin, RequireRep
from ..database import get_db
from ..models import College, Department
from ..schemas.master import (
    CollegeBrief,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DeptBrief,
    PaginatedResponse,
)
from ..utils.pagination import Pagination

router = APIRouter(prefix="/departments", tags=["Departments"])


def _load(db: Session):
    return db.query(Department).options(joinedload(Department.college))


def _to_response(dept: Department) -> DepartmentResponse:
    data = DepartmentResponse.model_validate(dept)
    if dept.college:
        data.college = CollegeBrief.model_validate(dept.college)
    return data


def _get_or_404(db: Session, dept_id: int) -> Department:
    dept = _load(db).filter(Department.dept_id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@router.get("", response_model=PaginatedResponse[DepartmentResponse])
def list_departments(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    college_id:   Optional[int]  = Query(None),
    search:       Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(True),
):
    q = _load(db)
    if is_active is not None:
        q = q.filter(Department.is_active == is_active)
    if college_id:
        q = q.filter(Department.college_id == college_id)
    if search:
        q = q.filter(Department.dept_name.ilike(f"%{search}%"))

    total = q.count()
    items = (
        q.order_by(Department.dept_name)
        .offset(pagination.offset)
        .limit(pagination.page_size)
        .all()
    )
    return PaginatedResponse.build(
        items     = [_to_response(d) for d in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.get("/all", response_model=List[DeptBrief])
def list_all_departments(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    college_id:   Optional[int] = Query(None),
):
    """Unpaginated brief list for dropdowns — filter by college."""
    q = db.query(Department).filter(Department.is_active == True)
    if college_id:
        q = q.filter(Department.college_id == college_id)
    depts = q.order_by(Department.dept_name).all()
    return [DeptBrief.model_validate(d) for d in depts]


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    payload:      DepartmentCreate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    if not db.query(College).filter(College.college_id == payload.college_id,
                                     College.is_active == True).first():
        raise HTTPException(status_code=404, detail="College not found")

    dept = Department(
        **payload.model_dump(),
        created_by = current_user.user_id,
        updated_by = current_user.user_id,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return _to_response(dept)


@router.get("/{dept_id}", response_model=DepartmentResponse)
def get_department(
    dept_id:      int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    return _to_response(_get_or_404(db, dept_id))


@router.put("/{dept_id}", response_model=DepartmentResponse)
def update_department(
    dept_id:      int,
    payload:      DepartmentUpdate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    dept = _get_or_404(db, dept_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(dept, field, value)
    dept.updated_by = current_user.user_id
    db.commit()
    db.refresh(dept)
    return _to_response(dept)


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_department(
    dept_id:      int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    dept = _get_or_404(db, dept_id)
    dept.is_active  = False
    dept.updated_by = current_user.user_id
    db.commit()
