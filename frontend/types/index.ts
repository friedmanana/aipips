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
  phone?: string
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
  qualification_score: number
  nz_fit_score: number
  recommendation: Recommendation
  recommendation_reason: string
  strengths: string[]
  concerns: string[]
  interview_flags: string[]
  notes?: string
  // merged candidate fields
  full_name?: string
  email?: string
  phone?: string
  current_title?: string
  current_organisation?: string
  location?: string
  linkedin_url?: string
  years_experience?: number
  skills?: string[]
  summary?: string
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

// --- Communications ---

export type CommType =
  | 'REJECTION'
  | 'SHORTLIST_INVITE'
  | 'PHONE_SCREEN_INVITE'
  | 'BOOKING_CONFIRMATION'
  | 'CUSTOM'

export type CommStatus = 'PENDING' | 'SENT' | 'FAILED' | 'NO_EMAIL' | 'DELIVERED'

export interface Communication {
  id: string
  job_id: string
  candidate_id: string
  type: CommType
  subject: string
  body_text: string
  body_html: string
  sent_at: string | null
  status: CommStatus
  resend_message_id: string | null
  slot_id: string | null
  created_at: string
  // merged candidate fields
  full_name?: string
  email?: string
}

export interface InterviewSlot {
  id: string
  job_id: string
  starts_at: string
  ends_at: string
  duration_mins: number
  is_booked: boolean
  booked_by: string | null
  created_at: string
}

export interface BookingInfo {
  token_id: string
  job: { title: string; organisation: string }
  candidate_name: string | null
  slots: InterviewSlot[]
  expires_at: string
}
