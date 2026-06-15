"""
Audit utilities.

log_status_change is the single, canonical function for writing to
H_REQUEST_AUDIT.  Every status transition in the system MUST go through
this function — never write to h_request_audit directly from a router.

The function does NOT call db.commit(); callers commit as part of their
own transaction so the status update and audit row are always atomic.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from ..models.history import RequestAudit


def log_status_change(
    db: Session,
    *,
    request_id: int,
    from_status: Optional[str],
    to_status: str,
    changed_by: int,
    channel: str = "rep_app",
    notes: Optional[str] = None,
) -> RequestAudit:
    """
    Append one row to H_REQUEST_AUDIT.

    Args:
        db:          SQLAlchemy session (caller owns commit/rollback).
        request_id:  The comp request being changed.
        from_status: Previous status (None on initial creation).
        to_status:   New status.
        changed_by:  user_id of the actor (use 0 for system-triggered changes).
        channel:     rep_app | faculty_link | admin | system
        notes:       Optional free-text context.

    Returns:
        The newly created RequestAudit ORM object (not yet flushed).
    """
    entry = RequestAudit(
        request_id  = request_id,
        from_status = from_status,
        to_status   = to_status,
        changed_by  = changed_by,
        changed_at  = datetime.now(timezone.utc),
        channel     = channel,
        notes       = notes,
    )
    db.add(entry)
    return entry
