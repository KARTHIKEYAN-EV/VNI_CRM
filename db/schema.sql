-- =============================================================================
-- VNI CRM — Complete Database Schema
-- Phase 1 · Comp Copy Tracking System · May 2026
-- =============================================================================
-- Run order: schema.sql → seed.sql (or via Docker init)
-- Extensions, P_ tables, M_ tables, T_ tables, H_ tables, indexes, triggers

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- trigram indexes for fuzzy search

-- =============================================================================
-- P_ PARAMETER / CONFIGURATION TABLES
-- Created first — no foreign key dependencies
-- =============================================================================

CREATE TABLE p_app_config (
    config_id    SERIAL       PRIMARY KEY,
    config_key   VARCHAR(100) NOT NULL UNIQUE,
    config_value VARCHAR(255) NOT NULL,
    description  TEXT,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by   INTEGER      NOT NULL DEFAULT 1  -- FK → m_user, enforced at app level
);

COMMENT ON TABLE  p_app_config IS 'Application-wide configuration. Admin-managed key-value store.';
COMMENT ON COLUMN p_app_config.config_key IS 'Keys: max_qty_per_line_item, token_expiry_hours, followup_reminder_days, max_copies_per_request, reminder_repeat_days';

CREATE TABLE p_rejection_reason (
    reason_id      SERIAL       PRIMARY KEY,
    reason_code    VARCHAR(50)  NOT NULL UNIQUE,
    reason_label   VARCHAR(150) NOT NULL,
    requires_notes BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by     INTEGER      NOT NULL DEFAULT 1,
    updated_by     INTEGER      NOT NULL DEFAULT 1
);

COMMENT ON TABLE p_rejection_reason IS 'Predefined rejection reasons for comp request approvals. Seeded; Admin-managed.';

-- =============================================================================
-- M_ MASTER DATA TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- M_REGION — sales territories
-- ---------------------------------------------------------------------------
CREATE TABLE m_region (
    region_id         SERIAL       PRIMARY KEY,
    region_name       VARCHAR(100) NOT NULL,
    districts_covered TEXT,                        -- comma-separated district names
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        INTEGER      NOT NULL,
    updated_by        INTEGER      NOT NULL
);

COMMENT ON TABLE  m_region IS 'Sales regions covering one or more TN districts.';
COMMENT ON COLUMN m_region.districts_covered IS 'e.g. "Tirunelveli, Nagercoil, Kanyakumari"';

-- ---------------------------------------------------------------------------
-- M_USER — system users (all roles)
-- NOTE: created_by / updated_by on ALL tables are INTEGER, not FK-constrained.
-- Reason: circular dependency at bootstrap; enforced at application layer.
-- This is standard practice in audit-field patterns.
-- ---------------------------------------------------------------------------
CREATE TABLE m_user (
    user_id       SERIAL      PRIMARY KEY,
    full_name     VARCHAR(150) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL
                  CHECK (role IN ('rep', 'manager', 'ceo', 'back_office', 'admin')),
    region_id     INTEGER      REFERENCES m_region(region_id),   -- NULL for ceo/admin/back_office
    reports_to    INTEGER      REFERENCES m_user(user_id),       -- self-ref; Phase 2 hierarchy
    phone         VARCHAR(20),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    INTEGER      NOT NULL DEFAULT 1,
    updated_by    INTEGER      NOT NULL DEFAULT 1
);

COMMENT ON TABLE  m_user IS 'All system users: rep, manager, ceo, back_office, admin.';
COMMENT ON COLUMN m_user.region_id  IS 'NULL for ceo, admin, back_office roles.';
COMMENT ON COLUMN m_user.reports_to IS 'Self-referencing for org hierarchy. Fully activated in Phase 2.';

-- ---------------------------------------------------------------------------
-- M_COLLEGE
-- ---------------------------------------------------------------------------
CREATE TABLE m_college (
    college_id            SERIAL       PRIMARY KEY,
    college_name          VARCHAR(200) NOT NULL,
    college_type          VARCHAR(30)  NOT NULL
                          CHECK (college_type IN ('Engineering', 'Arts&Science', 'Other')),
    region_id             INTEGER      NOT NULL REFERENCES m_region(region_id),
    affiliated_university VARCHAR(200),
    address_street        TEXT,
    address_city          VARCHAR(100),
    address_district      VARCHAR(100),
    address_state         VARCHAR(100) NOT NULL DEFAULT 'Tamil Nadu',
    address_pin           VARCHAR(10),
    phone                 VARCHAR(20),
    email                 VARCHAR(150),
    data_quality_flag     VARCHAR(20)  NOT NULL DEFAULT 'VERIFIED'
                          CHECK (data_quality_flag IN ('VERIFIED', 'PENDING_REVIEW')),
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            INTEGER      NOT NULL,
    updated_by            INTEGER      NOT NULL
);

COMMENT ON TABLE  m_college IS 'Colleges where VNI books are prescribed. 600+ across Tamil Nadu.';
COMMENT ON COLUMN m_college.data_quality_flag IS 'PENDING_REVIEW = on-the-fly field addition; quarantined until Admin approves.';

-- ---------------------------------------------------------------------------
-- M_DEPARTMENT
-- ---------------------------------------------------------------------------
CREATE TABLE m_department (
    dept_id    SERIAL       PRIMARY KEY,
    college_id INTEGER      NOT NULL REFERENCES m_college(college_id),
    dept_name  VARCHAR(150) NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by INTEGER      NOT NULL,
    updated_by INTEGER      NOT NULL
);

COMMENT ON TABLE m_department IS 'Academic departments within a college (e.g. Dept of Commerce).';

-- ---------------------------------------------------------------------------
-- M_FACULTY
-- ---------------------------------------------------------------------------
CREATE TABLE m_faculty (
    faculty_id        SERIAL       PRIMARY KEY,
    faculty_name      VARCHAR(150) NOT NULL,
    college_id        INTEGER      NOT NULL REFERENCES m_college(college_id),
    dept_id           INTEGER      NOT NULL REFERENCES m_department(dept_id),
    designation       VARCHAR(50)
                      CHECK (designation IN ('Professor', 'Asst. Professor', 'HOD', 'Principal', 'Other')),
    phone_personal    VARCHAR(20),
    phone_work        VARCHAR(20),
    phone_whatsapp    VARCHAR(20),
    email             VARCHAR(150),
    alt_address       TEXT,                         -- home/alternate dispatch address
    data_quality_flag VARCHAR(20)  NOT NULL DEFAULT 'VERIFIED'
                      CHECK (data_quality_flag IN ('VERIFIED', 'PENDING_REVIEW')),
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        INTEGER      NOT NULL,
    updated_by        INTEGER      NOT NULL
);

COMMENT ON TABLE m_faculty IS 'Faculty members who receive comp copies. Primary target entity.';

-- ---------------------------------------------------------------------------
-- M_AUTHOR
-- ---------------------------------------------------------------------------
CREATE TABLE m_author (
    author_id   SERIAL       PRIMARY KEY,
    author_name VARCHAR(150) NOT NULL,
    email       VARCHAR(150),
    phone       VARCHAR(20),
    bio         TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  INTEGER      NOT NULL,
    updated_by  INTEGER      NOT NULL
);

COMMENT ON TABLE m_author IS 'Book authors. Linked to books via M_BOOK_AUTHOR junction.';

-- ---------------------------------------------------------------------------
-- M_BOOK
-- ---------------------------------------------------------------------------
CREATE TABLE m_book (
    book_id      SERIAL       PRIMARY KEY,
    isbn         VARCHAR(20)  UNIQUE,
    title        VARCHAR(300) NOT NULL,
    edition      VARCHAR(20),
    subject_area VARCHAR(100),
    discipline   VARCHAR(100),
    mrp          INTEGER      NOT NULL CHECK (mrp >= 0),   -- integer only, no fractions
    format       VARCHAR(20)  NOT NULL DEFAULT 'Physical'
                 CHECK (format IN ('Physical', 'Digital', 'Both')),
    comp_stock   INTEGER      NOT NULL DEFAULT 0 CHECK (comp_stock >= 0),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by   INTEGER      NOT NULL,
    updated_by   INTEGER      NOT NULL
);

COMMENT ON TABLE  m_book IS '600+ VNI titles. mrp and comp_stock are integers — no fractional quantities ever.';
COMMENT ON COLUMN m_book.comp_stock IS 'Available comp stock. Updated by Back Office.';

-- ---------------------------------------------------------------------------
-- M_BOOK_AUTHOR — junction (many-to-many)
-- ---------------------------------------------------------------------------
CREATE TABLE m_book_author (
    id           SERIAL  PRIMARY KEY,
    book_id      INTEGER NOT NULL REFERENCES m_book(book_id),
    author_id    INTEGER NOT NULL REFERENCES m_author(author_id),
    author_order INTEGER NOT NULL DEFAULT 1,   -- 1=primary, 2=co-author, etc.
    UNIQUE (book_id, author_id)
);

COMMENT ON TABLE m_book_author IS 'Many-to-many: books ↔ authors. author_order=1 is primary author.';

-- ---------------------------------------------------------------------------
-- Academic hierarchy: M_COURSE → M_SUBJECT → M_SYLLABUS
-- ---------------------------------------------------------------------------

CREATE TABLE m_course (
    course_id             SERIAL       PRIMARY KEY,
    dept_id               INTEGER      NOT NULL REFERENCES m_department(dept_id),
    college_id            INTEGER      NOT NULL REFERENCES m_college(college_id),
    course_name           VARCHAR(100) NOT NULL,       -- e.g. "B.Com", "B.E. Computer Science"
    course_type           VARCHAR(20)  NOT NULL
                          CHECK (course_type IN ('UG', 'PG', 'Diploma')),
    duration_years        INTEGER      NOT NULL CHECK (duration_years > 0),
    affiliated_university VARCHAR(200),                -- overrides college default if set
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            INTEGER      NOT NULL,
    updated_by            INTEGER      NOT NULL
);

COMMENT ON TABLE m_course IS 'Degree programmes: B.Com, B.E., M.Sc. etc. Belongs to a college department.';

CREATE TABLE m_subject (
    subject_id    SERIAL       PRIMARY KEY,
    course_id     INTEGER      NOT NULL REFERENCES m_course(course_id),
    subject_name  VARCHAR(200) NOT NULL,
    subject_code  VARCHAR(30),                         -- university-assigned code if available
    semester_year VARCHAR(20),                          -- e.g. "Semester 3", "Year 2"
    subject_type  VARCHAR(20)  NOT NULL DEFAULT 'Core'
                  CHECK (subject_type IN ('Core', 'Elective', 'Lab')),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    INTEGER      NOT NULL,
    updated_by    INTEGER      NOT NULL
);

COMMENT ON TABLE m_subject IS 'Papers within a course-semester. Same name may appear in multiple courses — each is a distinct record.';

CREATE TABLE m_syllabus (
    syllabus_id        SERIAL       PRIMARY KEY,
    subject_id         INTEGER      NOT NULL REFERENCES m_subject(subject_id),
    university         VARCHAR(200) NOT NULL,
    regulation_year    VARCHAR(20)  NOT NULL,           -- e.g. "2021 Regulation"
    unit_breakdown     JSONB,                           -- {unit1: [...topics], unit2: [...], ...}
    last_verified_date DATE,
    source_notes       TEXT,
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         INTEGER      NOT NULL,
    updated_by         INTEGER      NOT NULL,
    UNIQUE (subject_id, university, regulation_year)
);

COMMENT ON TABLE m_syllabus IS 'Unit-wise syllabus per subject/university/regulation. Foundation for Phase 2/3 pitch intelligence.';

-- M_SYLLABUS_BOOK — junction (many-to-many)
CREATE TABLE m_syllabus_book (
    id          SERIAL  PRIMARY KEY,
    syllabus_id INTEGER NOT NULL REFERENCES m_syllabus(syllabus_id),
    book_id     INTEGER NOT NULL REFERENCES m_book(book_id),
    book_role   VARCHAR(20) NOT NULL DEFAULT 'Prescribed'
                CHECK (book_role IN ('Prescribed', 'Reference')),
    UNIQUE (syllabus_id, book_id)
);

COMMENT ON TABLE m_syllabus_book IS 'Many-to-many: syllabus ↔ books. role = Prescribed or Reference.';

-- M_FACULTY_SUBJECT — junction (many-to-many)
CREATE TABLE m_faculty_subject (
    id            SERIAL  PRIMARY KEY,
    faculty_id    INTEGER NOT NULL REFERENCES m_faculty(faculty_id),
    subject_id    INTEGER NOT NULL REFERENCES m_subject(subject_id),
    academic_year VARCHAR(10),                          -- e.g. "2025-26"
    UNIQUE (faculty_id, subject_id, academic_year)
);

COMMENT ON TABLE m_faculty_subject IS 'Which subjects each faculty member teaches, per academic year.';

-- =============================================================================
-- T_ TRANSACTION TABLES
-- =============================================================================

-- Sequence for human-readable request reference numbers
CREATE SEQUENCE IF NOT EXISTS seq_request_ref START 1;

CREATE TABLE t_comp_request (
    request_id         SERIAL      PRIMARY KEY,
    request_ref        VARCHAR(20) NOT NULL UNIQUE,     -- VNI-2026-000001
    rep_id             INTEGER     NOT NULL REFERENCES m_user(user_id),
    faculty_id         INTEGER     NOT NULL REFERENCES m_faculty(faculty_id),
    college_id         INTEGER     NOT NULL REFERENCES m_college(college_id),
    dept_id            INTEGER     NOT NULL REFERENCES m_department(dept_id),
    visit_notes        TEXT,
    submission_mode    VARCHAR(20) NOT NULL DEFAULT 'rep_filled'
                       CHECK (submission_mode IN ('rep_filled', 'faculty_filled')),
    status             VARCHAR(25) NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN (
                           'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED',
                           'DISPATCHED', 'DELIVERED', 'ADOPTED', 'NOT_ADOPTED',
                           'PENDING_FOLLOW_UP', 'CANCELLED'
                       )),
    dispatch_type      VARCHAR(20) NOT NULL DEFAULT 'college'
                       CHECK (dispatch_type IN ('college', 'alternate', 'faculty_saved')),
    alt_recipient_name VARCHAR(150),
    alt_address        TEXT,
    alt_city           VARCHAR(100),
    alt_pin            VARCHAR(10),
    -- request_date = business date (rep's visit date). May differ from created_at.
    -- All MIS reports filter on request_date, not created_at.
    request_date       DATE        NOT NULL,
    approved_by        INTEGER     REFERENCES m_user(user_id),  -- must be role=ceo; enforced at app level
    rejection_reason   VARCHAR(50) REFERENCES p_rejection_reason(reason_code),
    rejection_notes    TEXT,
    -- Status timestamp trail
    submitted_at       TIMESTAMPTZ,
    approved_at        TIMESTAMPTZ,
    rejected_at        TIMESTAMPTZ,
    dispatched_at      TIMESTAMPTZ,
    delivered_at       TIMESTAMPTZ,
    adoption_marked_at TIMESTAMPTZ,
    is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by         INTEGER     NOT NULL,
    updated_by         INTEGER     NOT NULL
);

COMMENT ON TABLE  t_comp_request IS 'Core transaction: one comp request per faculty visit. Heart of Phase 1.';
COMMENT ON COLUMN t_comp_request.request_date IS 'Business date of rep visit. Used in all MIS reports. May differ from created_at.';
COMMENT ON COLUMN t_comp_request.approved_by  IS 'Must reference a user with role=ceo. Enforced at application layer.';

-- T_COMP_REQUEST_BOOK — line items (one header → many books)
CREATE TABLE t_comp_request_book (
    line_item_id         SERIAL  PRIMARY KEY,
    request_id           INTEGER NOT NULL REFERENCES t_comp_request(request_id),
    book_id              INTEGER NOT NULL REFERENCES m_book(book_id),
    subject_id           INTEGER REFERENCES m_subject(subject_id),         -- structured subject
    subject_context_free VARCHAR(200),                                       -- free text if subject not in master
    quantity             INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),  -- integers only
    format               VARCHAR(20) NOT NULL DEFAULT 'Physical'
                         CHECK (format IN ('Physical', 'Digital')),
    dup_override         BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE = rep acknowledged 12-month duplicate warning
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- No created_by/updated_by: inherits from parent request
);

COMMENT ON TABLE  t_comp_request_book IS 'Line items: one row per book in a comp request.';
COMMENT ON COLUMN t_comp_request_book.dup_override IS 'TRUE = rep acknowledged duplicate-comping warning for this book.';

-- T_FACULTY_FORM_TOKEN — tokenised self-fill links for faculty
CREATE TABLE t_faculty_form_token (
    token_id       SERIAL       PRIMARY KEY,
    request_id     INTEGER      NOT NULL REFERENCES t_comp_request(request_id),
    faculty_id     INTEGER      NOT NULL REFERENCES m_faculty(faculty_id),
    token_hash     VARCHAR(255) NOT NULL UNIQUE,
    send_channel   VARCHAR(20)  NOT NULL DEFAULT 'email'
                   CHECK (send_channel IN ('whatsapp', 'email', 'both')),
    send_to_number VARCHAR(20),              -- rep override number (e.g. different WhatsApp)
    expires_at     TIMESTAMPTZ  NOT NULL,    -- NOW() + token_expiry_hours from config
    used_at        TIMESTAMPTZ,              -- NULL = unused; NOT NULL = already submitted
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    -- No updated_at: token is immutable after creation
);

COMMENT ON TABLE  t_faculty_form_token IS 'Signed expiring tokens for faculty self-fill form links. No login required.';
COMMENT ON COLUMN t_faculty_form_token.used_at IS 'Null = unused. One-time submission enforced: once used_at is set, token cannot be reused.';

-- =============================================================================
-- H_ HISTORY / AUDIT TABLES — append-only
-- Triggers below enforce immutability at the database level.
-- =============================================================================

CREATE TABLE h_request_audit (
    audit_id    SERIAL       PRIMARY KEY,
    request_id  INTEGER      NOT NULL REFERENCES t_comp_request(request_id),
    from_status VARCHAR(25),                -- NULL for the initial creation event
    to_status   VARCHAR(25)  NOT NULL,
    changed_by  INTEGER      NOT NULL,      -- FK → m_user; not constrained to allow system entries
    changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    channel     VARCHAR(30)  CHECK (channel IN ('rep_app', 'faculty_link', 'admin', 'system')),
    notes       TEXT
    -- Deliberately NO: is_active, updated_at, updated_by — immutable records
);

COMMENT ON TABLE h_request_audit IS 'APPEND-ONLY audit log. Every status change on every request. DB trigger prevents UPDATE/DELETE.';

CREATE TABLE h_master_data_review (
    review_id       SERIAL       PRIMARY KEY,
    entity_type     VARCHAR(30)  NOT NULL CHECK (entity_type IN ('college', 'faculty')),
    entity_id       INTEGER      NOT NULL,
    action_taken    VARCHAR(20)  NOT NULL CHECK (action_taken IN ('approved', 'merged', 'rejected')),
    reviewed_by     INTEGER      NOT NULL,   -- FK → m_user (admin)
    reviewed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    merge_target_id INTEGER,                 -- populated when action_taken = 'merged'
    notes           TEXT
    -- Also append-only; no updated_at/updated_by
);

COMMENT ON TABLE h_master_data_review IS 'APPEND-ONLY audit log for PENDING_REVIEW master data admin actions.';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Trigram indexes for fuzzy search (used in duplicate detection and search UX)
CREATE INDEX idx_m_college_name_trgm  ON m_college  USING GIN (college_name  gin_trgm_ops);
CREATE INDEX idx_m_faculty_name_trgm  ON m_faculty  USING GIN (faculty_name  gin_trgm_ops);
CREATE INDEX idx_m_book_title_trgm    ON m_book     USING GIN (title          gin_trgm_ops);
CREATE INDEX idx_m_book_subject_trgm  ON m_book     USING GIN (subject_area   gin_trgm_ops);

-- Partial indexes for pending review queues (Admin dashboard)
CREATE INDEX idx_m_college_pending    ON m_college  (data_quality_flag) WHERE data_quality_flag = 'PENDING_REVIEW';
CREATE INDEX idx_m_faculty_pending    ON m_faculty  (data_quality_flag) WHERE data_quality_flag = 'PENDING_REVIEW';

-- Foreign key lookups
CREATE INDEX idx_m_college_region     ON m_college    (region_id);
CREATE INDEX idx_m_dept_college       ON m_department (college_id);
CREATE INDEX idx_m_faculty_college    ON m_faculty    (college_id);
CREATE INDEX idx_m_faculty_dept       ON m_faculty    (dept_id);
CREATE INDEX idx_m_course_dept        ON m_course     (dept_id);
CREATE INDEX idx_m_subject_course     ON m_subject    (course_id);
CREATE INDEX idx_m_user_region        ON m_user       (region_id);

-- Transaction query patterns
CREATE INDEX idx_t_req_rep            ON t_comp_request (rep_id);
CREATE INDEX idx_t_req_faculty        ON t_comp_request (faculty_id);
CREATE INDEX idx_t_req_college        ON t_comp_request (college_id);
CREATE INDEX idx_t_req_status         ON t_comp_request (status);
CREATE INDEX idx_t_req_date           ON t_comp_request (request_date);
CREATE INDEX idx_t_req_book_request   ON t_comp_request_book (request_id);
CREATE INDEX idx_t_req_book_book      ON t_comp_request_book (book_id);
CREATE INDEX idx_t_token_hash         ON t_faculty_form_token (token_hash);

-- =============================================================================
-- T_NEW_REQUEST_TOKEN
-- Tokens for faculty-initiated new requests (blank form, no existing request).
-- Rep sends link; faculty picks books and submits a fresh request without login.
-- Note: intentionally omits updated_at/AuditMixin — append-style token table.
-- =============================================================================

CREATE TABLE t_new_request_token (
    token_id           SERIAL        PRIMARY KEY,
    rep_id             INTEGER       NOT NULL REFERENCES m_user(user_id),
    faculty_id         INTEGER       NOT NULL REFERENCES m_faculty(faculty_id),
    token_hash         VARCHAR(255)  NOT NULL UNIQUE,
    send_channel       VARCHAR(20)   NOT NULL DEFAULT 'whatsapp',
    send_to_number     VARCHAR(20),
    expires_at         TIMESTAMPTZ   NOT NULL,
    used_at            TIMESTAMPTZ,
    created_request_id INTEGER       REFERENCES t_comp_request(request_id),
    is_active          BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_new_request_token_hash
    ON t_new_request_token(token_hash)
    WHERE is_active = TRUE;

COMMENT ON TABLE t_new_request_token IS
    'Tokens for faculty-initiated new requests (no existing request needed). '
    'Rep sends link to faculty; faculty picks books and submits a fresh request.';

-- Audit query patterns
CREATE INDEX idx_h_audit_request      ON h_request_audit (request_id);
CREATE INDEX idx_h_audit_changed_at   ON h_request_audit (changed_at);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- 1. Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'm_region', 'm_user', 'm_college', 'm_department', 'm_faculty',
        'm_author', 'm_book', 'm_course', 'm_subject', 'm_syllabus',
        't_comp_request', 't_comp_request_book',
        'p_app_config', 'p_rejection_reason'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s
             FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- 2. Enforce append-only on H_ tables (DB-level guard, not just application-level)
CREATE OR REPLACE FUNCTION fn_guard_history_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'History table "%" is append-only. UPDATE and DELETE are forbidden. Attempted operation: %',
        TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER trg_h_request_audit_immutable
    BEFORE UPDATE OR DELETE ON h_request_audit
    FOR EACH ROW EXECUTE FUNCTION fn_guard_history_immutability();

CREATE TRIGGER trg_h_master_data_review_immutable
    BEFORE UPDATE OR DELETE ON h_master_data_review
    FOR EACH ROW EXECUTE FUNCTION fn_guard_history_immutability();

-- 3. Auto-generate human-readable request reference: VNI-YYYY-XXXXXX
CREATE OR REPLACE FUNCTION fn_generate_request_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.request_ref IS NULL OR NEW.request_ref = '' THEN
        NEW.request_ref = 'VNI-'
            || TO_CHAR(NOW(), 'YYYY')
            || '-'
            || LPAD(nextval('seq_request_ref')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_t_comp_request_ref
    BEFORE INSERT ON t_comp_request
    FOR EACH ROW EXECUTE FUNCTION fn_generate_request_ref();
