from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth.dependencies import CurrentUser, RequireAdmin
from ..database import get_db
from ..models import Author
from ..schemas.master import (
    AuthorBrief,
    AuthorCreate,
    AuthorResponse,
    AuthorUpdate,
    PaginatedResponse,
)
from ..utils.pagination import Pagination

router = APIRouter(prefix="/authors", tags=["Authors"])


@router.get("", response_model=PaginatedResponse[AuthorResponse])
def list_authors(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    search:       Optional[str]  = Query(None),
    is_active:    Optional[bool] = Query(True),
):
    q = db.query(Author)
    if is_active is not None:
        q = q.filter(Author.is_active == is_active)
    if search:
        q = q.filter(Author.author_name.ilike(f"%{search}%"))

    total = q.count()
    items = q.order_by(Author.author_name).offset(pagination.offset).limit(pagination.page_size).all()
    return PaginatedResponse.build(
        items     = [AuthorResponse.model_validate(a) for a in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.get("/all", response_model=List[AuthorBrief])
def list_all_authors(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    """Unpaginated — for book author assignment dropdowns."""
    authors = db.query(Author).filter(Author.is_active == True).order_by(Author.author_name).all()
    return [AuthorBrief.model_validate(a) for a in authors]


@router.post("", response_model=AuthorResponse, status_code=status.HTTP_201_CREATED)
def create_author(
    payload:      AuthorCreate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    author = Author(
        **payload.model_dump(),
        created_by = current_user.user_id,
        updated_by = current_user.user_id,
    )
    db.add(author)
    db.commit()
    db.refresh(author)
    return AuthorResponse.model_validate(author)


@router.get("/{author_id}", response_model=AuthorResponse)
def get_author(
    author_id:    int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    author = db.query(Author).filter(Author.author_id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    return AuthorResponse.model_validate(author)


@router.put("/{author_id}", response_model=AuthorResponse)
def update_author(
    author_id:    int,
    payload:      AuthorUpdate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    author = db.query(Author).filter(Author.author_id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(author, field, value)
    author.updated_by = current_user.user_id
    db.commit()
    db.refresh(author)
    return AuthorResponse.model_validate(author)


@router.delete("/{author_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_author(
    author_id:    int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    author = db.query(Author).filter(Author.author_id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    author.is_active  = False
    author.updated_by = current_user.user_id
    db.commit()
