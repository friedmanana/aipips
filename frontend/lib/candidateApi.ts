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

  parseCvPdf: async (id: string, file: File): Promise<{ text: string }> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/api/v1/candidate/applications/${id}/parse-cv-pdf`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
    return res.json()
  },

  generateCv: (id: string, background_text: string, pages: string, style: string) =>
    fetchCandidate<CvDocument>(`/api/v1/candidate/applications/${id}/generate-cv`, {
      method: 'POST', body: JSON.stringify({ background_text, pages, style }),
    }),

  enhanceCv: (id: string, pages: string, style: string) =>
    fetchCandidate<CvDocument>(`/api/v1/candidate/applications/${id}/enhance-cv`, {
      method: 'POST', body: JSON.stringify({ pages, style }),
    }),

  generateCoverLetter: (id: string, length: string, tone: string) =>
    fetchCandidate<CoverLetter>(`/api/v1/candidate/applications/${id}/cover-letter`, {
      method: 'POST', body: JSON.stringify({ length, tone }),
    }),

  enhanceCoverLetter: (id: string, existing_letter: string, length: string, tone: string) =>
    fetchCandidate<CoverLetter>(`/api/v1/candidate/applications/${id}/enhance-cover-letter`, {
      method: 'POST', body: JSON.stringify({ existing_letter, length, tone }),
    }),

  saveCoverLetter: (id: string, content_text: string) =>
    fetchCandidate<CoverLetter>(`/api/v1/candidate/applications/${id}/cover-letter`, {
      method: 'PATCH', body: JSON.stringify({ content_text }),
    }),

  getInterviewPrep: (id: string) =>
    fetchCandidate<{interview_format?: string, interviewer_roles?: string, focus_areas?: string, generated_qa?: QAItem[]}>(`/api/v1/candidate/applications/${id}/interview-prep`),

  saveInterviewPrep: (id: string, data: {interview_date?: string, interview_format?: string, focus_areas?: string, interviewer_roles?: string}) =>
    fetchCandidate(`/api/v1/candidate/applications/${id}/interview-prep`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  generateInterviewQA: (id: string, cat_counts: Record<string, number>) =>
    fetchCandidate<{qa: QAItem[]}>(`/api/v1/candidate/applications/${id}/generate-interview-qa`, {
      method: 'POST', body: JSON.stringify({ cat_counts }),
    }),

  saveQA: (id: string, qa: QAItem[]) =>
    fetchCandidate(`/api/v1/candidate/applications/${id}/interview-prep`, {
      method: 'POST', body: JSON.stringify({ generated_qa: qa }),
    }),

  downloadPdf: async (id: string, type: 'cv' | 'cover_letter', filename: string) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch(`${BASE}/api/v1/candidate/applications/${id}/download-pdf?type=${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`PDF generation failed: ${await res.text()}`)
    const blob = new Blob([await res.arrayBuffer()], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    // Small delay before cleanup so Safari has time to process the download
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 200)
  },
}
