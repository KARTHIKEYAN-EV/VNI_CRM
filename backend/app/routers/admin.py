from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.dependencies import RequireAdmin
from ..database import get_db
from ..utils.scheduler import get_system_stats, run_follow_up_check

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/follow-up-check")
def trigger_follow_up_check(
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    """
    Manually trigger the follow-up check:
      - Transitions DELIVERED → PENDING_FOLLOW_UP for requests past threshold
      - Sends consolidated reminder emails to each affected rep
    Safe to call repeatedly. Normally run as a daily cron job via
    scripts/run_reminders.py.
    """
    return run_follow_up_check(db)


@router.get("/stats")
def system_stats(
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    """System-wide request counts by status."""
    return get_system_stats(db)


@router.post("/test-notification")
def test_notification(
    current_user: RequireAdmin,
):
    """
    Send a test email to the admin's own address to verify SMTP config.
    Returns { sent: bool } — check backend logs for error details.
    """
    from ..utils.notifications import _send_email
    sent = _send_email(
        to_address = current_user.email,
        subject    = "VNI CRM — SMTP test",
        html_body  = "<p>SMTP configuration is working correctly.</p>",
        text_body  = "SMTP configuration is working correctly.",
    )
    return {"sent": sent, "to": current_user.email}
