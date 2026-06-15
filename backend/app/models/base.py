from sqlalchemy import Boolean, Column, Integer
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class AuditMixin:
    """
    Universal audit fields — every table in the schema carries these five.

    Design decisions (from Constitution §9.3):
    - is_active:   Soft delete. Default TRUE. Hard deletes are NEVER permitted.
    - created_at:  Set on INSERT. Never updated.
    - updated_at:  Updated on every write via DB trigger (fn_set_updated_at).
    - created_by:  Integer, NOT a DB-level FK. Reason: circular dependency on
                   m_user at bootstrap time. Enforced at application layer.
    - updated_by:  Same rationale as created_by.
    """

    is_active  = Column(Boolean,      nullable=False, default=True)
    created_at = Column(DateTime(timezone=True),  nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True),  nullable=False, server_default=func.now(),
                        onupdate=func.now())
    created_by = Column(Integer,      nullable=False)
    updated_by = Column(Integer,      nullable=False)
