-- =============================================================================
-- VNI CRM — Seed Data (P_ tables only)
-- Run AFTER schema.sql
-- Admin user is created by seed.py (needs bcrypt hash generation)
-- =============================================================================

-- P_APP_CONFIG — application parameters (all configurable by Admin at runtime)
INSERT INTO p_app_config (config_key, config_value, description, updated_by) VALUES
    ('max_qty_per_line_item',  '3',  'Max copies of a single book per comp request line item', 1),
    ('token_expiry_hours',     '72', 'Faculty form link token validity in hours', 1),
    ('followup_reminder_days', '30', 'Days after DELIVERED before PENDING_FOLLOW_UP status is set', 1),
    ('max_copies_per_request', '5',  'Soft cap on total book copies across all line items in one request', 1),
    ('reminder_repeat_days',   '30', 'Interval in days for repeat adoption follow-up reminders after first', 1);

-- P_REJECTION_REASON — predefined options for CEO when rejecting requests
INSERT INTO p_rejection_reason (reason_code, reason_label, requires_notes, created_by, updated_by) VALUES
    ('NO_STOCK',     'No Stock Available',      FALSE, 1, 1),
    ('NEW_EDITION',  'New Edition Awaited',     FALSE, 1, 1),
    ('DUPLICATE',    'Duplicate Request',        FALSE, 1, 1),
    ('OUT_OF_SCOPE', 'Outside Region Scope',    FALSE, 1, 1),
    ('OTHERS',       'Others (please specify)',  TRUE,  1, 1);
