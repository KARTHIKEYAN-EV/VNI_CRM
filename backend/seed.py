"""
VNI CRM — Database Seeder
Run once after schema.sql has been applied:

    cd backend
    python seed.py

Creates the bootstrap admin user and inserts P_ table defaults.
Safe to re-run — uses "insert if not exists" logic throughout.
"""
import sys

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth.jwt_handler import hash_password
from app.database import SessionLocal
from app.models import AppConfig, RejectionReason, User


def seed() -> None:
    db = SessionLocal()
    try:
        _seed_users(db)
        _seed_app_config(db)
        _seed_rejection_reasons(db)
        db.commit()
        print("\n✨  Seed complete.")
    except SQLAlchemyError as exc:
        db.rollback()
        print(f"\n❌  Seed failed: {exc}")
        sys.exit(1)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_users(db) -> None:
    """Bootstrap default users."""

    users = [
        {
            "full_name": "Admin",
            "email": "admin@vni.in",
            "password": "Admin@VNI2026",
            "role": "admin",
        },
        {
            "full_name": "Back Office User",
            "email": "backoffice@vni.in",
            "password": "BackOffice@VNI2026",
            "role": "back_office",
        },
        {
            "full_name": "Manager User",
            "email": "manager@vni.in",
            "password": "Manager@VNI2026",
            "role": "manager",
        },
        {
            "full_name": "Sales Representative",
            "email": "salesrep@vni.in",
            "password": "SalesRep@VNI2026",
            "role": "rep",
        },
        {
            "full_name": "CEO",
            "email": "ceo@vni.in",
            "password": "CEO@VNI2026",
            "role": "ceo",
        },
    ]

    for user_data in users:
        existing = (
            db.query(User)
            .filter(User.email == user_data["email"])
            .first()
        )

        if existing:
            print(f"  ⏭️  {user_data['email']} already exists - skipping")
            continue

        user = User(
            full_name=user_data["full_name"],
            email=user_data["email"],
            password_hash=hash_password(user_data["password"]),
            role=user_data["role"],
            is_active=True,
            created_by=1,
            updated_by=1,
        )

        db.add(user)
        db.flush()

        # Make created_by and updated_by point to itself
        user.created_by = user.user_id
        user.updated_by = user.user_id
        db.flush()

        print(
            f"  ✅ Created {user.role}: "
            f"{user.email} / {user_data['password']}"
        )

def _seed_app_config(db) -> None:
    configs = [
        ("max_qty_per_line_item",  "3",  "Max copies of a single book per comp request line item"),
        ("token_expiry_hours",     "72", "Faculty form link token validity in hours"),
        ("followup_reminder_days", "30", "Days after DELIVERED before PENDING_FOLLOW_UP is set"),
        ("max_copies_per_request", "5",  "Soft cap on total copies across all line items in one request"),
        ("reminder_repeat_days",   "30", "Interval in days for repeat adoption follow-up reminders"),
    ]
    inserted = 0
    for key, value, desc in configs:
        if not db.query(AppConfig).filter(AppConfig.config_key == key).first():
            db.add(AppConfig(config_key=key, config_value=value, description=desc, updated_by=1))
            inserted += 1
    print(f"  ✅  App config: {inserted} row(s) inserted")


def _seed_rejection_reasons(db) -> None:
    reasons = [
        ("NO_STOCK",     "No Stock Available",      False),
        ("NEW_EDITION",  "New Edition Awaited",     False),
        ("DUPLICATE",    "Duplicate Request",        False),
        ("OUT_OF_SCOPE", "Outside Region Scope",    False),
        ("OTHERS",       "Others (please specify)",  True),
    ]
    inserted = 0
    for code, label, req_notes in reasons:
        if not db.query(RejectionReason).filter(RejectionReason.reason_code == code).first():
            db.add(RejectionReason(
                reason_code    = code,
                reason_label   = label,
                requires_notes = req_notes,
                created_by     = 1,
                updated_by     = 1,
            ))
            inserted += 1
    print(f"  ✅  Rejection reasons: {inserted} row(s) inserted")


if __name__ == "__main__":
    print("🌱  VNI CRM — Database Seeder\n")
    seed()
