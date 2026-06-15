from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireAdmin, RequireRep
from ..database import get_db
from ..models import College, Department
from ..models.master import Course, Subject
from ..schemas.academic import (
    CourseBrief,
    CourseCreate,
    CourseResponse,
    CourseUpdate,
)
from ..schemas.master import CollegeBrief, DeptBrief, PaginatedResponse
from ..utils.pagination import Pagination

router = APIRouter(prefix="/courses", tags=["Academic — Courses"])


def _load(db: Session):
    return db.query(Course).options(
        joinedload(Course.department),
        joinedload(Course.college),
    )


def _to_response(c: Course, db: Session) -> CourseResponse:
    subject_count = db.query(func.count(Subject.subject_id)).filter(
        Subject.course_id == c.course_id,
        Subject.is_active == True,
    ).scalar() or 0

    data = CourseResponse.model_validate(c)
    data.subject_count = subject_count
    if c.department:
        data.department = DeptBrief.model_validate(c.department)
    if c.college:
        data.college = CollegeBrief.model_validate(c.college)
    return data


def _get_or_404(db: Session, course_id: int) -> Course:
    c = _load(db).filter(Course.course_id == course_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return c


@router.get("", response_model=PaginatedResponse[CourseResponse])
def list_courses(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    college_id:   Optional[int]  = Query(None),
    dept_id:      Optional[int]  = Query(None),
    course_type:  Optional[str]  = Query(None),
    search:       Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(True),
):
    q = _load(db)
    if is_active is not None:
        q = q.filter(Course.is_active == is_active)
    if college_id:
        q = q.filter(Course.college_id == college_id)
    if dept_id:
        q = q.filter(Course.dept_id == dept_id)
    if course_type:
        q = q.filter(Course.course_type == course_type)
    if search:
        q = q.filter(Course.course_name.ilike(f"%{search}%"))

    total = q.count()
    items = q.order_by(Course.course_name).offset(pagination.offset).limit(pagination.page_size).all()
    return PaginatedResponse.build(
        items     = [_to_response(c, db) for c in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.get("/all", response_model=List[CourseBrief])
def list_all_courses(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    dept_id:      Optional[int] = Query(None),
    college_id:   Optional[int] = Query(None),
):
    """Unpaginated brief list for subject-creation dropdowns."""
    q = db.query(Course).filter(Course.is_active == True)
    if dept_id:
        q = q.filter(Course.dept_id == dept_id)
    if college_id:
        q = q.filter(Course.college_id == college_id)
    return [CourseBrief.model_validate(c) for c in q.order_by(Course.course_name).all()]


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    payload:      CourseCreate,
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

    course = Course(
        **payload.model_dump(),
        created_by = current_user.user_id,
        updated_by = current_user.user_id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return _to_response(course, db)


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id:    int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    return _to_response(_get_or_404(db, course_id), db)


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id:    int,
    payload:      CourseUpdate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    course = _get_or_404(db, course_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(course, field, value)
    course.updated_by = current_user.user_id
    db.commit()
    db.refresh(course)
    return _to_response(course, db)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_course(
    course_id:    int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    course = _get_or_404(db, course_id)
    course.is_active  = False
    course.updated_by = current_user.user_id
    db.commit()
