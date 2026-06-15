from datetime import date, datetime
from typing import List, Optional

from pydantic import field_validator

from .auth import CamelModel
from .master import AuthorBrief, CollegeBrief, DeptBrief


# ---------------------------------------------------------------------------
# Brief nested schemas
# ---------------------------------------------------------------------------

class RepBrief(CamelModel):
    user_id:   int
    full_name: str
    role:      str


class FacultyBrief(CamelModel):
    faculty_id:    int
    faculty_name:  str
    designation:   Optional[str]
    phone_personal: Optional[str]
    phone_whatsapp: Optional[str]
    email:          Optional[str]
    data_quality_flag: str


class AuditEntry(CamelModel):
    audit_id:    int
    from_status: Optional[str]
    to_status:   str
    changed_by:  int
    changed_at:  datetime
    channel:     Optional[str]
    notes:       Optional[str]


# ---------------------------------------------------------------------------
# Line item
# ---------------------------------------------------------------------------

class CompRequestLineItemCreate(CamelModel):
    book_id:              int
    subject_id:           Optional[int] = None
    subject_context_free: Optional[str] = None   # free text if subject not in master
    quantity:             int  = 1
    format:               str  = "Physical"
    dup_override:         bool = False            # rep acknowledged 12-month duplicate

    @field_validator("quantity")
    @classmethod
    def positive_qty(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v

    @field_validator("format")
    @classmethod
    def valid_format(cls, v: str) -> str:
        if v not in {"Physical", "Digital"}:
            raise ValueError("format must be Physical or Digital")
        return v


class CompRequestLineItemResponse(CamelModel):
    line_item_id:         int
    book_id:              int
    book_title:           str
    book_authors:         List[AuthorBrief] = []
    subject_id:           Optional[int]
    subject_name:         Optional[str]
    subject_context_free: Optional[str]
    quantity:             int
    format:               str
    dup_override:         bool
    is_active:            bool


# ---------------------------------------------------------------------------
# Request header
# ---------------------------------------------------------------------------

class CompRequestCreate(CamelModel):
    faculty_id:         int
    visit_notes:        Optional[str] = None
    request_date:       date               # visit date (may differ from today)
    dispatch_type:      str  = "college"
    alt_recipient_name: Optional[str] = None
    alt_address:        Optional[str] = None
    alt_city:           Optional[str] = None
    alt_pin:            Optional[str] = None
    line_items:         List[CompRequestLineItemCreate] = []

    @field_validator("dispatch_type")
    @classmethod
    def valid_dispatch(cls, v: str) -> str:
        if v not in {"college", "alternate", "faculty_saved"}:
            raise ValueError("dispatch_type must be college, alternate, or faculty_saved")
        return v


class CompRequestUpdate(CamelModel):
    """Allowed header fields on a DRAFT request."""
    visit_notes:        Optional[str]  = None
    request_date:       Optional[date] = None
    dispatch_type:      Optional[str]  = None
    alt_recipient_name: Optional[str]  = None
    alt_address:        Optional[str]  = None
    alt_city:           Optional[str]  = None
    alt_pin:            Optional[str]  = None
    line_items:         Optional[List[CompRequestLineItemCreate]] = None


class CompRequestResponse(CamelModel):
    request_id:         int
    request_ref:        str
    rep_id:             int
    rep:                Optional[RepBrief]     = None
    faculty_id:         int
    faculty:            Optional[FacultyBrief] = None
    college_id:         int
    college:            Optional[CollegeBrief] = None
    dept_id:            int
    department:         Optional[DeptBrief]   = None
    visit_notes:        Optional[str]
    submission_mode:    str
    status:             str
    dispatch_type:      str
    alt_recipient_name: Optional[str]
    alt_address:        Optional[str]
    alt_city:           Optional[str]
    alt_pin:            Optional[str]
    request_date:       date
    approved_by:        Optional[int]
    rejection_reason:   Optional[str]
    rejection_notes:    Optional[str]
    submitted_at:       Optional[datetime]
    approved_at:        Optional[datetime]
    rejected_at:        Optional[datetime]
    dispatched_at:      Optional[datetime]
    delivered_at:       Optional[datetime]
    adoption_marked_at: Optional[datetime]
    is_active:          bool
    created_at:         datetime
    updated_at:         datetime
    line_items:         List[CompRequestLineItemResponse] = []
    audit_log:          List[AuditEntry] = []


# ---------------------------------------------------------------------------
# Duplicate check (12-month rolling window per constitution §10.2)
# ---------------------------------------------------------------------------

class LineDuplicateCheckRequest(CamelModel):
    faculty_id: int
    book_id:    int


class LineDuplicateCheckResult(CamelModel):
    is_duplicate:      bool
    last_request_ref:  Optional[str]  = None
    last_request_date: Optional[date] = None
    days_ago:          Optional[int]  = None


# ---------------------------------------------------------------------------
# Submit / cancel request bodies (optional notes)
# ---------------------------------------------------------------------------

class SubmitRequest(CamelModel):
    notes: Optional[str] = None


class CancelRequest(CamelModel):
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Phase E — Approval & Fulfilment action schemas
# ---------------------------------------------------------------------------

class ApproveRequest(CamelModel):
    notes: Optional[str] = None


class RejectRequest(CamelModel):
    reason_code:  str            # must exist in P_REJECTION_REASON
    reason_notes: Optional[str] = None   # required when reason.requires_notes = True


class DispatchRequest(CamelModel):
    notes: Optional[str] = None  # courier / tracking info stored in audit log


class DeliverRequest(CamelModel):
    notes: Optional[str] = None


class MarkAdoptionRequest(CamelModel):
    adopted: bool                # True = ADOPTED, False = NOT_ADOPTED
    notes:   Optional[str] = None


class RejectionReasonResponse(CamelModel):
    reason_id:      int
    reason_code:    str
    reason_label:   str
    requires_notes: bool
