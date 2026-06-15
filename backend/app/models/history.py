from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy import DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


# =============================================================================
# H_REQUEST_AUDIT — append-only status change log
# =============================================================================

class RequestAudit(Base):
    """
    Immutable audit log. Every status change on every comp request.
    DB trigger (fn_guard_history_immutability) enforces no UPDATE/DELETE.
    Application code must NEVER call db.delete() or UPDATE on this table.
    No is_active / updated_at / updated_by — these fields have no meaning
    on immutable records.
    """
    __tablename__ = "h_request_audit"

    audit_id    = Column(Integer,     primary_key=True)
    request_id  = Column(Integer,     ForeignKey("t_comp_request.request_id"), nullable=False)
    from_status = Column(String(25))   # NULL on initial creation event
    to_status   = Column(String(25),  nullable=False)
    changed_by  = Column(Integer,     nullable=False)  # FK → m_user; not constrained (allows system writes)
    changed_at  = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    channel     = Column(String(30))  # rep_app | faculty_link | admin | system
    notes       = Column(Text)

    # Relationships
    request = relationship("CompRequest", back_populates="audit_logs")


# =============================================================================
# H_MASTER_DATA_REVIEW — append-only admin review log
# =============================================================================

class MasterDataReview(Base):
    """
    Immutable audit log for Admin actions on PENDING_REVIEW master data.
    Also protected by DB trigger.
    """
    __tablename__ = "h_master_data_review"

    review_id       = Column(Integer,     primary_key=True)
    entity_type     = Column(String(30),  nullable=False)   # college | faculty
    entity_id       = Column(Integer,     nullable=False)
    action_taken    = Column(String(20),  nullable=False)   # approved | merged | rejected
    reviewed_by     = Column(Integer,     nullable=False)   # FK → m_user (admin)
    reviewed_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    merge_target_id = Column(Integer)     # populated when action_taken = 'merged'
    notes           = Column(Text)
