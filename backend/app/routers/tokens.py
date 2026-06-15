import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, List

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireRep
from ..database import get_db
from ..models.master import Faculty, Book, BookAuthor
from ..models.transaction import CompRequest, CompRequestBook, FacultyFormToken
from ..models.history import RequestAudit
from ..schemas.token import (
    BookQuantityEdit,
    FacultyFormSubmit,
    FacultyFormSubmitResult,
    FormTokenResponse,
    PublicBookItem,
    PublicBookSearchItem,
    PublicFormData,
    SendFormRequest,
)
from ..utils.audit import log_status_change
from ..utils.config import get_config_int

# ---------------------------------------------------------------------------
# Two routers:
#   router        — authenticated (prefix="/comp-requests", mounted in main.py)
#   public_router — no auth (prefix="/public",          mounted in main.py)
# ---------------------------------------------------------------------------
router        = APIRouter(prefix="/comp-requests", tags=["Comp Requests — Tokens"])
public_router = APIRouter(prefix="/public",        tags=["Public — Faculty Form"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_request_or_404(db: Session, request_id: int) -> CompRequest:
    r = (
        db.query(CompRequest)
        .options(
            joinedload(CompRequest.faculty).joinedload(Faculty.college),
            joinedload(CompRequest.faculty).joinedload(Faculty.department),
            joinedload(CompRequest.rep),
            joinedload(CompRequest.college),
            joinedload(CompRequest.department),
            joinedload(CompRequest.line_items)
                .joinedload(CompRequestBook.book)
                .joinedload(Book.book_authors)
                .joinedload(BookAuthor.author),
        )
        .filter(CompRequest.request_id == request_id, CompRequest.is_active == True)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Comp request not found")
    return r


def _build_public_form(r: CompRequest, token: FacultyFormToken) -> PublicFormData:
    now       = datetime.now(timezone.utc)
    is_expired = token.expires_at.replace(tzinfo=timezone.utc) < now if token.expires_at.tzinfo is None \
                 else token.expires_at < now
    return PublicFormData(
        token_hash         = token.token_hash,
        request_id         = r.request_id,
        request_ref        = r.request_ref,
        request_date       = r.request_date.isoformat(),
        faculty_name       = r.faculty.faculty_name if r.faculty else "",
        college_name       = r.college.college_name if r.college else "",
        dept_name          = r.department.dept_name if r.department else "",
        rep_name           = r.rep.full_name if r.rep else "",
        visit_notes        = r.visit_notes,
        dispatch_type      = r.dispatch_type,
        alt_recipient_name = r.alt_recipient_name,
        alt_address        = r.alt_address,
        alt_city           = r.alt_city,
        alt_pin            = r.alt_pin,
        books              = [
            PublicBookItem(
                line_item_id = li.line_item_id,
                book_id      = li.book_id,
                book_title   = li.book.title if li.book else "Unknown",
                authors      = ", ".join(
                    ba.author.author_name
                    for ba in sorted(li.book.book_authors, key=lambda x: x.author_order)
                    if ba.author
                ) if li.book else "",
                quantity     = li.quantity,
                format       = li.format,
            )
            for li in r.line_items if li.is_active
        ],
        expires_at = token.expires_at if token.expires_at.tzinfo
                     else token.expires_at.replace(tzinfo=timezone.utc),
        is_expired = is_expired,
        is_used    = token.used_at is not None,
    )


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


def _get_active_token_or_404(db: Session, token_hash: str) -> FacultyFormToken:
    token = (
        db.query(FacultyFormToken)
        .filter(FacultyFormToken.token_hash == token_hash,
                FacultyFormToken.is_active  == True)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="Form link is invalid or has been revoked")
    return token


# ---------------------------------------------------------------------------
# Authenticated endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/{request_id}/send-form",
    response_model=FormTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_form_to_faculty(
    request_id:   int,
    payload:      SendFormRequest,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    """
    Generate a tokenised form link for faculty self-fill.
    Phase 1: returns the token/URL for manual sharing (WhatsApp / email).
    Phase 2+: system auto-sends notification.
    Constitution §3.2: link expires after token_expiry_hours (default 72h).
    """
    r = _get_request_or_404(db, request_id)

    if r.status not in ("DRAFT",):
        raise HTTPException(
            status_code=400,
            detail=f"Form links can only be generated for DRAFT requests (current: {r.status})",
        )

    expiry_hours = get_config_int(db, "token_expiry_hours", 72)
    expires_at   = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)

    # Deactivate any existing unused tokens for this request
    existing = db.query(FacultyFormToken).filter(
        FacultyFormToken.request_id == request_id,
        FacultyFormToken.used_at    == None,
        FacultyFormToken.is_active  == True,
    ).all()
    for t in existing:
        t.is_active = False
    db.flush()

    # Generate new token (cryptographically secure, URL-safe)
    raw_token = secrets.token_urlsafe(32)

    token = FacultyFormToken(
        request_id     = request_id,
        faculty_id     = r.faculty_id,
        token_hash     = raw_token,
        send_channel   = payload.send_channel,
        send_to_number = payload.send_to_number,
        expires_at     = expires_at,
    )
    db.add(token)
    db.commit()
    db.refresh(token)

    return FormTokenResponse(
        token_id     = token.token_id,
        token_hash   = token.token_hash,
        request_id   = r.request_id,
        request_ref  = r.request_ref,
        send_channel = token.send_channel,
        expires_at   = expires_at,
        is_used      = False,
    )


@router.get("/{request_id}/tokens", response_model=List[FormTokenResponse])
def list_request_tokens(
    request_id:   int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    """List all form tokens generated for a comp request."""
    tokens = (
        db.query(FacultyFormToken)
        .filter(FacultyFormToken.request_id == request_id)
        .order_by(FacultyFormToken.created_at.desc())
        .all()
    )
    r = _get_request_or_404(db, request_id)
    return [
        FormTokenResponse(
            token_id     = t.token_id,
            token_hash   = t.token_hash,
            request_id   = request_id,
            request_ref  = r.request_ref,
            send_channel = t.send_channel,
            expires_at   = t.expires_at if t.expires_at.tzinfo
                           else t.expires_at.replace(tzinfo=timezone.utc),
            is_used      = t.used_at is not None,
        )
        for t in tokens
    ]


# ---------------------------------------------------------------------------
# Public endpoints — NO authentication required
# ---------------------------------------------------------------------------

@public_router.get("/form/{token_hash}", response_model=PublicFormData)
def get_public_form(
    token_hash: str,
    db:         Annotated[Session, Depends(get_db)],
):
    """
    Validate token and return pre-filled form data for faculty.
    No authentication required — accessed via shared link.
    """
    token = (
        db.query(FacultyFormToken)
        .filter(FacultyFormToken.token_hash == token_hash,
                FacultyFormToken.is_active  == True)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="Form link is invalid or has been revoked")

    r = _get_request_or_404(db, token.request_id)
    return _build_public_form(r, token)


@public_router.get("/form/{token_hash}/books", response_model=List[PublicBookSearchItem])
def search_books_for_form(
    token_hash: str,
    db:         Annotated[Session, Depends(get_db)],
    q:          str = Query(..., min_length=2, description="Search by title, author, or subject"),
    limit:      int = Query(20, ge=1, le=50),
):
    """
    Public book search — only accessible with a valid (non-expired, unused)
    form token. Lets faculty add extra books to their request.
    """
    token = _get_active_token_or_404(db, token_hash)

    now     = datetime.now(timezone.utc)
    expires = token.expires_at if token.expires_at.tzinfo \
              else token.expires_at.replace(tzinfo=timezone.utc)
    if expires < now:
        raise HTTPException(status_code=400, detail="This form link has expired")
    if token.used_at is not None:
        raise HTTPException(status_code=400, detail="This form has already been submitted")

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
    "/form/{token_hash}",
    response_model=FacultyFormSubmitResult,
)
def submit_public_form(
    token_hash: str,
    payload:    FacultyFormSubmit,
    db:         Annotated[Session, Depends(get_db)],
):
    """
    Faculty submits the pre-filled comp request form.
    No authentication required.
    Constitution: one-time submission; expired/used tokens are rejected.
    """
    token = (
        db.query(FacultyFormToken)
        .filter(FacultyFormToken.token_hash == token_hash,
                FacultyFormToken.is_active  == True)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="Form link is invalid or has been revoked")

    now = datetime.now(timezone.utc)
    expires = token.expires_at if token.expires_at.tzinfo \
              else token.expires_at.replace(tzinfo=timezone.utc)

    if token.used_at is not None:
        raise HTTPException(
            status_code=400,
            detail="This form has already been submitted. Each link is for one-time use only.",
        )
    if expires < now:
        raise HTTPException(
            status_code=400,
            detail=f"This form link has expired. Please ask your sales representative to send a new link.",
        )

    r = _get_request_or_404(db, token.request_id)
    if r.status != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail=f"This request is no longer accepting submissions (status: {r.status})",
        )

    # Apply faculty edits to the request
    if payload.visit_notes is not None:
        r.visit_notes = payload.visit_notes
    r.dispatch_type      = payload.dispatch_type
    r.alt_recipient_name = payload.alt_recipient_name
    r.alt_address        = payload.alt_address
    r.alt_city           = payload.alt_city
    r.alt_pin            = payload.alt_pin
    r.submission_mode    = "faculty_filled"

    # Apply book quantity edits (faculty can only change qty, not add/remove existing books)
    if payload.books:
        line_item_map = {li.line_item_id: li for li in r.line_items if li.is_active}
        for edit in payload.books:
            li = line_item_map.get(edit.line_item_id)
            if li and edit.quantity >= 1:
                li.quantity = edit.quantity

    # Faculty-added extra books
    max_qty   = get_config_int(db, "max_qty_per_line_item",  3)
    max_total = get_config_int(db, "max_copies_per_request", 5)

    existing_qty = sum(li.quantity for li in r.line_items if li.is_active)

    if payload.additional_books:
        added_qty = sum(ab.quantity for ab in payload.additional_books)
        if existing_qty + added_qty > max_total:
            raise HTTPException(
                status_code=400,
                detail=f"Total copies would be {existing_qty + added_qty}, exceeding the allowed limit of {max_total} per request.",
            )
        for ab in payload.additional_books:
            if ab.quantity < 1 or ab.quantity > max_qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Quantity {ab.quantity} for book id={ab.book_id} exceeds per-item limit of {max_qty}.",
                )
            book = db.query(Book).filter(Book.book_id == ab.book_id, Book.is_active == True).first()
            if not book:
                raise HTTPException(status_code=404, detail=f"Book id={ab.book_id} not found")
            db.add(CompRequestBook(
                request_id           = r.request_id,
                book_id              = ab.book_id,
                subject_id           = None,
                subject_context_free = ab.subject_context_free,
                quantity             = ab.quantity,
                format               = ab.format,
                dup_override         = False,
            ))

    # DRAFT → SUBMITTED
    # Use rep_id as the acting user — rep_id is always NOT NULL on the request,
    # whereas created_by can be NULL on legacy rows, which caused the 500.
    acting_user_id = r.rep_id

    r.status       = "SUBMITTED"
    r.submitted_at = now
    r.updated_by   = acting_user_id

    log_status_change(
        db,
        request_id  = r.request_id,
        from_status = "DRAFT",
        to_status   = "SUBMITTED",
        changed_by  = acting_user_id,
        channel     = "faculty_link",
        notes       = "Submitted by faculty via tokenised form link",
    )

    # Mark token as used (one-time)
    token.used_at = now

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("submit_public_form: db.commit() failed for token=%s", token_hash)
        raise HTTPException(status_code=500, detail="Submission failed due to a server error. Please try again.")

    faculty_name = r.faculty.faculty_name if r.faculty else "Faculty"
    college_name = r.college.college_name if r.college else ""

    return FacultyFormSubmitResult(
        request_ref  = r.request_ref,
        faculty_name = faculty_name,
        college_name = college_name,
        submitted_at = now,
    )
