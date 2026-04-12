-- ============================================================
-- Migration 004: Add phone column to candidates
-- Run this in the Supabase SQL Editor
-- ============================================================

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
