'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { candidateApi } from '@/lib/candidateApi'
import { CvPip, LetterPip, InterviewPip } from '@/components/PipIcons'
import type { JobApplication } from '@/types'

const STATUS_CONFIG = {
  DRAFT:       { label: 'Draft',       color: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'  },
  COMPLETE:    { label: 'Complete',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

const TOOLS = [
  {
    phase: 1,
    Icon: CvPip,
    label: 'CV Enhancement',
    description: 'Paste your CV and the job ad. AI rewrites it to match what the employer is looking for.',
  },
  {
    phase: 2,
    Icon: LetterPip,
    label: 'Cover Letter',
    description: 'Start from scratch or improve what you have. AI writes a cover letter that fits the job.',
  },
  {
    phase: 3,
    Icon: InterviewPip,
    label: 'Interview Prep',
    description: 'Get a list of likely interview questions with example answers — based on the job and your CV.',
  },
]

export default function CandidateDashboard() {
  const router = useRouter()
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [slowLoad, setSlowLoad] = useState(false)
  const [starting, setStarting] = useState<number | null>(null)

  useEffect(() => {
    const slowTimer = setTimeout(() => setSlowLoad(true), 4000)
    candidateApi.listApplications()
      .then(async (apps) => {
        // Auto-delete only applications that are completely empty AND less than 10 minutes old
        // (truly abandoned workspaces — user opened one, filled nothing, and navigated away)
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000
        const trulyEmpty = apps.filter((a) =>
          !a.job_title?.trim() &&
          !a.company?.trim() &&
          !a.job_description_text?.trim() &&
          new Date(a.created_at).getTime() > tenMinutesAgo
        )
        await Promise.all(trulyEmpty.map((a) => candidateApi.deleteApplication(a.id).catch(() => {})))
        // Show all applications that have a title
        setApplications(apps.filter((a) => a.job_title?.trim()))
      })
      .catch(console.error)
      .finally(() => { clearTimeout(slowTimer); setLoading(false); setSlowLoad(false) })
  }, [])

  const handleStart = async (phase: number) => {
    setStarting(phase)
    try {
      const app = await candidateApi.createApplication({ job_title: '', company: '', job_description_text: '' })
      router.push(`/candidate/applications/${app.id}?phase=${phase}`)
    } catch (err) {
      console.error(err)
      setStarting(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this application?')) return
    await candidateApi.deleteApplication(id)
    setApplications((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div>
      {/* Tool cards */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Job Seeker Tools</h1>
        <p className="text-sm text-slate-500 mb-6">Use each tool independently — or use all three for your next application.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TOOLS.map((tool) => (
            <div
              key={tool.phase}
              className="relative bg-white rounded-2xl border border-slate-200 p-6 flex flex-col hover:shadow-md hover:border-indigo-200 transition-all"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4">
                <tool.Icon />
              </div>
              <h2 className="text-base font-bold text-slate-800 mb-1">{tool.label}</h2>
              <p className="text-sm text-slate-500 flex-1 mb-5 leading-relaxed">{tool.description}</p>
              <button
                onClick={() => handleStart(tool.phase)}
                disabled={starting !== null}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                {starting === tool.phase
                  ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Opening…</>
                  : 'Start →'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Applications */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">My Applications</h2>
          <button
            onClick={() => handleStart(1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Application
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg className="w-7 h-7 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {slowLoad && (
              <p className="text-sm text-slate-400">Backend is warming up — this takes about 30 seconds on first load…</p>
            )}
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-400">
            <p className="text-sm">No applications yet — start a tool above to get going.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {applications.map((app) => {
              const status = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT
              const dateStr = new Date(app.created_at).toLocaleDateString('en-NZ', {
                day: 'numeric', month: 'short', year: 'numeric',
              })
              return (
                <div
                  key={app.id}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${status.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                    <button
                      onClick={() => handleDelete(app.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 mb-4">
                    <h3 className="text-base font-bold text-slate-900 leading-snug mb-0.5">
                      {app.job_title || 'Untitled Role'}
                    </h3>
                    {app.company && <p className="text-sm text-slate-500">{app.company}</p>}
                    <p className="text-xs text-slate-400 mt-1.5">{dateStr}</p>
                  </div>
                  <Link
                    href={`/candidate/applications/${app.id}`}
                    className="block text-center py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
                  >
                    Open →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
