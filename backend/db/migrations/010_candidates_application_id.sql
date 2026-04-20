-- ============================================================
-- Migration 010: Add application_id to candidates table
--
-- One candidates record per job_applications row.
-- Deduplication key: application_id (unique, nullable).
-- This replaces the old per-profile deduplication and allows
-- the same job seeker to appear as separate candidates for
-- each application they submit (e.g. AI Engineer + Data Scientist).
-- ============================================================

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS application_id UUID
    REFERENCES job_applications(id) ON DELETE SET NULL;

-- Partial unique index: only enforces uniqueness when application_id is set
CREATE UNIQUE INDEX IF NOT EXISTS candidates_application_id_key
  ON candidates(application_id)
  WHERE application_id IS NOT NULL;
