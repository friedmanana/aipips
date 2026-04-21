'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { candidateApi } from '@/lib/candidateApi'
import type { JobApplication } from '@/types'

const STATUS_CONFIG = {
  DRAFT:       { label: 'Draft',       color: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'  },
  COMPLETE:    { label: 'Complete',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

const CvIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M9 13h6M9 17h4"/>
    <path d="M16.5 13.5l1 1-1 1" strokeWidth={1.5}/>
    <circle cx="18" cy="14.5" r="0" fill="currentColor"/>
    <path d="M15 12.5c.8-.5 2-.3 2.5.5s.3 2-.5 2.5" strokeWidth={1.4}/>
  </svg>
)

const LetterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="M2 7l10 7 10-7"/>
  </svg>
)

const InterviewIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <path d="M8 10h8M8 14h5"/>
  </svg>
)

const TOOLS = [
  {
    phase: 1,
    Icon: CvIcon,
    label: 'CV Enhancement',
    description: 'Paste your CV and job description — AI rewrites it to match the role and pass ATS filters.',
    bg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    border: 'border-violet-200',
    text: 'text-violet-700',
    btn: 'bg-violet-600 hover:bg-violet-700',
  },
  {
    phase: 2,
    Icon: LetterIcon,
    label: 'Cover Letter',
    description: 'Generate a tailored cover letter that speaks to the role, or enhance one you already have.',
    bg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    btn: 'bg-indigo-600 hover:bg-indigo-700',
  },
  {
    phase: 3,
    Icon: InterviewIcon,
    label: 'Interview Prep',
    description: 'Get a personalised Q&A bank — behavioural, technical, and motivation questions with model answers.',
    bg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    border: 'border-sky-200',
    text: 'text-sky-700',
    btn: 'bg-sky-600 hover:bg-sky-700',
  },
]

export default function CandidateDashboard() {
  const router = useRouter()
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<number | null>(null)

  useEffect(() => {
    candidateApi.listApplications()
      .then(async (apps) => {
        // Auto-delete any applications with no job title and no content
        // (these are abandoned workspaces the user opened but never filled in)
        const empty = apps.filter((a) => !a.job_title?.trim())
        await Promise.all(empty.map((a) => candidateApi.deleteApplication(a.id).catch(() => {})))
        setApplications(apps.filter((a) => a.job_title?.trim()))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
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
              className={`relative bg-white rounded-2xl border ${tool.border} p-6 flex flex-col hover:shadow-md transition-all`}
            >
              <div className={`w-12 h-12 rounded-xl ${tool.bg} ${tool.iconColor} flex items-center justify-center mb-4`}>
                <tool.Icon />
              </div>
              <h2 className={`text-base font-bold ${tool.text} mb-1`}>{tool.label}</h2>
              <p className="text-sm text-slate-500 flex-1 mb-5 leading-relaxed">{tool.description}</p>
              <button
                onClick={() => handleStart(tool.phase)}
                disabled={starting !== null}
                className={`w-full py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${tool.btn}`}
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
          <div className="flex items-center justify-center py-16">
            <svg className="w-7 h-7 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
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
