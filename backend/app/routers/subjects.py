from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireAdmin, RequireRep
from ..database import get_db
from ..models.master import (
    Course, Faculty, FacultySubject, Subject, Syllabus,
)
from ..schemas.academic import (
    CourseBrief,
    FacultySubjectAssign,
    FacultySubjectResponse,
    SubjectBrief,
    SubjectCreate,
    SubjectResponse,
    SubjectUpdate,
)
from ..schemas.master import PaginatedResponse
from ..utils.pagination import Pagination

router = APIRouter(prefix="/subjects", tags=["Academic — Subjects"])


def _load(db: Session):
    return db.query(Subject).options(joinedload(Subject.course))


def _to_response(s: Subject, db: Session) -> SubjectResponse:
    syllabus_count = db.query(func.count(Syllabus.syllabus_id)).filter(
        Syllabus.subject_id == s.subject_id,
        Syllabus.is_active == True,
    ).scalar() or 0

    data = SubjectResponse.model_validate(s)
    data.syllabus_count = syllabus_count
    if s.course:
        data.course = CourseBrief.model_validate(s.course)
    return data


def _get_or_404(db: Session, subject_id: int) -> Subject:
    s = _load(db).filter(Subject.subject_id == subject_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    return s


@router.get("", response_model=PaginatedResponse[SubjectResponse])
def list_subjects(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    course_id:    Optional[int]  = Query(None),
    subject_type: Optional[str]  = Query(None),
    search:       Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(True),
):
    q = _load(db)
    if is_active is not None:
        q = q.filter(Subject.is_active == is_active)
    if course_id:
        q = q.filter(Subject.course_id == course_id)
    if subject_type:
        q = q.filter(Subject.subject_type == subject_type)
    if search:
        q = q.filter(Subject.subject_name.ilike(f"%{search}%"))

    total = q.count()
    items = q.order_by(Subject.semester_year, Subject.subject_name)\
             .offset(pagination.offset).limit(pagination.page_size).all()
    return PaginatedResponse.build(
        items     = [_to_response(s, db) for s in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.get("/all", response_model=List[SubjectBrief])
def list_all_subjects(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    course_id:    Optional[int] = Query(None),
):
    """Unpaginated brief list — for comp request line item subject dropdown."""
    q = db.query(Subject).filter(Subject.is_active == True)
    if course_id:
        q = q.filter(Subject.course_id == course_id)
    return [SubjectBrief.model_validate(s) for s in q.order_by(Subject.subject_name).all()]


@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload:      SubjectCreate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    if not db.query(Course).filter(Course.course_id == payload.course_id,
                                    Course.is_active == True).first():
        raise HTTPException(status_code=404, detail="Course not found")

    subject = Subject(
        **payload.model_dump(),
        created_by = current_user.user_id,
        updated_by = current_user.user_id,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return _to_response(subject, db)


@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id:   int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    return _to_response(_get_or_404(db, subject_id), db)


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id:   int,
    payload:      SubjectUpdate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    s = _get_or_404(db, subject_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(s, field, value)
    s.updated_by = current_user.user_id
    db.commit()
    db.refresh(s)
    return _to_response(s, db)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_subject(
    subject_id:   int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    s = _get_or_404(db, subject_id)
    s.is_active  = False
    s.updated_by = current_user.user_id
    db.commit()


# ---------------------------------------------------------------------------
# Faculty ↔ Subject assignments (nested under /subjects)
# ---------------------------------------------------------------------------

@router.get("/{subject_id}/faculty", response_model=List[FacultySubjectResponse])
def list_subject_faculty(
    subject_id:   int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    """List all faculty assigned to teach this subject."""
    _get_or_404(db, subject_id)
    rows = (
        db.query(FacultySubject)
        .options(joinedload(FacultySubject.faculty), joinedload(FacultySubject.subject))
        .filter(FacultySubject.subject_id == subject_id)
        .all()
    )
    return [
        FacultySubjectResponse(
            id            = r.id,
            faculty_id    = r.faculty_id,
            faculty_name  = r.faculty.faculty_name if r.faculty else None,
            subject_id    = r.subject_id,
            subject_name  = r.subject.subject_name if r.subject else None,
            academic_year = r.academic_year,
        )
        for r in rows
    ]


@router.post("/faculty-assignments", response_model=FacultySubjectResponse,
             status_code=status.HTTP_201_CREATED)
def assign_faculty_to_subject(
    payload:      FacultySubjectAssign,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    """Assign a faculty member to a subject for a given academic year."""
    faculty = db.query(Faculty).filter(Faculty.faculty_id == payload.faculty_id,
                                        Faculty.is_active == True).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    subject = db.query(Subject).filter(Subject.subject_id == payload.subject_id,
                                        Subject.is_active == True).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    existing = db.query(FacultySubject).filter(
        FacultySubject.faculty_id    == payload.faculty_id,
        FacultySubject.subject_id    == payload.subject_id,
        FacultySubject.academic_year == payload.academic_year,
    ).first()
    if existing:
        raise HTTPException(status_code=409,
                            detail="This faculty-subject-year combination already exists")

    row = FacultySubject(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return FacultySubjectResponse(
        id            = row.id,
        faculty_id    = row.faculty_id,
        faculty_name  = faculty.faculty_name,
        subject_id    = row.subject_id,
        subject_name  = subject.subject_name,
        academic_year = row.academic_year,
    )


@router.delete("/faculty-assignments/{assignment_id}",
               status_code=status.HTTP_204_NO_CONTENT)
def remove_faculty_assignment(
    assignment_id: int,
    current_user:  RequireRep,
    db:            Annotated[Session, Depends(get_db)],
):
    row = db.query(FacultySubject).filter(FacultySubject.id == assignment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(row)
    db.commit()
