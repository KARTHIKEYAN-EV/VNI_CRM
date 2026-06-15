from datetime import date, datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireRep
from ..database import get_db
from ..models import Faculty, User
from ..models.master import Book, BookAuthor, Author, College, Subject
from ..models.transaction import CompRequest, CompRequestBook
from ..models.history import RequestAudit
from ..schemas.comp_request import (
    AuditEntry,
    CancelRequest,
    CompRequestCreate,
    CompRequestLineItemResponse,
    CompRequestResponse,
    CompRequestUpdate,
    FacultyBrief,
    LineDuplicateCheckRequest,
    LineDuplicateCheckResult,
    RepBrief,
    SubmitRequest,
)
from ..schemas.master import CollegeBrief, DeptBrief, PaginatedResponse
from ..utils.audit import log_status_change
from ..utils.config import get_config_int
from ..utils.pagination import Pagination

router = APIRouter(prefix="/comp-requests", tags=["Comp Requests"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load(db: Session):
    return db.query(CompRequest).options(
        joinedload(CompRequest.rep),
        joinedload(CompRequest.faculty).joinedload(Faculty.college),
        joinedload(CompRequest.faculty).joinedload(Faculty.department),
        joinedload(CompRequest.college),
        joinedload(CompRequest.department),
        joinedload(CompRequest.line_items).joinedload(CompRequestBook.book)
            .joinedload(Book.book_authors).joinedload(BookAuthor.author),
        joinedload(CompRequest.line_items).joinedload(CompRequestBook.subject),
        joinedload(CompRequest.audit_logs),
    )

def _to_response(r: CompRequest) -> CompRequestResponse:
    # Build the base response dict with ALL required fields
    response_dict = {
        # Primary identifiers
        "request_id": r.request_id,
        "request_ref": r.request_ref,
        
        # Foreign keys
        "repId": r.rep_id,
        "facultyId": r.faculty_id,
        "collegeId": r.college_id,
        "deptId": r.dept_id,
        
        # Status and dates
        "status": r.status,
        "request_date": r.request_date,
        "submitted_at": r.submitted_at,
        "approved_at": r.approved_at,
        "approvedBy": r.approved_by,
        "rejected_at": r.rejected_at,
        "dispatched_at": r.dispatched_at,
        "delivered_at": r.delivered_at,
        "adoption_marked_at": r.adoption_marked_at,
        
        # Notes and metadata
        "visit_notes": r.visit_notes,
        "submission_mode": r.submission_mode,
        "dispatch_type": r.dispatch_type,
        
        # Alternate recipient fields
        "alt_recipient_name": r.alt_recipient_name,
        "alt_address": r.alt_address,
        "alt_city": r.alt_city,
        "alt_pin": r.alt_pin,
        
        # Rejection fields
        "rejection_reason": r.rejection_reason,
        "rejection_notes": r.rejection_notes,
        
        # Audit fields
        "created_at": r.created_at,
        "updated_at": r.updated_at,
        "created_by": r.created_by,
        "updated_by": r.updated_by,
        "is_active": r.is_active,
        
        # Complex nested objects (will be populated)
        "rep": None,
        "faculty": None,
        "college": None,
        "department": None,
        "line_items": [],
        "audit_log": [],
    }
    
    # Add relationship objects if they exist
    if r.rep:
        response_dict["rep"] = RepBrief.model_validate(r.rep).model_dump()
    if r.faculty:
        response_dict["faculty"] = FacultyBrief.model_validate(r.faculty).model_dump()
    if r.college:
        response_dict["college"] = CollegeBrief.model_validate(r.college).model_dump()
    if r.department:
        response_dict["department"] = DeptBrief.model_validate(r.department).model_dump()
    
    # Build line items
    response_dict["line_items"] = []
    for li in r.line_items:
        if not li.is_active:
            continue
            
        line_item_dict = {
            "line_item_id": li.line_item_id,
            "book_id": li.book_id,
            "book_title": li.book.title if li.book else "Unknown",
            "subject_id": li.subject_id,
            "subject_name": li.subject.subject_name if li.subject else None,
            "subject_context_free": li.subject_context_free,
            "quantity": li.quantity,
            "format": li.format,
            "dup_override": li.dup_override,
            "is_active": li.is_active,
            "book_authors": []
        }
        
        # Build book authors
        if li.book and li.book.book_authors:
            for ba in sorted(li.book.book_authors, key=lambda x: x.author_order):
                line_item_dict["book_authors"].append({
                    "authorId": ba.author_id,
                    "authorName": ba.author.author_name if ba.author else "Unknown",
                    "authorOrder": ba.author_order
                })
        
        response_dict["line_items"].append(line_item_dict)
    
    # Build audit log
    response_dict["audit_log"] = []
    for a in sorted(r.audit_logs, key=lambda x: x.changed_at):
        response_dict["audit_log"].append(AuditEntry.model_validate(a).model_dump())
    
    # Validate the complete dict against the schema
    return CompRequestResponse.model_validate(response_dict)

def _get_or_404(db: Session, request_id: int) -> CompRequest:
    r = _load(db).filter(CompRequest.request_id == request_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Comp request not found")
    return r


def _assert_draft(r: CompRequest) -> None:
    if r.status != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail=f"Request is {r.status} — only DRAFT requests can be edited",
        )


def _check_access(r: CompRequest, current_user: User) -> None:
    """Reps can only access their own requests."""
    if current_user.role == "rep" and r.rep_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")


def _build_line_items(
    db: Session,
    request_id: int,
    items_data: List,
    max_qty: int,
    max_total: int,
) -> None:
    total_qty = sum(i.quantity for i in items_data)
    if total_qty > max_total:
        raise HTTPException(
            status_code=400,
            detail=f"Total copies ({total_qty}) exceeds limit of {max_total}",
        )

    for item in items_data:
        if item.quantity > max_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Quantity {item.quantity} exceeds per-item limit of {max_qty}",
            )
        book = db.query(Book).filter(Book.book_id == item.book_id,
                                      Book.is_active == True).first()
        if not book:
            raise HTTPException(status_code=404,
                                detail=f"Book id={item.book_id} not found")

        subject = None
        if item.subject_id:
            subject = db.query(Subject).filter(
                Subject.subject_id == item.subject_id,
                Subject.is_active == True,
            ).first()
            if not subject:
                raise HTTPException(status_code=404,
                                    detail=f"Subject id={item.subject_id} not found")

        db.add(CompRequestBook(
            request_id           = request_id,
            book_id              = item.book_id,
            subject_id           = item.subject_id,
            subject_context_free = item.subject_context_free,
            quantity             = item.quantity,
            format               = item.format,
            dup_override         = item.dup_override,
        ))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/line-duplicate-check", response_model=LineDuplicateCheckResult)
def check_line_duplicate(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    faculty_id:   int = Query(...),
    book_id:      int = Query(...),
):
    """Thin GET wrapper used by frontend typeahead — call before adding a book."""
    return _do_duplicate_check(db, faculty_id, book_id)


@router.post("/line-duplicate-check", response_model=LineDuplicateCheckResult)
def check_line_duplicate_post(
    payload:      LineDuplicateCheckRequest,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    """
    Check if the same faculty+book was comped in the last 12 months.
    Returns a warning object — never blocks creation (Constitution §10.2).
    """
    return _do_duplicate_check(db, payload.faculty_id, payload.book_id)


def _do_duplicate_check(
    db:         Session,
    faculty_id: int,
    book_id:    int,
) -> LineDuplicateCheckResult:
    cutoff = date.today() - timedelta(days=365)
    row = (
        db.query(CompRequest, CompRequestBook)
        .join(CompRequestBook, CompRequest.request_id == CompRequestBook.request_id)
        .filter(
            CompRequest.faculty_id == faculty_id,
            CompRequestBook.book_id == book_id,
            CompRequest.status.notin_(["CANCELLED", "REJECTED"]),
            CompRequest.request_date >= cutoff,
            CompRequest.is_active == True,
            CompRequestBook.is_active == True,
        )
        .order_by(CompRequest.request_date.desc())
        .first()
    )
    if not row:
        return LineDuplicateCheckResult(is_duplicate=False)

    req, _ = row
    days_ago = (date.today() - req.request_date).days
    return LineDuplicateCheckResult(
        is_duplicate      = True,
        last_request_ref  = req.request_ref,
        last_request_date = req.request_date,
        days_ago          = days_ago,
    )


@router.get("", response_model=PaginatedResponse[CompRequestResponse])
def list_requests(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    status_:      Optional[str]  = Query(None, alias="status"),
    rep_id:       Optional[int]  = Query(None),
    college_id:   Optional[int]  = Query(None),
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    search:       Optional[str]  = Query(None, description="Request ref or faculty name"),
):
    q = _load(db).filter(CompRequest.is_active == True)

    # Role-based scope (Constitution §4.1)
    if current_user.role == "rep":
        q = q.filter(CompRequest.rep_id == current_user.user_id)
    elif current_user.role == "manager" and current_user.region_id:
        q = q.join(College, CompRequest.college_id == College.college_id)\
             .filter(College.region_id == current_user.region_id)
    # ceo / admin / back_office: no restriction

    if status_:
        q = q.filter(CompRequest.status == status_)
    if rep_id and current_user.role != "rep":
        q = q.filter(CompRequest.rep_id == rep_id)
    if college_id:
        q = q.filter(CompRequest.college_id == college_id)
    if date_from:
        q = q.filter(CompRequest.request_date >= date_from)
    if date_to:
        q = q.filter(CompRequest.request_date <= date_to)
    if search:
        q = q.filter(
            CompRequest.request_ref.ilike(f"%{search}%")
        )

    total = q.count()
    items = (
        q.order_by(CompRequest.request_date.desc(), CompRequest.request_id.desc())
        .offset(pagination.offset).limit(pagination.page_size).all()
    )
    return PaginatedResponse.build(
        items     = [_to_response(r) for r in items],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.post("", response_model=CompRequestResponse, status_code=status.HTTP_201_CREATED)
def create_request(
    payload:      CompRequestCreate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    faculty = db.query(Faculty).options(
        joinedload(Faculty.college), joinedload(Faculty.department)
    ).filter(Faculty.faculty_id == payload.faculty_id,
             Faculty.is_active == True).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    max_qty   = get_config_int(db, "max_qty_per_line_item",  3)
    max_total = get_config_int(db, "max_copies_per_request", 5)

    request = CompRequest(
        request_ref        = "",          # trigger auto-generates VNI-YYYY-XXXXXX
        rep_id             = current_user.user_id,
        faculty_id         = faculty.faculty_id,
        college_id         = faculty.college_id,
        dept_id            = faculty.dept_id,
        visit_notes        = payload.visit_notes,
        submission_mode    = "rep_filled",
        status             = "DRAFT",
        dispatch_type      = payload.dispatch_type,
        alt_recipient_name = payload.alt_recipient_name,
        alt_address        = payload.alt_address,
        alt_city           = payload.alt_city,
        alt_pin            = payload.alt_pin,
        request_date       = payload.request_date,
        created_by         = current_user.user_id,
        updated_by         = current_user.user_id,
    )
    db.add(request)
    db.flush()  # gets request_id + triggers request_ref generation

    _build_line_items(db, request.request_id, payload.line_items, max_qty, max_total)

    log_status_change(
        db,
        request_id  = request.request_id,
        from_status = None,
        to_status   = "DRAFT",
        changed_by  = current_user.user_id,
        channel     = "rep_app",
    )

    db.commit()
    # Re-fetch with full joinedloads via _get_or_404 instead of db.refresh()
    # which only reloads scalar columns, leaving relationships unloaded.
    return _to_response(_get_or_404(db, request.request_id))


from ..auth.dependencies import RequireCEO, RequireBackOffice
from ..models.parameter import RejectionReason
from ..schemas.comp_request import (
    ApproveRequest, RejectRequest, DispatchRequest,
    DeliverRequest, MarkAdoptionRequest, RejectionReasonResponse,
)


@router.get("/rejection-reasons", response_model=List[RejectionReasonResponse])
def list_rejection_reasons(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    """Return active rejection reasons for the CEO approval UI."""
    reasons = db.query(RejectionReason).filter(
        RejectionReason.is_active == True
    ).order_by(RejectionReason.reason_id).all()
    return [RejectionReasonResponse.model_validate(r) for r in reasons]


@router.get("/{request_id}", response_model=CompRequestResponse)
def get_request(
    request_id:   int,
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    r = _get_or_404(db, request_id)
    _check_access(r, current_user)
    return _to_response(r)


@router.put("/{request_id}", response_model=CompRequestResponse)
def update_request(
    request_id:   int,
    payload:      CompRequestUpdate,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    r = _get_or_404(db, request_id)
    _check_access(r, current_user)
    _assert_draft(r)

    # Update header fields
    header_fields = {
        "visit_notes", "request_date", "dispatch_type",
        "alt_recipient_name", "alt_address", "alt_city", "alt_pin",
    }
    for field, value in payload.model_dump(exclude_none=True, exclude={"line_items"}).items():
        if field in header_fields:
            setattr(r, field, value)
    r.updated_by = current_user.user_id

    # Replace line items if provided
    if payload.line_items is not None:
        for li in r.line_items:
            li.is_active = False
        db.flush()

        max_qty   = get_config_int(db, "max_qty_per_line_item",  3)
        max_total = get_config_int(db, "max_copies_per_request", 5)
        _build_line_items(db, r.request_id, payload.line_items, max_qty, max_total)

    db.commit()
    # Re-fetch with full joinedloads instead of db.refresh()
    return _to_response(_get_or_404(db, r.request_id))


@router.post("/{request_id}/submit", response_model=CompRequestResponse)
def submit_request(
    request_id:   int,
    payload:      SubmitRequest,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    r = _get_or_404(db, request_id)
    _check_access(r, current_user)
    _assert_draft(r)

    active_lines = [li for li in r.line_items if li.is_active]
    if not active_lines:
        raise HTTPException(
            status_code=400,
            detail="A request must have at least one book before it can be submitted",
        )

    r.status       = "SUBMITTED"
    r.submitted_at = datetime.now(timezone.utc)
    r.updated_by   = current_user.user_id

    log_status_change(
        db,
        request_id  = r.request_id,
        from_status = "DRAFT",
        to_status   = "SUBMITTED",
        changed_by  = current_user.user_id,
        channel     = "rep_app",
        notes       = payload.notes,
    )

    db.commit()
    # Re-fetch with full joinedloads instead of db.refresh()
    return _to_response(_get_or_404(db, r.request_id))


@router.post("/{request_id}/cancel", response_model=CompRequestResponse)
def cancel_request(
    request_id:   int,
    payload:      CancelRequest,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    r = _get_or_404(db, request_id)
    _check_access(r, current_user)

    if r.status not in ("DRAFT", "SUBMITTED"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a request in {r.status} status",
        )

    prev_status  = r.status
    r.status     = "CANCELLED"
    r.updated_by = current_user.user_id

    log_status_change(
        db,
        request_id  = r.request_id,
        from_status = prev_status,
        to_status   = "CANCELLED",
        changed_by  = current_user.user_id,
        channel     = "rep_app",
        notes       = payload.notes,
    )

    db.commit()
    # Re-fetch with full joinedloads instead of db.refresh()
    return _to_response(_get_or_404(db, r.request_id))


# =============================================================================
# Phase E — Approval, Fulfilment & Adoption endpoints
# =============================================================================

@router.post("/{request_id}/approve", response_model=CompRequestResponse)
def approve_request(
    request_id:   int,
    payload:      ApproveRequest,
    current_user: RequireCEO,
    db:           Annotated[Session, Depends(get_db)],
):
    """CEO approves a SUBMITTED request — status → APPROVED."""
    r = _get_or_404(db, request_id)
    if r.status != "SUBMITTED":
        raise HTTPException(400, f"Cannot approve a request in {r.status} status")

    r.status      = "APPROVED"
    r.approved_by = current_user.user_id
    r.approved_at = datetime.now(timezone.utc)
    r.updated_by  = current_user.user_id

    log_status_change(
        db, request_id=r.request_id,
        from_status="SUBMITTED", to_status="APPROVED",
        changed_by=current_user.user_id, channel="admin",
        notes=payload.notes,
    )
    db.commit()
    # Re-fetch with full joinedloads instead of db.refresh()
    return _to_response(_get_or_404(db, r.request_id))


@router.post("/{request_id}/reject", response_model=CompRequestResponse)
def reject_request(
    request_id:   int,
    payload:      RejectRequest,
    current_user: RequireCEO,
    db:           Annotated[Session, Depends(get_db)],
):
    """CEO rejects a SUBMITTED request with a mandatory reason code."""
    r = _get_or_404(db, request_id)
    if r.status != "SUBMITTED":
        raise HTTPException(400, f"Cannot reject a request in {r.status} status")

    reason = db.query(RejectionReason).filter(
        RejectionReason.reason_code == payload.reason_code,
        RejectionReason.is_active   == True,
    ).first()
    if not reason:
        raise HTTPException(404, f"Rejection reason '{payload.reason_code}' not found")
    if reason.requires_notes and not (payload.reason_notes or "").strip():
        raise HTTPException(400, f"Reason '{reason.reason_code}' requires additional notes")

    r.status           = "REJECTED"
    r.rejection_reason = payload.reason_code
    r.rejection_notes  = payload.reason_notes
    r.rejected_at      = datetime.now(timezone.utc)
    r.updated_by       = current_user.user_id

    log_status_change(
        db, request_id=r.request_id,
        from_status="SUBMITTED", to_status="REJECTED",
        changed_by=current_user.user_id, channel="admin",
        notes=f"{reason.reason_label}" + (f": {payload.reason_notes}" if payload.reason_notes else ""),
    )
    db.commit()
    # Re-fetch with full joinedloads instead of db.refresh()
    return _to_response(_get_or_404(db, r.request_id))


@router.post("/{request_id}/dispatch", response_model=CompRequestResponse)
def dispatch_request(
    request_id:   int,
    payload:      DispatchRequest,
    current_user: RequireBackOffice,
    db:           Annotated[Session, Depends(get_db)],
):
    """Back Office marks an APPROVED request as DISPATCHED."""
    r = _get_or_404(db, request_id)
    if r.status != "APPROVED":
        raise HTTPException(400, f"Cannot dispatch a request in {r.status} status")

    r.status        = "DISPATCHED"
    r.dispatched_at = datetime.now(timezone.utc)
    r.updated_by    = current_user.user_id

    log_status_change(
        db, request_id=r.request_id,
        from_status="APPROVED", to_status="DISPATCHED",
        changed_by=current_user.user_id, channel="admin",
        notes=payload.notes,
    )
    db.commit()
    # Re-fetch with full joinedloads instead of db.refresh()
    return _to_response(_get_or_404(db, r.request_id))


@router.post("/{request_id}/deliver", response_model=CompRequestResponse)
def deliver_request(
    request_id:   int,
    payload:      DeliverRequest,
    current_user: RequireBackOffice,
    db:           Annotated[Session, Depends(get_db)],
):
    """Back Office confirms delivery — status → DELIVERED."""
    r = _get_or_404(db, request_id)
    if r.status != "DISPATCHED":
        raise HTTPException(400, f"Cannot mark delivery for a request in {r.status} status")

    r.status       = "DELIVERED"
    r.delivered_at = datetime.now(timezone.utc)
    r.updated_by   = current_user.user_id

    log_status_change(
        db, request_id=r.request_id,
        from_status="DISPATCHED", to_status="DELIVERED",
        changed_by=current_user.user_id, channel="admin",
        notes=payload.notes,
    )
    db.commit()
    # Re-fetch with full joinedloads instead of db.refresh()
    return _to_response(_get_or_404(db, r.request_id))


@router.post("/{request_id}/mark-adoption", response_model=CompRequestResponse)
def mark_adoption(
    request_id:   int,
    payload:      MarkAdoptionRequest,
    current_user: RequireRep,
    db:           Annotated[Session, Depends(get_db)],
):
    """Rep / Manager marks adoption outcome after delivery."""
    r = _get_or_404(db, request_id)
    if r.status not in ("DELIVERED", "PENDING_FOLLOW_UP"):
        raise HTTPException(
            400, f"Cannot mark adoption for a request in {r.status} status"
        )

    prev_status          = r.status
    r.status             = "ADOPTED" if payload.adopted else "NOT_ADOPTED"
    r.adoption_marked_at = datetime.now(timezone.utc)
    r.updated_by         = current_user.user_id

    log_status_change(
        db, request_id=r.request_id,
        from_status=prev_status, to_status=r.status,
        changed_by=current_user.user_id, channel="rep_app",
        notes=payload.notes,
    )
    db.commit()
    # Re-fetch with full joinedloads instead of db.refresh()
    return _to_response(_get_or_404(db, r.request_id))