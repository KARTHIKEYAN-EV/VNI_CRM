-- Fix: t_faculty_form_token has no updated_at column but the
-- fn_set_updated_at trigger was mistakenly attached to it.
-- Dropping it here so form submissions no longer crash on commit.

DROP TRIGGER IF EXISTS trg_t_faculty_form_token_updated_at ON t_faculty_form_token;
.gi