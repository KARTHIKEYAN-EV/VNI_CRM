-- ---------------------------------------------------------------------------
-- Migration: Add t_new_request_token table
-- Purpose: Tokenised "faculty-initiates" flow — rep sends a blank form link
--          to faculty; faculty searches books and submits a brand-new request
--          without logging in.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS t_new_request_token (
    token_id       SERIAL        PRIMARY KEY,
    rep_id         INTEGER       NOT NULL REFERENCES m_user(user_id),
    faculty_id     INTEGER       NOT NULL REFERENCES m_faculty(faculty_id),
    token_hash     VARCHAR(255)  NOT NULL UNIQUE,
    send_channel   VARCHAR(20)   NOT NULL DEFAULT 'whatsapp',
    send_to_number VARCHAR(20),
    expires_at     TIMESTAMPTZ   NOT NULL,
    used_at        TIMESTAMPTZ,
    -- If used, the created request is linked here for traceability
    created_request_id INTEGER    REFERENCES t_comp_request(request_id),
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_new_request_token_hash
    ON t_new_request_token(token_hash)
    WHERE is_active = TRUE;

COMMENT ON TABLE t_new_request_token IS
    'Tokens for faculty-initiated new requests (no existing request needed). '
    'Rep sends link to faculty; faculty picks books and submits a fresh request.';
