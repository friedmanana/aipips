'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Job, ScreeningResult, JobStatus } from '@/types'
import CandidateCard from '@/components/CandidateCard'
import EmptyState from '@/components/EmptyState'
import ScoreBadge from '@/components/ScoreBadge'

type TabKey = 'shortlisted' | 'second_round' | 'all'

const statusConfig: Record<JobStatus, { label: string; className: string }> = {
  OPEN: { label: 'Open', className: 'bg-green-100 text-green-800' },
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
  CLOSED: { label: 'Closed', className: 'bg-red-100 text-red-800' },
  FILLED: { label: 'Filled', className: 'bg-blue-100 text-blue-800' },
}

function formatDate(dateStr: string) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function JobDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<ScreeningResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('shortlisted')
  const [rerunning, setRerunning] = useState(false)
  const [sourcingStatus, setSourcingStatus] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [jobData, shortlistData] = await Promise.all([
        api.getJob(id),
        api.getShortlist(id),
      ])
      setJob(jobData)
      setCandidates(shortlistData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRerun = async () => {
    setRerunning(true)
    setSourcingStatus(null)
    try {
      setSourcingStatus('searching')
      const sourced = await api.sourceAndScreen(id) as { total_sourced?: number; total_screened?: number }
      await loadData()
      const found = sourced?.total_sourced ?? sourced?.total_screened ?? 0
      setSourcingStatus(found > 0 ? `Found ${found} candidate${found !== 1 ? 's' : ''}` : 'no_results')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSourcingStatus(null)
    } finally {
      setRerunning(false)
    }
  }

  const shortlisted = candidates.filter((c) => c.recommendation === 'SHORTLIST')
  const secondRound = candidates.filter((c) => c.recommendation === 'SECOND_ROUND')
  const allCandidates = candidates

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'shortlisted', label: 'Shortlisted', count: shortlisted.length },
    { key: 'second_round', label: 'Second Round', count: secondRound.length },
    { key: 'all', label: 'All Candidates', count: allCandidates.length },
  ]

  const activeList =
    activeTab === 'shortlisted'
      ? shortlisted
      : activeTab === 'second_round'
      ? secondRound
      : allCandidates

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Jobs
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-800">Failed to load job</p>
          <p className="text-sm text-red-600 mt-1 font-mono">{error}</p>
        </div>
      </div>
    )
  }

  if (!job) return null

  const status = statusConfig[job.status] ?? { label: job.status, className: 'bg-slate-100 text-slate-600' }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href="/"
        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All Jobs
      </Link>

      {/* Job header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <p className="text-slate-600 font-medium">
              {[job.organisation, job.department].filter(Boolean).join(' · ')}
            </p>
          </div>

          <button
            onClick={handleRerun}
            disabled={rerunning}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {rerunning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-run Sourcing
              </>
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
          {job.location && (
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {job.location}
            </span>
          )}
          {job.salary_band && (
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {job.salary_band}
            </span>
          )}
          {job.employment_type && (
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {job.employment_type}
            </span>
          )}
          {job.closing_date && (
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Closes {formatDate(job.closing_date)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Job details */}
        <div className="lg:col-span-1 space-y-4">
          {job.overview && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Overview
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">{job.overview}</p>
            </div>
          )}

          {job.responsibilities && job.responsibilities.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Responsibilities
              </h2>
              <ul className="space-y-1.5">
                {job.responsibilities.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {job.required_skills && job.required_skills.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Required Skills
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {job.required_skills.map((skill, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Candidates */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                      activeTab === tab.key
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sourcing status banner */}
          {sourcingStatus === 'no_results' && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">LinkedIn X-Ray search returned 0 candidates</p>
              <p className="mt-1 text-amber-700">
                DuckDuckGo didn&apos;t find matching LinkedIn profiles right now — this is common for NZ roles.
                Try <strong>Re-run Sourcing</strong> again later, or use the <strong>Upload CVs</strong> option to screen candidates directly.
              </p>
            </div>
          )}
          {sourcingStatus === 'searching' && (
            <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching LinkedIn via DuckDuckGo X-Ray… this takes 30–60 seconds
            </div>
          )}
          {sourcingStatus && sourcingStatus !== 'searching' && sourcingStatus !== 'no_results' && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-medium">
              ✓ {sourcingStatus} — scroll down to view results
            </div>
          )}

          {/* Candidate list */}
          {activeList.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200">
              <EmptyState
                title="No candidates yet"
                description="Run sourcing and screening to find and evaluate candidates for this role."
              />
              <div className="pb-6 flex justify-center">
                <button
                  onClick={handleRerun}
                  disabled={rerunning}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {rerunning ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Searching… (30–60s)
                    </>
                  ) : 'Run Sourcing & Screening'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeList
                .slice()
                .sort((a, b) => b.overall_score - a.overall_score)
                .map((result) => (
                  <CandidateCard key={result.id} result={result} />
                ))}
            </div>
          )}

          {/* Score legend */}
          {activeList.length > 0 && (
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
              <span className="font-medium">Score:</span>
              {[
                { label: '≥75 Strong', color: 'bg-green-100 text-green-800' },
                { label: '≥55 Good', color: 'bg-yellow-100 text-yellow-800' },
                { label: '≥35 Fair', color: 'bg-orange-100 text-orange-800' },
                { label: '<35 Weak', color: 'bg-red-100 text-red-800' },
              ].map(({ label, color }) => (
                <span key={label} className={`px-2 py-0.5 rounded-full ${color}`}>
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
