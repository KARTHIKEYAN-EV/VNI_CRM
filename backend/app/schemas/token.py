from datetime import datetime
from typing import List, Optional

from pydantic import field_validator

from .auth import CamelModel


# ---------------------------------------------------------------------------
# Token generation (Rep → send form link to faculty)
# ---------------------------------------------------------------------------

class SendFormRequest(CamelModel):
    send_channel:   str = "whatsapp"      # whatsapp | email | both
    send_to_number: Optional[str] = None  # override number (defaults to faculty's WhatsApp)

    @field_validator("send_channel")
    @classmethod
    def valid_channel(cls, v: str) -> str:
        if v not in {"whatsapp", "email", "both"}:
            raise ValueError("send_channel must be whatsapp, email, or both")
        return v


class FormTokenResponse(CamelModel):
    token_id:     int
    token_hash:   str            # raw token — frontend builds URL from this
    request_id:   int
    request_ref:  str
    send_channel: str
    expires_at:   datetime
    is_used:      bool


# ---------------------------------------------------------------------------
# Public form data (no auth — returned by GET /public/form/{token})
# ---------------------------------------------------------------------------

class PublicBookItem(CamelModel):
    line_item_id: int
    book_id:      int
    book_title:   str
    authors:      str   # "Author A, Author B" — pre-formatted for display
    quantity:     int
    format:       str


class PublicFormData(CamelModel):
    """
    Pre-filled form data returned to faculty for review.
    All sensitive internal fields are excluded.
    """
    token_hash:         str
    request_id:         int
    request_ref:        str
    request_date:       str         # ISO date string
    faculty_name:       str
    college_name:       str
    dept_name:          str
    rep_name:           str
    visit_notes:        Optional[str]
    dispatch_type:      str
    alt_recipient_name: Optional[str]
    alt_address:        Optional[str]
    alt_city:           Optional[str]
    alt_pin:            Optional[str]
    books:              List[PublicBookItem]
    expires_at:         datetime
    is_expired:         bool
    is_used:            bool


# ---------------------------------------------------------------------------
# Faculty submission (POST /public/form/{token})
# ---------------------------------------------------------------------------

class BookQuantityEdit(CamelModel):
    line_item_id: int
    quantity:     int   # faculty-requested quantity (min 1)


class PublicBookSearchItem(CamelModel):
    book_id:      int
    title:        str
    authors:      str
    edition:      Optional[str]
    subject_area: Optional[str]
    mrp:          Optional[float] = None
    format:       Optional[str]   = None


class AdditionalBookItem(CamelModel):
    book_id:              int
    quantity:             int = 1
    format:               str = "Physical"
    subject_context_free: Optional[str] = None


class FacultyFormSubmit(CamelModel):
    """
    Faculty can adjust dispatch preference, notes, and book quantities,
    and add a small number of additional books to the request.
    """
    visit_notes:        Optional[str]            = None
    dispatch_type:      str                      = "college"
    alt_recipient_name: Optional[str]            = None
    alt_address:        Optional[str]            = None
    alt_city:           Optional[str]            = None
    alt_pin:            Optional[str]            = None
    books:              Optional[List[BookQuantityEdit]]   = None  # omit = no change
    additional_books:   Optional[List[AdditionalBookItem]] = None  # new books faculty wants to add


class FacultyFormSubmitResult(CamelModel):
    request_ref:  str
    faculty_name: str
    college_name: str
    submitted_at: datetime
    message:      str = "Your comp copy request has been submitted successfully."
