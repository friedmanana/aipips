'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Job } from '@/types'
import JobCard from '@/components/JobCard'
import EmptyState from '@/components/EmptyState'

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listJobs()
      .then(setJobs)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [])

  const openJobs = jobs.filter((j) => j.status === 'OPEN')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your public sector recruitment pipeline
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Post New Job
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Total Jobs
          </p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {loading ? '—' : jobs.length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Open Jobs
          </p>
          <p className="text-3xl font-bold text-indigo-600 mt-1">
            {loading ? '—' : openJobs.length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Total Candidates
          </p>
          <p className="text-3xl font-bold text-slate-900 mt-1">0</p>
        </div>
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg
            className="w-8 h-8 text-indigo-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-800 mb-1">Could not connect to backend</p>
          <p className="text-sm text-red-600">
            Backend not running — start with{' '}
            <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono text-xs">
              uvicorn main:app --reload
            </code>
          </p>
          <p className="text-xs text-red-500 mt-2 font-mono">{error}</p>
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Post your first job to start the recruitment pipeline and find the best candidates."
          action={{ label: 'Post a Job', href: '/jobs/new' }}
        />
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
            All Jobs ({jobs.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
            {jobs
              .slice()
              .sort((a, b) => {
                const order = { OPEN: 0, DRAFT: 1, FILLED: 2, CLOSED: 3 }
                return (order[a.status] ?? 4) - (order[b.status] ?? 4)
              })
              .map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
