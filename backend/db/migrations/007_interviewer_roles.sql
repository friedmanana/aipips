-- Add interviewer_roles column to interview_preps table
ALTER TABLE interview_preps
    ADD COLUMN IF NOT EXISTS interviewer_roles TEXT DEFAULT '';
