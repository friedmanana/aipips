-- ============================================================
-- AI Pips — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- Jobs table
-- ------------------------------------------------------------
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    organisation TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    salary_band TEXT NOT NULL,
    employment_type TEXT NOT NULL CHECK (employment_type IN ('permanent', 'fixed-term', 'casual')),
    closing_date TIMESTAMPTZ NOT NULL,
    overview TEXT NOT NULL,
    responsibilities JSONB NOT NULL DEFAULT '[]',
    required_skills JSONB NOT NULL DEFAULT '[]',
    preferred_skills JSONB NOT NULL DEFAULT '[]',
    qualifications JSONB NOT NULL DEFAULT '[]',
    competencies JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'FILLED')),
    raw_jd_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Candidates table
-- ------------------------------------------------------------
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    location TEXT NOT NULL,
    linkedin_url TEXT,
    source TEXT NOT NULL CHECK (source IN ('DIRECT_APPLY', 'LINKEDIN_XRAY', 'SEEK', 'TRADEME')),
    current_title TEXT NOT NULL,
    current_organisation TEXT NOT NULL,
    years_experience INTEGER NOT NULL,
    skills JSONB NOT NULL DEFAULT '[]',
    qualifications JSONB NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL,
    raw_cv_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Screening results table
-- ------------------------------------------------------------
CREATE TABLE screening_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    overall_score FLOAT NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    skill_match_score FLOAT NOT NULL CHECK (skill_match_score >= 0 AND skill_match_score <= 100),
    experience_score FLOAT NOT NULL CHECK (experience_score >= 0 AND experience_score <= 100),
    qualification_score FLOAT NOT NULL DEFAULT 0,
    nz_fit_score FLOAT NOT NULL DEFAULT 0,
    recommendation TEXT NOT NULL CHECK (recommendation IN ('SHORTLIST', 'SECOND_ROUND', 'HOLD', 'DECLINE')),
    recommendation_reason TEXT,
    strengths JSONB NOT NULL DEFAULT '[]',
    concerns JSONB NOT NULL DEFAULT '[]',
    interview_flags JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, candidate_id)
);

-- ------------------------------------------------------------
-- Sourcing runs table
-- ------------------------------------------------------------
CREATE TABLE sourcing_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    total_found INTEGER NOT NULL DEFAULT 0,
    total_scored INTEGER NOT NULL DEFAULT 0,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_organisation ON jobs(organisation);
CREATE INDEX idx_candidates_source ON candidates(source);
CREATE INDEX idx_screening_results_job_id ON screening_results(job_id);
CREATE INDEX idx_screening_results_recommendation ON screening_results(recommendation);

-- ============================================================
-- updated_at trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_runs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now — tighten when auth is added
CREATE POLICY "allow_all" ON jobs FOR ALL USING (true);
CREATE POLICY "allow_all" ON candidates FOR ALL USING (true);
CREATE POLICY "allow_all" ON screening_results FOR ALL USING (true);
CREATE POLICY "allow_all" ON sourcing_runs FOR ALL USING (true);
