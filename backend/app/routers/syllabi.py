from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireAdmin, RequireRep
from ..database import get_db
from ..models.master import (
    Book, BookAuthor, Author, Subject, Syllabus, SyllabusBook,
)
from ..schemas.academic import (
    SubjectBrief,
    SyllabusBookAssign,
    SyllabusBookEntry,
    SyllabusCreate,
    SyllabusResponse,
    SyllabusUpdate,
)
from ..schemas.master import AuthorBrief, PaginatedResponse
from ..utils.pagination import Pagination

router = APIRouter(prefix="/syllabi", tags=["Academic — Syllabi"])


def _load(db: Session):
    return db.query(Syllabus).options(
        joinedload(Syllabus.subject),
        joinedload(Syllabus.syllabus_books).joinedload(SyllabusBook.book)
            .joinedload(Book.book_authors).joinedload(BookAuthor.author),
    )


def _to_response(s: Syllabus) -> SyllabusResponse:
    data = SyllabusResponse.model_validate(s)

    if s.subject:
        data.subject = SubjectBrief.model_validate(s.subject)

    data.books = [
        SyllabusBookEntry(
            id         = sb.id,
            book_id    = sb.book_id,
            book_title = sb.book.title if sb.book else "Unknown",
            book_role  = sb.book_role,
            authors    = [
                AuthorBrief(
                    author_id    = ba.author_id,
                    author_name  = ba.author.author_name if ba.author else "Unknown",
                    author_order = ba.author_order,
                )
                for ba in sorted(sb.book.book_authors, key=lambda x: x.author_order)
                if sb.book and ba.author
            ] if sb.book else [],
        )
        for sb in s.syllabus_books
    ]
    return data


def _get_or_404(db: Session, syllabus_id: int) -> Syllabus:
    s = _load(db).filter(Syllabus.syllabus_id == syllabus_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    return s


@router.get("", response_model=PaginatedResponse[SyllabusResponse])
def list_syllabi(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    subject_id:   Optional[int]  = Query(None),
    university:   Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(True),
):
    q = _load(db)
    if is_active is not None:
        q = q.filter(Syllabus.is_active == is_active)
    if subject_id:
        q = q.filter(Syllabus.subject_id == subject_id)
    if university:
        q = q.filter(Syllabus.university.ilike(f"%{university}%"))

    total = q.count()
    items = (
        q.order_by(Syllabus.university, Syllabus.regulation_year)
        .offset(pagination.offset).limit(pagination.page_size).all()
    )
    return PaginatedResponse.build(
        items     = [_to_response(s) for s in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.post("", response_model=SyllabusResponse, status_code=status.HTTP_201_CREATED)
def create_syllabus(
    payload:      SyllabusCreate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    if not db.query(Subject).filter(Subject.subject_id == payload.subject_id,
                                     Subject.is_active == True).first():
        raise HTTPException(status_code=404, detail="Subject not found")

    # Check unique constraint
    existing = db.query(Syllabus).filter(
        Syllabus.subject_id      == payload.subject_id,
        Syllabus.university      == payload.university,
        Syllabus.regulation_year == payload.regulation_year,
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Syllabus already exists for this subject / university / regulation year",
        )

    # Serialise unit_breakdown list → plain dicts for JSONB
    unit_data = (
        [u.model_dump() for u in payload.unit_breakdown]
        if payload.unit_breakdown else None
    )

    syllabus = Syllabus(
        subject_id         = payload.subject_id,
        university         = payload.university,
        regulation_year    = payload.regulation_year,
        unit_breakdown     = unit_data,
        last_verified_date = payload.last_verified_date,
        source_notes       = payload.source_notes,
        created_by         = current_user.user_id,
        updated_by         = current_user.user_id,
    )
    db.add(syllabus)
    db.commit()
    db.refresh(syllabus)
    return _to_response(syllabus)


@router.get("/{syllabus_id}", response_model=SyllabusResponse)
def get_syllabus(
    syllabus_id:  int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    return _to_response(_get_or_404(db, syllabus_id))


@router.put("/{syllabus_id}", response_model=SyllabusResponse)
def update_syllabus(
    syllabus_id:  int,
    payload:      SyllabusUpdate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    s = _get_or_404(db, syllabus_id)
    update_data = payload.model_dump(exclude_none=True)

    # Serialise unit_breakdown if provided
    if "unit_breakdown" in update_data and update_data["unit_breakdown"] is not None:
        update_data["unit_breakdown"] = [
            u.model_dump() if hasattr(u, "model_dump") else u
            for u in update_data["unit_breakdown"]
        ]

    for field, value in update_data.items():
        setattr(s, field, value)
    s.updated_by = current_user.user_id
    db.commit()
    db.refresh(s)
    return _to_response(s)


@router.delete("/{syllabus_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_syllabus(
    syllabus_id:  int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    s = _get_or_404(db, syllabus_id)
    s.is_active  = False
    s.updated_by = current_user.user_id
    db.commit()


# ---------------------------------------------------------------------------
# Book assignments for a syllabus
# ---------------------------------------------------------------------------

@router.post("/{syllabus_id}/books", response_model=SyllabusResponse,
             status_code=status.HTTP_201_CREATED)
def assign_book(
    syllabus_id:  int,
    payload:      SyllabusBookAssign,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    """Assign a book (Prescribed or Reference) to this syllabus."""
    s = _get_or_404(db, syllabus_id)

    book = db.query(Book).filter(Book.book_id == payload.book_id,
                                  Book.is_active == True).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    existing = db.query(SyllabusBook).filter(
        SyllabusBook.syllabus_id == syllabus_id,
        SyllabusBook.book_id     == payload.book_id,
    ).first()
    if existing:
        # Update role if different
        existing.book_role = payload.book_role
    else:
        db.add(SyllabusBook(
            syllabus_id = syllabus_id,
            book_id     = payload.book_id,
            book_role   = payload.book_role,
        ))

    s.updated_by = current_user.user_id
    db.commit()
    db.refresh(s)
    return _to_response(s)


@router.delete("/{syllabus_id}/books/{book_id}",
               status_code=status.HTTP_204_NO_CONTENT)
def remove_book(
    syllabus_id:  int,
    book_id:      int,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    """Remove a book assignment from this syllabus."""
    row = db.query(SyllabusBook).filter(
        SyllabusBook.syllabus_id == syllabus_id,
        SyllabusBook.book_id     == book_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Book not assigned to this syllabus")
    db.delete(row)
    db.commit()
