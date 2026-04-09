'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Job } from '@/types'

interface CVEntry {
  id: number
  text: string
}

let nextId = 1

export default function UploadCVsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [jobLoading, setJobLoading] = useState(true)
  const [jobError, setJobError] = useState<string | null>(null)

  const [cvEntries, setCvEntries] = useState<CVEntry[]>([{ id: nextId++, text: '' }])
  const [screening, setScreening] = useState(false)
  const [screenError, setScreenError] = useState<string | null>(null)

  const loadJob = useCallback(async () => {
    setJobLoading(true)
    setJobError(null)
    try {
      const jobData = await api.getJob(id)
      setJob(jobData)
    } catch (err: unknown) {
      setJobError(err instanceof Error ? err.message : String(err))
    } finally {
      setJobLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadJob()
  }, [loadJob])

  const addCV = () => {
    setCvEntries((prev) => [...prev, { id: nextId++, text: '' }])
  }

  const removeCV = (entryId: number) => {
    setCvEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  const updateCV = (entryId: number, text: string) => {
    setCvEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, text } : e)))
  }

  const nonEmptyCVs = cvEntries.filter((e) => e.text.trim().length > 0)
  const canScreen = nonEmptyCVs.length > 0 && !screening

  const handleScreen = async () => {
    if (!canScreen) return
    setScreening(true)
    setScreenError(null)
    try {
      await api.uploadCVs(id, nonEmptyCVs.map((e) => e.text))
      router.push(`/jobs/${id}`)
    } catch (err: unknown) {
      setScreenError(err instanceof Error ? err.message : String(err))
      setScreening(false)
    }
  }

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (jobError) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href={`/jobs/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Job
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-800">Failed to load job</p>
          <p className="text-sm text-red-600 mt-1 font-mono">{jobError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href={`/jobs/${id}`}
        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to {job?.title ?? 'Job'}
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Screen Candidates for {job?.title ?? '…'}
        </h1>
        <p className="mt-2 text-slate-600">
          Paste one CV per box. Separate multiple CVs using the{' '}
          <span className="font-medium text-indigo-700">+ Add Another CV</span> button.
        </p>
      </div>

      {/* CV text areas */}
      <div className="space-y-4">
        {cvEntries.map((entry, index) => (
          <div key={entry.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">CV {index + 1}</span>
              {cvEntries.length > 1 && (
                <button
                  onClick={() => removeCV(entry.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                  aria-label={`Remove CV ${index + 1}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <textarea
              rows={10}
              value={entry.text}
              onChange={(e) => updateCV(entry.id, e.target.value)}
              placeholder={`Paste CV / resume text here...\n\nName: Jane Smith\nCurrent Role: Policy Analyst at Treasury\n\nSummary:\nExperienced public sector professional with 8 years in policy advisory...\n\nSkills: Policy analysis, stakeholder engagement, report writing`}
              className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono leading-relaxed"
              disabled={screening}
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {entry.text.length.toLocaleString()} characters
            </p>
          </div>
        ))}
      </div>

      {/* Add CV button */}
      <button
        onClick={addCV}
        disabled={screening}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 text-slate-600 text-sm font-medium rounded-md hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Another CV
      </button>

      {/* Error banner */}
      {screenError && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Screening failed</p>
          <p className="text-sm text-red-600 mt-1 font-mono">{screenError}</p>
        </div>
      )}

      {/* Screening status / submit */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleScreen}
          disabled={!canScreen}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {screening ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Screening candidates…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Screen {nonEmptyCVs.length} CV{nonEmptyCVs.length !== 1 ? 's' : ''}
            </>
          )}
        </button>

        {screening && (
          <p className="text-sm text-slate-500">
            Screening candidates… this takes ~10s per CV
          </p>
        )}
      </div>
    </div>
  )
}
