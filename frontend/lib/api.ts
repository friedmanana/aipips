import type { Job, ScreeningResult, PipelineResult, ScreeningResponse, Communication, InterviewSlot, BookingInfo } from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export const api = {
  listJobs: (status?: string) =>
    fetchAPI<Job[]>(`/api/v1/jobs${status ? `?status=${status}` : ''}`),

  getJob: (id: string) => fetchAPI<Job>(`/api/v1/jobs/${id}`),

  runPipeline: (rawJdText: string) =>
    fetchAPI<PipelineResult>('/api/v1/jobs/pipeline', {
      method: 'POST',
      body: JSON.stringify({ raw_jd_text: rawJdText }),
    }),

  analyseJob: (rawText: string) =>
    fetchAPI('/api/v1/jobs', {
      method: 'POST',
      body: JSON.stringify({ raw_text: rawText }),
    }),

  getShortlist: (jobId: string) =>
    fetchAPI<ScreeningResult[]>(`/api/v1/jobs/${jobId}/shortlist`),

  getAllResults: (jobId: string) =>
    fetchAPI<ScreeningResult[]>(`/api/v1/jobs/${jobId}/results`),

  sourceAndScreen: async (jobId: string) => {
    await fetchAPI(`/api/v1/jobs/${jobId}/source`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    return fetchAPI(`/api/v1/jobs/${jobId}/screen`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },

  uploadCVs: (jobId: string, cvTexts: string[]) =>
    fetchAPI<ScreeningResponse>(`/api/v1/jobs/${jobId}/upload-cvs`, {
      method: 'POST',
      body: JSON.stringify({ cv_texts: cvTexts }),
    }),

  updateResultRecommendation: (jobId: string, resultId: string, recommendation: string) =>
    fetchAPI(`/api/v1/jobs/${jobId}/results/${resultId}`, {
      method: 'PATCH',
      body: JSON.stringify({ recommendation }),
    }),

  deleteResult: (jobId: string, resultId: string) =>
    fetchAPI(`/api/v1/jobs/${jobId}/results/${resultId}`, {
      method: 'DELETE',
    }),

  // --- Communications ---
  listComms: (jobId: string) =>
    fetchAPI<Communication[]>(`/api/v1/jobs/${jobId}/comms`),

  rejectBatch: (jobId: string, candidateIds: string[]) =>
    fetchAPI<{ sent: number; errors: unknown[]; communications: Communication[] }>(
      `/api/v1/jobs/${jobId}/comms/reject-batch`,
      { method: 'POST', body: JSON.stringify({ candidate_ids: candidateIds }) }
    ),

  inviteBatch: (
    jobId: string,
    candidateIds: string[],
    type: 'SHORTLIST_INVITE' | 'PHONE_SCREEN_INVITE' = 'SHORTLIST_INVITE',
    slotIds: string[] = []
  ) =>
    fetchAPI<{ sent: number; errors: unknown[]; communications: Communication[] }>(
      `/api/v1/jobs/${jobId}/comms/invite-batch`,
      {
        method: 'POST',
        body: JSON.stringify({ candidate_ids: candidateIds, type, slot_ids: slotIds }),
      }
    ),

  // --- Slots ---
  listSlots: (jobId: string, availableOnly = false) =>
    fetchAPI<InterviewSlot[]>(
      `/api/v1/jobs/${jobId}/slots${availableOnly ? '?available_only=true' : ''}`
    ),

  createSlot: (jobId: string, startsAt: string, endsAt: string, durationMins = 30) =>
    fetchAPI<InterviewSlot>(`/api/v1/jobs/${jobId}/slots`, {
      method: 'POST',
      body: JSON.stringify({ starts_at: startsAt, ends_at: endsAt, duration_mins: durationMins }),
    }),

  deleteSlot: (jobId: string, slotId: string) =>
    fetchAPI(`/api/v1/jobs/${jobId}/slots/${slotId}`, { method: 'DELETE' }),

  // --- Booking (public) ---
  getBookingInfo: (token: string) =>
    fetchAPI<BookingInfo>(`/api/v1/book/${token}`),

  confirmBooking: (token: string, slotId: string) =>
    fetchAPI<{ confirmed: boolean; slot: InterviewSlot; job: { title: string; organisation: string } }>(
      `/api/v1/book/${token}/confirm`,
      { method: 'POST', body: JSON.stringify({ slot_id: slotId }) }
    ),
}
