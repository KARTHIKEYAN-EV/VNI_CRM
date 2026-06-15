"""
VNI CRM — Follow-up check scheduler (Phase G)

Designed to run:
  1. As a cron job via  scripts/run_reminders.py
  2. On-demand via     POST /api/v1/admin/follow-up-check  (admin endpoint)

Run frequency recommendation: once per day (e.g. 07:00 local time).
Safe to re-run — already PENDING_FOLLOW_UP requests are skipped.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..models.master import User
from ..models.transaction import CompRequest, CompRequestBook
from ..utils.audit import log_status_change
from ..utils.config import get_config_int
from ..utils.notifications import notify_rep_follow_up

logger = logging.getLogger(__name__)

SYSTEM_USER_ID = 1   # used as changed_by for system-triggered transitions


# ---------------------------------------------------------------------------
# Follow-up check
# ---------------------------------------------------------------------------

def run_follow_up_check(db: Session) -> dict:
    """
    1. Find all DELIVERED requests whose delivered_at is older than
       followup_reminder_days (default 30).
    2. Transition them to PENDING_FOLLOW_UP and log to H_REQUEST_AUDIT.
    3. Send reminder emails to the owning reps (grouped by rep).

    Returns a summary dict:  { updated, threshold_days, emails_sent, checked_at }
    """
    threshold_days = get_config_int(db, "followup_reminder_days", 30)
    cutoff         = datetime.now(timezone.utc) - timedelta(days=threshold_days)

    # Requests that have been delivered long enough without adoption update
    stale = (
        db.query(CompRequest)
        .options(
            joinedload(CompRequest.rep),
            joinedload(CompRequest.faculty),
            joinedload(CompRequest.college),
        )
        .filter(
            CompRequest.status       == "DELIVERED",
            CompRequest.delivered_at <= cutoff,
            CompRequest.is_active    == True,
        )
        .all()
    )

    updated = 0
    for r in stale:
        r.status     = "PENDING_FOLLOW_UP"
        r.updated_by = SYSTEM_USER_ID
        log_status_change(
            db,
            request_id  = r.request_id,
            from_status = "DELIVERED",
            to_status   = "PENDING_FOLLOW_UP",
            changed_by  = SYSTEM_USER_ID,
            channel     = "system",
            notes       = (
                f"Auto-triggered: {threshold_days} days elapsed since delivery "
                f"without adoption status update"
            ),
        )
        updated += 1
        logger.info(f"PENDING_FOLLOW_UP set for {r.request_ref}")

    if updated:
        db.commit()

    # Send reminder emails grouped by rep
    emails_sent = _send_reminder_emails(db, stale)

    summary = {
        "updated":       updated,
        "threshold_days": threshold_days,
        "emails_sent":   emails_sent,
        "checked_at":    datetime.now(timezone.utc).isoformat(),
    }
    logger.info(f"Follow-up check complete: {summary}")
    return summary


def _send_reminder_emails(db: Session, requests: list) -> int:
    """
    Group requests by rep and send one consolidated reminder email per rep.
    Also includes already-PENDING_FOLLOW_UP requests (ongoing reminders).
    """
    from ..config import get_settings
    settings = get_settings()

    # Collect all PENDING_FOLLOW_UP requests (including just-transitioned ones)
    all_pending = (
        db.query(CompRequest)
        .options(
            joinedload(CompRequest.rep),
            joinedload(CompRequest.faculty),
            joinedload(CompRequest.college),
        )
        .filter(
            CompRequest.status    == "PENDING_FOLLOW_UP",
            CompRequest.is_active == True,
        )
        .all()
    )

    # Group by rep
    by_rep: dict[int, list] = {}
    for r in all_pending:
        by_rep.setdefault(r.rep_id, []).append(r)

    sent = 0
    for rep_id, rep_requests in by_rep.items():
        rep = rep_requests[0].rep
        if not rep or not rep.email:
            continue

        items = [
            {
                "request_ref": r.request_ref,
                "faculty_name": r.faculty.faculty_name if r.faculty else "—",
                "college_name": r.college.college_name if r.college else "—",
                "delivered_at": r.delivered_at.date().isoformat() if r.delivered_at else "—",
                "days_ago":     (
                    (datetime.now(timezone.utc) - r.delivered_at).days
                    if r.delivered_at else 0
                ),
            }
            for r in sorted(rep_requests,
                            key=lambda x: x.delivered_at or datetime.min.replace(tzinfo=timezone.utc))
        ]

        ok = notify_rep_follow_up(
            rep_email    = rep.email,
            rep_name     = rep.full_name,
            requests     = items,
            frontend_url = settings.frontend_url,
        )
        if ok:
            sent += 1

    return sent


# ---------------------------------------------------------------------------
# Stats helper (used by admin endpoint)
# ---------------------------------------------------------------------------

def get_system_stats(db: Session) -> dict:
    """Return request counts by status for the admin dashboard."""
    rows = (
        db.query(CompRequest.status, func.count(CompRequest.request_id))
        .filter(CompRequest.is_active == True)
        .group_by(CompRequest.status)
        .all()
    )
    by_status = {status: count for status, count in rows}

    total = sum(by_status.values())
    return {
        "total_requests": total,
        "by_status":      by_status,
        "pending_approval":   by_status.get("SUBMITTED",         0),
        "pending_dispatch":   by_status.get("APPROVED",          0),
        "pending_delivery":   by_status.get("DISPATCHED",        0),
        "pending_adoption":   by_status.get("DELIVERED",         0)
                            + by_status.get("PENDING_FOLLOW_UP", 0),
        "adopted":            by_status.get("ADOPTED",           0),
        "not_adopted":        by_status.get("NOT_ADOPTED",       0),
    }
