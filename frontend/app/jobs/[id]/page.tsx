'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Job, ScreeningResult, JobStatus, Recommendation } from '@/types'
import CandidateCard from '@/components/CandidateCard'
import CandidateDetailModal from '@/components/CandidateDetailModal'
import EmptyState from '@/components/EmptyState'

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
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [rerunning, setRerunning] = useState(false)
  const [sourcingStatus, setSourcingStatus] = useState<string | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<ScreeningResult | null>(null)
  const [moveConfirm, setMoveConfirm] = useState<{ resultId: string; recommendation: Recommendation } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [jobData, allResults] = await Promise.all([
        api.getJob(id),
        api.getAllResults(id),
      ])
      setJob(jobData)
      setCandidates(allResults)
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

  const handleMove = (resultId: string, recommendation: Recommendation) => {
    // Show confirmation first
    setMoveConfirm({ resultId, recommendation })
  }

  const confirmMove = async () => {
    if (!moveConfirm) return
    const { resultId, recommendation } = moveConfirm
    setMoveConfirm(null)
    // Optimistic update
    setCandidates((prev) =>
      prev.map((c) => (c.id === resultId ? { ...c, recommendation } : c))
    )
    if (selectedCandidate?.id === resultId) {
      setSelectedCandidate((prev) => prev ? { ...prev, recommendation } : null)
    }
    try {
      await api.updateResultRecommendation(id, resultId, recommendation)
    } catch {
      await loadData()
    }
  }

  const handleDelete = async (resultId: string) => {
    // Optimistic update
    setCandidates((prev) => prev.filter((c) => c.id !== resultId))
    if (selectedCandidate?.id === resultId) setSelectedCandidate(null)
    try {
      await api.deleteResult(id, resultId)
    } catch {
      await loadData()
    }
  }

  const shortlisted = candidates.filter((c) => c.recommendation === 'SHORTLIST')
  const secondRound = candidates.filter((c) => c.recommendation === 'SECOND_ROUND')
  const allCandidates = candidates

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All Candidates', count: allCandidates.length },
    { key: 'second_round', label: 'Second Round', count: secondRound.length },
    { key: 'shortlisted', label: 'Shortlisted', count: shortlisted.length },
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
    <>
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

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/jobs/${id}/upload`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 text-sm font-medium rounded-md hover:bg-indigo-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload CVs
            </Link>

            <button
              onClick={handleRerun}
              disabled={rerunning}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Find Candidates with AI
                </>
              )}
            </button>
          </div>
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
              AI is sourcing and screening candidates for this role — usually takes 30–60 seconds
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
                title={activeTab === 'all' ? 'No candidates yet' : activeTab === 'second_round' ? 'No second-round candidates' : 'No shortlisted candidates'}
                description={
                  activeTab === 'all'
                    ? 'Upload CVs to screen candidates, or run LinkedIn sourcing to find candidates automatically.'
                    : 'Candidates screened as this tier will appear here.'
                }
              />
              {activeTab === 'all' && (
                <div className="pb-6 flex justify-center gap-3">
                  <Link
                    href={`/jobs/${id}/upload`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload CVs
                  </Link>
                  <button
                    onClick={handleRerun}
                    disabled={rerunning}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {rerunning ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Searching… (30–60s)
                      </>
                    ) : 'Find Candidates with AI'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {activeList
                .slice()
                .sort((a, b) => b.overall_score - a.overall_score)
                .map((result) => (
                  <CandidateCard
                    key={result.id}
                    result={result}
                    onClick={setSelectedCandidate}
                    onMove={handleMove}
                    onDelete={handleDelete}
                  />
                ))}
            </div>
          )}

          {/* Score legend */}
          {activeList.length > 0 && (
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
              <span className="font-medium">Score:</span>
              {[
                { label: '≥75 Shortlist', color: 'bg-green-100 text-green-800' },
                { label: '≥60 Second Round', color: 'bg-yellow-100 text-yellow-800' },
                { label: '≥45 Hold', color: 'bg-orange-100 text-orange-800' },
                { label: '<45 Decline', color: 'bg-red-100 text-red-800' },
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

    {/* Candidate detail modal */}
    {selectedCandidate && (
      <CandidateDetailModal
        result={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onMove={handleMove}
        onDelete={handleDelete}
      />
    )}

    {/* Move confirmation dialog */}
    {moveConfirm && (() => {
      const labels: Record<Recommendation, string> = {
        SHORTLIST: 'Shortlisted',
        SECOND_ROUND: 'Second Round',
        HOLD: 'Hold',
        DECLINE: 'Decline',
      }
      const colors: Record<Recommendation, string> = {
        SHORTLIST: 'bg-green-600 hover:bg-green-700',
        SECOND_ROUND: 'bg-blue-600 hover:bg-blue-700',
        HOLD: 'bg-yellow-500 hover:bg-yellow-600',
        DECLINE: 'bg-red-600 hover:bg-red-700',
      }
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMoveConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Move candidate?</h3>
            <p className="text-sm text-slate-600 mb-5">
              This candidate will be moved to{' '}
              <span className="font-semibold text-slate-900">{labels[moveConfirm.recommendation]}</span>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setMoveConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMove}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${colors[moveConfirm.recommendation]}`}
              >
                Move to {labels[moveConfirm.recommendation]}
              </button>
            </div>
          </div>
        </div>
      )
    })()}
    </>
  )
}
