import type { Job, ScreeningResult, PipelineResult } from '@/types'

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
}
