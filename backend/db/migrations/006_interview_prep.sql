CREATE TABLE IF NOT EXISTS interview_preps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    interview_date TEXT DEFAULT '',
    interview_format TEXT DEFAULT '',  -- e.g. "Panel interview", "One-on-one", "Video call"
    focus_areas TEXT DEFAULT '',       -- candidate notes on what they think will be covered
    generated_qa JSONB,                -- array of {question, answer, category} objects
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interview_preps_application_id ON interview_preps(application_id);
