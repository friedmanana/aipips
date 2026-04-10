-- ============================================================
-- Migration 002: Communications, interview slots, booking tokens
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add email column to candidates if it doesn't exist yet
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

-- ------------------------------------------------------------
-- interview_slots
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  duration_mins INT NOT NULL DEFAULT 30,
  is_booked     BOOLEAN NOT NULL DEFAULT FALSE,
  booked_by     UUID REFERENCES candidates(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_slots_job_id    ON interview_slots(job_id);
CREATE INDEX IF NOT EXISTS idx_interview_slots_starts_at ON interview_slots(starts_at);

-- ------------------------------------------------------------
-- communications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  candidate_id       UUID REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  type               TEXT NOT NULL CHECK (type IN (
                       'REJECTION', 'SHORTLIST_INVITE',
                       'PHONE_SCREEN_INVITE', 'BOOKING_CONFIRMATION', 'CUSTOM'
                     )),
  subject            TEXT NOT NULL DEFAULT '',
  body_html          TEXT NOT NULL DEFAULT '',
  body_text          TEXT NOT NULL DEFAULT '',
  sent_at            TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','SENT','FAILED','NO_EMAIL','DELIVERED')),
  resend_message_id  TEXT,
  slot_id            UUID REFERENCES interview_slots(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communications_job_id       ON communications(job_id);
CREATE INDEX IF NOT EXISTS idx_communications_candidate_id ON communications(candidate_id);

-- ------------------------------------------------------------
-- booking_tokens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID REFERENCES communications(id) ON DELETE CASCADE NOT NULL,
  token            TEXT NOT NULL UNIQUE,
  expires_at       TIMESTAMPTZ NOT NULL,
  used_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_tokens_token ON booking_tokens(token);
