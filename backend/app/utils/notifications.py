"""
VNI CRM — Notification utilities (Phase G)

Sending strategy:
  - If email_enabled = False (default) → log intent, return False, never raise
  - If email_enabled = True  → attempt SMTP send; log error on failure, return False, never raise

This "fire and forget" design means notifications never block the main request flow.
Phase 2+ can replace this module with SendGrid / AWS SES without changing callers.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from ..config import get_settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Core send helper
# ---------------------------------------------------------------------------

def _send_email(
    to_address: str,
    subject:    str,
    html_body:  str,
    text_body:  str = "",
) -> bool:
    """
    Attempt to send an email.  Returns True if sent, False otherwise.
    Never raises — all exceptions are caught and logged.
    """
    settings = get_settings()

    if not to_address or "@" not in to_address:
        logger.info(f"[NOTIFY skipped — no valid email] subject={subject!r}")
        return False

    if not settings.email_enabled or not settings.smtp_host:
        logger.info(
            f"[NOTIFY not sent — SMTP disabled] "
            f"to={to_address!r} subject={subject!r}"
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{settings.smtp_from_name} <{settings.smtp_from}>"
        msg["To"]      = to_address

        if text_body:
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, [to_address], msg.as_string())

        logger.info(f"[NOTIFY sent] to={to_address!r} subject={subject!r}")
        return True

    except Exception as exc:
        logger.error(
            f"[NOTIFY failed] to={to_address!r} subject={subject!r} error={exc!r}"
        )
        return False


# ---------------------------------------------------------------------------
# Email templates
# ---------------------------------------------------------------------------

def _base_html(content: str) -> str:
    """Wrap email content in a minimal branded HTML shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#D01D22;padding:20px 28px;">
      <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
        Vijay Nicole Imprints
      </p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">
        Comp Copy Tracking System
      </p>
    </div>
    <!-- Body -->
    <div style="padding:28px;">
      {content}
    </div>
    <!-- Footer -->
    <div style="padding:16px 28px;background:#f9f9f9;border-top:1px solid #eeeeee;">
      <p style="margin:0;color:#999999;font-size:11px;">
        This is an automated message from VNI CRM. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>"""


def _p(text: str, color: str = "#333333", size: str = "14px") -> str:
    return f'<p style="margin:0 0 14px;color:{color};font-size:{size};line-height:1.6;">{text}</p>'


def _label(text: str) -> str:
    return f'<p style="margin:0 0 4px;color:#999999;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">{text}</p>'


def _value(text: str) -> str:
    return f'<p style="margin:0 0 14px;color:#111111;font-size:14px;font-weight:600;">{text}</p>'


def _info_box(rows: list[tuple[str, str]]) -> str:
    cells = "".join(
        f'<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#666;font-size:12px;">{k}</td>'
        f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#111;font-size:12px;font-weight:600;">{v}</td></tr>'
        for k, v in rows
    )
    return f'<table style="width:100%;border-collapse:collapse;border:1px solid #eeeeee;border-radius:6px;margin-bottom:18px;">{cells}</table>'


def _button(label: str, url: str) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;background:#D01D22;color:#ffffff;'
        f'padding:11px 22px;border-radius:6px;text-decoration:none;font-size:14px;'
        f'font-weight:600;margin-bottom:18px;">{label}</a>'
    )


# ---------------------------------------------------------------------------
# Notification functions
# ---------------------------------------------------------------------------

def notify_faculty_dispatch(
    faculty_email:  str,
    faculty_name:   str,
    request_ref:    str,
    college_name:   str,
    books:          list[str],      # list of book titles
    rep_name:       str,
) -> bool:
    """
    Notify faculty when their comp copy has been dispatched.
    Constitution §15 item 8: "Faculty receives a notification when comp copy is dispatched."
    """
    book_list_html = "".join(
        f'<li style="padding:4px 0;color:#333;font-size:13px;">{b}</li>'
        for b in books
    )
    content = (
        _p(f"Dear {faculty_name},")
        + _p("Your complimentary book(s) from <strong>Vijay Nicole Imprints</strong> have been dispatched. "
             "Please expect delivery within 5–7 working days.")
        + _info_box([
            ("Request Reference", request_ref),
            ("College",           college_name),
            ("Dispatched by",     rep_name),
        ])
        + f'<p style="margin:0 0 8px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Books</p>'
        + f'<ul style="margin:0 0 18px;padding-left:20px;">{book_list_html}</ul>'
        + _p("If you have any questions, please contact your VNI sales representative.", color="#666666", size="13px")
        + _p("Regards,<br><strong>VNI Field Team</strong>")
    )
    subject  = f"Your VNI comp copy is on its way — {request_ref}"
    text     = (
        f"Dear {faculty_name},\n\n"
        f"Your complimentary book(s) from Vijay Nicole Imprints have been dispatched.\n"
        f"Request Reference: {request_ref}\n"
        f"Books: {', '.join(books)}\n\n"
        f"Please expect delivery within 5–7 working days.\n\n"
        f"Regards,\nVNI Field Team"
    )
    return _send_email(faculty_email, subject, _base_html(content), text)


def notify_rep_rejection(
    rep_email:      str,
    rep_name:       str,
    request_ref:    str,
    faculty_name:   str,
    reason_label:   str,
    reason_notes:   Optional[str],
    frontend_url:   str,
) -> bool:
    """
    Notify rep when their comp request has been rejected by CEO.
    Constitution §15 item 6: "Rep is notified on rejection. Rep can resubmit."
    """
    detail_url = f"{frontend_url}/requests/{request_ref}"
    content = (
        _p(f"Dear {rep_name},")
        + _p(f"The following comp request has been <strong style='color:#D01D22;'>rejected</strong> by the approver.")
        + _info_box([
            ("Request Reference", request_ref),
            ("Faculty",           faculty_name),
            ("Rejection Reason",  reason_label),
        ]
        + ([("Additional Notes", reason_notes)] if reason_notes else []))
        + _p("You can resubmit the request after making any necessary changes.")
        + _button("View Request", detail_url)
        + _p("Regards,<br><strong>VNI CRM System</strong>")
    )
    subject = f"Comp request {request_ref} was rejected"
    text    = (
        f"Dear {rep_name},\n\n"
        f"Comp request {request_ref} for {faculty_name} has been rejected.\n"
        f"Reason: {reason_label}\n"
        + (f"Notes: {reason_notes}\n" if reason_notes else "")
        + f"\nYou can resubmit after making changes.\n\nVNI CRM System"
    )
    return _send_email(rep_email, subject, _base_html(content), text)


def notify_rep_follow_up(
    rep_email:    str,
    rep_name:     str,
    requests:     list[dict],   # [{request_ref, faculty_name, college_name, delivered_at, days_ago}]
    frontend_url: str,
) -> bool:
    """
    Remind rep to mark adoption status for delivered-but-unactioned requests.
    Constitution §7.3: "Reminders continue at Y-day intervals until adoption status is set."
    """
    if not requests:
        return False

    rows_html = "".join(
        f'<tr>'
        f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#D01D22;font-weight:600;">{r["request_ref"]}</td>'
        f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;">{r["faculty_name"]}</td>'
        f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666;">{r["college_name"]}</td>'
        f'<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">{r["days_ago"]} days ago</td>'
        f'</tr>'
        for r in requests
    )
    table = (
        f'<table style="width:100%;border-collapse:collapse;border:1px solid #eee;margin-bottom:18px;">'
        f'<thead><tr style="background:#f9f9f9;">'
        f'<th style="padding:8px 12px;text-align:left;font-size:11px;color:#999;font-weight:600;">REF</th>'
        f'<th style="padding:8px 12px;text-align:left;font-size:11px;color:#999;font-weight:600;">FACULTY</th>'
        f'<th style="padding:8px 12px;text-align:left;font-size:11px;color:#999;font-weight:600;">COLLEGE</th>'
        f'<th style="padding:8px 12px;text-align:left;font-size:11px;color:#999;font-weight:600;">DELIVERED</th>'
        f'</tr></thead><tbody>{rows_html}</tbody></table>'
    )
    content = (
        _p(f"Dear {rep_name},")
        + _p(f"You have <strong>{len(requests)}</strong> delivered comp request(s) awaiting adoption follow-up. "
             "Please visit each faculty member and update the adoption status.")
        + table
        + _button("View Follow-up Queue", f"{frontend_url}/follow-ups")
        + _p("Regards,<br><strong>VNI CRM System</strong>")
    )
    subject = f"Action required: {len(requests)} comp request(s) need adoption follow-up"
    text    = (
        f"Dear {rep_name},\n\n"
        f"You have {len(requests)} delivered comp request(s) awaiting adoption follow-up:\n\n"
        + "\n".join(f"- {r['request_ref']} | {r['faculty_name']} | {r['college_name']} | {r['days_ago']} days ago"
                    for r in requests)
        + f"\n\nPlease update adoption status at: {frontend_url}/follow-ups\n\nVNI CRM System"
    )
    return _send_email(rep_email, subject, _base_html(content), text)
