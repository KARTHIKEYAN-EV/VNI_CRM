from datetime import date, datetime
from typing import List, Optional

from pydantic import field_validator

from .auth import CamelModel


# ---------------------------------------------------------------------------
# Authenticated: Rep sends a blank form link to faculty
# ---------------------------------------------------------------------------

class SendNewRequestTokenRequest(CamelModel):
    faculty_id:     int
    send_channel:   str = "whatsapp"
    send_to_number: Optional[str] = None

    @field_validator("send_channel")
    @classmethod
    def valid_channel(cls, v: str) -> str:
        if v not in {"whatsapp", "email", "both"}:
            raise ValueError("send_channel must be whatsapp, email, or both")
        return v


class NewRequestTokenResponse(CamelModel):
    token_id:     int
    token_hash:   str
    faculty_id:   int
    send_channel: str
    expires_at:   datetime
    is_used:      bool


# ---------------------------------------------------------------------------
# Public: data returned when faculty opens the link
# ---------------------------------------------------------------------------

class PublicNewRequestFormData(CamelModel):
    token_hash:    str
    faculty_name:  str
    college_name:  str
    dept_name:     str
    rep_name:      str
    faculty_id:    int
    college_id:    int
    dept_id:       int
    expires_at:    datetime
    is_expired:    bool
    is_used:       bool


# ---------------------------------------------------------------------------
# Public: book search result for the form (no auth)
# ---------------------------------------------------------------------------

class PublicBookSearchItem(CamelModel):
    book_id:     int
    title:       str
    authors:     str   # "Author A, Author B" pre-formatted
    edition:     Optional[str]
    subject_area: Optional[str]
    mrp:         int
    format:      str


# ---------------------------------------------------------------------------
# Public: faculty submits new request from blank form
# ---------------------------------------------------------------------------

class NewRequestLineItem(CamelModel):
    book_id:              int
    quantity:             int = 1
    format:               str = "Physical"
    subject_context_free: Optional[str] = None

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


class FacultyNewRequestSubmit(CamelModel):
    visit_notes:        Optional[str] = None
    request_date:       date
    dispatch_type:      str = "college"
    alt_recipient_name: Optional[str] = None
    alt_address:        Optional[str] = None
    alt_city:           Optional[str] = None
    alt_pin:            Optional[str] = None
    line_items:         List[NewRequestLineItem]

    @field_validator("dispatch_type")
    @classmethod
    def valid_dispatch(cls, v: str) -> str:
        if v not in {"college", "alternate"}:
            raise ValueError("dispatch_type must be college or alternate")
        return v


class FacultyNewRequestResult(CamelModel):
    request_ref:  str
    faculty_name: str
    college_name: str
    submitted_at: datetime
    book_count:   int
    message:      str = "Your complimentary copy request has been submitted successfully."
