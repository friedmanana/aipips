import type { JobApplication, CvDocument, CoverLetter, CandidateProfile, QAItem } from '@/types'
import { createClient } from '@/lib/supabase/client'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchCandidate<T>(path: string, options?: RequestInit): Promise<T> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export const candidateApi = {
  getProfile: () =>
    fetchCandidate<CandidateProfile>('/api/v1/candidate/profile'),

  upsertProfile: (data: { full_name: string; email?: string }) =>
    fetchCandidate<CandidateProfile>('/api/v1/candidate/profile', {
      method: 'POST', body: JSON.stringify(data),
    }),

  listApplications: () =>
    fetchCandidate<JobApplication[]>('/api/v1/candidate/applications'),

  createApplication: (data: { job_title: string; company?: string; job_description_text?: string }) =>
    fetchCandidate<JobApplication>('/api/v1/candidate/applications', {
      method: 'POST', body: JSON.stringify(data),
    }),

  getApplication: (id: string) =>
    fetchCandidate<JobApplication & {
      original_cv: CvDocument | null
      enhanced_cv: CvDocument | null
      cover_letter: CoverLetter | null
    }>(`/api/v1/candidate/applications/${id}`),

  updateApplication: (id: string, data: Partial<Pick<JobApplication, 'job_title' | 'company' | 'job_description_text' | 'status'>>) =>
    fetchCandidate<JobApplication>(`/api/v1/candidate/applications/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deleteApplication: (id: string) =>
    fetchCandidate(`/api/v1/candidate/applications/${id}`, { method: 'DELETE' }),

  uploadCv: (id: string, content_text: string) =>
    fetchCandidate<CvDocument>(`/api/v1/candidate/applications/${id}/cv`, {
      method: 'POST', body: JSON.stringify({ content_text }),
    }),

  enhanceCv: (id: string) =>
    fetchCandidate<CvDocument>(`/api/v1/candidate/applications/${id}/enhance-cv`, { method: 'POST' }),

  generateCoverLetter: (id: string) =>
    fetchCandidate<CoverLetter>(`/api/v1/candidate/applications/${id}/cover-letter`, { method: 'POST' }),

  getInterviewPrep: (id: string) =>
    fetchCandidate<{interview_date?: string, interview_format?: string, focus_areas?: string, generated_qa?: QAItem[]}>(`/api/v1/candidate/applications/${id}/interview-prep`),

  saveInterviewPrep: (id: string, data: {interview_date?: string, interview_format?: string, focus_areas?: string}) =>
    fetchCandidate(`/api/v1/candidate/applications/${id}/interview-prep`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  generateInterviewQA: (id: string) =>
    fetchCandidate<{qa: QAItem[]}>(`/api/v1/candidate/applications/${id}/generate-interview-qa`, {
      method: 'POST',
    }),
}
