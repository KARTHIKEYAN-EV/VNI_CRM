from sqlalchemy import Boolean, Column, Integer, String, Text
from sqlalchemy import DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class AppConfig(Base):
    __tablename__ = "p_app_config"

    config_id    = Column(Integer,     primary_key=True)
    config_key   = Column(String(100), nullable=False, unique=True)
    config_value = Column(String(255), nullable=False)
    description  = Column(Text)
    updated_at   = Column(DateTime(timezone=True), nullable=False, server_default=func.now(),
                          onupdate=func.now())
    updated_by   = Column(Integer,     nullable=False, default=1)


class RejectionReason(Base):
    __tablename__ = "p_rejection_reason"

    reason_id      = Column(Integer,     primary_key=True)
    reason_code    = Column(String(50),  nullable=False, unique=True)
    reason_label   = Column(String(150), nullable=False)
    requires_notes = Column(Boolean,     nullable=False, default=False)
    is_active      = Column(Boolean,     nullable=False, default=True)
    created_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now(),
                            onupdate=func.now())
    created_by     = Column(Integer,     nullable=False, default=1)
    updated_by     = Column(Integer,     nullable=False, default=1)
