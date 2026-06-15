from datetime import date, datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireReports
from ..database import get_db
from ..models.master import Author, Book, BookAuthor, College, Region, User
from ..models.transaction import CompRequest, CompRequestBook
from ..schemas.reports import (
    AdoptionRateRow,
    BookCompingRow,
    CollegeCoverageRow,
    CompSummaryRow,
    FulfilmentTATRow,
    FulfilmentTATSummary,
    PendingFollowUpRow,
    PrintRunImpactRow,
    SubjectCoverageRow,
)
from ..utils.csv_utils import make_csv_response as _csv_response

router = APIRouter(prefix="/reports", tags=["MIS Reports"])

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
def _default_from(d: Optional[date]) -> date:
    return d or (datetime.now() - timedelta(days=365)).date()


def _default_to(d: Optional[date]) -> date:
    return d or datetime.now().date()


def _scope(q, current_user: User, college_alias=College):
    """Apply role-based row-level scoping to any comp request query."""
    if current_user.role == "rep":
        q = q.filter(CompRequest.rep_id == current_user.user_id)
    elif current_user.role == "manager" and current_user.region_id:
        q = q.filter(college_alias.region_id == current_user.region_id)
    # ceo / admin / back_office: no additional filter
    return q



# ---------------------------------------------------------------------------
# 1. Comp Summary
# ---------------------------------------------------------------------------
@router.get("/comp-summary")
def comp_summary(
    current_user: RequireReports,
    db:           Annotated[Session, Depends(get_db)],
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    region_id:    Optional[int]  = Query(None),
    rep_id:       Optional[int]  = Query(None),
    fmt:          str            = Query("json", alias="format"),
):
    """Total comp requests and copies by month → region → rep."""
    q = (
        db.query(
            func.to_char(CompRequest.request_date, "YYYY-MM").label("period"),
            Region.region_name,
            User.full_name.label("rep_name"),
            func.count(CompRequest.request_id.distinct()).label("total_requests"),
            func.coalesce(func.sum(CompRequestBook.quantity), 0).label("total_copies"),
        )
        .join(User,    CompRequest.rep_id     == User.user_id)
        .join(College, CompRequest.college_id == College.college_id)
        .join(Region,  College.region_id      == Region.region_id)
        .outerjoin(
            CompRequestBook,
            (CompRequestBook.request_id == CompRequest.request_id) &
            (CompRequestBook.is_active  == True),
        )
        .filter(
            CompRequest.status.notin_(["DRAFT", "CANCELLED", "REJECTED"]),
            CompRequest.is_active   == True,
            CompRequest.request_date >= _default_from(date_from),
            CompRequest.request_date <= _default_to(date_to),
        )
    )
    q = _scope(q, current_user)
    if region_id: q = q.filter(Region.region_id == region_id)
    if rep_id:    q = q.filter(CompRequest.rep_id == rep_id)

    rows = (
        q.group_by("period", Region.region_name, User.full_name)
        .order_by("period", Region.region_name)
        .all()
    )

    if fmt == "csv":
        return _csv_response(
            [[r.period, r.region_name, r.rep_name, r.total_requests, r.total_copies] for r in rows],
            ["Period", "Region", "Rep", "Total Requests", "Total Copies"],
            "comp_summary.csv",
        )
    return [
        CompSummaryRow(
            period         = r.period,
            region_name    = r.region_name,
            rep_name       = r.rep_name,
            total_requests = r.total_requests,
            total_copies   = r.total_copies,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 2. Subject Coverage
# ---------------------------------------------------------------------------
@router.get("/subject-coverage", response_model=List[SubjectCoverageRow])
def subject_coverage(
    current_user: RequireReports,
    db:           Annotated[Session, Depends(get_db)],
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    region_id:    Optional[int]  = Query(None),
    fmt:          str            = Query("json", alias="format"),
):
    """Which subjects have been comped, by request count and college reach."""
    # Use free-text subject context (most commonly filled by reps)
    q = (
        db.query(
            func.coalesce(
                CompRequestBook.subject_context_free,
                func.cast(CompRequestBook.subject_id, "text"),
                "Unspecified",
            ).label("subject_name"),
            func.count(CompRequestBook.line_item_id.distinct()).label("comp_count"),
            func.count(CompRequest.college_id.distinct()).label("college_count"),
            func.coalesce(func.sum(CompRequestBook.quantity), 0).label("copy_count"),
        )
        .join(CompRequest, CompRequestBook.request_id == CompRequest.request_id)
        .join(College,     CompRequest.college_id     == College.college_id)
        .filter(
            CompRequest.status.notin_(["DRAFT", "CANCELLED", "REJECTED"]),
            CompRequest.is_active      == True,
            CompRequestBook.is_active  == True,
            CompRequest.request_date   >= _default_from(date_from),
            CompRequest.request_date   <= _default_to(date_to),
        )
    )
    q = _scope(q, current_user)
    if region_id: q = q.filter(College.region_id == region_id)

    rows = (
        q.group_by("subject_name")
        .order_by(func.count(CompRequestBook.line_item_id.distinct()).desc())
        .limit(100)
        .all()
    )
    return [
        SubjectCoverageRow(
            subject_name  = r.subject_name or "Unspecified",
            comp_count    = r.comp_count,
            college_count = r.college_count,
            copy_count    = r.copy_count,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 3. College Coverage
# ---------------------------------------------------------------------------
@router.get("/college-coverage", response_model=List[CollegeCoverageRow])
def college_coverage(
    current_user: RequireReports,
    db:           Annotated[Session, Depends(get_db)],
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    region_id:    Optional[int]  = Query(None),
    rep_id:       Optional[int]  = Query(None),
    fmt:          str            = Query("json", alias="format"),
):
    q = (
        db.query(
            College.college_id,
            College.college_name,
            College.college_type,
            Region.region_name,
            func.count(CompRequest.request_id.distinct()).label("total_requests"),
            func.coalesce(func.sum(CompRequestBook.quantity), 0).label("total_copies"),
            func.max(CompRequest.request_date).label("last_comp_date"),
        )
        .join(CompRequest, CompRequest.college_id == College.college_id)
        .join(Region,      College.region_id      == Region.region_id)
        .outerjoin(
            CompRequestBook,
            (CompRequestBook.request_id == CompRequest.request_id) &
            (CompRequestBook.is_active  == True),
        )
        .filter(
            CompRequest.status.notin_(["DRAFT", "CANCELLED", "REJECTED"]),
            CompRequest.is_active   == True,
            College.is_active       == True,
            CompRequest.request_date >= _default_from(date_from),
            CompRequest.request_date <= _default_to(date_to),
        )
    )
    q = _scope(q, current_user)
    if region_id: q = q.filter(College.region_id == region_id)
    if rep_id:    q = q.filter(CompRequest.rep_id == rep_id)

    rows = (
        q.group_by(College.college_id, College.college_name,
                   College.college_type, Region.region_name)
        .order_by(func.count(CompRequest.request_id.distinct()).desc())
        .all()
    )
    return [
        CollegeCoverageRow(
            college_id     = r.college_id,
            college_name   = r.college_name,
            college_type   = r.college_type,
            region_name    = r.region_name,
            total_requests = r.total_requests,
            total_copies   = r.total_copies,
            last_comp_date = r.last_comp_date.isoformat() if r.last_comp_date else None,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 4. Book-wise Comping
# ---------------------------------------------------------------------------
@router.get("/book-comping", response_model=List[BookCompingRow])
def book_comping(
    current_user: RequireReports,
    db:           Annotated[Session, Depends(get_db)],
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    region_id:    Optional[int]  = Query(None),
    fmt:          str            = Query("json", alias="format"),
):
    q = (
        db.query(
            Book.book_id,
            Book.title,
            Book.subject_area,
            Book.comp_stock,
            func.count(CompRequestBook.line_item_id.distinct()).label("total_requests"),
            func.coalesce(func.sum(CompRequestBook.quantity), 0).label("total_copies"),
        )
        .join(CompRequestBook, CompRequestBook.book_id == Book.book_id)
        .join(CompRequest,     CompRequest.request_id  == CompRequestBook.request_id)
        .join(College,         CompRequest.college_id  == College.college_id)
        .filter(
            CompRequest.status.notin_(["DRAFT", "CANCELLED", "REJECTED"]),
            CompRequest.is_active      == True,
            CompRequestBook.is_active  == True,
            Book.is_active             == True,
            CompRequest.request_date   >= _default_from(date_from),
            CompRequest.request_date   <= _default_to(date_to),
        )
    )
    q = _scope(q, current_user)
    if region_id: q = q.filter(College.region_id == region_id)

    rows = (
        q.group_by(Book.book_id, Book.title, Book.subject_area, Book.comp_stock)
        .order_by(func.coalesce(func.sum(CompRequestBook.quantity), 0).desc())
        .all()
    )

    # Fetch authors separately to avoid cartesian product
    author_map: dict[int, str] = {}
    for r in rows:
        bas = (
            db.query(Author.author_name)
            .join(BookAuthor, BookAuthor.author_id == Author.author_id)
            .filter(BookAuthor.book_id == r.book_id)
            .order_by(BookAuthor.author_order)
            .all()
        )
        author_map[r.book_id] = ", ".join(a.author_name for a in bas) or "—"

    return [
        BookCompingRow(
            book_id        = r.book_id,
            title          = r.title,
            authors        = author_map.get(r.book_id, "—"),
            subject_area   = r.subject_area,
            total_requests = r.total_requests,
            total_copies   = r.total_copies,
            comp_stock     = r.comp_stock,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 5. Adoption Rate
# ---------------------------------------------------------------------------
@router.get("/adoption-rate", response_model=List[AdoptionRateRow])
def adoption_rate(
    current_user: RequireReports,
    db:           Annotated[Session, Depends(get_db)],
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    region_id:    Optional[int]  = Query(None),
    fmt:          str            = Query("json", alias="format"),
):
    delivered_statuses = ("DELIVERED", "ADOPTED", "NOT_ADOPTED", "PENDING_FOLLOW_UP")
    q = (
        db.query(
            User.full_name.label("rep_name"),
            func.count(CompRequest.request_id).label("total_delivered"),
            func.sum(case((CompRequest.status == "ADOPTED",      1), else_=0)).label("adopted"),
            func.sum(case((CompRequest.status == "NOT_ADOPTED",  1), else_=0)).label("not_adopted"),
            func.sum(case(
                (CompRequest.status.in_(("DELIVERED", "PENDING_FOLLOW_UP")), 1),
                else_=0
            )).label("pending"),
        )
        .join(User,    CompRequest.rep_id     == User.user_id)
        .join(College, CompRequest.college_id == College.college_id)
        .filter(
            CompRequest.status.in_(delivered_statuses),
            CompRequest.is_active   == True,
            CompRequest.request_date >= _default_from(date_from),
            CompRequest.request_date <= _default_to(date_to),
        )
    )
    q = _scope(q, current_user)
    if region_id: q = q.filter(College.region_id == region_id)

    rows = (
        q.group_by(User.user_id, User.full_name)
        .order_by(User.full_name)
        .all()
    )
    return [
        AdoptionRateRow(
            rep_name        = r.rep_name,
            total_delivered = r.total_delivered,
            adopted         = r.adopted or 0,
            not_adopted     = r.not_adopted or 0,
            pending         = r.pending or 0,
            adoption_pct    = round(
                (r.adopted / (r.adopted + r.not_adopted) * 100)
                if (r.adopted + r.not_adopted) > 0 else 0.0,
                1,
            ),
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 6. Pending Follow-ups
# ---------------------------------------------------------------------------
@router.get("/pending-follow-ups", response_model=List[PendingFollowUpRow])
def pending_follow_ups(
    current_user: RequireReports,
    db:           Annotated[Session, Depends(get_db)],
    region_id:    Optional[int]  = Query(None),
    rep_id:       Optional[int]  = Query(None),
    fmt:          str            = Query("json", alias="format"),
):
    from ..models.master import Faculty
    q = (
        db.query(CompRequest)
        .options(
            joinedload(CompRequest.rep),
            joinedload(CompRequest.faculty),
            joinedload(CompRequest.college),
        )
        .join(College, CompRequest.college_id == College.college_id)
        .filter(
            CompRequest.status.in_(["DELIVERED", "PENDING_FOLLOW_UP"]),
            CompRequest.is_active == True,
        )
    )
    q = _scope(q, current_user)
    if region_id: q = q.filter(College.region_id == region_id)
    if rep_id:    q = q.filter(CompRequest.rep_id == rep_id)

    rows = q.order_by(CompRequest.delivered_at).all()
    today = date.today()
    return [
        PendingFollowUpRow(
            request_id   = r.request_id,
            request_ref  = r.request_ref,
            faculty_name = r.faculty.faculty_name if r.faculty else "—",
            college_name = r.college.college_name if r.college else "—",
            rep_name     = r.rep.full_name if r.rep else "—",
            delivered_at = r.delivered_at.date().isoformat() if r.delivered_at else None,
            days_elapsed = (today - r.delivered_at.date()).days if r.delivered_at else 0,
            status       = r.status,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 7. Fulfilment TAT
# ---------------------------------------------------------------------------
@router.get("/fulfilment-tat")
def fulfilment_tat(
    current_user: RequireReports,
    db:           Annotated[Session, Depends(get_db)],
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    region_id:    Optional[int]  = Query(None),
    fmt:          str            = Query("json", alias="format"),
):
    from ..models.master import Faculty
    q = (
        db.query(CompRequest)
        .options(joinedload(CompRequest.faculty))
        .join(College, CompRequest.college_id == College.college_id)
        .filter(
            CompRequest.delivered_at.isnot(None),
            CompRequest.is_active   == True,
            CompRequest.request_date >= _default_from(date_from),
            CompRequest.request_date <= _default_to(date_to),
        )
    )
    q = _scope(q, current_user)
    if region_id: q = q.filter(College.region_id == region_id)

    records = q.order_by(CompRequest.delivered_at.desc()).all()

    def _days(a, b) -> Optional[int]:
        if a and b:
            delta = (b - a)
            return max(0, delta.days)
        return None

    rows: list[FulfilmentTATRow] = []
    for r in records:
        a2d = _days(r.approved_at,   r.dispatched_at)
        d2v = _days(r.dispatched_at, r.delivered_at)
        tot = _days(r.approved_at,   r.delivered_at)
        rows.append(FulfilmentTATRow(
            request_id                = r.request_id,
            request_ref               = r.request_ref,
            faculty_name              = r.faculty.faculty_name if r.faculty else "—",
            approved_at               = r.approved_at.date().isoformat()   if r.approved_at   else None,
            dispatched_at             = r.dispatched_at.date().isoformat() if r.dispatched_at else None,
            delivered_at              = r.delivered_at.date().isoformat()  if r.delivered_at  else None,
            approval_to_dispatch_days = a2d,
            dispatch_to_delivery_days = d2v,
            total_fulfil_days         = tot,
        ))

    valid_a2d = [r.approval_to_dispatch_days for r in rows if r.approval_to_dispatch_days is not None]
    valid_d2v = [r.dispatch_to_delivery_days for r in rows if r.dispatch_to_delivery_days is not None]
    valid_tot = [r.total_fulfil_days         for r in rows if r.total_fulfil_days         is not None]

    summary = FulfilmentTATSummary(
        avg_approval_to_dispatch = round(sum(valid_a2d) / len(valid_a2d), 1) if valid_a2d else None,
        avg_dispatch_to_delivery = round(sum(valid_d2v) / len(valid_d2v), 1) if valid_d2v else None,
        avg_total_days           = round(sum(valid_tot) / len(valid_tot), 1) if valid_tot else None,
        min_total_days           = min(valid_tot) if valid_tot else None,
        max_total_days           = max(valid_tot) if valid_tot else None,
    )

    return {"rows": rows, "summary": summary}


# ---------------------------------------------------------------------------
# 8. Print Run Impact
# ---------------------------------------------------------------------------
@router.get("/print-run-impact", response_model=List[PrintRunImpactRow])
def print_run_impact(
    current_user: RequireReports,
    db:           Annotated[Session, Depends(get_db)],
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    fmt:          str            = Query("json", alias="format"),
):
    q = (
        db.query(
            Book.book_id,
            Book.title,
            Book.subject_area,
            Book.comp_stock,
            func.coalesce(func.sum(CompRequestBook.quantity), 0).label("total_comped"),
        )
        .outerjoin(
            CompRequestBook, CompRequestBook.book_id == Book.book_id
        )
        .outerjoin(
            CompRequest,
            (CompRequest.request_id == CompRequestBook.request_id) &
            (CompRequest.status.notin_(["DRAFT", "CANCELLED", "REJECTED"])) &
            (CompRequest.is_active == True) &
            (CompRequest.request_date >= _default_from(date_from)) &
            (CompRequest.request_date <= _default_to(date_to)),
        )
        .filter(Book.is_active == True)
        .group_by(Book.book_id, Book.title, Book.subject_area, Book.comp_stock)
        .having(func.coalesce(func.sum(CompRequestBook.quantity), 0) > 0)
        .order_by(func.coalesce(func.sum(CompRequestBook.quantity), 0).desc())
    )

    rows = q.all()

    author_map: dict[int, str] = {
        r.book_id: ", ".join(
            a.author_name for a in
            db.query(Author.author_name)
            .join(BookAuthor, BookAuthor.author_id == Author.author_id)
            .filter(BookAuthor.book_id == r.book_id)
            .order_by(BookAuthor.author_order)
            .all()
        ) or "—"
        for r in rows
    }

    return [
        PrintRunImpactRow(
            book_id         = r.book_id,
            title           = r.title,
            authors         = author_map.get(r.book_id, "—"),
            subject_area    = r.subject_area,
            comp_stock      = r.comp_stock,
            total_comped    = r.total_comped,
            remaining_stock = max(0, r.comp_stock - r.total_comped),
            utilization_pct = round(
                (r.total_comped / r.comp_stock * 100) if r.comp_stock > 0 else 0.0, 1
            ),
        )
        for r in rows
    ]
