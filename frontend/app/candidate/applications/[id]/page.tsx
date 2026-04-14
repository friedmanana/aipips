'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { candidateApi } from '@/lib/candidateApi'
import type { JobApplication, CvDocument, CoverLetter } from '@/types'

export default function ApplicationWorkspace() {
  const { id } = useParams<{ id: string }>()
  const [app, setApp] = useState<JobApplication | null>(null)
  const [originalCv, setOriginalCv] = useState<CvDocument | null>(null)
  const [enhancedCv, setEnhancedCv] = useState<CvDocument | null>(null)
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null)
  const [loading, setLoading] = useState(true)

  // inputs
  const [cvInput, setCvInput] = useState('')
  const [jdInput, setJdInput] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')

  // loading states
  const [savingCv, setSavingCv] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [generatingCl, setGeneratingCl] = useState(false)
  const [savingJob, setSavingJob] = useState(false)

  const [copied, setCopied] = useState<'cv' | 'cl' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadApp = useCallback(async () => {
    try {
      const data = await candidateApi.getApplication(id)
      setApp(data)
      setOriginalCv(data.original_cv)
      setEnhancedCv(data.enhanced_cv)
      setCoverLetter(data.cover_letter)
      setJobTitle(data.job_title)
      setCompany(data.company ?? '')
      setJdInput(data.job_description_text ?? '')
      if (data.original_cv) setCvInput(data.original_cv.content_text)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadApp() }, [loadApp])

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleSaveCv = async () => {
    if (!cvInput.trim()) return
    setSavingCv(true)
    setError(null)
    try {
      const saved = await candidateApi.uploadCv(id, cvInput)
      setOriginalCv(saved)
      flash('CV saved')
    } catch (e) { setError(String(e)) }
    finally { setSavingCv(false) }
  }

  const handleSaveJob = async () => {
    setSavingJob(true)
    setError(null)
    try {
      const updated = await candidateApi.updateApplication(id, {
        job_title: jobTitle,
        company,
        job_description_text: jdInput,
      })
      setApp(updated)
      flash('Job details saved')
    } catch (e) { setError(String(e)) }
    finally { setSavingJob(false) }
  }

  const handleEnhanceCv = async () => {
    // Auto-save CV and JD first if changed
    if (cvInput.trim() && cvInput !== originalCv?.content_text) {
      await handleSaveCv()
    }
    if (jdInput !== app?.job_description_text) {
      await handleSaveJob()
    }
    setEnhancing(true)
    setError(null)
    try {
      const enhanced = await candidateApi.enhanceCv(id)
      setEnhancedCv(enhanced)
    } catch (e) { setError(String(e)) }
    finally { setEnhancing(false) }
  }

  const handleGenerateCl = async () => {
    setGeneratingCl(true)
    setError(null)
    try {
      const cl = await candidateApi.generateCoverLetter(id)
      setCoverLetter(cl)
    } catch (e) { setError(String(e)) }
    finally { setGeneratingCl(false) }
  }

  const handleCopy = async (text: string, key: 'cv' | 'cl') => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    )
  }

  if (!app) return <div className="text-center py-12 text-slate-500">Application not found.</div>

  const canEnhance = cvInput.trim().length > 0

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/candidate/dashboard" className="text-sm text-slate-500 hover:text-slate-700">← My Applications</Link>
          <div className="flex items-center gap-3 mt-2">
            <input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              onBlur={handleSaveJob}
              placeholder="Job Title"
              className="text-xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none"
            />
            {company && <span className="text-slate-400">·</span>}
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              onBlur={handleSaveJob}
              placeholder="Organisation"
              className="text-sm text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>
        {successMsg && (
          <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">{successMsg}</span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT COLUMN — Inputs */}
        <div className="space-y-5">

          {/* CV Upload */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Your CV</h2>
                <p className="text-xs text-slate-400 mt-0.5">Paste your current CV text</p>
              </div>
              {cvInput.trim() && (
                <span className="text-xs text-slate-400">{cvInput.split(/\s+/).filter(Boolean).length} words</span>
              )}
            </div>
            <textarea
              value={cvInput}
              onChange={e => setCvInput(e.target.value)}
              rows={14}
              placeholder="Paste your CV here…&#10;&#10;Include work experience, education, skills, and achievements."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
            />
            <button
              onClick={handleSaveCv}
              disabled={savingCv || !cvInput.trim()}
              className="mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {savingCv ? 'Saving…' : originalCv ? 'Update CV' : 'Save CV'}
            </button>
          </div>

          {/* Job Description */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Job Description</h2>
                <p className="text-xs text-slate-400 mt-0.5">Paste from the job ad — AI uses this to tailor your CV</p>
              </div>
              {jdInput.trim() && (
                <span className="text-xs text-slate-400">{jdInput.split(/\s+/).filter(Boolean).length} words</span>
              )}
            </div>
            <textarea
              value={jdInput}
              onChange={e => setJdInput(e.target.value)}
              rows={10}
              placeholder="Paste the full job description here…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
            />
            <button
              onClick={handleSaveJob}
              disabled={savingJob || !jdInput.trim()}
              className="mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {savingJob ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* Enhance button */}
          <button
            onClick={handleEnhanceCv}
            disabled={enhancing || !canEnhance}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {enhancing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Enhancing your CV… (~20s)
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {enhancedCv ? 'Re-enhance CV with AI' : 'Enhance CV with AI'}
              </>
            )}
          </button>
          {!canEnhance && (
            <p className="text-xs text-amber-600 text-center -mt-2">Paste your CV above to get started</p>
          )}
        </div>

        {/* RIGHT COLUMN — Outputs */}
        <div className="space-y-5">

          {/* Enhanced CV */}
          <div className={`bg-white rounded-xl p-5 border ${enhancedCv ? 'border-indigo-200' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {enhancedCv ? '✨ Enhanced CV' : 'Enhanced CV'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {enhancedCv
                    ? `Tailored for ${app.job_title}${app.company ? ` at ${app.company}` : ''}`
                    : 'Will appear here after you click Enhance'}
                </p>
              </div>
              {enhancedCv && (
                <button
                  onClick={() => handleCopy(enhancedCv.content_text, 'cv')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  {copied === 'cv' ? '✓ Copied!' : 'Copy text'}
                </button>
              )}
            </div>
            {enhancedCv ? (
              <div
                className="border border-indigo-100 rounded-lg p-4 bg-indigo-50/20 max-h-[600px] overflow-y-auto text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: enhancedCv.content_html }}
              />
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-10 text-center text-slate-300">
                <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">Your enhanced CV will appear here</p>
              </div>
            )}
          </div>

          {/* Cover Letter */}
          <div className={`bg-white rounded-xl p-5 border ${coverLetter ? 'border-green-200' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {coverLetter ? '✨ Cover Letter' : 'Cover Letter'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">AI-written based on your CV and job description</p>
              </div>
              {coverLetter && (
                <button
                  onClick={() => handleCopy(coverLetter.content_text, 'cl')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  {copied === 'cl' ? '✓ Copied!' : 'Copy text'}
                </button>
              )}
            </div>
            {!originalCv ? (
              <p className="text-xs text-amber-600">Save your CV first before generating a cover letter.</p>
            ) : coverLetter ? (
              <>
                <div
                  className="border border-green-100 rounded-lg p-4 bg-green-50/20 max-h-96 overflow-y-auto text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: coverLetter.content_html }}
                />
                <button
                  onClick={handleGenerateCl}
                  disabled={generatingCl}
                  className="mt-3 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {generatingCl ? 'Regenerating…' : 'Regenerate'}
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerateCl}
                disabled={generatingCl}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {generatingCl ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Generating… (~20s)
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z"/>
                    </svg>
                    Generate Cover Letter
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
