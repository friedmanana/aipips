'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { candidateApi } from '@/lib/candidateApi'
import type { JobApplication } from '@/types'

const STATUS_CONFIG = {
  DRAFT:       { label: 'Draft',       color: 'bg-slate-100 text-slate-600',  dot: 'bg-slate-400' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'  },
  COMPLETE:    { label: 'Complete',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

const PHASE_STEPS = [
  { icon: '📝', label: 'CV Enhancement' },
  { icon: '✍🏼', label: 'Cover Letter' },
  { icon: '🎤', label: 'Interview Prep' },
]

export default function CandidateDashboard() {
  const router = useRouter()
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    candidateApi.listApplications()
      .then(setApplications)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this application?')) return
    await candidateApi.deleteApplication(id)
    setApplications((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div>
      {/* Hero header */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-3xl px-8 py-10 mb-10 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-violet-400/20 rounded-full blur-2xl" />

        <div className="relative flex items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">My Applications</h1>
            <p className="text-indigo-200 text-lg">
              AI-powered tool to help you land your next role
            </p>
            {/* Phase guide */}
            <div className="flex items-center gap-3 mt-6 flex-wrap">
              {PHASE_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur px-4 py-2 rounded-full border border-white/20">
                    <span className="text-xl">{step.icon}</span>
                    <span className="text-white text-sm font-semibold">{step.label}</span>
                  </div>
                  {i < PHASE_STEPS.length - 1 && (
                    <svg className="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => router.push('/candidate/applications/new')}
            className="flex-shrink-0 inline-flex items-center gap-2 px-7 py-4 bg-white text-indigo-700 text-base font-bold rounded-2xl hover:bg-indigo-50 transition-colors shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Application
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : applications.length === 0 ? (
        /* Empty state */
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📋</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No applications yet</h3>
          <p className="text-base text-slate-500 mb-8 max-w-sm mx-auto">
            Create your first application to start enhancing your CV with AI, generating cover letters, and preparing for interviews.
          </p>
          <button
            onClick={() => router.push('/candidate/applications/new')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-bold rounded-2xl transition-colors shadow-md"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Get started
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => {
            const status = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT
            const dateStr = new Date(app.created_at).toLocaleDateString('en-NZ', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
            return (
              <div
                key={app.id}
                className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 flex flex-col"
              >
                {/* Top: status + delete */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${status.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                  <button
                    onClick={() => handleDelete(app.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Job info */}
                <div className="flex-1 mb-5">
                  <h3 className="text-lg font-bold text-slate-900 leading-snug mb-1">
                    {app.job_title || 'Untitled Role'}
                  </h3>
                  {app.company && (
                    <p className="text-sm text-slate-500 font-medium">{app.company}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">{dateStr}</p>
                </div>

                {/* Progress phases */}
                <div className="flex items-center gap-1.5 mb-5">
                  {PHASE_STEPS.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg text-xs text-slate-400"
                    >
                      <span>{step.icon}</span>
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href={`/candidate/applications/${app.id}`}
                  className="block text-center py-3 text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm group-hover:shadow-md"
                >
                  Open Workspace →
                </Link>
              </div>
            )
          })}

          {/* Add new card */}
          <button
            onClick={() => router.push('/candidate/applications/new')}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-6 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all duration-200 flex flex-col items-center justify-center gap-3 min-h-[200px] text-slate-400 hover:text-indigo-600"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-indigo-100 flex items-center justify-center transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-semibold">New Application</span>
          </button>
        </div>
      )}
    </div>
  )
}
