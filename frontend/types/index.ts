export type JobStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FILLED'
export type Recommendation = 'SHORTLIST' | 'SECOND_ROUND' | 'HOLD' | 'DECLINE'
export type CandidateSource = 'DIRECT_APPLY' | 'LINKEDIN_XRAY' | 'SEEK' | 'TRADEME'

export interface Job {
  id: string
  title: string
  organisation: string
  department: string
  location: string
  salary_band: string
  employment_type: string
  closing_date: string
  overview: string
  responsibilities: string[]
  required_skills: string[]
  preferred_skills: string[]
  qualifications: string[]
  competencies: string[]
  status: JobStatus
  created_at: string
}

export interface Candidate {
  id: string
  full_name: string
  email?: string
  location: string
  linkedin_url?: string
  source: CandidateSource
  current_title: string
  current_organisation: string
  years_experience: number
  skills: string[]
  summary: string
}

export interface ScreeningResult {
  id: string
  job_id: string
  candidate_id: string
  overall_score: number
  skill_match_score: number
  experience_score: number
  nz_fit_score: number
  recommendation: Recommendation
  recommendation_reason: string
  strengths: string[]
  concerns: string[]
  interview_flags: string[]
  // merged candidate fields
  full_name?: string
  current_title?: string
  current_organisation?: string
  location?: string
  linkedin_url?: string
}

export interface PipelineResult {
  job: Job
  validation: { is_complete: boolean; missing_fields: string[]; warnings: string[] }
  total_sourced: number
  shortlisted: ScreeningResult[]
  second_round: ScreeningResult[]
  all_screened: ScreeningResult[]
}

export interface ScreeningResponse {
  total_screened: number
  shortlisted: ScreeningResult[]
  second_round: ScreeningResult[]
  hold: ScreeningResult[]
  declined: ScreeningResult[]
  all_screened: ScreeningResult[]
}
