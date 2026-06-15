from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireAdmin
from ..database import get_db
from ..models import Author, Book, BookAuthor
from ..schemas.master import (
    AuthorBrief,
    BookCreate,
    BookResponse,
    BookUpdate,
    PaginatedResponse,
)
from ..utils.fuzzy import search_books
from ..utils.pagination import Pagination

router = APIRouter(prefix="/books", tags=["Books"])


def _load(db: Session):
    return db.query(Book).options(
        joinedload(Book.book_authors).joinedload(BookAuthor.author)
    )


def _to_response(book: Book) -> BookResponse:
    data = BookResponse.model_validate(book)
    data.authors = [
        AuthorBrief(
            author_id    = ba.author_id,
            author_name  = ba.author.author_name if ba.author else "Unknown",
            author_order = ba.author_order,
        )
        for ba in sorted(book.book_authors, key=lambda x: x.author_order)
        if ba.author
    ]
    return data


def _get_or_404(db: Session, book_id: int) -> Book:
    book = _load(db).filter(Book.book_id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


def _sync_authors(db: Session, book: Book, author_assignments: list, actor_id: int):
    """Replace all author associations for a book."""
    for ba in book.book_authors:
        db.delete(ba)
    db.flush()
    for assignment in author_assignments:
        author = db.query(Author).filter(
            Author.author_id == assignment.author_id,
            Author.is_active == True,
        ).first()
        if not author:
            raise HTTPException(
                status_code=404,
                detail=f"Author id={assignment.author_id} not found",
            )
        db.add(BookAuthor(
            book_id      = book.book_id,
            author_id    = assignment.author_id,
            author_order = assignment.author_order,
        ))


@router.get("", response_model=PaginatedResponse[BookResponse])
def list_books(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    search:       Optional[str]  = Query(None, description="Filter by title (ILIKE)"),
    discipline:   Optional[str]  = Query(None),
    format_:      Optional[str]  = Query(None, alias="format"),
    is_active:    Optional[bool] = Query(True),
):
    q = _load(db)
    if is_active is not None:
        q = q.filter(Book.is_active == is_active)
    if search:
        q = q.filter(Book.title.ilike(f"%{search}%"))
    if discipline:
        q = q.filter(Book.discipline.ilike(f"%{discipline}%"))
    if format_:
        q = q.filter(Book.format == format_)

    total = q.count()
    items = q.order_by(Book.title).offset(pagination.offset).limit(pagination.page_size).all()
    return PaginatedResponse.build(
        items     = [_to_response(b) for b in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.get("/search", response_model=List[BookResponse])
def fuzzy_search_books(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    q:            str = Query(..., min_length=2, description="Search by title or subject"),
    limit:        int = Query(20, ge=1, le=50),
):
    """
    Trigram-based fuzzy search across title and subject_area.
    Constitution §14.7: 600+ books — search, not scroll.
    """
    results = search_books(db, q, limit)
    return [_to_response(b) for b in results]


@router.post("", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
def create_book(
    payload:      BookCreate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    if payload.isbn:
        if db.query(Book).filter(Book.isbn == payload.isbn).first():
            raise HTTPException(status_code=409, detail="A book with this ISBN already exists")

    authors_data = payload.authors
    book_data    = payload.model_dump(exclude={"authors"})

    book = Book(
        **book_data,
        created_by = current_user.user_id,
        updated_by = current_user.user_id,
    )
    db.add(book)
    db.flush()

    _sync_authors(db, book, authors_data, current_user.user_id)
    db.commit()
    db.refresh(book)
    return _to_response(book)


@router.get("/{book_id}", response_model=BookResponse)
def get_book(
    book_id:      int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    return _to_response(_get_or_404(db, book_id))


@router.put("/{book_id}", response_model=BookResponse)
def update_book(
    book_id:      int,
    payload:      BookUpdate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    book = _get_or_404(db, book_id)

    update_data = payload.model_dump(exclude_none=True, exclude={"authors"})
    for field, value in update_data.items():
        setattr(book, field, value)
    book.updated_by = current_user.user_id

    if payload.authors is not None:
        _sync_authors(db, book, payload.authors, current_user.user_id)

    db.commit()
    db.refresh(book)
    return _to_response(book)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_book(
    book_id:      int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    book = _get_or_404(db, book_id)
    book.is_active  = False
    book.updated_by = current_user.user_id
    db.commit()
