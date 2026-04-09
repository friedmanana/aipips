'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import PipelineProgress from '@/components/PipelineProgress'

type PipelineStep = 'analysing' | 'sourcing' | 'screening' | 'done' | 'error'

const PLACEHOLDER = `Position: Senior Policy Advisor
Organisation: Ministry of Business, Innovation & Employment
Location: Wellington, New Zealand
Employment Type: Permanent, Full-time
Salary Band: $110,000 – $130,000

About the Role:
We are seeking an experienced Senior Policy Advisor to join our Economic Policy team...

Key Responsibilities:
- Develop and analyse policy options across economic and regulatory domains
- Provide high-quality advice to Ministers and senior officials
- Lead stakeholder engagement and consultation processes
- Prepare Cabinet papers, briefings, and regulatory impact statements

Required Skills:
- Strong policy analysis and research skills
- Excellent written and verbal communication
- Experience in the NZ public sector
- Familiarity with Cabinet processes and government decision-making

Qualifications:
- Bachelor's degree or higher in Economics, Law, Public Policy, or related field
- 5+ years of relevant policy experience`

export default function NewJobPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [step, setStep] = useState<PipelineStep | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
  }

  const runPipeline = async () => {
    if (!text.trim()) return
    setErrorMsg(null)
    setStep('analysing')
    clearTimers()

    timerRefs.current.push(
      setTimeout(() => setStep('sourcing'), 2000),
      setTimeout(() => setStep('screening'), 4000),
    )

    try {
      const result = await api.runPipeline(text.trim())
      clearTimers()
      setStep('done')

      const jobId = result.job?.id
      if (jobId) {
        setTimeout(() => router.push(`/jobs/${jobId}`), 800)
      }
    } catch (err: unknown) {
      clearTimers()
      setStep('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  const isRunning = step !== null && step !== 'done' && step !== 'error'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Post a New Job</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Paste your job description and run the full AI recruitment pipeline
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <label
          htmlFor="jd-text"
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          Job Description
        </label>
        <textarea
          id="jd-text"
          rows={18}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          disabled={isRunning}
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-slate-50 disabled:cursor-not-allowed font-mono leading-relaxed"
        />

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            {text.length > 0 ? `${text.length} characters` : 'Paste your JD above'}
          </p>
          <button
            onClick={runPipeline}
            disabled={isRunning || !text.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Run Full Pipeline
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pipeline progress */}
      {step !== null && (
        <div className="mt-6">
          <PipelineProgress
            step={step}
            message={
              step === 'analysing'
                ? 'Parsing and structuring the job description…'
                : step === 'sourcing'
                ? 'Searching for matching candidates in NZ…'
                : step === 'screening'
                ? 'Scoring and ranking candidates…'
                : step === 'done'
                ? 'Redirecting to results…'
                : errorMsg ?? undefined
            }
          />
        </div>
      )}

      {/* Inline error */}
      {step === 'error' && errorMsg && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Pipeline failed</p>
          <p className="text-xs text-red-600 mt-1 font-mono break-all">{errorMsg}</p>
          <button
            onClick={() => {
              setStep(null)
              setErrorMsg(null)
            }}
            className="mt-3 text-xs text-red-700 underline hover:no-underline"
          >
            Dismiss and try again
          </button>
        </div>
      )}
    </div>
  )
}
