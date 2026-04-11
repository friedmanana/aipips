-- ============================================================
-- Migration 003: Integrations table + calendar fields on slots
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Google Calendar (and future) OAuth token storage
CREATE TABLE IF NOT EXISTS integrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL UNIQUE,          -- e.g. 'google_calendar'
  user_email   TEXT,                          -- Google account email
  access_token TEXT,
  refresh_token TEXT NOT NULL DEFAULT '',
  token_expiry TIMESTAMPTZ,
  scope        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Google Calendar event details on booked slots
ALTER TABLE interview_slots ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE interview_slots ADD COLUMN IF NOT EXISTS meet_link TEXT;
