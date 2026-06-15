import logging
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireRep
from ..database import get_db
from ..models.master import Book, BookAuthor, Author, Faculty, Subject
from ..models.transaction import CompRequest, CompRequestBook, NewRequestToken
from ..models.history import RequestAudit
from ..schemas.new_request_token import (
    FacultyNewRequestResult,
    FacultyNewRequestSubmit,
    NewRequestLineItem,
    NewRequestTokenResponse,
    PublicBookSearchItem,
    PublicNewRequestFormData,
    SendNewRequestTokenRequest,
)
from ..utils.audit import log_status_change
from ..utils.config import get_config_int

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Two routers:
#   router        — authenticated (prefix="/new-request-tokens", mounted in main.py)
#   public_router — no auth     (prefix="/public",               mounted in main.py)
# ---------------------------------------------------------------------------
router        = APIRouter(prefix="/new-request-tokens", tags=["New Request Tokens"])
public_router = APIRouter(prefix="/public",             tags=["Public — Faculty New Request Form"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_expires(db: Session) -> datetime:
    hours = get_config_int(db, "token_expiry_hours", 72)
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def _normalize_tz(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (UTC) regardless of DB driver behaviour."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _get_faculty_or_404(db: Session, faculty_id: int) -> Faculty:
    f = (
        db.query(Faculty)
        .options(
            joinedload(Faculty.college),
            joinedload(Faculty.department),
        )
        .filter(Faculty.faculty_id == faculty_id, Faculty.is_active == True)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    return f


def _get_token_or_404(db: Session, token_hash: str) -> NewRequestToken:
    t = (
        db.query(NewRequestToken)
        .options(
            joinedload(NewRequestToken.rep),
            joinedload(NewRequestToken.faculty)
                .joinedload(Faculty.college),
            joinedload(NewRequestToken.faculty)
                .joinedload(Faculty.department),
        )
        .filter(NewRequestToken.token_hash == token_hash,
                NewRequestToken.is_active  == True)
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Form link is invalid or has been revoked")
    return t


def _book_to_public(book: Book) -> PublicBookSearchItem:
    authors_str = ", ".join(
        ba.author.author_name
        for ba in sorted(book.book_authors, key=lambda x: x.author_order)
        if ba.author
    )
    return PublicBookSearchItem(
        book_id      = book.book_id,
        title        = book.title,
        authors      = authors_str,
        edition      = book.edition,
        subject_area = book.subject_area,
        mrp          = book.mrp,
        format       = book.format,
    )


# ---------------------------------------------------------------------------
# Authenticated endpoints
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=NewRequestTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_request_token(
    payload:      SendNewRequestTokenRequest,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    """
    Rep sends a blank form link to a specific faculty member.
    Faculty can open the link (no login) and submit a new comp request
    with whichever books they choose.
    """
    faculty = _get_faculty_or_404(db, payload.faculty_id)

    expires_at = _make_expires(db)

    # Deactivate any existing unused new-request tokens for this rep+faculty pair
    existing = (
        db.query(NewRequestToken)
        .filter(
            NewRequestToken.rep_id     == current_user.user_id,
            NewRequestToken.faculty_id == faculty.faculty_id,
            NewRequestToken.used_at    == None,
            NewRequestToken.is_active  == True,
        )
        .all()
    )
    for t in existing:
        t.is_active = False
    db.flush()

    raw_token = secrets.token_urlsafe(32)

    token = NewRequestToken(
        rep_id         = current_user.user_id,
        faculty_id     = faculty.faculty_id,
        token_hash     = raw_token,
        send_channel   = payload.send_channel,
        send_to_number = payload.send_to_number,
        expires_at     = expires_at,
    )
    db.add(token)
    db.commit()
    db.refresh(token)

    return NewRequestTokenResponse(
        token_id     = token.token_id,
        token_hash   = token.token_hash,
        faculty_id   = faculty.faculty_id,
        send_channel = token.send_channel,
        expires_at   = expires_at,
        is_used      = False,
    )


@router.get("", response_model=List[NewRequestTokenResponse])
def list_my_tokens(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    faculty_id:   Optional[int] = Query(None),
):
    """List new-request tokens generated by the current rep (or all for admin/manager)."""
    q = db.query(NewRequestToken)
    if current_user.role == "rep":
        q = q.filter(NewRequestToken.rep_id == current_user.user_id)
    if faculty_id:
        q = q.filter(NewRequestToken.faculty_id == faculty_id)
    tokens = q.order_by(NewRequestToken.created_at.desc()).all()
    return [
        NewRequestTokenResponse(
            token_id     = t.token_id,
            token_hash   = t.token_hash,
            faculty_id   = t.faculty_id,
            send_channel = t.send_channel,
            expires_at   = _normalize_tz(t.expires_at),
            is_used      = t.used_at is not None,
        )
        for t in tokens
    ]


# ---------------------------------------------------------------------------
# Public endpoints — NO authentication required
# ---------------------------------------------------------------------------

@public_router.get(
    "/new-request-form/{token_hash}",
    response_model=PublicNewRequestFormData,
)
def get_new_request_form(
    token_hash: str,
    db:         Annotated[Session, Depends(get_db)],
):
    """
    Validate token and return faculty details for the blank request form.
    No authentication required — accessed via shared link.
    """
    token = _get_token_or_404(db, token_hash)

    now        = datetime.now(timezone.utc)
    expires    = _normalize_tz(token.expires_at)
    is_expired = expires < now
    is_used    = token.used_at is not None

    faculty = token.faculty
    return PublicNewRequestFormData(
        token_hash   = token.token_hash,
        faculty_name = faculty.faculty_name if faculty else "",
        college_name = faculty.college.college_name if faculty and faculty.college else "",
        dept_name    = faculty.department.dept_name if faculty and faculty.department else "",
        rep_name     = token.rep.full_name if token.rep else "",
        faculty_id   = token.faculty_id,
        college_id   = faculty.college_id if faculty else 0,
        dept_id      = faculty.dept_id    if faculty else 0,
        expires_at   = expires,
        is_expired   = is_expired,
        is_used      = is_used,
    )


@public_router.get(
    "/new-request-form/{token_hash}/books",
    response_model=List[PublicBookSearchItem],
)
def search_books_public(
    token_hash: str,
    db:         Annotated[Session, Depends(get_db)],
    q:          str = Query(..., min_length=2, description="Search by title, author, or subject"),
    limit:      int = Query(20, ge=1, le=50),
):
    """
    Public book search — only accessible with a valid (non-expired) token.
    Used by the faculty form to search and add books.
    """
    # Validate token is active and not expired (don't need full relations here)
    token = (
        db.query(NewRequestToken)
        .filter(NewRequestToken.token_hash == token_hash,
                NewRequestToken.is_active  == True)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="Form link is invalid or has been revoked")

    now     = datetime.now(timezone.utc)
    expires = _normalize_tz(token.expires_at)
    if expires < now:
        raise HTTPException(status_code=400, detail="This form link has expired")
    if token.used_at is not None:
        raise HTTPException(status_code=400, detail="This form has already been submitted")

    # Trigram search across title, subject_area, and author name
    books = (
        db.query(Book)
        .options(
            joinedload(Book.book_authors).joinedload(BookAuthor.author)
        )
        .filter(
            Book.is_active == True,
            func.greatest(
                func.similarity(Book.title,        q),
                func.coalesce(func.similarity(Book.subject_area, q), 0.0),
            ) >= 0.15,
        )
        .order_by(
            func.greatest(
                func.similarity(Book.title,        q),
                func.coalesce(func.similarity(Book.subject_area, q), 0.0),
            ).desc()
        )
        .limit(limit)
        .all()
    )
    return [_book_to_public(b) for b in books]


@public_router.post(
    "/new-request-form/{token_hash}",
    response_model=FacultyNewRequestResult,
)
def submit_new_request_form(
    token_hash: str,
    payload:    FacultyNewRequestSubmit,
    db:         Annotated[Session, Depends(get_db)],
):
    """
    Faculty submits a brand-new comp request from a blank tokenised form.
    No authentication required.
    Creates a new CompRequest (status=SUBMITTED) linked to the rep who sent the token.
    """
    token = _get_token_or_404(db, token_hash)

    now     = datetime.now(timezone.utc)
    expires = _normalize_tz(token.expires_at)

    if token.used_at is not None:
        raise HTTPException(
            status_code=400,
            detail="This form has already been submitted. Each link is for one-time use only.",
        )
    if expires < now:
        raise HTTPException(
            status_code=400,
            detail="This form link has expired. Please ask your sales representative to send a new link.",
        )
    if not payload.line_items:
        raise HTTPException(
            status_code=400,
            detail="Please add at least one book before submitting.",
        )

    faculty = token.faculty
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    max_qty   = get_config_int(db, "max_qty_per_line_item",  3)
    max_total = get_config_int(db, "max_copies_per_request", 5)

    total_qty = sum(li.quantity for li in payload.line_items)
    if total_qty > max_total:
        raise HTTPException(
            status_code=400,
            detail=f"Total copies ({total_qty}) exceeds the allowed limit of {max_total} per request.",
        )

    # Validate all books exist before we start writing
    for li in payload.line_items:
        if li.quantity > max_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Quantity {li.quantity} for book id={li.book_id} exceeds per-item limit of {max_qty}.",
            )
        book = db.query(Book).filter(Book.book_id == li.book_id, Book.is_active == True).first()
        if not book:
            raise HTTPException(status_code=404, detail=f"Book id={li.book_id} not found")

    # Create the CompRequest (SUBMITTED directly — faculty filled it)
    request = CompRequest(
        request_ref        = "",          # DB trigger auto-generates VNI-YYYY-XXXXXX
        rep_id             = token.rep_id,
        faculty_id         = faculty.faculty_id,
        college_id         = faculty.college_id,
        dept_id            = faculty.dept_id,
        visit_notes        = payload.visit_notes,
        submission_mode    = "faculty_filled",
        status             = "SUBMITTED",
        dispatch_type      = payload.dispatch_type,
        alt_recipient_name = payload.alt_recipient_name,
        alt_address        = payload.alt_address,
        alt_city           = payload.alt_city,
        alt_pin            = payload.alt_pin,
        request_date       = payload.request_date,
        submitted_at       = now,
        created_by         = token.rep_id,
        updated_by         = token.rep_id,
    )
    db.add(request)
    db.flush()  # gets request_id + triggers request_ref generation

    # Add line items
    for li in payload.line_items:
        db.add(CompRequestBook(
            request_id           = request.request_id,
            book_id              = li.book_id,
            subject_id           = None,
            subject_context_free = li.subject_context_free,
            quantity             = li.quantity,
            format               = li.format,
            dup_override         = False,
        ))

    log_status_change(
        db,
        request_id  = request.request_id,
        from_status = None,
        to_status   = "SUBMITTED",
        changed_by  = token.rep_id,
        channel     = "faculty_link",
        notes       = "New request submitted by faculty via tokenised blank form",
    )

    # Mark token as used and link the created request
    token.used_at            = now
    token.created_request_id = request.request_id

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("submit_new_request_form: db.commit() failed for token=%s", token_hash)
        raise HTTPException(status_code=500, detail="Submission failed due to a server error. Please try again.")

    return FacultyNewRequestResult(
        request_ref  = request.request_ref,
        faculty_name = faculty.faculty_name,
        college_name = faculty.college.college_name if faculty.college else "",
        submitted_at = now,
        book_count   = len(payload.line_items),
    )
