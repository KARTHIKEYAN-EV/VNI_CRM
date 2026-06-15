from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy import DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import AuditMixin, Base


# =============================================================================
# T_COMP_REQUEST — header
# =============================================================================

class CompRequest(AuditMixin, Base):
    __tablename__ = "t_comp_request"

    request_id         = Column(Integer,    primary_key=True)
    request_ref        = Column(String(20), nullable=False, unique=True)  # VNI-2026-000001
    rep_id             = Column(Integer,    ForeignKey("m_user.user_id"),       nullable=False)
    faculty_id         = Column(Integer,    ForeignKey("m_faculty.faculty_id"), nullable=False)
    college_id         = Column(Integer,    ForeignKey("m_college.college_id"), nullable=False)
    dept_id            = Column(Integer,    ForeignKey("m_department.dept_id"), nullable=False)
    visit_notes        = Column(Text)
    submission_mode    = Column(String(20), nullable=False, default="rep_filled")
    status             = Column(String(25), nullable=False, default="DRAFT")
    dispatch_type      = Column(String(20), nullable=False, default="college")
    alt_recipient_name = Column(String(150))
    alt_address        = Column(Text)
    alt_city           = Column(String(100))
    alt_pin            = Column(String(10))
    # Business date of the visit — used in all MIS reports (not created_at)
    request_date       = Column(Date,       nullable=False)
    approved_by        = Column(Integer,    ForeignKey("m_user.user_id"))
    rejection_reason   = Column(String(50), ForeignKey("p_rejection_reason.reason_code"))
    rejection_notes    = Column(Text)
    # Status timestamp trail
    submitted_at       = Column(DateTime(timezone=True))
    approved_at        = Column(DateTime(timezone=True))
    rejected_at        = Column(DateTime(timezone=True))
    dispatched_at      = Column(DateTime(timezone=True))
    delivered_at       = Column(DateTime(timezone=True))
    adoption_marked_at = Column(DateTime(timezone=True))

    # Relationships
    rep      = relationship("User", back_populates="comp_requests_as_rep",
                            foreign_keys=[rep_id])
    approver = relationship("User", back_populates="comp_requests_approved",
                            foreign_keys=[approved_by])
    faculty    = relationship("Faculty",    back_populates="comp_requests")
    college    = relationship("College")
    department = relationship("Department")
    line_items  = relationship("CompRequestBook",   back_populates="request",
                               cascade="all, delete-orphan")
    audit_logs  = relationship("RequestAudit",      back_populates="request")
    form_tokens = relationship("FacultyFormToken",  back_populates="request")


# =============================================================================
# T_COMP_REQUEST_BOOK — line items
# =============================================================================

class CompRequestBook(Base):
    __tablename__ = "t_comp_request_book"

    line_item_id         = Column(Integer,    primary_key=True)
    request_id           = Column(Integer,    ForeignKey("t_comp_request.request_id"), nullable=False)
    book_id              = Column(Integer,    ForeignKey("m_book.book_id"),             nullable=False)
    subject_id           = Column(Integer,    ForeignKey("m_subject.subject_id"))
    subject_context_free = Column(String(200))  # free text if subject not in master
    quantity             = Column(Integer,    nullable=False, default=1)
    format               = Column(String(20), nullable=False, default="Physical")
    dup_override         = Column(Boolean,    nullable=False, default=False)
    is_active            = Column(Boolean,    nullable=False, default=True)
    created_at           = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), nullable=False, server_default=func.now(),
                                  onupdate=func.now())

    # Relationships
    request = relationship("CompRequest",  back_populates="line_items")
    book    = relationship("Book",         back_populates="comp_line_items")
    subject = relationship("Subject",      back_populates="comp_line_items")


# =============================================================================
# T_FACULTY_FORM_TOKEN
# =============================================================================

class FacultyFormToken(Base):
    __tablename__ = "t_faculty_form_token"

    token_id       = Column(Integer,     primary_key=True)
    request_id     = Column(Integer,     ForeignKey("t_comp_request.request_id"),  nullable=False)
    faculty_id     = Column(Integer,     ForeignKey("m_faculty.faculty_id"),        nullable=False)
    token_hash     = Column(String(255), nullable=False, unique=True)
    send_channel   = Column(String(20),  nullable=False, default="email")
    send_to_number = Column(String(20))
    expires_at     = Column(DateTime(timezone=True), nullable=False)
    used_at        = Column(DateTime(timezone=True))
    is_active      = Column(Boolean,     nullable=False, default=True)
    created_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    request = relationship("CompRequest",   back_populates="form_tokens")
    faculty = relationship("Faculty",       back_populates="form_tokens")


# =============================================================================
# T_NEW_REQUEST_TOKEN — blank-form token for faculty-initiated requests
# =============================================================================

class NewRequestToken(Base):
    __tablename__ = "t_new_request_token"

    token_id           = Column(Integer,     primary_key=True)
    rep_id             = Column(Integer,     ForeignKey("m_user.user_id"),              nullable=False)
    faculty_id         = Column(Integer,     ForeignKey("m_faculty.faculty_id"),         nullable=False)
    token_hash         = Column(String(255), nullable=False, unique=True)
    send_channel       = Column(String(20),  nullable=False, default="whatsapp")
    send_to_number     = Column(String(20))
    expires_at         = Column(DateTime(timezone=True), nullable=False)
    used_at            = Column(DateTime(timezone=True))
    created_request_id = Column(Integer,     ForeignKey("t_comp_request.request_id"))
    is_active          = Column(Boolean,     nullable=False, default=True)
    created_at         = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    rep             = relationship("User",        foreign_keys=[rep_id])
    faculty         = relationship("Faculty",     back_populates="new_request_tokens")
    created_request = relationship("CompRequest", foreign_keys=[created_request_id])
